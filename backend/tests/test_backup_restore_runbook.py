from pathlib import Path


RUNBOOK = Path(__file__).resolve().parents[2] / "docs" / "backup-restore-runbook.md"
DEPLOYMENT_READINESS = (
    Path(__file__).resolve().parents[2] / "docs" / "deployment-readiness.md"
)
GITIGNORE = Path(__file__).resolve().parents[2] / ".gitignore"


def test_backup_restore_runbook_covers_launch_recovery_controls():
    contents = RUNBOOK.read_text(encoding="utf-8").lower()

    required_phrases = [
        "managed postgresql with automated backups enabled",
        "point-in-time recovery",
        "recovery point objective",
        "recovery time objective",
        "pg_dump",
        "pg_restore",
        "restore to a new database",
        "python -m alembic current",
        "python -m alembic upgrade head",
        "alembic downgrade -1",
        "projectops_environment=production",
        "delete local drill dumps",
        "never commit",
    ]

    for phrase in required_phrases:
        assert phrase in contents


def test_deployment_readiness_links_recovery_runbook():
    contents = DEPLOYMENT_READINESS.read_text(encoding="utf-8")

    assert "docs/backup-restore-runbook.md" in contents
    assert "Backup And Restore" in contents


def test_database_dump_outputs_are_gitignored():
    contents = GITIGNORE.read_text(encoding="utf-8")

    assert "backups/" in contents
    assert "*.dump" in contents
    assert "*.backup" in contents
    assert "*.sql" in contents
