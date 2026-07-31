from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.dashboard import ProjectDashboardRead
from app.schemas.health_check import HealthCheckRead, HealthCheckRunRequest
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.schemas.project_activity import ProjectActivityEventRead
from app.schemas.project_artifact import ProjectArtifactCreate, ProjectArtifactRead, ProjectArtifactUpdate
from app.schemas.repo_analysis import RepoAnalysisRead
from app.schemas.repo_integration import RepoIntegrationCreate, RepoIntegrationRead
from app.services.dashboard import dashboard_service
from app.services.activity import activity_service
from app.services.github_repo_parser import InvalidGitHubRepoUrlError
from app.services.health_checks import (
    HealthCheckNotFoundError,
    HealthCheckTargetUrlMissingError,
    health_check_service,
)
from app.services.url_validator import HealthCheckUrlSafetyError
from app.services.projects import ProjectNotFoundError, project_service
from app.services.project_artifacts import ProjectArtifactNotFoundError, project_artifact_service
from app.services.repo_analyses import RepoAnalysisNotFoundError, repo_analysis_service
from app.services.repo_integrations import RepoIntegrationNotFoundError, repo_integration_service
from app.models.project_artifact import ProjectArtifactSourceType, ProjectArtifactType
from app.models.project_activity import ProjectActivityCategory, ProjectActivityEventType

router = APIRouter(prefix="/projects", tags=["Projects"])


