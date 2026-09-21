"""Durable local worker. Run with python -m app.jobs.run_readiness_workflows."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import httpx
from sqlalchemy import select, update
from fastapi import HTTPException
from app.models.rehearsal_workflows import RehearsalWorkflow
from app.repositories import risk_explanations as reservations
from app.services import rehearsal, rehearsal_workflows as workflows
from app.services.rehearsal_provider import generate
from app.schemas.rehearsal_workflows import ReviewOutput


def selection(manifest):
    return SimpleNamespace(requirement_ids=[r['id'] for r in manifest['requirements']],
        evidence_ids=[e['id'] for e in manifest['evidence']])


def run_once(session_factory=None, *, provider=None, now=None):
    """Recover expired dispatches, then process at most one eligible review, without retries.

    External transport accepts (manifest, model), returning {output, usage}; a test adapter
    uses the same interface. A process death after dispatch remains an unknown outcome.
    """
    if session_factory is None:
        from app.core.database import SessionLocal
        session_factory = SessionLocal
    clock = (lambda: now) if now is not None else (lambda: datetime.now(timezone.utc))
    with session_factory() as db:
        db.execute(update(RehearsalWorkflow).where(RehearsalWorkflow.status == 'running',
            RehearsalWorkflow.lease_until <= clock()).values(status='unknown_outcome',
                fence=RehearsalWorkflow.fence + 1, finished_at=clock(),
                failure='Worker lease expired after dispatch. Provider outcome is unknown; review before starting another run.'))
        db.commit()
        candidate = db.scalar(select(RehearsalWorkflow).where(RehearsalWorkflow.status == 'queued')
            .order_by(RehearsalWorkflow.id).limit(1))
        if candidate is None:
            return None
        user_id, project_id, release_id, run_id = candidate.created_by, candidate.project_id, candidate.release_id, candidate.id
        db.rollback()
        reservations.lock_account(db, user_id)
        row = db.scalar(select(RehearsalWorkflow).where(RehearsalWorkflow.id == run_id).with_for_update())
        if row.status != 'queued':
            db.rollback()
            return None
        try:
            rehearsal.owned(db, project_id, release_id, user_id, True)
            prepared = workflows.preview(db, project_id, release_id, user_id, selection(row.manifest))
            if prepared['digest'] != row.digest:
                raise HTTPException(409, 'Release context changed before dispatch. Preview a new review.')
            if provider is None and not prepared['available']:
                raise HTTPException(503, 'OpenAI runtime access is not configured.')
            workflows.admit(db, user_id, excluding=row.id, now=clock())
        except HTTPException as error:
            row.status, row.failure, row.finished_at, row.reserved_tokens = 'failed', str(error.detail), clock(), 0
            db.commit()
            return workflows.read(row)
        row.status, row.dispatched_at, row.lease_until = 'running', clock(), clock() + timedelta(seconds=120)
        row.fence += 1
        fence, manifest = row.fence, row.manifest
        db.commit()
    result, failure, outcome = None, None, 'completed'
    try:
        result = (provider or generate)(manifest, manifest['model'])
        output = ReviewOutput.model_validate(result['output'])
        allowed_requirements = {r['id']: r for r in manifest['requirements']}
        allowed_evidence = {e['id'] for e in manifest['evidence']}
        if {a.requirement_id for a in output.assessments} != set(allowed_requirements):
            raise ValueError('Every selected requirement must have an explicit assessment.')
        if len({a.requirement_id for a in output.assessments}) != len(output.assessments):
            raise ValueError('Duplicate requirement assessments.')
        for assessment in output.assessments:
            if assessment.requirement_id not in allowed_requirements or not set(assessment.evidence_ids) <= allowed_evidence:
                raise ValueError('Unsupported citation.')
        for step in output.next_steps:
            if not set(step.requirement_ids) <= allowed_requirements.keys():
                raise ValueError('Unsupported requirement.')
    except (TimeoutError, ConnectionError, httpx.TransportError):
        outcome, failure = 'unknown_outcome', 'Provider outcome is unknown. No automatic retry was made.'
    except Exception:
        outcome, failure = 'failed', 'Review failed or returned unsupported evidence. Preview before trying again.'
    with session_factory() as db:
        reservations.lock_account(db, user_id)
        # A single lock order with HTTP mutations prevents account/project deadlocks.
        try:
            rehearsal.owned(db, project_id, release_id, user_id, True)
            project_available = True
        except HTTPException:
            project_available = False
        row = db.scalar(select(RehearsalWorkflow).where(RehearsalWorkflow.id == run_id).with_for_update())
        if isinstance(result, dict):
            usage = result.get('usage', {})
            row.usage = {k: v for k, v in (usage if isinstance(usage, dict) else {}).items()
                if k in ('input_tokens', 'output_tokens', 'total_tokens') and type(v) is int and 0 <= v <= 1000000}
        if row.status != 'running' or row.fence != fence:
            db.commit()
            return workflows.read(row)
        if row.lease_until <= clock():
            outcome, failure = 'unknown_outcome', 'Worker lease expired; late output was discarded.'
        if not project_available:
            outcome, failure = 'failed', 'Release became unavailable during review. Output was discarded.'
        if outcome == 'completed':
            try:
                prepared = workflows.preview(db, project_id, release_id, user_id, selection(manifest))
                if prepared['digest'] != row.digest:
                    raise ValueError('Release context changed.')
                from app.schemas.rehearsal import AssessmentInput
                provenance = {'origin': 'ai', 'workflow_id': run_id, 'model': manifest['model'], 'prompt_version': manifest['prompt_version']}
                with db.begin_nested():
                    assessment_ids, next_step_ids = [], []
                    for proposal in output.assessments:
                        data = AssessmentInput(**proposal.model_dump(),
                            requirement_revision=allowed_requirements[proposal.requirement_id]['revision'],
                            scope_id=manifest['scope']['id'])
                        record = rehearsal.create_assessment(db, project_id, release_id, user_id, data, commit=False, provenance=provenance)
                        assessment_ids.append(record['id'])
                    for proposal in output.next_steps:
                        from app.schemas.rehearsal import NextStepInput
                        record = rehearsal.create_next_step(db, project_id, release_id, user_id,
                            NextStepInput(**proposal.model_dump()), commit=False, provenance=provenance)
                        next_step_ids.append(record['id'])
                row.output = {**output.model_dump(), 'assessment_ids': assessment_ids, 'next_step_ids': next_step_ids}
            except Exception:
                outcome, failure = 'failed', 'Review context changed or evidence failed validation. No proposals were saved.'
        row.status, row.failure, row.finished_at = outcome, failure, clock()
        db.commit()
        return workflows.read(row)


def main():
    import argparse
    import time
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    from app.jobs.rehearsal_worker_preflight import wait_until_ready
    try:
        wait_until_ready()
    except (RuntimeError, ValueError):
        parser.exit(1, 'Worker startup checks failed. Confirm configuration and deploy API migrations first.\n')
    while True:
        result = run_once()
        if result:
            print(f"Review {result['id']}: {result['status']}", flush=True)
        if args.once:
            return
        time.sleep(2)


if __name__ == '__main__':
    main()
