from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.ci_pipeline_run import CiPipelineRun
from app.models.project import Project
from app.models.repo_integration import RepoIntegration
from app.repositories.ci_pipeline_runs import ci_pipeline_run_repository
from app.repositories.repo_integrations import repo_integration_repository
from app.services.ci_monitor_state import lock_monitor as lock_ci_monitor
from app.services.ci_status_monitor_schedules import ci_status_monitor_schedule_service
from app.services.github_actions_client import (
    GitHubActionsClient,
    GitHubActionsFetchError,
    GitHubActionsPermissionMissingError,
    GitHubActionsRepositoryNotFoundError,
)
from app.services.github_app import GitHubAppAuthorizationError, GitHubAppConfigurationError, github_app_service
from app.services.projects import project_service

COMMIT_MESSAGE_MAX_LENGTH = 500


class CiRepoNotConnectedError(Exception):
    pass


class CiGitHubAppRequiredError(Exception):
    pass


class CiActionsPermissionMissingError(Exception):
    pass


class CiRepositoryAccessRevokedError(Exception):
    pass


class CiSyncFailedError(Exception):
    pass


class CiStatusNotFoundError(Exception):
    pass


class CiSyncResult:
    def __init__(self, new_count: int, updated_count: int, latest_run: CiPipelineRun | None) -> None:
        self.new_count = new_count
        self.updated_count = updated_count
        self.latest_run = latest_run


