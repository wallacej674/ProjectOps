from datetime import datetime, timedelta, timezone

from app.services.ci_pipeline_status import ci_pipeline_status_service
from app.services.ci_status_monitor_schedules import ci_status_monitor_schedule_service
from app.services.github_actions_client import GitHubActionsPermissionMissingError
from app.services.github_app import github_app_service
from app.services.projects import project_service
from app.schemas.ci_status_monitor_schedule import CiStatusMonitorScheduleUpdate
from app.repositories.repo_integrations import repo_integration_repository
from app.schemas.project import ProjectCreate
from app.services.scheduled_ci_status_checks import run_scheduled_checks

from tests.test_ci_pipeline_status import FakeGitHubActionsClient, workflow_run_payload


def make_project_with_ci_monitor(db, *, name: str, installation_id: int, cadence_minutes: int = 15):
    project = project_service.create_project(db, ProjectCreate(name=name, status="development"), owner_user_id=1)
    repo_integration_repository.upsert_github_app_repo(
        db, project.id, installation_id=installation_id,
        repository={"id": installation_id, "full_name": "acme/widgets", "html_url": "https://github.com/acme/widgets",
                     "default_branch": "main", "private": False},
    )
    ci_status_monitor_schedule_service.update_for_project(
        db, project.id, CiStatusMonitorScheduleUpdate(enabled=True, cadence_minutes=cadence_minutes)
    )
    return project


def test_run_scheduled_checks_syncs_due_project_and_advances_next_run(client, db, monkeypatch):
    # `client` fixture creates the authenticated user (id=1) that owns projects created below.
    client.get("/api/v1/projects")
    project = make_project_with_ci_monitor(db, name="Scheduled Project", installation_id=1)

    FakeGitHubActionsClient.runs_to_return = [workflow_run_payload()]
    FakeGitHubActionsClient.calls = []
    monkeypatch.setattr(ci_pipeline_status_service, "client_factory", FakeGitHubActionsClient)
    monkeypatch.setattr(github_app_service, "installation_token", lambda settings, installation_id: "fake-token")

    now = datetime.now(timezone.utc) + timedelta(minutes=20)
    completed = run_scheduled_checks(db, now=now)

    assert completed == 1
    latest = ci_pipeline_status_service.get_latest_project_ci_run(db, project.id)
    assert latest.conclusion == "success"
    monitor = ci_status_monitor_schedule_service.get_for_project(db, project.id)
    assert monitor.last_outcome == "synced"
    assert monitor.next_run_at > now


def test_run_scheduled_checks_skips_permission_missing_without_raising(client, db, monkeypatch):
    client.get("/api/v1/projects")
    project = make_project_with_ci_monitor(db, name="Unauthorized Project", installation_id=2)

    class RaisingClient:
        def __init__(self, access_token: str) -> None:
            pass

        def fetch_workflow_runs(self, *args, **kwargs):
            raise GitHubActionsPermissionMissingError("nope")

    monkeypatch.setattr(ci_pipeline_status_service, "client_factory", RaisingClient)
    monkeypatch.setattr(github_app_service, "installation_token", lambda settings, installation_id: "fake-token")

    now = datetime.now(timezone.utc) + timedelta(minutes=20)
    completed = run_scheduled_checks(db, now=now)

    # An expected, already-recorded sync failure (needs re-authorization) is not counted as a
    # completed sync, but it must not raise ScheduledCiStatusRunError either — the scheduler
    # should just move on to the next due project.
    assert completed == 0
    monitor = ci_status_monitor_schedule_service.get_for_project(db, project.id)
    assert monitor.last_outcome == "permission_missing"
    assert monitor.consecutive_sync_failures == 1
