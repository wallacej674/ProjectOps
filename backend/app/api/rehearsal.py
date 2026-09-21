"""Authenticated Release Rehearsal public interface."""
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.rehearsal import RehearsalEvidence, RehearsalScope
from app.schemas.rehearsal import EvidenceInput, ScopeInput
from app.schemas.rehearsal import AssessmentInput, AssessmentReviewInput, DispositionInput
from app.models.rehearsal import RehearsalAssessment
from app.models.rehearsal import RehearsalNextStep
from app.schemas.rehearsal import NextStepInput, NextStepTransition, NextStepUpdate
from app.services import rehearsal as service

router = APIRouter(prefix='/projects/{project_id}/releases/{release_id}/rehearsal', tags=['Release Rehearsal'])
Db = Annotated[Session, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]


async def bounded_input(request: Request, contract):
    payload = bytearray()
    async for chunk in request.stream():
        payload.extend(chunk)
        if len(payload) > 256 * 1024:
            raise HTTPException(413, 'Import exceeds the 256 KiB limit.')
    try:
        return contract.model_validate_json(payload)
    except (ValidationError, ValueError, json.JSONDecodeError):
        raise HTTPException(422, 'Invalid import. Check the report fields, sizes, and verification timestamps.') from None


@router.get('/scope')
def scope(project_id: int, release_id: int, db: Db, user: UserDep):
    service.owned(db, project_id, release_id, user.id)
    return service.read_scope(service.current_scope(db, release_id))


@router.post('/scope', status_code=201)
async def set_scope(project_id: int, release_id: int, request: Request, db: Db, user: UserDep):
    data = await bounded_input(request, ScopeInput)
    return service.set_scope(db, project_id, release_id, user.id, data)


@router.get('/scope/history')
def scopes(project_id: int, release_id: int, db: Db, user: UserDep,
           offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    return service.list_records(db, project_id, release_id, user.id, RehearsalScope, service.read_scope, offset, limit)


@router.post('/evidence/preview')
async def evidence_preview(project_id: int, release_id: int, request: Request, db: Db, user: UserDep):
    data = await bounded_input(request, EvidenceInput)
    return service.preview_evidence(db, project_id, release_id, user.id, data)


@router.post('/evidence', status_code=201)
async def create_evidence(project_id: int, release_id: int, request: Request, db: Db, user: UserDep):
    data = await bounded_input(request, EvidenceInput)
    return service.create_evidence(db, project_id, release_id, user.id, data)


@router.get('/evidence')
def evidence(project_id: int, release_id: int, db: Db, user: UserDep,
             offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    return service.list_records(db, project_id, release_id, user.id, RehearsalEvidence, service.read_evidence, offset, limit)


@router.get('/summary')
def summary(project_id: int, release_id: int, db: Db, user: UserDep):
    return service.summary(db, project_id, release_id, user.id)


@router.post('/assessments', status_code=201)
def assessment_create(project_id: int, release_id: int, data: AssessmentInput, db: Db, user: UserDep):
    return service.create_assessment(db, project_id, release_id, user.id, data)


@router.get('/assessments')
def assessments(project_id: int, release_id: int, db: Db, user: UserDep,
                offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    release = service.owned(db, project_id, release_id, user.id)
    return service.list_records(db, project_id, release_id, user.id, RehearsalAssessment,
        lambda row: service.read_assessment(db, release, row), offset, limit)


@router.post('/assessments/{assessment_id}/review')
def assessment_review(project_id: int, release_id: int, assessment_id: int,
                      data: AssessmentReviewInput, db: Db, user: UserDep):
    return service.review_assessment(db, project_id, release_id, assessment_id, user.id, data)


@router.post('/requirements/{requirement_id}/disposition')
def disposition(project_id: int, release_id: int, requirement_id: int, data: DispositionInput, db: Db, user: UserDep):
    return service.disposition(db, project_id, release_id, requirement_id, user.id, data)


@router.get('/next-steps')
def next_steps(project_id: int, release_id: int, db: Db, user: UserDep,
               offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    return service.list_records(db, project_id, release_id, user.id, RehearsalNextStep,
        lambda row: service.read_next_step(db, row), offset, limit)


@router.post('/next-steps', status_code=201)
def next_step_create(project_id: int, release_id: int, data: NextStepInput, db: Db, user: UserDep):
    return service.create_next_step(db, project_id, release_id, user.id, data)


@router.post('/next-steps/{next_step_id}/transition')
def next_step_transition(project_id: int, release_id: int, next_step_id: int,
                         data: NextStepTransition, db: Db, user: UserDep):
    return service.transition_next_step(db, project_id, release_id, next_step_id, user.id, data)


@router.get('/evidence/sources')
def evidence_sources(project_id: int, release_id: int, db: Db, user: UserDep, kind: str,
                     requirement_id: int, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    return service.source_options(db, project_id, release_id, user.id, kind, requirement_id, offset, limit)


@router.patch('/next-steps/{next_step_id}')
def next_step_update(project_id: int, release_id: int, next_step_id: int, data: NextStepUpdate, db: Db, user: UserDep):
    return service.update_next_step(db, project_id, release_id, next_step_id, user.id, data)
