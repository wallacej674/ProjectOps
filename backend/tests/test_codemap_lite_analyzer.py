from app.services.codemap_lite_analyzer import analyze_repo_paths


def test_analyzer_detects_project_support_files_and_folders():
    result = analyze_repo_paths(
        [
            "README.md",
            ".env.example",
            "docker-compose.yml",
            ".github/workflows/ci.yml",
            "tests/test_health.py",
        ]
    )

    assert result.signals["has_readme"] is True
    assert result.signals["has_env_example"] is True
    assert result.signals["has_docker"] is True
    assert result.signals["has_ci"] is True
    assert result.signals["has_tests"] is True
    assert result.total_files_scanned == 5


def test_analyzer_detects_python_backend_stack_signals():
    result = analyze_repo_paths(
        [
            "backend/pyproject.toml",
            "backend/app/main.py",
            "backend/app/repositories/projects.py",
            "backend/alembic/env.py",
            "backend/alembic/versions/0001_create_projects.py",
        ]
    )

    assert result.signals["has_backend"] is True
    assert result.signals["has_python"] is True
    assert result.signals["has_fastapi"] is True
    assert result.signals["has_sqlalchemy"] is True
    assert result.signals["has_migrations"] is True
    assert result.signals["has_alembic"] is True
    assert result.detected_stack["languages"] == ["python"]
    assert result.detected_stack["frameworks"] == ["fastapi"]
    assert result.detected_stack["tools"] == ["alembic", "sqlalchemy"]


def test_analyzer_detects_react_vite_typescript_frontend_signals():
    result = analyze_repo_paths(
        [
            "frontend/package.json",
            "frontend/src/App.tsx",
            "frontend/src/main.tsx",
            "frontend/vite.config.ts",
        ]
    )

    assert result.signals["has_frontend"] is True
    assert result.signals["has_react"] is True
    assert result.signals["has_typescript"] is True
    assert result.signals["has_vite"] is True
    assert result.detected_stack["languages"] == ["typescript"]
    assert result.detected_stack["frameworks"] == ["react", "vite"]


def test_analyzer_summary_only_claims_detected_signals():
    result = analyze_repo_paths(
        [
            "backend/pyproject.toml",
            "backend/app/main.py",
            "backend/tests/test_health.py",
        ]
    )

    assert "Python backend" in result.summary
    assert "tests" in result.summary
    assert "React" not in result.summary
    assert "Docker" not in result.summary
    assert "GitHub Actions" not in result.summary
