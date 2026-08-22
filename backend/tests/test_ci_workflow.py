from pathlib import Path


def test_ci_workflow_runs_dependency_security_scans():
    workflow = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "ci.yml"
    contents = workflow.read_text(encoding="utf-8")

    assert "Dependency Security Scan" in contents
    assert "python -m pip_audit" in contents
    assert "npm run audit" in contents
