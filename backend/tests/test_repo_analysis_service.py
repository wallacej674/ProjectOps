from app.schemas.project import ProjectCreate
from app.schemas.repo_integration import RepoIntegrationCreate
from app.services.projects import project_service
from app.services.repo_analyses import repo_analysis_service
from app.services.repo_integrations import repo_integration_service


class FakeTreeFetcher:
    def fetch_tree_paths(self, repo_owner: str, repo_name: str) -> list[str]:
        assert repo_owner == "openai"
        assert repo_name == "codex"
        return [
            "README.md",
            "backend/pyproject.toml",
            "backend/app/main.py",
            "backend/tests/test_health.py",
            ".github/workflows/ci.yml",
        ]


class FakeSnapshotFetcher:
    def fetch_repository_snapshot(self, repo_owner: str, repo_name: str):
        from app.services.github_repo_tree_fetcher import GitHubRepositorySnapshot

        return GitHubRepositorySnapshot(
            paths=["package.json", "package-lock.json", ".github/workflows/ci.yml"],
            manifest_contents={
                "package.json": '{"dependencies":{"react":"19"},"scripts":{"test":"vitest"}}',
                "package-lock.json": "{}",
                ".github/workflows/ci.yml": "name: CI",
            },
            skipped_files=[],
        )


def test_repo_analysis_service_stores_completed_analysis_snapshot(db):
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
    repo_integration = repo_integration_service.attach_github_repo(
        db,
        project.id,
        RepoIntegrationCreate(repo_url="https://github.com/openai/codex"),
    )

    analysis = repo_analysis_service.run_analysis(db, project.id, tree_fetcher=FakeTreeFetcher())

    assert analysis.project_id == project.id
    assert analysis.repo_integration_id == repo_integration.id
    assert analysis.status == "completed"
    assert analysis.error_message is None
    assert analysis.total_files_scanned == 5
    assert analysis.signals["has_readme"] is True
    assert analysis.signals["has_backend"] is True
    assert analysis.signals["has_python"] is True
    assert analysis.signals["has_ci"] is True
    assert "Python backend" in analysis.summary


def test_repo_analysis_service_stores_manifest_insights_and_evidence(db):
    project = project_service.create_project(
        db,
        ProjectCreate(name="Insight", description=None, repo_url=None, production_url=None, status="development"),
    )
    repo_integration_service.attach_github_repo(
        db, project.id, RepoIntegrationCreate(repo_url="https://github.com/openai/codex")
    )

    analysis = repo_analysis_service.run_analysis(db, project.id, tree_fetcher=FakeSnapshotFetcher())

    assert analysis.analysis_version == "codemap_medium_v1"
    assert analysis.insights["frameworks"] == ["react"]
    assert analysis.insights["commands"]["test"] == ["npm run test"]
    assert analysis.evidence_files["framework:react"] == ["package.json"]
    assert analysis.inspected_files == [".github/workflows/ci.yml", "package-lock.json", "package.json"]
