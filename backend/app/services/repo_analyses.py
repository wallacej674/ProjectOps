from typing import Protocol

from sqlalchemy.orm import Session

from app.models.repo_analysis import RepoAnalysis, RepoAnalysisStatus
from app.repositories.repo_analyses import repo_analysis_repository
from app.services.codemap_lite_analyzer import analyze_repo_paths
from app.services.github_repo_tree_fetcher import RepoTreeFetchError, github_repo_tree_fetcher
from app.services.projects import project_service
from app.services.repo_integrations import repo_integration_service


class RepoAnalysisNotFoundError(Exception):
    pass


class RepoTreeFetcher(Protocol):
    def fetch_tree_paths(self, repo_owner: str, repo_name: str) -> list[str]:
        pass


class RepoAnalysisService:
    def __init__(self, tree_fetcher: RepoTreeFetcher = github_repo_tree_fetcher) -> None:
        self.tree_fetcher = tree_fetcher

    def run_analysis(
        self,
        db: Session,
        project_id: int,
        tree_fetcher: RepoTreeFetcher | None = None,
    ) -> RepoAnalysis:
        project_service.get_project(db, project_id)
        repo_integration = repo_integration_service.get_project_repo(db, project_id)
        active_tree_fetcher = tree_fetcher or self.tree_fetcher

        try:
            paths = active_tree_fetcher.fetch_tree_paths(repo_integration.repo_owner, repo_integration.repo_name)
        except RepoTreeFetchError as error:
            return repo_analysis_repository.create(
                db,
                RepoAnalysis(
                    project_id=project_id,
                    repo_integration_id=repo_integration.id,
                    status=RepoAnalysisStatus.failed.value,
                    summary="CodeMap Lite analysis failed.",
                    detected_stack={"languages": [], "frameworks": [], "tools": []},
                    detected_files=[],
                    detected_folders=[],
                    signals={},
                    warnings=[],
                    error_message=str(error),
                    total_files_scanned=0,
                ),
            )

        result = analyze_repo_paths(paths)
        return repo_analysis_repository.create(
            db,
            RepoAnalysis(
                project_id=project_id,
                repo_integration_id=repo_integration.id,
                status=RepoAnalysisStatus.completed.value,
                summary=result.summary,
                detected_stack=result.detected_stack,
                detected_files=result.detected_files,
                detected_folders=result.detected_folders,
                signals=result.signals,
                warnings=result.warnings,
                error_message=None,
                total_files_scanned=result.total_files_scanned,
            ),
        )

    def get_latest_project_analysis(self, db: Session, project_id: int) -> RepoAnalysis:
        project_service.get_project(db, project_id)
        repo_analysis = repo_analysis_repository.get_latest_by_project_id(db, project_id)
        if repo_analysis is None:
            raise RepoAnalysisNotFoundError(f"Project {project_id} does not have a repo analysis yet.")
        return repo_analysis

    def list_project_analyses(self, db: Session, project_id: int) -> list[RepoAnalysis]:
        project_service.get_project(db, project_id)
        return repo_analysis_repository.list_by_project_id(db, project_id)


repo_analysis_service = RepoAnalysisService()
