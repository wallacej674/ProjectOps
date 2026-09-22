"""Release-scoped evidence and assessment policy behind the rehearsal interface."""
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import select, delete

from app.models.rehearsal import RehearsalEvidence, RehearsalScope
from app.models.rehearsal import RehearsalAssessment, AssessmentEvidence, AssessmentReview, RequirementDisposition
from app.models.rehearsal import RehearsalNextStep, NextStepRequirement, NextStepDependency, NextStepReview
from app.models.releases import RequirementRevision, ReleaseRequirement, RequirementMaterial
from app.models.project_artifact import ProjectArtifact
from app.models.code_risk import FindingOccurrence, CodeRiskScan, ScanTarget
from app.models.health_check import HealthCheck
from app.models.readiness import ProjectReadinessItem
from app.models.repo_analysis import RepoAnalysis
from app.models.ci_pipeline_run import CiPipelineRun
from fastapi.encoders import jsonable_encoder
from app.repositories import releases as repository
from app.services import releases


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()).hexdigest()


def owned(db, project_id, release_id, user_id, write=False):
    releases.project(db, project_id, user_id, write)
    return releases.release_for(db, project_id, release_id, write)


def current_scope(db, release_id):
    return db.scalar(select(RehearsalScope).where(RehearsalScope.release_id == release_id)
        .order_by(RehearsalScope.version.desc()).limit(1))


def read_scope(row):
    if row is None:
        return None
    return {k: getattr(row, k) for k in ('id', 'version', 'brief_revision', 'source', 'environment', 'created_at')}


def scope_for(db, release_id, scope_id):
    row = db.scalar(select(RehearsalScope).where(RehearsalScope.id == scope_id, RehearsalScope.release_id == release_id))
    if row is None:
        raise HTTPException(404, 'Scope not found.')
    return row


def set_scope(db, project_id, release_id, user_id, data):
    release = owned(db, project_id, release_id, user_id, True)
    brief = repository.brief(db, release)
    if brief.confirmed_at is None:
        raise HTTPException(409, 'Confirm the release brief before selecting evidence scope.')
    previous = current_scope(db, release_id)
    version = previous.version if previous else 0
    if data.version != version:
        raise HTTPException(409, 'Scope changed. Reload before saving.')
    row = RehearsalScope(release_id=release_id, version=version + 1, brief_revision=brief.revision,
        source=data.source.model_dump(), environment=data.environment, created_by=user_id)
    db.add(row)
    db.commit()
    return read_scope(row)


def requirement_for(db, release_id, requirement_id, revision=None, confirmed=False):
    row = releases.requirement_for(db, release_id, requirement_id)
    rev = db.scalar(select(RequirementRevision).where(RequirementRevision.requirement_id == row.id,
        RequirementRevision.revision == (revision or row.current_revision)))
    if rev is None:
        raise HTTPException(404, 'Requirement revision not found.')
    if confirmed and (row.retired or rev.confirmed_at is None):
        raise HTTPException(409, 'A confirmed, active requirement is required.')
    return row, rev


def evidence_by_id(db, project_id, release_id, user_id, evidence_id):
    owned(db, project_id, release_id, user_id)
    row = db.scalar(select(RehearsalEvidence).where(RehearsalEvidence.id == evidence_id,
        RehearsalEvidence.release_id == release_id))
    if row is None:
        raise HTTPException(404, 'Evidence not found.')
    return row


def read_evidence(row):
    return {k: getattr(row, k) for k in ('id', 'requirement_id', 'requirement_revision', 'scope_id',
        'kind', 'origin', 'digest', 'payload', 'limitations', 'created_by', 'created_at')}


def preview_evidence(db, project_id, release_id, user_id, data):
    owned(db, project_id, release_id, user_id)
    _, revision = requirement_for(db, release_id, data.requirement_id, data.requirement_revision, True)
    scope_for(db, release_id, data.scope_id)
    if data.kind == 'verification':
        payload = {'source_id': None, 'verification': data.verification.model_dump(mode='json')}
        origin = 'user_imported'
        limitations = ['User-supplied verification report; execution and source identity are not independently attested.']
    else:
        payload, origin, limitations = source_payload(db, project_id, release_id, data.requirement_id, revision, data.kind, data.source_id)
    if len(json.dumps(payload).encode()) > 256 * 1024:
        raise HTTPException(422, 'Selected observation exceeds the evidence payload limit.')
    evidence = {'requirement_id': data.requirement_id, 'requirement_revision': revision.revision,
        'scope_id': data.scope_id, 'kind': data.kind, 'origin': origin, 'payload': payload,
        'limitations': limitations}
    return {'digest': digest(evidence), 'evidence': evidence, 'limitations': limitations}


