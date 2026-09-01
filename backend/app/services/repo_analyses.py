from typing import Protocol

from sqlalchemy.orm import Session

from app.models.repo_analysis import RepoAnalysis, RepoAnalysisStatus
from app.repositories.repo_analyses import repo_analysis_repository
from app.services.codemap_medium_analyzer import analyze_manifest_contents
from app.services.codemap_lite_analyzer import analyze_repo_paths
from app.services.github_repo_tree_fetcher import RepoTreeFetchError, github_repo_tree_fetcher
from app.services.github_repo_tree_fetcher import GitHubRepoTreeFetcher
from app.services.github_app import github_app_service
from app.core.config import get_settings
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
        if tree_fetcher is None and repo_integration.github_installation_id is not None:
            token = github_app_service.installation_token(get_settings(), repo_integration.github_installation_id)
            active_tree_fetcher = GitHubRepoTreeFetcher(access_token=token)

        try:
            if hasattr(active_tree_fetcher, "fetch_repository_snapshot"):
                snapshot = active_tree_fetcher.fetch_repository_snapshot(
                    repo_integration.repo_owner, repo_integration.repo_name
                )
                paths = snapshot.paths
                manifest_contents = snapshot.manifest_contents
                skipped_files = snapshot.skipped_files
            else:
                paths = active_tree_fetcher.fetch_tree_paths(repo_integration.repo_owner, repo_integration.repo_name)
                manifest_contents = {}
                skipped_files = []
        except RepoTreeFetchError as error:
            analysis = repo_analysis_repository.create(
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
                    analysis_version="codemap_medium_v1",
                    insights={},
                    evidence_files={},
                    inspected_files=[],
                ),
            )
            self._record_analysis_activity(db, analysis)
            return analysis

        result = analyze_repo_paths(paths)
        medium_result = analyze_manifest_contents(manifest_contents, skipped_files)
        combined_warnings = [*result.warnings, *medium_result.warnings]
        analysis = repo_analysis_repository.create(
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
                warnings=combined_warnings,
                error_message=None,
                total_files_scanned=result.total_files_scanned,
                analysis_version="codemap_medium_v1",
                insights=medium_result.insights,
                evidence_files=medium_result.evidence_files,
                inspected_files=sorted(manifest_contents),
            ),
        )
        self._record_analysis_activity(db, analysis)
        return analysis

    def get_latest_project_analysis(self, db: Session, project_id: int) -> RepoAnalysis:
        project_service.get_project(db, project_id)
        repo_analysis = repo_analysis_repository.get_latest_by_project_id(db, project_id)
        if repo_analysis is None:
            raise RepoAnalysisNotFoundError(f"Project {project_id} does not have a repo analysis yet.")
        return repo_analysis

    def list_project_analyses(self, db: Session, project_id: int) -> list[RepoAnalysis]:
        project_service.get_project(db, project_id)
        return repo_analysis_repository.list_by_project_id(db, project_id)

    def _record_analysis_activity(self, db: Session, analysis: RepoAnalysis) -> None:
        from app.services.activity import activity_service

        completed = analysis.status == RepoAnalysisStatus.completed.value
        activity_service.record_event(
            db,
            project_id=analysis.project_id,
            event_type="codemap_analysis_completed" if completed else "codemap_analysis_failed",
            event_category="codemap",
            message="Repository analysis completed." if completed else "Repository analysis failed.",
            related_resource_type="repo_analysis",
            related_resource_id=analysis.id,
            metadata={
                "status": analysis.status,
                "total_files_scanned": analysis.total_files_scanned,
                "error_message": analysis.error_message,
                "analysis_version": analysis.analysis_version,
            },
        )


repo_analysis_service = RepoAnalysisService()
