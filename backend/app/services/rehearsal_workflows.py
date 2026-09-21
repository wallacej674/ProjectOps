"""Frozen review manifests and account-shared AI admission."""
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, func, or_
from app.core.config import get_settings
from app.models.rehearsal_workflows import RehearsalWorkflow, RehearsalWorkflowRequest
from app.models.code_risk import RiskExplanation
from app.repositories import risk_explanations as reservations
from app.repositories import releases as releases_repository
from app.services import rehearsal
from app.services.rehearsal_provider import provider_available, input_size

RESERVATION = 27576
LIMITS = {'active_operations': 1, 'calls_per_day': 20, 'tokens_per_day': 600000,
          'input_bytes': 24576, 'output_tokens': 3000, 'calls_per_run': 1}


def token_cost(row):
    usage = row.usage or {}
    if all(type(usage.get(k)) is int and usage[k] >= 0 for k in ('input_tokens', 'output_tokens')):
        return usage['input_tokens'] + usage['output_tokens']
    return getattr(row, 'reserved_tokens', RESERVATION)


def admit(db, user_id, *, excluding=None, now=None):
    now = now or datetime.now(timezone.utc)
    reservations.expire(db, user_id)
    workflows = db.scalars(select(RehearsalWorkflow).where(RehearsalWorkflow.created_by == user_id,
        or_(func.coalesce(RehearsalWorkflow.dispatched_at, RehearsalWorkflow.created_at) >= now - timedelta(days=1),
            RehearsalWorkflow.status.in_(['queued', 'running'])))).all()
    old = db.scalars(select(RiskExplanation).where(RiskExplanation.created_by == user_id,
        RiskExplanation.created_at >= now - timedelta(days=1))).all()
    counted = [r for r in workflows if r.id != excluding and (r.dispatched_at or r.status == 'queued')]
    if any(r.status in ('queued', 'running') for r in counted) or any(r.status == 'pending' for r in old):
        raise HTTPException(429, 'One account AI operation may be active at a time.')
    if len(counted) + len(old) >= 20 or sum(token_cost(r) for r in counted + old) + RESERVATION > 600000:
        raise HTTPException(429, 'Account AI rolling-day call or token limit reached.')


def preview(db, project_id, release_id, user_id, data):
    release = rehearsal.owned(db, project_id, release_id, user_id)
    brief = releases_repository.brief(db, release)
    if brief.confirmed_at is None:
        raise HTTPException(409, 'Confirm the current release brief before preparing an AI review.')
    scope = rehearsal.current_scope(db, release_id)
    if scope is None or scope.brief_revision != release.current_brief_revision:
        raise HTTPException(409, 'Select a current release scope before preparing an AI review.')
    requirements = []
    for rid in sorted(set(data.requirement_ids)):
        row, revision = rehearsal.requirement_for(db, release_id, rid, confirmed=True)
        if revision.brief_revision_id != brief.id:
            raise HTTPException(409, 'Reconfirm requirements for the current release brief.')
        if revision.content['applicability'] != 'applicable':
            raise HTTPException(409, 'Only confirmed applicable requirements can be assessed.')
        requirements.append({'id': row.id, 'revision': revision.revision, 'content': revision.content})
    evidence = [rehearsal.read_scoped_evidence(db, release,
                    rehearsal.evidence_by_id(db, project_id, release_id, user_id, eid))
                for eid in sorted(set(data.evidence_ids))]
    if any(e['requirement_id'] not in data.requirement_ids for e in evidence):
        raise HTTPException(422, 'Selected evidence must belong to a selected requirement.')
    manifest = jsonable_encoder({'release_id': release_id, 'brief_revision': release.current_brief_revision,
        'scope': rehearsal.read_scope(scope), 'requirements': requirements, 'evidence': evidence,
        'model': get_settings().code_risk_ai_model, 'prompt_version': 'rehearsal-v2', 'schema_version': 1,
        'policy_version': 1, 'destination': 'OpenAI API (external)'})
    if input_size(manifest, manifest['model']) > LIMITS['input_bytes']:
        raise HTTPException(422, 'Selected evidence plus review instructions and schema exceeds the 24 KiB AI input limit. Select less evidence.')
    return {'manifest': manifest, 'digest': rehearsal.digest(manifest), 'available': provider_available(), 'limits': LIMITS}