def create_evidence(db, project_id, release_id, user_id, data, commit=True):
    owned(db, project_id, release_id, user_id, True)
    input_digest = digest(data.model_dump(mode='json', exclude={'request_key'}))
    existing = db.scalar(select(RehearsalEvidence).where(RehearsalEvidence.release_id == release_id,
        RehearsalEvidence.request_key == str(data.request_key)))
    if existing:
        if existing.input_digest != input_digest:
            raise HTTPException(409, 'Request key was already used for different evidence.')
        return read_evidence(existing)
    prepared = preview_evidence(db, project_id, release_id, user_id, data)
    _, rev = requirement_for(db, release_id, data.requirement_id, data.requirement_revision)
    row = RehearsalEvidence(release_id=release_id, request_key=str(data.request_key), input_digest=input_digest,
        requirement_revision_id=rev.id, digest=prepared['digest'], created_by=user_id, **prepared['evidence'])
    field = {'material': 'material_id', 'scan': 'occurrence_id', 'health': 'health_check_id',
        'readiness': 'readiness_id', 'analysis': 'analysis_id', 'ci': 'ci_run_id'}.get(data.kind)
    if field:
        setattr(row, field, data.source_id)
    db.add(row)
    db.flush()
    if commit:
        db.commit()
    return read_evidence(row)


def freshness(db, release, scope, revision):
    reasons = []
    current = current_scope(db, release.id)
    requirement = db.get(ReleaseRequirement, revision.requirement_id)
    brief = repository.brief(db, release)
    if requirement.current_revision != revision.revision or requirement.retired:
        reasons.append('Requirement revision changed or was retired.')
    if revision.brief_revision_id != brief.id or brief.confirmed_at is None or scope.brief_revision != brief.revision:
        reasons.append('Release brief changed or needs confirmation.')
    if current is None:
        return 'unknown', reasons + ['No current source and environment scope selected.']
    if scope.source != current.source:
        reasons.append('Source snapshot or file inventory changed; impact needs review.')
    if scope.environment != current.environment:
        reasons.append('Verification environment changed.')
    if reasons:
        return 'stale', reasons
    if not scope.source.get('target') or not scope.source.get('snapshot') or not scope.environment:
        return 'unknown', ['Source identity or environment is unknown.']
    return 'current', []


def assessment_evidence(db, assessment_id):
    return list(db.scalars(select(RehearsalEvidence).join(AssessmentEvidence)
        .where(AssessmentEvidence.assessment_id == assessment_id).order_by(RehearsalEvidence.id)))


def matching_scope_ids(db, scope):
    return select(RehearsalScope.id).where(RehearsalScope.release_id == scope.release_id,
        RehearsalScope.brief_revision == scope.brief_revision, RehearsalScope.source == scope.source,
        RehearsalScope.environment == scope.environment)


def read_scoped_evidence(db, release, row):
    if row.release_id != release.id:
        raise HTTPException(404, 'Evidence not found in this Release.')
    scope = scope_for(db, release.id, row.scope_id)
    revision = db.get(RequirementRevision, row.requirement_revision_id)
    state, reasons = freshness(db, release, scope, revision)
    if row.kind in ('health', 'readiness', 'analysis', 'ci') and state == 'current':
        state = 'unknown'
        reasons.append('This observation has no verified source snapshot or environment association.')
    if row.kind == 'scan' and row.payload.get('source_snapshot') != scope.source.get('snapshot'):
        state = 'stale'
        reasons.append('Scanner snapshot differs from the selected evidence scope.')
    if row.kind == 'readiness':
        source = db.get(ProjectReadinessItem, row.readiness_id)
        if source is None or source.updated_at.isoformat() != row.payload['snapshot']['updated_at']:
            state = 'stale'
            reasons.append('Baseline readiness observation changed after selection.')
    if row.kind == 'material':
        material = db.get(RequirementMaterial, row.material_id)
        artifact = repository.artifact_for(db, release.project_id, material.artifact_id) if material else None
        if artifact is None or releases.artifact_snapshot(artifact) != row.payload['snapshot']:
            state = 'stale'
            reasons.append('Linked material source changed; review the frozen evidence.')
    return {**read_evidence(row), 'scope': read_scope(scope), 'freshness': state,
        'freshness_reasons': reasons, 'reasons': reasons}


