import hashlib
import json
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.code_risk import ScanTarget, CodeRiskScan, RiskFinding, FindingOccurrence, RiskWorkItem, WorkItemFinding, RiskExplanation
from app.schemas.code_risk import ScanReport


def target_for(db: Session, project_id: int, target_id: int, *, write=False):
    query = select(ScanTarget).where(ScanTarget.id == target_id, ScanTarget.project_id == project_id)
    if write:
        query = query.with_for_update()
    target = db.scalar(query)
    if target is None:
        raise HTTPException(404, 'Scan target not found.')
    if write and target.archived:
        raise HTTPException(409, 'Scan target is archived.')
    return target


def scan_for(db: Session, project_id: int, scan_id: int):
    scan = db.get(CodeRiskScan, scan_id)
    if scan is None:
        raise HTTPException(404, 'Scan not found.')
    target_for(db, project_id, scan.target_id)
    return scan


def scan_read(scan, summary=False):
    report = scan.report
    if summary:
        report = {**report, 'files': {}, 'tools': [{**t, 'covered_files': []} for t in report['tools']]}
    return {'id': scan.id, 'target_id': scan.target_id, 'outcome': scan.outcome,
            'imported_at': scan.imported_at, 'imported_by': scan.imported_by, 'report': report}


def fingerprint(evidence):
    parts = [evidence.tool, evidence.rule_id, evidence.path, evidence.ecosystem, evidence.package,
             evidence.anchor if evidence.tool == 'semgrep' else None]
    return hashlib.sha256(json.dumps(parts, sort_keys=True).encode()).hexdigest()


def import_scan(db, project_id, target_id, user_id, report: ScanReport, digest):
    target_for(db, project_id, target_id, write=True)
    if report.target_id != target_id:
        raise HTTPException(422, 'Report target does not match the selected target.')
    existing = db.scalar(select(CodeRiskScan).where(CodeRiskScan.target_id == target_id, CodeRiskScan.run_id == str(report.run_id)))
    if existing:
        if existing.digest != digest:
            raise HTTPException(409, 'Run ID already imported with different bytes.')
        return existing
    outcomes = [t.outcome for t in report.tools]
    outcome = 'completed' if all(o == 'completed' for o in outcomes) else 'partial' if any(o in ('completed', 'partial') for o in outcomes) else 'failed'
    payload = report.model_dump(mode='json')
    # Occurrence evidence is stored once; report metadata retains only coverage.
    payload.pop('findings')
    scan = CodeRiskScan(target_id=target_id, run_id=str(report.run_id), digest=digest,
                        outcome=outcome, report=payload, imported_by=user_id)
    db.add(scan)
    db.flush()
    seen = set()
    for evidence in report.findings:
        key = fingerprint(evidence)
        if key in seen:
            raise HTTPException(422, 'Ambiguous duplicate finding identity in report.')
        seen.add(key)
        finding = db.scalar(select(RiskFinding).where(RiskFinding.target_id == target_id, RiskFinding.fingerprint == key))
        if finding is None:
            finding = RiskFinding(target_id=target_id, fingerprint=key)
            db.add(finding)
            db.flush()
        db.add(FindingOccurrence(scan_id=scan.id, finding_id=finding.id, evidence=evidence.model_dump()))
    from app.models.project_activity import ProjectActivityEvent
    db.add(ProjectActivityEvent(project_id=project_id, event_type='code_risk_scan_imported', event_category='codemap',
        message=f'Code risk scan imported: {outcome}.', related_resource_type='code_risk_scan', related_resource_id=scan.id))
    db.commit()
    db.refresh(scan)
    return scan


def occurrences(db, scan_id):
    return db.execute(select(FindingOccurrence, RiskFinding).join(RiskFinding, FindingOccurrence.finding_id == RiskFinding.id)
                      .where(FindingOccurrence.scan_id == scan_id).order_by(FindingOccurrence.id)).all()


def occurrence_read(occ, finding):
    return {'id': occ.id, 'finding_id': finding.id, 'scan_id': occ.scan_id, 'evidence': occ.evidence,
            'disposition': finding.disposition, 'review_version': finding.review_version,
            'review_history': finding.review_history,
            'needs_review': bool(finding.review_history and finding.review_history[-1]['evidence_digest'] != evidence_digest(occ.evidence))}


def finding_for(db, project_id, finding_id):
    finding = db.get(RiskFinding, finding_id)
    if finding is None:
        raise HTTPException(404, 'Finding not found.')
    target_for(db, project_id, finding.target_id)
    return finding


def evidence_digest(evidence):
    # Line shifts do not invalidate a review, but changed evidence does.
    return hashlib.sha256(json.dumps({k: v for k, v in evidence.items() if k != 'line'}, sort_keys=True).encode()).hexdigest()


