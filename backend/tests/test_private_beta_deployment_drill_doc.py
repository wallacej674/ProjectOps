from pathlib import Path


DRILL_DOC = Path(__file__).resolve().parents[2] / "docs" / "private-beta-deployment-drill.md"


def test_private_beta_deployment_drill_doc_covers_required_sections():
    contents = DRILL_DOC.read_text(encoding="utf-8").lower()

    required_phrases = [
        "provider stack",
        "backend deployment settings",
        "frontend deployment settings",
        "database provider and migration settings",
        "environment variable checklist",
        "migration command",
        "health check results",
        "auth smoke test",
        "product smoke test",
        "observability smoke test",
        "request id correlation proof",
        "backup and pitr status",
        "rollback notes",
        "private-beta go/no-go checklist",
        "pending provider access",
    ]

    for phrase in required_phrases:
        assert phrase in contents


def test_private_beta_deployment_drill_doc_warns_against_committing_secrets():
    contents = DRILL_DOC.read_text(encoding="utf-8").lower()

    assert "do not paste real secrets" in contents
    assert "sentry dsn" in contents
    assert "database url" in contents
    assert "auth secret" in contents