def read_assessment(db, release, row):
    scope = scope_for(db, release.id, row.scope_id)
    revision = db.get(RequirementRevision, row.requirement_revision_id)
    state, reasons = freshness(db, release, scope, revision)
    evidence = assessment_evidence(db, row.id)
    newer = db.scalar(select(RehearsalEvidence.id).where(RehearsalEvidence.requirement_id == row.requirement_id,
        RehearsalEvidence.requirement_revision == row.requirement_revision,
        RehearsalEvidence.scope_id.in_(matching_scope_ids(db, scope)), RehearsalEvidence.created_at > row.created_at).limit(1))
    if newer:
        state = 'stale'
        reasons.append('New evidence was imported after this assessment; reassess the selected scope.')
    for item in evidence:
        scoped = read_scoped_evidence(db, release, item)
        if scoped['freshness'] == 'stale' or scoped['freshness'] == 'unknown' and state == 'current':
            state = scoped['freshness']
        reasons.extend(scoped['freshness_reasons'])
    reasons = list(dict.fromkeys(reasons))
    result = {k: getattr(row, k) for k in ('id', 'requirement_id', 'requirement_revision', 'scope_id', 'outcome',
        'rationale', 'limitations', 'version', 'review_status', 'provenance', 'created_by', 'created_at')}
    reviews = db.scalars(select(AssessmentReview).where(AssessmentReview.assessment_id == row.id).order_by(AssessmentReview.id))
    return {**result, 'evidence_ids': [e.id for e in evidence], 'freshness': state, 'reasons': reasons,
        'state': 'stale' if state == 'stale' else row.outcome,
        'reviews': [{k: getattr(r, k) for k in ('id', 'action', 'reason', 'created_by', 'created_at')} for r in reviews]}


def create_assessment(db, project_id, release_id, user_id, data, commit=True, provenance=None):
    release = owned(db, project_id, release_id, user_id, True)
    requirement, rev = requirement_for(db, release_id, data.requirement_id, data.requirement_revision, True)
    scope = scope_for(db, release_id, data.scope_id)
    if requirement.current_revision != rev.revision or rev.content['applicability'] != 'applicable':
        raise HTTPException(409, 'Assessment requires the current, confirmed applicable requirement.')
    if rev.brief_revision_id != repository.brief(db, release).id:
        raise HTTPException(409, 'Requirement needs confirmation against the current brief.')
    evidence = [evidence_by_id(db, project_id, release_id, user_id, identity) for identity in data.evidence_ids]
    compatible_ids = set(db.scalars(matching_scope_ids(db, scope)))
    for item in evidence:
        if item.requirement_id != requirement.id or item.requirement_revision != rev.revision or item.scope_id not in compatible_ids:
            raise HTTPException(422, 'Evidence must address this requirement revision and an equivalent source/environment scope.')
    if data.outcome != 'not_verified' and not evidence:
        raise HTTPException(422, 'An assessed outcome requires relevant evidence.')
    def executed_outcomes(items):
        return {item.payload['verification']['outcome'] for item in items
            if item.kind == 'verification' and item.payload.get('verification', {}).get('executed')
            and item.payload['verification']['criterion'].strip() == rev.content['criterion'].strip()}
    selected_outcomes = executed_outcomes(evidence)
    comparable = list(db.scalars(select(RehearsalEvidence).where(RehearsalEvidence.requirement_id == requirement.id,
        RehearsalEvidence.requirement_revision == rev.revision, RehearsalEvidence.scope_id.in_(compatible_ids))))
    all_outcomes = executed_outcomes(comparable)
    if data.outcome == 'supported':
        if freshness(db, release, scope, rev)[0] != 'current':
            raise HTTPException(422, 'Current known source and environment scope is required for support.')
        if 'passed' not in selected_outcomes or 'failed' in all_outcomes:
            raise HTTPException(422, 'Support requires a relevant executed pass without unresolved contradictory current evidence.')
    if data.outcome == 'gap_found' and 'failed' not in selected_outcomes and not any(item.kind == 'scan' for item in evidence):
        raise HTTPException(422, 'A gap needs relevant observed contrary evidence; absent verification remains unknown.')
    if data.outcome == 'gap_found' and all_outcomes == {'passed', 'failed'}:
        raise HTTPException(422, 'Comparable passing and failing checks require a conflicting assessment.')
    if data.outcome == 'conflicting' and selected_outcomes != {'passed', 'failed'}:
        raise HTTPException(422, 'Conflict requires comparable executed passing and failing evidence.')
    row = RehearsalAssessment(release_id=release_id, requirement_revision_id=rev.id, created_by=user_id, provenance=provenance or {'origin': 'human'},
        **data.model_dump(exclude={'evidence_ids'}))
    db.add(row)
    db.flush()
    for item in evidence:
        db.add(AssessmentEvidence(assessment_id=row.id, evidence_id=item.id))
    db.flush()
    if commit:
        db.commit()
    return read_assessment(db, release, row)