def review_finding(db, project_id, finding_id, user_id, data):
    from datetime import datetime, timezone
    finding = finding_for(db, project_id, finding_id)
    target_for(db, project_id, finding.target_id, write=True)
    db.refresh(finding, with_for_update=True)
    if finding.review_version != data.version:
        raise HTTPException(409, 'Review changed. Reload before saving.')
    occurrence = db.get(FindingOccurrence, data.occurrence_id)
    if not occurrence or occurrence.finding_id != finding.id:
        raise HTTPException(404, 'Finding occurrence not found.')
    finding.disposition = data.disposition
    finding.review_version += 1
    finding.review_history = [*finding.review_history, {
        'disposition': data.disposition, 'reason': data.reason, 'user_id': user_id,
        'at': datetime.now(timezone.utc).isoformat(), 'evidence_digest': evidence_digest(occurrence.evidence),
        'occurrence_id': occurrence.id}]
    db.commit()
    return occurrence_read(occurrence, finding)


def comparison(db, current, baseline):
    if current.target_id != baseline.target_id:
        raise HTTPException(422, 'Comparison requires the same target.')
    new = {f.id: (o, f) for o, f in occurrences(db, current.id)}
    old = {f.id: (o, f) for o, f in occurrences(db, baseline.id)}
    tools = {t['name']: t for t in current.report['tools']}
    previous = {t['name']: t for t in baseline.report['tools']}

    def covered(evidence, source, other):
        tool, before = source.get(evidence['tool']), other.get(evidence['tool'])
        return (evidence.get('confidence') != 'ambiguous-location' and tool and before and tool['outcome'] == before['outcome'] == 'completed'
                and tool['profile'] == before['profile'] and tool['version'] == before['version']
                and evidence['path'] in tool['covered_files'] and evidence['path'] in before['covered_files'])

    items = []
    for finding_id in sorted(new.keys() | old.keys()):
        occurrence, finding = new.get(finding_id, old.get(finding_id))
        change = 'recurring' if finding_id in new and finding_id in old else (
            'new' if covered(occurrence.evidence, previous, tools) else 'not_assessed') if finding_id in new else (
            'not_detected' if covered(occurrence.evidence, tools, previous) else 'not_assessed')
        items.append({**occurrence_read(occurrence, finding), 'change': change})
    return items



def work_read(db, item):
    ids = db.scalars(select(WorkItemFinding.finding_id).where(WorkItemFinding.work_item_id == item.id)).all()
    return {'id': item.id, 'status': item.status, 'version': item.version, 'created_by': item.created_by,
            **item.content, 'finding_ids': ids}


def create_work(db, project_id, user_id, data):
    if data.explanation_id is not None:
        explanation = db.get(RiskExplanation, data.explanation_id)
        if explanation is None or explanation.project_id != project_id:
            raise HTTPException(404, 'Explanation not found.')
        occurrence = db.get(FindingOccurrence, explanation.occurrence_id)
        if explanation.status != 'completed' or occurrence.finding_id not in data.finding_ids:
            raise HTTPException(409, 'Explanation must be completed and refer to a selected finding.')
    for finding_id in set(data.finding_ids):
        finding = finding_for(db, project_id, finding_id)
        target_for(db, project_id, finding.target_id, write=True)
    item = RiskWorkItem(project_id=project_id, created_by=user_id, content=data.model_dump(exclude={'finding_ids'}))
    db.add(item)
    db.flush()
    for finding_id in set(data.finding_ids):
        db.add(WorkItemFinding(work_item_id=item.id, finding_id=finding_id))
    db.commit()
    return work_read(db, item)


def evidence_artifact(db, project_id, scan_id, user_id):
    from app.models.project_artifact import ProjectArtifact
    from app.models.project_activity import ProjectActivityEvent
    scan = scan_for(db, project_id, scan_id)
    target_for(db, project_id, scan.target_id, write=True)
    db.refresh(scan)
    if scan.artifact_id:
        return {'id': scan.artifact_id}
    rows = occurrences(db, scan.id)
    summary = f'Code risk scan {scan.id}: {scan.outcome}; {len(rows)} findings. User-supplied scan evidence, not a production-safety certification.'
    content = '\n'.join([summary, 'Snapshot: ' + scan.report['snapshot_hash'],
        f'Open review: {sum(f.disposition == "unreviewed" for o, f in rows)}',
        *[f"{t['name']}: {t['outcome']}; profile {t['profile']}" for t in scan.report['tools']],
        f'ProjectOps reference: /app/projects/{project_id}?view=repository&section=risks&scan={scan.id}'])
    artifact = ProjectArtifact(project_id=project_id, title=f'Code risk review: scan {scan.id}',
        artifact_type='evidence', source_type='manual', summary=summary, content=content,
        tags='code-risk,scan-evidence', created_by_user_id=user_id, status='active')
    db.add(artifact)
    db.flush()
    scan.artifact_id = artifact.id
    db.add(ProjectActivityEvent(project_id=project_id, event_type='artifact_created', event_category='artifact',
        message='Code risk review evidence reference created.', related_resource_type='project_artifact', related_resource_id=artifact.id))
    db.commit()
    return {'id': artifact.id}

