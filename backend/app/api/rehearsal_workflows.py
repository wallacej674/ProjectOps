from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.rehearsal_workflows import WorkflowSelection, WorkflowCreate
from app.services import rehearsal_workflows as service

router = APIRouter(prefix='/projects/{project_id}/releases/{release_id}/rehearsal/workflows', tags=['Release Rehearsal'])
Db = Annotated[Session, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]

@router.post('/preview')
def preview(project_id: int, release_id: int, data: WorkflowSelection, db: Db, user: UserDep):
    return service.preview(db, project_id, release_id, user.id, data)

@router.post('')
def create(project_id: int, release_id: int, data: WorkflowCreate, db: Db, user: UserDep):
    return service.enqueue(db, project_id, release_id, user.id, data)

@router.get('')
def listing(project_id: int, release_id: int, db: Db, user: UserDep, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    return service.listing(db, project_id, release_id, user.id, offset, limit)

@router.get('/{workflow_id}')
def get(project_id: int, release_id: int, workflow_id: int, db: Db, user: UserDep):
    return service.get(db, project_id, release_id, user.id, workflow_id)


@router.post('/{workflow_id}/cancel')
def cancel(project_id: int, release_id: int, workflow_id: int, db: Db, user: UserDep):
    return service.cancel(db, project_id, release_id, user.id, workflow_id)
