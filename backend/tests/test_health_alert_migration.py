"""Exercise frozen migrations in an isolated, transactionally discarded schema."""
import importlib.util
from pathlib import Path
from uuid import uuid4
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text
from app.core.database import engine


def test_alert_migration_preserves_existing_observations_without_backfill(db):
    schema = "alert_migration_" + uuid4().hex
    versions = Path(__file__).resolve().parents[1] / "alembic" / "versions"
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            with Operations.context(MigrationContext.configure(connection)):
                for path in sorted(versions.glob("*.py")):
                    spec = importlib.util.spec_from_file_location(path.stem, path)
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)
                    if path.name.startswith("0014"):
                        connection.execute(text("INSERT INTO projects (id, name, status) VALUES (1, 'Migration Project', 'development')"))
                        connection.execute(text("INSERT INTO health_checks (project_id, target_url, status, execution_source, checked_at) VALUES (1, 'https://example.com', 'unhealthy', 'scheduled', CURRENT_TIMESTAMP)"))
                        connection.execute(text("INSERT INTO health_monitor_schedules (project_id, enabled, cadence_minutes, consecutive_failures) VALUES (1, true, 15, 8)"))
                    module.upgrade()
            assert connection.scalar(text("SELECT count(*) FROM health_checks")) == 1
            assert connection.scalar(text("SELECT count(*) FROM health_alerts")) == 0
            row = connection.execute(text("SELECT consecutive_failures, consecutive_healthy, sequence_started_at, next_run_at FROM health_monitor_schedules")).one()
            assert row[0:2] == (0, 0)
            assert row[2] is not None and row[3] > row[2]
            assert connection.scalar(text("SELECT count(*) FROM pg_indexes WHERE schemaname = :schema AND indexname = 'uq_health_alert_active_project'"), {"schema": schema}) == 1
        finally:
            transaction.rollback()