def _parse_github_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class CiPipelineStatusService:
    def __init__(self, client_factory=GitHubActionsClient) -> None:
        self.client_factory = client_factory

    def sync_project_ci_status(
        self,
        db: Session,
        project_id: int,
        execution_source: str = "manual",
    ) -> CiSyncResult:
        project_service.get_project(db, project_id)
        repo = repo_integration_repository.get_by_project_id(db, project_id)
        if repo is None:
            raise CiRepoNotConnectedError(f"Project {project_id} does not have a connected repository.")
        if repo.github_installation_id is None:
            raise CiGitHubAppRequiredError(
                "Connect this repository through GitHub App to see build status."
            )

        try:
            token = github_app_service.installation_token(get_settings(), repo.github_installation_id)
            client = self.client_factory(access_token=token)
            runs_payload = client.fetch_workflow_runs(repo.repo_owner, repo.repo_name, branch=repo.default_branch, per_page=10)
        except GitHubActionsPermissionMissingError as error:
            self._record_sync_outcome(db, project_id, "permission_missing")
            raise CiActionsPermissionMissingError(str(error)) from error
        except GitHubActionsRepositoryNotFoundError as error:
            self._record_sync_outcome(db, project_id, "repo_not_found")
            raise CiRepositoryAccessRevokedError(str(error)) from error
        except (GitHubAppAuthorizationError, GitHubAppConfigurationError, GitHubActionsFetchError) as error:
            self._record_sync_outcome(db, project_id, "sync_error")
            raise CiSyncFailedError(str(error)) from error

        new_count = 0
        updated_count = 0
        transitioned_runs: list[CiPipelineRun] = []
        for payload in runs_payload:
            run, is_new, conclusion_changed = self._upsert_run(db, project_id, repo, payload)
            if is_new:
                new_count += 1
            else:
                updated_count += 1
            if is_new and run.conclusion is not None or conclusion_changed:
                transitioned_runs.append(run)

        for run in transitioned_runs:
            self._record_run_activity(db, run)

        self._record_sync_outcome(db, project_id, "synced" if runs_payload else "no_runs_found")
        latest_run = ci_pipeline_run_repository.get_latest_by_project_id(db, project_id)
        return CiSyncResult(new_count=new_count, updated_count=updated_count, latest_run=latest_run)

    def get_latest_project_ci_run(self, db: Session, project_id: int) -> CiPipelineRun:
        project_service.get_project(db, project_id)
        run = ci_pipeline_run_repository.get_latest_by_project_id(db, project_id)
        if run is None:
            raise CiStatusNotFoundError(f"Project {project_id} does not have any observed CI runs yet.")
        return run

    def list_project_ci_runs(self, db: Session, project_id: int) -> list[CiPipelineRun]:
        project_service.get_project(db, project_id)
        return ci_pipeline_run_repository.list_by_project_id(db, project_id)

    def list_latest_ci_status_for_owner(
        self, db: Session, owner_user_id: int
    ) -> list[tuple[Project, RepoIntegration | None, CiPipelineRun | None]]:
        projects = project_service.list_projects(db, owner_user_id=owner_user_id)
        projects_sorted = sorted(projects, key=lambda project: project.name.lower())
        results = []
        for project in projects_sorted:
            repo = repo_integration_repository.get_by_project_id(db, project.id)
            latest_run = ci_pipeline_run_repository.get_latest_by_project_id(db, project.id) if repo else None
            results.append((project, repo, latest_run))
        return results

    def _upsert_run(self, db: Session, project_id: int, repo: RepoIntegration, payload: dict) -> tuple[CiPipelineRun, bool, bool]:
        commit_message = None
        head_commit = payload.get("head_commit") or {}
        if head_commit.get("message"):
            commit_message = head_commit["message"].splitlines()[0][:COMMIT_MESSAGE_MAX_LENGTH]

        status = payload.get("status") or "unknown"
        conclusion = payload.get("conclusion")
        run_started_at = _parse_github_timestamp(payload.get("run_started_at"))
        run_completed_at = _parse_github_timestamp(payload.get("updated_at")) if status == "completed" else None
        duration_seconds = None
        if run_started_at is not None and run_completed_at is not None:
            duration_seconds = max(0, round((run_completed_at - run_started_at).total_seconds()))

        run = CiPipelineRun(
            project_id=project_id,
            repo_integration_id=repo.id,
            github_run_id=int(payload["id"]),
            github_workflow_id=int(payload["workflow_id"]) if payload.get("workflow_id") else None,
            workflow_name=(payload.get("name") or "workflow")[:255],
            run_number=payload.get("run_number"),
            status=status,
            conclusion=conclusion,
            branch=(payload.get("head_branch") or None),
            commit_sha=(payload.get("head_sha") or None),
            commit_message=commit_message,
            event=(payload.get("event") or None),
            html_url=(payload.get("html_url") or None),
            run_started_at=run_started_at,
            run_completed_at=run_completed_at,
            duration_seconds=duration_seconds,
            observed_at=datetime.now(timezone.utc),
        )
        return ci_pipeline_run_repository.upsert(db, run)

    def _record_run_activity(self, db: Session, run: CiPipelineRun) -> None:
        from app.services.activity import activity_service

        if run.conclusion == "success":
            event_type = "ci_run_succeeded"
        elif run.conclusion == "failure":
            event_type = "ci_run_failed"
        else:
            event_type = "ci_run_other_conclusion"

        activity_service.record_event(
            db,
            project_id=run.project_id,
            event_type=event_type,
            event_category="ci",
            message=f"Workflow \"{run.workflow_name}\" on {run.branch or 'unknown branch'} finished as {run.conclusion or run.status}.",
            related_resource_type="ci_pipeline_run",
            related_resource_id=run.id,
            metadata={
                "workflow_name": run.workflow_name,
                "status": run.status,
                "conclusion": run.conclusion,
                "branch": run.branch,
                "commit_sha": run.commit_sha,
                "html_url": run.html_url,
            },
        )

    def _record_sync_outcome(self, db: Session, project_id: int, outcome: str) -> None:
        project, schedule = lock_ci_monitor(db, project_id)
        if schedule is None:
            db.rollback()
            return
        now = datetime.now(timezone.utc)
        schedule.last_completed_at = now
        schedule.last_outcome = outcome
        schedule.consecutive_sync_failures = 0 if outcome in ("synced", "no_runs_found") else schedule.consecutive_sync_failures + 1
        db.commit()


ci_pipeline_status_service = CiPipelineStatusService()
