from app.services.codemap_medium_analyzer import analyze_manifest_contents


def test_manifest_analysis_derives_evidence_backed_repository_insights():
    result = analyze_manifest_contents(
        {
            "package.json": '{"engines":{"node":">=20"},"dependencies":{"react":"19"},"devDependencies":{"vite":"6","typescript":"5"},"scripts":{"dev":"vite","test":"vitest","lint":"eslint .","build":"vite build"}}',
            "package-lock.json": "{}",
            "backend/pyproject.toml": '[project]\nrequires-python = ">=3.11"\ndependencies = ["fastapi>=0.111", "sqlalchemy>=2", "alembic>=1.13"]',
            ".github/workflows/ci.yml": "name: CI",
            "Dockerfile": "FROM python:3.11",
        }
    )

    assert result.insights["runtimes"] == ["node >=20", "python >=3.11"]
    assert result.insights["package_managers"] == ["npm", "pip"]
    assert result.insights["frameworks"] == ["alembic", "fastapi", "react", "sqlalchemy", "typescript", "vite"]
    assert result.insights["commands"]["test"] == ["npm run test"]
    assert result.insights["dependency_counts"] == {"runtime": 4, "development": 2}
    assert result.insights["operational_signals"] == ["containers", "github_actions"]
    assert result.evidence_files["framework:fastapi"] == ["backend/pyproject.toml"]


def test_manifest_analysis_reports_malformed_and_skipped_files_without_failing():
    result = analyze_manifest_contents({"package.json": "not-json"}, ["README.md"])

    assert "package.json could not be parsed safely." in result.warnings
    assert any("were skipped" in warning for warning in result.warnings)


def test_manifest_analysis_respects_declared_javascript_package_manager():
    result = analyze_manifest_contents(
        {"package.json": '{"packageManager":"pnpm@10.0.0"}', "pnpm-lock.yaml": "lockfileVersion: 9"}
    )

    assert result.insights["package_managers"] == ["pnpm"]
    assert result.evidence_files["package_manager:pnpm"] == ["package.json", "pnpm-lock.yaml"]
