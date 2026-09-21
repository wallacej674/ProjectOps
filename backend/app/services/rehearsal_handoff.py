"""Portable assignments and frozen human decisions behind owned release interfaces."""
import json
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, func
from app.models.rehearsal import RehearsalAssessment, RehearsalEvidence, RequirementDisposition
from app.models.rehearsal_handoff import RehearsalDecision
from app.services import rehearsal


def bounded_manifest(value, limit=256 * 1024):
    manifest = jsonable_encoder(value)
    if len(json.dumps(manifest, ensure_ascii=True).encode()) > limit:
        raise HTTPException(413, 'Selected context exceeds the export limit. Narrow the selected scope.')
    return manifest


def frozen_evidence(db, release, row):
    return rehearsal.read_scoped_evidence(db, release, row)


def decision_preview(db, project_id, release_id, user_id):
    release = rehearsal.owned(db, project_id, release_id, user_id)
    summary = rehearsal.summary(db, project_id, release_id, user_id)
    assessments = []
    for requirement in summary['requirements']:
        if requirement['assessment_id']:
            row = db.get(RehearsalAssessment, requirement['assessment_id'])
            assessments.append(rehearsal.read_assessment(db, release, row))
    cited_ids = {identity for assessment in assessments for identity in assessment['evidence_ids']}
    evidence = [frozen_evidence(db, release, row) for row in db.scalars(
        select(RehearsalEvidence).where(RehearsalEvidence.release_id == release_id,
            RehearsalEvidence.id.in_(cited_ids)).order_by(RehearsalEvidence.id))]
    current = rehearsal.current_scope(db, release_id)
    current_revisions = {item['id']: item['requirement_revision'] for item in summary['requirements']}
    unreviewed = []
    if current:
        from app.models.rehearsal import RehearsalScope
        rows = db.scalars(select(RehearsalEvidence).join(RehearsalScope).where(
            RehearsalEvidence.release_id == release_id, RehearsalEvidence.id.notin_(cited_ids),
            RehearsalScope.source == current.source, RehearsalScope.environment == current.environment,
            RehearsalScope.brief_revision == current.brief_revision).order_by(RehearsalEvidence.id))
        for row in rows:
            if current_revisions.get(row.requirement_id) == row.requirement_revision:
                record = frozen_evidence(db, release, row)
                record.pop('payload')
                unreviewed.append(record)
    historical_count = db.scalar(select(func.count()).select_from(RehearsalEvidence).where(
        RehearsalEvidence.release_id == release_id)) - len(evidence) - len(unreviewed)
    dispositions = [{key: getattr(row, key) for key in ('id', 'requirement_id', 'requirement_revision',
        'disposition', 'reason', 'created_by', 'created_at')} for row in db.scalars(
        select(RequirementDisposition).where(RequirementDisposition.release_id == release_id).order_by(RequirementDisposition.id))]
    manifest = bounded_manifest({'schema_version': 1, 'release_id': release_id,
        'brief_revision': release.current_brief_revision, 'summary': summary, 'assessments': assessments,
        'evidence': evidence, 'unreviewed_evidence': unreviewed, 'historical_evidence_count': historical_count,
        'limitations': ['Unreviewed observations are identified by digest and origin; payloads remain in evidence history.'],
        'dispositions': dispositions})
    return {'manifest': manifest, 'digest': rehearsal.digest(manifest)}


def read_decision(row):
    return {key: getattr(row, key) for key in ('id', 'release_id', 'digest', 'decision', 'reason',
                                             'manifest', 'created_by', 'created_at')}


def create_decision(db, project_id, release_id, user_id, data):
    rehearsal.owned(db, project_id, release_id, user_id, True)
    input_digest = rehearsal.digest(data.model_dump(mode='json'))
    existing = db.scalar(select(RehearsalDecision).where(RehearsalDecision.release_id == release_id,
        RehearsalDecision.request_key == str(data.request_key)))
    if existing:
        if existing.input_digest != input_digest:
            raise HTTPException(409, 'Decision request key was already used with different content.')
        return read_decision(existing)
    preview = decision_preview(db, project_id, release_id, user_id)
    if preview['digest'] != data.digest:
        raise HTTPException(409, 'Release evidence changed. Preview the decision again.')
    row = RehearsalDecision(release_id=release_id, request_key=str(data.request_key), input_digest=input_digest,
        digest=data.digest, decision=data.decision, reason=data.reason, manifest=preview['manifest'], created_by=user_id)
    db.add(row)
    db.commit()
    return read_decision(row)


def compare(db, project_id, release_id, user_id, baseline_id):
    current = decision_preview(db, project_id, release_id, user_id)
    if baseline_id is None:
        return {'baseline': None, 'current': current, 'scope_changed': False, 'changes': [],
                'limitations': ['Select a previous Release Decision to compare its frozen evidence with current scope.']}
    baseline = db.scalar(select(RehearsalDecision).where(RehearsalDecision.id == baseline_id,
        RehearsalDecision.release_id == release_id))
    if baseline is None:
        raise HTTPException(404, 'Release Decision not found.')
    before = {row['id']: row for row in baseline.manifest['summary']['requirements']}
    after = {row['id']: row for row in current['manifest']['summary']['requirements']}
    changes = [{'requirement_id': rid, 'before': before.get(rid), 'after': after.get(rid)}
               for rid in sorted(before.keys() | after.keys()) if before.get(rid) != after.get(rid)]
    return {'baseline': read_decision(baseline), 'current': current,
            'scope_changed': baseline.manifest['summary']['scope'] != current['manifest']['summary']['scope'],
            'changes': changes, 'limitations': ['Changes compare supplied evidence and selected scope, not automatic code analysis.']}