def review_assessment(db, project_id, release_id, assessment_id, user_id, data):
    release = owned(db, project_id, release_id, user_id, True)
    row = db.scalar(select(RehearsalAssessment).where(RehearsalAssessment.id == assessment_id,
        RehearsalAssessment.release_id == release_id))
    if row is None:
        raise HTTPException(404, 'Assessment not found.')
    releases.check_version(row, data.version)
    if row.review_status == 'superseded':
        raise HTTPException(409, 'Superseded assessments remain historical. Create a new assessment.')
    row.review_status = 'accepted' if data.action == 'accept' else 'superseded'
    row.version += 1
    db.add(AssessmentReview(assessment_id=row.id, action=data.action, reason=data.reason, created_by=user_id))
    db.commit()
    return read_assessment(db, release, row)


def disposition(db, project_id, release_id, requirement_id, user_id, data):
    owned(db, project_id, release_id, user_id, True)
    _, rev = requirement_for(db, release_id, requirement_id)
    row = RequirementDisposition(release_id=release_id, requirement_id=requirement_id, requirement_revision=rev.revision,
        created_by=user_id, **data.model_dump())
    db.add(row)
    db.commit()
    return {k: getattr(row, k) for k in ('id', 'requirement_id', 'requirement_revision', 'disposition', 'reason', 'created_by', 'created_at')}


def summary(db, project_id, release_id, user_id):
    release = owned(db, project_id, release_id, user_id)
    result = []
    for row in db.scalars(select(ReleaseRequirement).where(ReleaseRequirement.release_id == release_id).order_by(ReleaseRequirement.id)):
        rev = repository.requirement_revision(db, row)
        assessment = db.scalar(select(RehearsalAssessment).where(RehearsalAssessment.requirement_id == row.id,
            RehearsalAssessment.review_status == 'accepted').order_by(RehearsalAssessment.id.desc()).limit(1))
        status = read_assessment(db, release, assessment) if assessment else None
        disposition = db.scalar(select(RequirementDisposition).where(RequirementDisposition.requirement_id == row.id,
            RequirementDisposition.requirement_revision == rev.revision).order_by(RequirementDisposition.id.desc()).limit(1))
        result.append({'id': row.id, 'requirement_revision': rev.revision, **rev.content,
            'lifecycle': 'retired' if row.retired else 'confirmed' if rev.confirmed_at else 'proposed',
            'state': status['state'] if status else 'not_verified', 'outcome': status['outcome'] if status else 'not_verified',
            'freshness': status['freshness'] if status else 'unknown',
            'reasons': status['reasons'] if status else ['No accepted assessment.'],
            'assessment_id': assessment.id if assessment else None, 'disposition': disposition.disposition if disposition else 'open',
            'disposition_reason': disposition.reason if disposition else None})
    steps = list(db.scalars(select(RehearsalNextStep).where(RehearsalNextStep.release_id == release_id,
        RehearsalNextStep.status.notin_(['closed', 'cancelled']))))
    ranked = sorted([read_next_step(db, row) for row in steps], key=lambda row: (row['blocked'], -row['priority_rank'], row['id']))
    return {'scope': read_scope(current_scope(db, release_id)), 'requirements': result, 'next_steps': ranked[:3],
        'limitations': ['Supplied evidence supports a human release decision; it does not certify production safety.']}


