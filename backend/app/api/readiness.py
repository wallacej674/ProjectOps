from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.readiness import ProjectReadinessItemRead, ProjectReadinessSummary, ReadinessItemUpdate
from app.services.projects import ProjectNotFoundError
from app.services.readiness import (
    ManualItemUpdateError,
    ReadinessItemNotFoundError,
    readiness_service,
)

router = APIRouter(prefix="/api/v1/projects", tags=["Readiness"])


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _build_summary(assessments, score) -> ProjectReadinessSummary:
    return ProjectReadinessSummary(
        score=score.score,
        status=score.status,
        passed=score.passed,
        failed=score.failed,
        unknown=score.unknown,
        not_applicable=score.not_applicable,
        total_applicable=score.total_applicable,
        top_gaps=score.top_gaps,
        items=[ProjectReadinessItemRead.model_validate(a) for a in assessments],
    )


@router.post(
    "/{project_id}/readiness/evaluate",
    response_model=ProjectReadinessSummary,
    status_code=status.HTTP_201_CREATED,
)
def evaluate_project_readiness(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> ProjectReadinessSummary:
    try:
        assessments, score = readiness_service.evaluate_project(db, project_id)
        return _build_summary(assessments, score)
    except ProjectNotFoundError as error:
        raise _not_found(str(error)) from error


@router.get("/{project_id}/readiness", response_model=ProjectReadinessSummary)
def get_project_readiness(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> ProjectReadinessSummary:
    try:
        assessments, score = readiness_service.get_project_readiness(db, project_id)
        return _build_summary(assessments, score)
    except ProjectNotFoundError as error:
        raise _not_found(str(error)) from error


@router.patch(
    "/{project_id}/readiness/items/{item_key}",
    response_model=ProjectReadinessItemRead,
)
def update_readiness_item(
    project_id: int,
    item_key: str,
    update_in: ReadinessItemUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> ProjectReadinessItemRead:
    try:
        return readiness_service.update_manual_item(
            db, project_id, item_key, update_in.status, update_in.notes
        )
    except ProjectNotFoundError as error:
        raise _not_found(str(error)) from error
    except ReadinessItemNotFoundError as error:
        raise _not_found(str(error)) from error
    except ManualItemUpdateError as error:
        raise _bad_request(str(error)) from error
