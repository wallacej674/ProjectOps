"""Worker startup is checked through its operator command before paid dispatch."""
import os
from pathlib import Path
import subprocess
import sys


def test_worker_preflight_rejects_missing_provider_without_disclosing_configuration():
    environment = {**os.environ, 'OPENAI_API_KEY': '', 'PROJECTOPS_ENVIRONMENT': 'test'}
    result = subprocess.run([sys.executable, '-m', 'app.jobs.rehearsal_worker_preflight', '--timeout', '0'],
        cwd=Path(__file__).parents[1], env=environment, capture_output=True, text=True, timeout=15)
    assert result.returncode == 1
    assert 'OpenAI access is not configured' in result.stderr
    assert 'postgresql' not in result.stderr
    assert 'Traceback' not in result.stderr

def test_worker_preflight_waits_for_exact_schema_head_without_applying_migrations(db):
    from sqlalchemy import text
    environment = {**os.environ, 'OPENAI_API_KEY': '', 'PROJECTOPS_ENVIRONMENT': 'test',
                   'PROJECTOPS_REGISTRATION_MODE': 'open'}
    command = [sys.executable, '-m', 'app.jobs.rehearsal_worker_preflight', '--schema-only', '--timeout', '0']
    def check():
        return subprocess.run(command, cwd=Path(__file__).parents[1], env=environment,
                              capture_output=True, text=True, timeout=15)
    absent = check()
    assert absent.returncode == 1
    assert 'Database migrations are not at the required revision' in absent.stderr
    db.execute(text('CREATE TABLE alembic_version (version_num VARCHAR(32) PRIMARY KEY)'))
    db.execute(text("INSERT INTO alembic_version VALUES ('0017_release_workspace')"))
    db.commit()
    assert check().returncode == 1
    assert db.scalar(text('SELECT version_num FROM alembic_version')) == '0017_release_workspace'
    db.execute(text("UPDATE alembic_version SET version_num='0022_ci_evidence'"))
    db.commit()
    ready = check()
    assert ready.returncode == 0, ready.stderr
    assert 'preflight passed' in ready.stdout
    db.execute(text('DROP TABLE alembic_version'))
    db.commit()
