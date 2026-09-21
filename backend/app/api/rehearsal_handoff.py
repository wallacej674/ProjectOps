from fastapi import APIRouter, Query
from app.api.rehearsal import Db, UserDep
from app.models.rehearsal_handoff import RehearsalDecision
from app.schemas.rehearsal_handoff import DecisionInput
from app.services import rehearsal, rehearsal_handoff as service

router = APIRouter(prefix='/projects/{project_id}/releases/{release_id}/rehearsal', tags=['Release Rehearsal'])


@router.get('/decisions/preview')
def decision_preview(project_id: int, release_id: int, db: Db, user: UserDep):
    return service.decision_preview(db, project_id, release_id, user.id)


@router.post('/decisions', status_code=201)
def create_decision(project_id: int, release_id: int, data: DecisionInput, db: Db, user: UserDep):
    return service.create_decision(db, project_id, release_id, user.id, data)


@router.get('/decisions')
def decisions(project_id: int, release_id: int, db: Db, user: UserDep,
              offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    return rehearsal.list_records(db, project_id, release_id, user.id, RehearsalDecision,
                                  service.read_decision, offset, limit)


@router.get('/comparison')
def compare(project_id: int, release_id: int, db: Db, user: UserDep,
            baseline_decision_id: int | None = Query(None, gt=0)):
    return service.compare(db, project_id, release_id, user.id, baseline_decision_id)
