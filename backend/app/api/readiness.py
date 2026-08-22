from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.readiness import (
    ProjectReadinessEvidenceCoverage,
    ProjectReadinessItemRead,
    ProjectReadinessSummary,
    ReadinessArtifactEvidenceRead,
    ReadinessArtifactLinkRequest,
    ReadinessItemUpdate,
)
from app.schemas.launch_report import ProjectLaunchChecklistRead, ProjectLaunchReportRead
from app.services.project_artifacts import ProjectArtifactNotFoundError
from app.services.projects import ProjectNotFoundError
from app.services.readiness import (
    ArtifactEvidenceAlreadyLinkedError,
    ArtifactEvidenceLinkNotFoundError,
    ManualItemUpdateError,
    ReadinessItemNotFoundError,
    readiness_service,
)
from app.services.launch_report import launch_report_service
from app.services.projects import project_service

router = APIRouter(prefix="/api/v1/projects", tags=["Readiness"])


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


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


def _ensure_owned_project(db: Session, project_id: int, current_user: User) -> None:
    project_service.get_project_for_user(db, project_id, current_user.id)


@router.post(
    "/{project_id}/readiness/evaluate",
    response_model=ProjectReadinessSummary,
    status_code=status.HTTP_201_CREATED,
)
def evaluate_project_readiness(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectReadinessSummary:
    try:
        _ensure_owned_project(db, project_id, current_user)
        assessments, score = readiness_service.evaluate_project(db, project_id)
        return _build_summary(assessments, score)
    except ProjectNotFoundError as error:
        raise _not_found(str(error)) from error


@router.get("/{project_id}/readiness", response_model=ProjectReadinessSummary)
def get_project_readiness(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectReadinessSummary:
    try:
        _ensure_owned_project(db, project_id, current_user)
        assessments, score = readiness_service.get_project_readiness(db, project_id)
        return _build_summary(assessments, score)
    except ProjectNotFoundError as error:
        raise _not_found(str(error)) from error


@router.get("/{project_id}/readiness/evidence-coverage", response_model=ProjectReadinessEvidenceCoverage)
def get_project_readiness_evidence_coverage(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectReadinessEvidenceCoverage:
    try:
        _ensure_owned_project(db, project_id, current_user)
        return readiness_service.get_evidence_coverage(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(str(error)) from error


@router.get("/{project_id}/launch-report", response_model=ProjectLaunchReportRead)
def get_project_launch_report(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectLaunchReportRead:
    try:
        _ensure_owned_project(db, project_id, current_user)
        return launch_report_service.get_launch_report(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(str(error)) from error


@router.get("/{project_id}/launch-checklist", response_model=ProjectLaunchChecklistRead)
def get_project_launch_checklist(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectLaunchChecklistRead:
    try:
        _ensure_owned_project(db, project_id, current_user)
        return launch_report_service.get_launch_checklist(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(str(error)) from error


@router.post(
    "/{project_id}/readiness/items/{item_key}/artifacts",
    response_model=ReadinessArtifactEvidenceRead,
    status_code=status.HTTP_201_CREATED,
)
def link_readiness_artifact_evidence(
    project_id: int,
    item_key: str,
    link_in: ReadinessArtifactLinkRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReadinessArtifactEvidenceRead:
    try:
        _ensure_owned_project(db, project_id, current_user)
        return readiness_service.link_artifact_evidence(db, project_id, item_key, link_in.artifact_id)
    except ProjectNotFoundError as error:
        raise _not_found(str(error)) from error
    except ProjectArtifactNotFoundError as error:
        raise _not_found(str(error)) from error
    except ReadinessItemNotFoundError as error:
        raise _not_found(str(error)) from error
    except ArtifactEvidenceAlreadyLinkedError as error:
        raise _conflict(str(error)) from error


@router.get(
    "/{project_id}/readiness/items/{item_key}/artifacts",
    response_model=list[ReadinessArtifactEvidenceRead],
)
def list_readiness_artifact_evidence(
    project_id: int,
    item_key: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ReadinessArtifactEvidenceRead]:
    try:
        _ensure_owned_project(db, project_id, current_user)
        return readiness_service.list_artifact_evidence(db, project_id, item_key)
    except ProjectNotFoundError as error:
        raise _not_found(str(error)) from error
    except ReadinessItemNotFoundError as error:
        raise _not_found(str(error)) from error


@router.delete(
    "/{project_id}/readiness/items/{item_key}/artifacts/{artifact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unlink_readiness_artifact_evidence(
    project_id: int,
    item_key: str,
    artifact_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    try:
        _ensure_owned_project(db, project_id, current_user)
        readiness_service.unlink_artifact_evidence(db, project_id, item_key, artifact_id)
    except ProjectNotFoundError as error:
        raise _not_found(str(error)) from error
    except ReadinessItemNotFoundError as error:
        raise _not_found(str(error)) from error
    except ArtifactEvidenceLinkNotFoundError as error:
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
    current_user: Annotated[User, Depends(get_current_user)],
) -> ProjectReadinessItemRead:
    try:
        _ensure_owned_project(db, project_id, current_user)
        return readiness_service.update_manual_item(
            db, project_id, item_key, update_in.status, update_in.notes
        )
    except ProjectNotFoundError as error:
        raise _not_found(str(error)) from error
    except ReadinessItemNotFoundError as error:
        raise _not_found(str(error)) from error
    except ManualItemUpdateError as error:
        raise _bad_request(str(error)) from error
