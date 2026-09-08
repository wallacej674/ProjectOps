import hashlib
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.project import Project
from app.models.user import User
from app.models.code_risk import ScanTarget, CodeRiskScan, FindingOccurrence, RiskWorkItem
from app.schemas.code_risk import MAX_REPORT_BYTES, ScanReport, TargetCreate, TargetUpdate, ReviewInput, WorkCreate, WorkUpdate
from app.services.projects import project_service, ProjectNotFoundError
from app.services import code_risk as service
from app.schemas.risk_explanations import PreviewInput
from app.services import risk_explanations
from app.schemas.risk_explanations import ExplanationInput
from app.repositories import risk_explanations as explanation_repository

router = APIRouter(prefix='/projects/{project_id}/code-risk', tags=['Code Risk Review'])
Db = Annotated[Session, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]


def owned(db, project_id, user, write=False):
    try:
        project = project_service.get_project_for_user(db, project_id, user.id)
    except ProjectNotFoundError:
        raise HTTPException(404, 'Project not found.')
    if write:
        project = db.scalar(select(Project).where(Project.id == project_id).with_for_update())
        if project.status == 'archived':
            raise HTTPException(409, 'Project is archived.')
    return project


@router.get('/targets')
def targets(project_id: int, db: Db, user: UserDep):
    owned(db, project_id, user)
    return db.scalars(select(ScanTarget).where(ScanTarget.project_id == project_id).order_by(ScanTarget.id)).all()


@router.post('/targets', status_code=201)
def create_target(project_id: int, data: TargetCreate, db: Db, user: UserDep):
    owned(db, project_id, user, True)
    target = ScanTarget(project_id=project_id, name=data.name)
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


@router.post('/targets/{target_id}/scans/import', status_code=201)
async def import_report(project_id: int, target_id: int, request: Request, db: Db, user: UserDep):
    await run_in_threadpool(owned, db, project_id, user)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_REPORT_BYTES:
            raise HTTPException(413, 'Report exceeds 10 MiB.')
    try:
        report = ScanReport.model_validate_json(bytes(body))
    except (ValidationError, ValueError, RecursionError):
        raise HTTPException(422, 'Invalid code risk report. Check schema, limits, paths and coverage.')
    def persist():
        owned(db, project_id, user, True)
        result = service.import_scan(db, project_id, target_id, user.id, report, hashlib.sha256(body).hexdigest())
        return service.scan_read(result)
    return await run_in_threadpool(persist)


@router.get('/scans/{scan_id}')
def get_scan(project_id: int, scan_id: int, db: Db, user: UserDep):
    owned(db, project_id, user)
    return service.scan_read(service.scan_for(db, project_id, scan_id))


@router.get('/scans/{scan_id}/findings')
def findings(project_id: int, scan_id: int, db: Db, user: UserDep, severity: str = '', disposition: str = '',
             limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0)):
    owned(db, project_id, user)
    service.scan_for(db, project_id, scan_id)
    rows = service.occurrences(db, scan_id)
    if severity:
        rows = [(o, f) for o, f in rows if o.evidence['severity'] == severity]
    if disposition:
        rows = [(o, f) for o, f in rows if f.disposition == disposition]
    severity_order = {'critical': 0, 'high': 1, 'unknown': 2, 'medium': 3, 'low': 4, 'info': 5}
    review_order = {'unreviewed': 0, 'acknowledged': 1, 'accepted_risk': 2, 'false_positive': 3}
    rows.sort(key=lambda row: (review_order[row[1].disposition], severity_order[row[0].evidence['severity']], row[0].id))
    return {'items': [service.occurrence_read(*r) for r in rows[offset:offset + limit]], 'total': len(rows)}



@router.patch('/targets/{target_id}')
def update_target(project_id: int, target_id: int, data: TargetUpdate, db: Db, user: UserDep):
    owned(db, project_id, user, True)
    target = service.target_for(db, project_id, target_id)
    target.name, target.archived = data.name, data.archived
    db.commit()
    db.refresh(target)
    return target


@router.get('/targets/{target_id}/scans')
def scans(project_id: int, target_id: int, db: Db, user: UserDep,
          limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0)):
    owned(db, project_id, user)
    service.target_for(db, project_id, target_id)
    query = select(CodeRiskScan).where(CodeRiskScan.target_id == target_id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(CodeRiskScan.id.desc()).offset(offset).limit(limit)).all()
    return {'items': [service.scan_read(row, summary=True) for row in rows], 'total': total}


