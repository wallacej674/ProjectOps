from app.schemas.project import ProjectCreate
from app.schemas.repo_integration import RepoIntegrationCreate
from app.services.projects import project_service
from app.services.repo_integrations import repo_integration_service


def test_repo_intake_service_replaces_existing_repo_connection(db):
    project = project_service.create_project(
        db,
        ProjectCreate(
            name="LaunchBudget",
            description="A budgeting app for product launches.",
            repo_url=None,
            production_url=None,
            status="development",
        ),
    )
    first_repo = repo_integration_service.attach_github_repo(
        db,
        project.id,
        RepoIntegrationCreate(repo_url="https://github.com/openai/codex"),
    )

    second_repo = repo_integration_service.attach_github_repo(
        db,
        project.id,
        RepoIntegrationCreate(repo_url="https://github.com/python/cpython.git"),
    )

    assert second_repo.id == first_repo.id
    assert second_repo.repo_owner == "python"
    assert second_repo.repo_name == "cpython"
    assert second_repo.repo_url == "https://github.com/python/cpython"
    assert second_repo.default_branch is None
    assert second_repo.last_verified_at is None