def read(row, now=None):
    now = now or datetime.now(timezone.utc)
    result = {k: getattr(row, k) for k in ('id', 'digest', 'manifest', 'status', 'output', 'usage', 'failure',
        'created_at', 'dispatched_at', 'finished_at')}
    result['warning'] = 'No worker has picked up this review. Start the local readiness worker.' if (
        row.status == 'queued' and now - row.created_at > timedelta(seconds=60)) else None
    return result


def enqueue(db, project_id, release_id, user_id, data):
    reservations.lock_account(db, user_id)
    rehearsal.owned(db, project_id, release_id, user_id, True)
    alias = db.get(RehearsalWorkflowRequest, (user_id, str(data.request_key)))
    existing = db.get(RehearsalWorkflow, alias.workflow_id) if alias else db.scalar(select(RehearsalWorkflow).where(RehearsalWorkflow.created_by == user_id,
        RehearsalWorkflow.request_key == str(data.request_key)))
    if existing:
        if existing.release_id != release_id or existing.digest != data.digest:
            raise HTTPException(409, 'Request key was already used for another review.')
        db.commit()
        return read(existing)
    prepared = preview(db, project_id, release_id, user_id, data)
    if data.digest != prepared['digest']:
        raise HTTPException(409, 'Review context changed. Preview again before sending.')
    cached = db.scalar(select(RehearsalWorkflow).where(RehearsalWorkflow.created_by == user_id,
        RehearsalWorkflow.release_id == release_id, RehearsalWorkflow.digest == data.digest,
        RehearsalWorkflow.status == 'completed').order_by(RehearsalWorkflow.id.desc()).limit(1))
    if cached is not None and not data.regenerate:
        db.add(RehearsalWorkflowRequest(created_by=user_id, request_key=str(data.request_key), workflow_id=cached.id))
        db.commit()
        return read(cached)
    if not prepared['available']:
        raise HTTPException(503, 'OpenAI runtime access is not configured.')
    admit(db, user_id)
    row = RehearsalWorkflow(project_id=project_id, release_id=release_id, created_by=user_id,
        request_key=str(data.request_key), digest=data.digest, manifest=prepared['manifest'])
    db.add(row)
    db.flush()
    db.add(RehearsalWorkflowRequest(created_by=user_id, request_key=str(data.request_key), workflow_id=row.id))
    db.commit()
    return read(row)


def get(db, project_id, release_id, user_id, workflow_id):
    rehearsal.owned(db, project_id, release_id, user_id)
    row = db.scalar(select(RehearsalWorkflow).where(RehearsalWorkflow.id == workflow_id,
        RehearsalWorkflow.release_id == release_id))
    if row is None:
        raise HTTPException(404, 'Workflow not found.')
    return read(row)


def listing(db, project_id, release_id, user_id, offset, limit):
    rehearsal.owned(db, project_id, release_id, user_id)
    query = select(RehearsalWorkflow).where(RehearsalWorkflow.release_id == release_id)
    return {'items': [read(r) for r in db.scalars(query.order_by(RehearsalWorkflow.id.desc()).offset(offset).limit(limit))],
            'total': db.scalar(select(func.count()).select_from(query.subquery()))}


def cancel(db, project_id, release_id, user_id, workflow_id):
    reservations.lock_account(db, user_id)
    rehearsal.owned(db, project_id, release_id, user_id, True)
    row = db.scalar(select(RehearsalWorkflow).where(RehearsalWorkflow.id == workflow_id,
        RehearsalWorkflow.release_id == release_id).with_for_update())
    if row is None:
        raise HTTPException(404, 'Workflow not found.')
    if row.status in ('queued', 'running'):
        row.status, row.finished_at = 'cancelled', datetime.now(timezone.utc)
        row.fence += 1
        row.failure = 'Cancelled. An already dispatched provider request may still finish; its output will be discarded.' if row.dispatched_at else None
        if row.dispatched_at is None:
            row.reserved_tokens = 0
    db.commit()
    return read(row)
