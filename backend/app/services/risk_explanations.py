"""Prepare an exact, reviewable packet without network access."""
import hashlib
import json
from fastapi import HTTPException
from app.models.code_risk import FindingOccurrence
from app.services import code_risk
from app.core.config import get_settings
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.models.code_risk import RiskExplanation
from app.models.project import Project
from app.repositories import risk_explanations as repository
from app.schemas.risk_explanations import ExplanationOutput
from app.code_risk.openai_explanations import provider_available, generate

PROMPT_VERSION = 'risk-explanation-v1'


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(',', ':')).encode()).hexdigest()


def preview(db, project_id, occurrence_id, data):
    occurrence = db.get(FindingOccurrence, occurrence_id)
    if occurrence is None:
        raise HTTPException(404, 'Occurrence not found.')
    scan = code_risk.scan_for(db, project_id, occurrence.scan_id)
    evidence = occurrence.evidence
    # Do not include raw scanner messages, source anchors, or arbitrary report fields.
    finding = {k: evidence[k] for k in ('tool', 'rule_id', 'path', 'line', 'severity', 'package', 'versions', 'ecosystem') if k in evidence}
    tool = next(t for t in scan.report['tools'] if t['name'] == evidence['tool'])
    packet = {'evidence': [{'id': 'finding', **finding},
                           {'id': 'coverage', 'tool': tool['name'], 'version': tool['version'],
                            'profile': tool['profile'], 'outcome': tool['outcome']}],
              'limitations': ['User-supplied scanner evidence; no source code or runtime evidence is included.'],
              'snapshot_hash': scan.report['snapshot_hash']}
    identity = {'occurrence_id': occurrence_id, 'packet': packet, 'model': get_settings().code_risk_ai_model, 'prompt_version': PROMPT_VERSION}
    if len(json.dumps(packet).encode()) > 24 * 1024:
        raise HTTPException(422, 'Evidence exceeds the 24 KiB context limit.')
    return {**identity, 'context_digest': digest(identity), 'destination': 'OpenAI API (external)',
            'available': provider_available(), 'unavailable_reason': 'OpenAI runtime access is not configured.'}



def read(record):
    return {key: getattr(record, key) for key in ('id', 'occurrence_id', 'context_digest', 'model',
        'prompt_version', 'status', 'output', 'usage', 'failure', 'created_at', 'finished_at', 'packet')}


def get(db, project_id, explanation_id, user_id):
    repository.expire(db, user_id)
    record = db.scalar(select(RiskExplanation).where(RiskExplanation.id == explanation_id,
        RiskExplanation.project_id == project_id))
    if record is None:
        raise HTTPException(404, 'Explanation not found.')
    db.commit()
    return read(record)


def explain(db, project_id, occurrence_id, user_id, data):
    prepared = preview(db, project_id, occurrence_id, data)
    if prepared['context_digest'] != data.context_digest:
        raise HTTPException(409, 'Evidence or model changed. Preview again before sending.')
    # All callers lock the account first. The lock spans reservation only, never network work.
    repository.lock_account(db, user_id)
    project = db.scalar(select(Project).where(Project.id == project_id).with_for_update())
    if project is None or project.owner_user_id != user_id:
        raise HTTPException(404, 'Project not found.')
    if project.status == 'archived':
        raise HTTPException(409, 'Project is archived.')
    repository.expire(db, user_id)
    existing = repository.by_key(db, user_id, str(data.request_key))
    if existing:
        if existing.context_digest != data.context_digest:
            raise HTTPException(409, 'Request key was already used with different evidence.')
        db.commit()
        return read(existing)
    occurrence = db.get(FindingOccurrence, occurrence_id)
    scan = code_risk.scan_for(db, project_id, occurrence.scan_id)
    code_risk.target_for(db, project_id, scan.target_id, write=True)
    cached = repository.cached(db, user_id, data.context_digest)
    if cached and (not data.regenerate or cached.status == 'pending'):
        repository.remember_key(db, user_id, str(data.request_key), cached.id)
        db.commit()
        return read(cached)
    if not provider_available():
        raise HTTPException(503, 'OpenAI runtime access is not configured.')
    now = datetime.now(timezone.utc)
    if repository.count(db, user_id, pending=True) >= 1 or repository.count(db, user_id, since=now - timedelta(days=1)) >= 20:
        raise HTTPException(429, 'AI limit reached: one active request and 20 requests per rolling day.')
    record = RiskExplanation(project_id=project_id, occurrence_id=occurrence_id, created_by=user_id,
        request_key=str(data.request_key), context_digest=data.context_digest, model=prepared['model'],
        prompt_version=PROMPT_VERSION, packet=prepared['packet'], status='pending', expires_at=now + timedelta(seconds=90))
    db.add(record)
    db.flush()
    record_id = record.id
    repository.remember_key(db, user_id, str(data.request_key), record_id)
    db.commit()
    try:
        result = generate(prepared['packet'], prepared['model'])
        output = ExplanationOutput.model_validate(result['output'])
        allowed_paths = {prepared['packet']['evidence'][0]['path']}
        if not set(output.work_item.affected_files).issubset(allowed_paths):
            raise ValueError('Unsupported file citation.')
        safe_output = output.model_dump()
        usage = {k: v for k, v in result.get('usage', {}).items()
                 if k in ('input_tokens', 'output_tokens', 'total_tokens') and type(v) is int and 0 <= v <= 1000000}
        outcome, failure = 'completed', None
    except Exception:
        # Provider messages may repeat submitted context. Never persist or expose them.
        safe_output, usage = None, None
        outcome, failure = 'failed', 'Explanation failed or returned unsupported evidence. Retry explicitly after reviewing the packet.'
    record = db.scalar(select(RiskExplanation).where(RiskExplanation.id == record_id).with_for_update())
    if record.status == 'pending':
        record.status, record.failure = outcome, failure
        record.output, record.usage = safe_output, usage
        record.finished_at = datetime.now(timezone.utc)
    db.commit()
    return read(record)
