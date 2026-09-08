from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.releases import ReleaseCreate, BriefUpdate, VersionInput
from app.repositories import releases as repository
from app.services import releases as service
from app.schemas.releases import RequirementCreate, RequirementUpdate
from app.schemas.releases import MaterialInput


router = APIRouter(prefix='/projects/{project_id}/releases', tags=['Release Readiness'])
Db = Annotated[Session, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]


@router.post('', status_code=201)
def create_release(project_id: int, data: ReleaseCreate, db: Db, user: UserDep):
    return service.create(db, project_id, user.id, data)


@router.get('')
def list_releases(project_id: int, db: Db, user: UserDep, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    service.project(db, project_id, user.id)
    rows, total = repository.list_releases(db, project_id, offset, limit)
    return {'items': [service.read(db, row) for row in rows], 'total': total}


@router.get('/active')
def active_release(project_id: int, db: Db, user: UserDep):
    service.project(db, project_id, user.id)
    row = repository.active(db, project_id)
    return service.read(db, row) if row else None


@router.get('/{release_id}')
def get_release(project_id: int, release_id: int, db: Db, user: UserDep):
    service.project(db, project_id, user.id)
    return service.read(db, service.release_for(db, project_id, release_id))


@router.post('/{release_id}/brief')
def update_brief(project_id: int, release_id: int, data: BriefUpdate, db: Db, user: UserDep):
    return service.update_brief(db, project_id, release_id, user.id, data)


@router.post('/{release_id}/brief/confirm')
def confirm_brief(project_id: int, release_id: int, data: VersionInput, db: Db, user: UserDep):
    return service.confirm_brief(db, project_id, release_id, user.id, data)


@router.get('/{release_id}/brief/history')
def brief_history(project_id: int, release_id: int, db: Db, user: UserDep, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    service.project(db, project_id, user.id)
    service.release_for(db, project_id, release_id)
    rows, total = repository.brief_history(db, release_id, offset, limit)
    return {'items': [service.brief_read(row) for row in rows], 'total': total}



@router.post('/{release_id}/requirements', status_code=201)
def create_requirement(project_id: int, release_id: int, data: RequirementCreate, db: Db, user: UserDep):
    return service.create_requirement(db, project_id, release_id, user.id, data)


@router.get('/{release_id}/requirements')
def list_requirements(project_id: int, release_id: int, db: Db, user: UserDep, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    service.project(db, project_id, user.id)
    release = service.release_for(db, project_id, release_id)
    rows, total = repository.list_requirements(db, release_id, offset, limit)
    return {'items': [service.requirement_read(db, release, row) for row in rows], 'total': total}


@router.patch('/{release_id}/requirements/{requirement_id}')
def update_requirement(project_id: int, release_id: int, requirement_id: int, data: RequirementUpdate, db: Db, user: UserDep):
    return service.update_requirement(db, project_id, release_id, requirement_id, user.id, data)


@router.post('/{release_id}/requirements/{requirement_id}/confirm')
def confirm_requirement(project_id: int, release_id: int, requirement_id: int, data: VersionInput, db: Db, user: UserDep):
    return service.confirm_requirement(db, project_id, release_id, requirement_id, user.id, data)


@router.get('/{release_id}/requirements/{requirement_id}/history')
def requirement_history(project_id: int, release_id: int, requirement_id: int, db: Db, user: UserDep, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    service.project(db, project_id, user.id)
    service.release_for(db, project_id, release_id)
    service.requirement_for(db, release_id, requirement_id)
    rows, total = repository.requirement_history(db, requirement_id, offset, limit)
    return {'items': [service.requirement_revision_read(row) for row in rows], 'total': total}


@router.post('/{release_id}/activate')
def activate_release(project_id: int, release_id: int, data: VersionInput, db: Db, user: UserDep):
    return service.change_state(db, project_id, release_id, user.id, data, 'activate')


@router.post('/{release_id}/archive')
def archive_release(project_id: int, release_id: int, data: VersionInput, db: Db, user: UserDep):
    return service.change_state(db, project_id, release_id, user.id, data, 'archive')



@router.post('/{release_id}/requirements/{requirement_id}/materials', status_code=201)
def link_material(project_id: int, release_id: int, requirement_id: int, data: MaterialInput, db: Db, user: UserDep):
    return service.link_material(db, project_id, release_id, requirement_id, user.id, data)


@router.get('/{release_id}/requirements/{requirement_id}/materials')
def list_materials(project_id: int, release_id: int, requirement_id: int, db: Db, user: UserDep, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    service.project(db, project_id, user.id)
    service.release_for(db, project_id, release_id)
    service.requirement_for(db, release_id, requirement_id)
    rows, total = repository.materials(db, requirement_id, offset, limit)
    return {'items': [service.material_read(db, project_id, row) for row in rows], 'total': total}