def next_step_for(db, release_id, next_step_id):
    row = db.scalar(select(RehearsalNextStep).where(RehearsalNextStep.id == next_step_id,
        RehearsalNextStep.release_id == release_id))
    if row is None:
        raise HTTPException(404, 'Next Step not found.')
    return row


def read_next_step(db, row):
    consequences = []
    urgency = 0
    needs_review = False
    release = db.get(releases.Release, row.release_id)
    for identity in row.content['requirement_ids']:
        requirement, rev = requirement_for(db, row.release_id, identity, row.content['requirement_revisions'][str(identity)])
        needs_review = needs_review or requirement.current_revision != rev.revision or requirement.retired
        consequences.append(rev.content['consequence'])
        assessment = db.scalar(select(RehearsalAssessment).where(RehearsalAssessment.requirement_id == identity,
            RehearsalAssessment.requirement_revision == rev.revision, RehearsalAssessment.review_status == 'accepted')
            .order_by(RehearsalAssessment.id.desc()).limit(1))
        assessed = read_assessment(db, release, assessment) if assessment else None
        effective = assessment.outcome if assessed and assessed['freshness'] == 'current' else 'not_verified'
        needs_review = needs_review or bool(assessed and assessed['freshness'] != 'current')
        urgency = max(urgency, {'supported': 0, 'not_verified': 1, 'gap_found': 2, 'conflicting': 3}[effective])
    consequence = max(consequences, key=lambda value: {'low': 1, 'medium': 2, 'high': 3}[value])
    blocked = any(next_step_for(db, row.release_id, identity).status != 'closed' for identity in row.content['dependencies'])
    history = db.scalars(select(NextStepReview).where(NextStepReview.next_step_id == row.id).order_by(NextStepReview.id))
    return {'id': row.id, 'version': row.version, 'status': row.status, **row.content,
        'priority': consequence, 'priority_rank': {'low': 1, 'medium': 2, 'high': 3}[consequence] * 10 + urgency,
        'priority_rationale': f'{consequence.title()} confirmed consequence; ' +
            ('prerequisite verification is still open.' if blocked else 'scope or evidence changed and needs review.' if needs_review else 'ordered by unresolved evidence, then stable creation order.'),
        'priority_policy': 'consequence-evidence-dependencies-v1', 'blocked': blocked,
        'created_by': row.created_by, 'created_at': row.created_at, 'provenance': row.provenance,
        'history': [{k: getattr(review, k) for k in ('id', 'status', 'reason', 'evidence_ids', 'content_snapshot', 'created_by', 'created_at')} for review in history]}


def create_next_step(db, project_id, release_id, user_id, data, commit=True, provenance=None):
    release = owned(db, project_id, release_id, user_id, True)
    revisions = {}
    brief = repository.brief(db, release)
    for identity in data.requirement_ids:
        _, revision = requirement_for(db, release_id, identity, confirmed=True)
        if revision.brief_revision_id != brief.id or brief.confirmed_at is None or revision.content['applicability'] != 'applicable':
            raise HTTPException(409, 'Next Steps require confirmed current applicable requirements.')
        revisions[str(identity)] = revision.revision
    for identity in data.dependencies:
        next_step_for(db, release_id, identity)
    # Dependencies reference preexisting immutable assignments, so a new node cannot form a cycle.
    row = RehearsalNextStep(release_id=release_id, content={**data.model_dump(), 'requirement_revisions': revisions}, created_by=user_id, provenance=provenance or {'origin': 'human'})
    db.add(row)
    db.flush()
    for identity in data.requirement_ids:
        db.add(NextStepRequirement(next_step_id=row.id, requirement_id=identity))
    for identity in data.dependencies:
        db.add(NextStepDependency(next_step_id=row.id, dependency_id=identity))
    db.flush()
    if commit:
        db.commit()
    return read_next_step(db, row)


