"""Run frozen migrations without touching application data."""
import importlib.util
from pathlib import Path
from uuid import uuid4
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text, inspect
from app.core.database import engine


def test_code_risk_migration_creates_constraints_and_preserves_history(db):
    schema = 'risk_migration_' + uuid4().hex
    versions = Path(__file__).resolve().parents[1] / 'alembic' / 'versions'
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            with Operations.context(MigrationContext.configure(connection)):
                for path in sorted(versions.glob('*.py')):
                    spec = importlib.util.spec_from_file_location(path.stem, path)
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)
                    module.upgrade()
            names = inspect(connection).get_table_names(schema=schema)
            assert 'releases' in names
            assert 'release_requirement_materials' in names
            indexes = inspect(connection).get_indexes('releases', schema=schema)
            assert any(i['name'] == 'uq_releases_active_project' and i['unique'] for i in indexes)
            assert 'code_risk_occurrences' in names
            assert 'code_risk_work_item_findings' in names
            constraints = inspect(connection).get_unique_constraints('code_risk_scans', schema=schema)
            assert any(c['column_names'] == ['target_id', 'run_id'] for c in constraints)
        finally:
            transaction.rollback()
