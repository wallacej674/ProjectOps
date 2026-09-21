"""Bounded worker startup checks; never runs migrations or provider requests."""
import argparse
from pathlib import Path
import sys
import time
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import get_settings
from app.services.rehearsal_provider import provider_available


def wait_until_ready(timeout=180, *, require_provider=True):
    if not 0 <= timeout <= 300:
        raise RuntimeError('Startup timeout must be between 0 and 300 seconds.')
    if require_provider and not provider_available():
        raise RuntimeError('OpenAI access is not configured.')
    settings = get_settings()
    settings.validate_auth_settings()
    settings.cors_origins()
    backend = Path(__file__).resolve().parents[2]
    config = Config(str(backend / 'alembic.ini'))
    config.set_main_option('script_location', str(backend / 'alembic'))
    expected = set(ScriptDirectory.from_config(config).get_heads())
    engine = create_engine(settings.database_url, connect_args={
        'connect_timeout': 5, 'options': '-c statement_timeout=5000'})
    deadline = time.monotonic() + timeout
    try:
        while True:
            try:
                with engine.connect() as connection:
                    current = set(MigrationContext.configure(connection).get_current_heads())
                if current == expected:
                    return
            except SQLAlchemyError:
                pass
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise RuntimeError('Database migrations are not at the required revision or the database is unavailable. The API deploy must migrate first.')
            time.sleep(min(5, remaining))
    finally:
        engine.dispose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--timeout', type=float, default=180)
    parser.add_argument('--schema-only', action='store_true', help='For non-AI scheduled jobs.')
    args = parser.parse_args()
    try:
        wait_until_ready(args.timeout, require_provider=not args.schema_only)
    except (RuntimeError, ValueError):
        # No configuration values, driver exceptions or connection strings in logs.
        message = 'Database migrations are not at the required revision, OpenAI access is not configured, or startup configuration is invalid.'
        print(f'Rehearsal worker preflight failed: {message}', file=sys.stderr)
        return 1
    print('Rehearsal worker preflight passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