def transition_next_step(db, project_id, release_id, next_step_id, user_id, data, commit=True):
    release = owned(db, project_id, release_id, user_id, True)
    row = next_step_for(db, release_id, next_step_id)
    releases.check_version(row, data.version)
    transitions = {'proposed': {'accepted', 'cancelled'}, 'accepted': {'in_progress', 'awaiting_verification', 'cancelled'},
        'in_progress': {'awaiting_verification', 'cancelled'}, 'awaiting_verification': {'in_progress', 'closed', 'cancelled'},
        'closed': set(), 'cancelled': set()}
    if data.status not in transitions[row.status]:
        raise HTTPException(409, 'This Next Step transition is not available.')
    if data.status in ('in_progress', 'closed') and read_next_step(db, row)['blocked']:
        raise HTTPException(409, 'Complete prerequisite verification before proceeding.')
    evidence = [evidence_by_id(db, project_id, release_id, user_id, identity) for identity in data.evidence_ids]
    for item in evidence:
        if item.requirement_id not in row.content['requirement_ids']:
            raise HTTPException(422, 'Verification evidence must address this assignment.')
    if data.status == 'closed':
        current = current_scope(db, release_id)
        covered = set()
        for item in evidence:
            _, rev = requirement_for(db, release_id, item.requirement_id)
            fresh, _ = freshness(db, release, scope_for(db, release_id, item.scope_id), rev)
            report = item.payload.get('verification')
            if item.requirement_revision != rev.revision or fresh != 'current' or current is None:
                raise HTTPException(409, 'Verification evidence is stale or has unknown scope.')
            if report and report['executed'] and report['outcome'] != 'not_run' and report['criterion'] == rev.content['criterion']:
                covered.add(item.requirement_id)
        if covered != set(row.content['requirement_ids']):
            raise HTTPException(422, 'Review an executed verification record for every linked requirement.')
    row.status, row.version = data.status, row.version + 1
    db.add(NextStepReview(next_step_id=row.id, status=data.status, reason=data.reason,
        evidence_ids=data.evidence_ids, created_by=user_id))
    db.flush()
    if commit:
        db.commit()
    return read_next_step(db, row)


def list_records(db, project_id, release_id, user_id, model, reader, offset=0, limit=25):
    owned(db, project_id, release_id, user_id)
    rows, total = repository.page(db, select(model).where(model.release_id == release_id).order_by(model.id.desc()), offset, limit)
    return {'items': [reader(row) for row in rows], 'total': total}


def source_query(kind, project_id, revision):
    if kind == 'material':
        return select(RequirementMaterial).where(RequirementMaterial.requirement_revision_id == revision.id)
    if kind == 'scan':
        return select(FindingOccurrence).join(CodeRiskScan).join(ScanTarget).where(ScanTarget.project_id == project_id)
    model = {'health': HealthCheck, 'readiness': ProjectReadinessItem, 'analysis': RepoAnalysis, 'ci': CiPipelineRun}.get(kind)
    if model is None:
        raise HTTPException(422, 'Unsupported evidence source.')
    return select(model).where(model.project_id == project_id)


def source_payload(db, project_id, release_id, requirement_id, revision, kind, source_id):
    query = source_query(kind, project_id, revision)
    model = query.column_descriptions[0]['entity']
    source = db.scalar(query.where(model.id == source_id))
    if source is None:
        raise HTTPException(404, 'Evidence source not found in this Project and requirement scope.')
    if kind == 'material':
        artifact = repository.artifact_for(db, project_id, source.artifact_id)
        if artifact is None:
            raise HTTPException(404, 'Material source not found.')
        return {'source_id': source_id, 'snapshot': source.snapshot, 'source_digest': source.digest}, 'manual_assertion', [
            'A frozen supporting note is context, not proof that verification ran.']
    if kind == 'scan':
        scan = db.get(CodeRiskScan, source.scan_id)
        report = scan.report
        finding = {key: value for key, value in source.evidence.items() if key in
            ('tool', 'rule_id', 'path', 'line', 'severity', 'package', 'version', 'versions', 'ecosystem', 'advisory_url')}
        tool = next(item for item in report['tools'] if item['name'] == finding['tool'])
        payload = {'source_id': source_id, 'scan_id': scan.id, 'source_snapshot': report['snapshot_hash'],
            'target_id': scan.target_id, 'finding': finding,
            'tool': {key: tool[key] for key in ('name', 'version', 'profile', 'outcome', 'covered_files')},
            'exclusions': report['exclusions'], 'observed_at': report['finished_at'],
            'file_digest': report['files'].get(finding['path'])}
        return payload, 'user_imported', ['Imported scanner observation; tool coverage is not behavioral coverage or proof of exploitability.']
    fields = {'health': ('target_url', 'status', 'execution_source', 'http_status_code', 'response_time_ms', 'checked_at'),
        'readiness': ('status', 'source', 'evidence', 'notes', 'evaluated_at', 'updated_at'),
        'analysis': ('status', 'summary', 'analysis_version', 'detected_stack', 'signals', 'warnings', 'insights', 'evidence_files', 'created_at'),
        'ci': ('workflow_name', 'status', 'conclusion', 'branch', 'commit_sha', 'run_started_at', 'run_completed_at', 'html_url')}
    snapshot = jsonable_encoder({key: getattr(source, key) for key in fields[kind]})
    limitation = {'health': 'Endpoint reachability does not verify a customer journey; deployed code identity is unknown.',
        'readiness': 'Baseline checklist observation does not establish release-specific behavior; source identity is unknown.',
        'analysis': 'Bounded repository configuration observations do not establish behavior or a verified source snapshot.',
        'ci': 'A CI run result supports buildability of the observed commit; it does not verify deployment, runtime behavior, or business correctness.'}[kind]
    origin = 'manual_assertion' if kind == 'readiness' and source.source == 'manual' else 'projectops_observation'
    return {'source_id': source_id, 'source_snapshot': None, 'snapshot': snapshot}, origin, [limitation]