@router.get('/findings/{finding_id}')
def finding(project_id: int, finding_id: int, db: Db, user: UserDep,
            limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0)):
    owned(db, project_id, user)
    item = service.finding_for(db, project_id, finding_id)
    query = select(FindingOccurrence).where(FindingOccurrence.finding_id == finding_id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(FindingOccurrence.id.desc()).offset(offset).limit(limit)).all()
    return {'id': item.id, 'disposition': item.disposition, 'review_version': item.review_version,
            'review_history': item.review_history,
            'occurrences': {'items': [service.occurrence_read(row, item) for row in rows], 'total': total}}


@router.patch('/findings/{finding_id}/review')
def review(project_id: int, finding_id: int, data: ReviewInput, db: Db, user: UserDep):
    owned(db, project_id, user, True)
    return service.review_finding(db, project_id, finding_id, user.id, data)


@router.get('/scans/{scan_id}/comparison')
def compare(project_id: int, scan_id: int, baseline_id: int, db: Db, user: UserDep,
            limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0)):
    owned(db, project_id, user)
    rows = service.comparison(db, service.scan_for(db, project_id, scan_id), service.scan_for(db, project_id, baseline_id))
    return {'items': rows[offset:offset + limit], 'total': len(rows)}



@router.post('/work-items', status_code=201)
def create_work(project_id: int, data: WorkCreate, db: Db, user: UserDep):
    owned(db, project_id, user, True)
    return service.create_work(db, project_id, user.id, data)


@router.get('/work-items')
def work_items(project_id: int, db: Db, user: UserDep,
               limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0)):
    owned(db, project_id, user)
    query = select(RiskWorkItem).where(RiskWorkItem.project_id == project_id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(RiskWorkItem.id.desc()).offset(offset).limit(limit)).all()
    return {'items': [service.work_read(db, row) for row in rows], 'total': total}


@router.patch('/work-items/{item_id}')
def update_work(project_id: int, item_id: int, data: WorkUpdate, db: Db, user: UserDep):
    owned(db, project_id, user, True)
    item = db.scalar(select(RiskWorkItem).where(RiskWorkItem.id == item_id, RiskWorkItem.project_id == project_id).with_for_update())
    if item is None:
        raise HTTPException(404, 'Work item not found.')
    if item.version != data.version:
        raise HTTPException(409, 'Work item changed. Reload before saving.')
    item.status = data.status
    item.version += 1
    db.commit()
    return service.work_read(db, item)


@router.post('/scans/{scan_id}/evidence-artifact')
def evidence_artifact(project_id: int, scan_id: int, db: Db, user: UserDep):
    owned(db, project_id, user, True)
    return service.evidence_artifact(db, project_id, scan_id, user.id)




@router.post('/occurrences/{occurrence_id}/explanation-preview')
def explanation_preview(project_id: int, occurrence_id: int, data: PreviewInput, db: Db, user: UserDep):
    owned(db, project_id, user)
    return risk_explanations.preview(db, project_id, occurrence_id, data)



@router.post('/occurrences/{occurrence_id}/explanations')
def explain_occurrence(project_id: int, occurrence_id: int, data: ExplanationInput, db: Db, user: UserDep):
    owned(db, project_id, user, True)
    # Release ownership-read locks before the service reserves the account-scoped request.
    db.commit()
    return risk_explanations.explain(db, project_id, occurrence_id, user.id, data)


@router.get('/explanations/{explanation_id}')
def get_explanation(project_id: int, explanation_id: int, db: Db, user: UserDep):
    owned(db, project_id, user)
    return risk_explanations.get(db, project_id, explanation_id, user.id)


@router.get('/occurrences/{occurrence_id}/explanations')
def explanation_history(project_id: int, occurrence_id: int, db: Db, user: UserDep,
                        limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0)):
    owned(db, project_id, user)
    risk_explanations.preview(db, project_id, occurrence_id, PreviewInput())
    explanation_repository.expire(db, user.id)
    rows, total = explanation_repository.history(db, occurrence_id, offset, limit)
    db.commit()
    return {'items': [risk_explanations.read(row) for row in rows], 'total': total}