def _not_found(error: ProjectNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


def _repo_not_found(error: RepoIntegrationNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


def _analysis_not_found(error: RepoAnalysisNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


def _health_check_not_found(error: HealthCheckNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


def _artifact_not_found(error: ProjectArtifactNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


def _bad_request(error: HealthCheckTargetUrlMissingError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))


def _invalid_repo_url(error: InvalidGitHubRepoUrlError) -> HTTPException:
    return HTTPException(status_code=422, detail=str(error))


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(project_in: ProjectCreate, db: Annotated[Session, Depends(get_db)]) -> ProjectRead:
    return project_service.create_project(db, project_in)


@router.get("", response_model=list[ProjectRead])
def list_projects(
    db: Annotated[Session, Depends(get_db)],
    include_archived: bool = Query(default=False),
) -> list[ProjectRead]:
    return project_service.list_projects(db, include_archived=include_archived)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Annotated[Session, Depends(get_db)]) -> ProjectRead:
    try:
        return project_service.get_project(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error


@router.get("/{project_id}/dashboard", response_model=ProjectDashboardRead)
def get_project_dashboard(project_id: int, db: Annotated[Session, Depends(get_db)]) -> ProjectDashboardRead:
    try:
        return dashboard_service.get_project_dashboard(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error


@router.get("/{project_id}/activity", response_model=list[ProjectActivityEventRead])
def list_project_activity(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    category: ProjectActivityCategory | None = Query(default=None),
    event_type: ProjectActivityEventType | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[ProjectActivityEventRead]:
    try:
        return activity_service.list_project_activity(
            db,
            project_id,
            event_category=category.value if category else None,
            event_type=event_type.value if event_type else None,
            limit=limit,
            offset=offset,
        )
    except ProjectNotFoundError as error:
        raise _not_found(error) from error


@router.post("/{project_id}/repo", response_model=RepoIntegrationRead, status_code=status.HTTP_201_CREATED)
def attach_project_repo(
    project_id: int,
    repo_integration_in: RepoIntegrationCreate,
    db: Annotated[Session, Depends(get_db)],
) -> RepoIntegrationRead:
    try:
        return repo_integration_service.attach_github_repo(db, project_id, repo_integration_in)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error
    except InvalidGitHubRepoUrlError as error:
        raise _invalid_repo_url(error) from error


@router.get("/{project_id}/repo", response_model=RepoIntegrationRead)
def get_project_repo(project_id: int, db: Annotated[Session, Depends(get_db)]) -> RepoIntegrationRead:
    try:
        return repo_integration_service.get_project_repo(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error
    except RepoIntegrationNotFoundError as error:
        raise _repo_not_found(error) from error


@router.delete("/{project_id}/repo", status_code=status.HTTP_204_NO_CONTENT)
def remove_project_repo(project_id: int, db: Annotated[Session, Depends(get_db)]) -> None:
    try:
        repo_integration_service.remove_project_repo(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error
    except RepoIntegrationNotFoundError as error:
        raise _repo_not_found(error) from error


@router.post("/{project_id}/analyses/run", response_model=RepoAnalysisRead, status_code=status.HTTP_201_CREATED)
def run_project_repo_analysis(project_id: int, db: Annotated[Session, Depends(get_db)]) -> RepoAnalysisRead:
    try:
        return repo_analysis_service.run_analysis(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error
    except RepoIntegrationNotFoundError as error:
        raise _repo_not_found(error) from error


@router.get("/{project_id}/analyses/latest", response_model=RepoAnalysisRead)
def get_latest_project_repo_analysis(project_id: int, db: Annotated[Session, Depends(get_db)]) -> RepoAnalysisRead:
    try:
        return repo_analysis_service.get_latest_project_analysis(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error
    except RepoAnalysisNotFoundError as error:
        raise _analysis_not_found(error) from error


@router.get("/{project_id}/analyses", response_model=list[RepoAnalysisRead])
def list_project_repo_analyses(project_id: int, db: Annotated[Session, Depends(get_db)]) -> list[RepoAnalysisRead]:
    try:
        return repo_analysis_service.list_project_analyses(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error


@router.post("/{project_id}/health-checks/run", response_model=HealthCheckRead, status_code=status.HTTP_201_CREATED)
def run_project_health_check(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    health_check_in: HealthCheckRunRequest | None = None,
) -> HealthCheckRead:
    try:
        return health_check_service.run_health_check(db, project_id, health_check_in or HealthCheckRunRequest())
    except ProjectNotFoundError as error:
        raise _not_found(error) from error
    except HealthCheckTargetUrlMissingError as error:
        raise _bad_request(error) from error
    except HealthCheckUrlSafetyError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/{project_id}/health-checks/latest", response_model=HealthCheckRead)
def get_latest_project_health_check(project_id: int, db: Annotated[Session, Depends(get_db)]) -> HealthCheckRead:
    try:
        return health_check_service.get_latest_project_health_check(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error
    except HealthCheckNotFoundError as error:
        raise _health_check_not_found(error) from error


@router.get("/{project_id}/health-checks", response_model=list[HealthCheckRead])
def list_project_health_checks(project_id: int, db: Annotated[Session, Depends(get_db)]) -> list[HealthCheckRead]:
    try:
        return health_check_service.list_project_health_checks(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error


@router.post("/{project_id}/artifacts", response_model=ProjectArtifactRead, status_code=status.HTTP_201_CREATED)
def create_project_artifact(
    project_id: int,
    artifact_in: ProjectArtifactCreate,
    db: Annotated[Session, Depends(get_db)],
) -> ProjectArtifactRead:
    try:
        return project_artifact_service.create_project_artifact(db, project_id, artifact_in)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error


@router.get("/{project_id}/artifacts", response_model=list[ProjectArtifactRead])
def list_project_artifacts(
    project_id: int,
    db: Annotated[Session, Depends(get_db)],
    include_archived: bool = Query(default=False),
    artifact_type: ProjectArtifactType | None = Query(default=None),
    source_type: ProjectArtifactSourceType | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    tags: str | None = Query(default=None, max_length=1000),
) -> list[ProjectArtifactRead]:
    try:
        parsed_tags = [tag.strip() for tag in tags.split(",") if tag.strip()] if tags else None
        return project_artifact_service.list_project_artifacts(
            db,
            project_id,
            include_archived=include_archived,
            artifact_type=artifact_type,
            source_type=source_type,
            search=search,
            tags=parsed_tags,
        )
    except ProjectNotFoundError as error:
        raise _not_found(error) from error


@router.get("/{project_id}/artifacts/{artifact_id}", response_model=ProjectArtifactRead)
def get_project_artifact(
    project_id: int,
    artifact_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> ProjectArtifactRead:
    try:
        return project_artifact_service.get_project_artifact(db, project_id, artifact_id)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error
    except ProjectArtifactNotFoundError as error:
        raise _artifact_not_found(error) from error


@router.patch("/{project_id}/artifacts/{artifact_id}", response_model=ProjectArtifactRead)
def update_project_artifact(
    project_id: int,
    artifact_id: int,
    artifact_in: ProjectArtifactUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> ProjectArtifactRead:
    try:
        return project_artifact_service.update_project_artifact(db, project_id, artifact_id, artifact_in)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error
    except ProjectArtifactNotFoundError as error:
        raise _artifact_not_found(error) from error


@router.delete("/{project_id}/artifacts/{artifact_id}", response_model=ProjectArtifactRead)
def archive_project_artifact(
    project_id: int,
    artifact_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> ProjectArtifactRead:
    try:
        return project_artifact_service.archive_project_artifact(db, project_id, artifact_id)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error
    except ProjectArtifactNotFoundError as error:
        raise _artifact_not_found(error) from error


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> ProjectRead:
    try:
        return project_service.update_project(db, project_id, project_in)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error


@router.delete("/{project_id}", response_model=ProjectRead)
def archive_project(project_id: int, db: Annotated[Session, Depends(get_db)]) -> ProjectRead:
    try:
        return project_service.archive_project(db, project_id)
    except ProjectNotFoundError as error:
        raise _not_found(error) from error