def source_options(db, project_id, release_id, user_id, kind, requirement_id, offset=0, limit=25):
    owned(db, project_id, release_id, user_id)
    _, revision = requirement_for(db, release_id, requirement_id)
    query = source_query(kind, project_id, revision)
    model = query.column_descriptions[0]['entity']
    rows, total = repository.page(db, query.order_by(model.id.desc()), offset, limit)
    def title(row):
        if kind == 'material':
            return row.snapshot['title']
        if kind == 'scan':
            return f"{row.evidence['rule_id']} - {row.evidence['path']}"
        if kind == 'health':
            return f"{row.status}: {row.target_url}"
        if kind == 'readiness':
            return f"{row.item.label}: {row.status}"
        if kind == 'ci':
            return f"{row.conclusion or row.status}: {row.workflow_name} #{row.run_number}"
        return f"Repository observations #{row.id}: {row.status}"
    return {'items': [{'id': row.id, 'title': title(row)} for row in rows], 'total': total}


def update_next_step(db, project_id, release_id, next_step_id, user_id, data):
    release = owned(db, project_id, release_id, user_id, True)
    row = next_step_for(db, release_id, next_step_id)
    releases.check_version(row, data.version)
    if row.status not in ('proposed', 'accepted'):
        raise HTTPException(409, 'Only proposed or accepted assignments may be revised.')
    revisions = {}
    brief = repository.brief(db, release)
    for identity in data.requirement_ids:
        _, revision = requirement_for(db, release_id, identity, confirmed=True)
        if revision.brief_revision_id != brief.id or brief.confirmed_at is None or revision.content['applicability'] != 'applicable':
            raise HTTPException(409, 'Confirm current applicable requirements before revising the assignment.')
        revisions[str(identity)] = revision.revision
    pending = list(data.dependencies)
    visited = set()
    while pending:
        identity = pending.pop()
        if identity == row.id:
            raise HTTPException(422, 'Next Step dependencies cannot form a cycle.')
        if identity in visited:
            continue
        visited.add(identity)
        dependency = next_step_for(db, release_id, identity)
        pending.extend(dependency.content['dependencies'])
    db.add(NextStepReview(next_step_id=row.id, status='revised', reason='Assignment revised; confirmation is required again.',
        evidence_ids=[], content_snapshot={**row.content, 'version': row.version}, created_by=user_id))
    row.content = {**data.model_dump(exclude={'version'}), 'requirement_revisions': revisions}
    row.version += 1
    row.status = 'proposed'
    db.execute(delete(NextStepRequirement).where(NextStepRequirement.next_step_id == row.id))
    db.execute(delete(NextStepDependency).where(NextStepDependency.next_step_id == row.id))
    for identity in data.requirement_ids:
        db.add(NextStepRequirement(next_step_id=row.id, requirement_id=identity))
    for identity in data.dependencies:
        db.add(NextStepDependency(next_step_id=row.id, dependency_id=identity))
    db.commit()
    return read_next_step(db, row)
