from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.dashboard import ProjectDashboardRead
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.schemas.repo_analysis import RepoAnalysisRead
from app.schemas.repo_integration import RepoIntegrationCreate, RepoIntegrationRead
from app.services.dashboard import dashboard_service
from app.services.github_repo_parser import InvalidGitHubRepoUrlError
from app.services.projects import ProjectNotFoundError, project_service
from app.services.repo_analyses import RepoAnalysisNotFoundError, repo_analysis_service
from app.services.repo_integrations import RepoIntegrationNotFoundError, repo_integration_service

router = APIRouter(prefix="/projects", tags=["Projects"])


def _not_found(error: ProjectNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


def _repo_not_found(error: RepoIntegrationNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


def _analysis_not_found(error: RepoAnalysisNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


def _invalid_repo_url(error: InvalidGitHubRepoUrlError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error))


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
