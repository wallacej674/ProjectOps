# Backup, Restore, and Migration Rollback Runbook

ProjectOps stores product data in PostgreSQL. Database dumps, snapshots, and
restored databases contain sensitive customer data such as emails, password
hashes, Project metadata, artifact notes, readiness evidence, and activity
history. Treat every backup as production data unless you can prove otherwise.

## Recovery Targets

For a private beta launch, use these starting targets:

- Recovery point objective: no more than 24 hours of data loss.
- Recovery time objective: restore a usable database within 2 hours.
- Backup retention: at least 7 days for private beta, and at least 30 days
  before paid or external-customer production use.

Tighten these targets before ProjectOps becomes business critical.

## Production Backup Policy

Before sending real users to ProjectOps:

1. Use managed PostgreSQL with automated backups enabled.
2. Enable point-in-time recovery when the provider supports it.
3. Confirm backups are encrypted at rest.
4. Restrict backup, snapshot, and database-export access to deployment owners.
5. Keep database dumps out of git, tickets, chat, and shared screenshots.
6. Store any manual dump in an encrypted location with an expiration plan.
7. Run a restore drill before launch and after any major migration milestone.

Do not restore over the production database as a first step. Restore to a new
database, verify it, then cut traffic over only after the rollback decision is
made.

## Local Backup Drill

Use local drills to practice the commands without touching production.

From the repository root:

```powershell
docker compose up -d db
New-Item -ItemType Directory -Force backups
docker compose exec db pg_dump -U projectops -d projectops -Fc -f /tmp/projectops-local.dump
docker compose cp projectops-db:/tmp/projectops-local.dump .\backups\projectops-local.dump
```

The dump file in `backups/` is intentionally ignored by git through the
directory name pattern. Delete local dumps when the drill is complete.

## Local Restore Drill

Restore only into a disposable database during drills.

From the repository root:

```powershell
docker compose cp .\backups\projectops-local.dump projectops-db:/tmp/projectops-local.dump
docker compose exec db dropdb -U projectops --if-exists projectops_restore
docker compose exec db createdb -U projectops projectops_restore
docker compose exec db pg_restore -U projectops -d projectops_restore --clean --if-exists /tmp/projectops-local.dump
```

Then point a temporary backend session at the restored database and smoke test:

```powershell
cd backend
$env:PROJECTOPS_DATABASE_URL = "postgresql+psycopg://projectops:projectops@localhost:55432/projectops_restore"
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe scripts\check_config.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Verify:

1. `GET /health` responds.
2. `GET /health/db` responds.
3. Existing Projects, artifacts, readiness evidence, and activity history load.
4. Registering or signing in still works in the restored environment.

## Migration Release Checklist

Before running a production migration:

1. Confirm `PROJECTOPS_ENVIRONMENT=production` and the expected
   `PROJECTOPS_DATABASE_URL` are configured in the backend host.
2. Record the current database revision:

```bash
python -m alembic current
```

3. Take or verify a fresh managed database backup or snapshot.
4. Confirm the latest restore drill succeeded.
5. Run migrations before serving new backend traffic:

```bash
python -m alembic upgrade head
```

6. Smoke test `/health`, `/health/db`, sign-in, Project list, Project detail,
   readiness, artifacts, and activity.

## Migration Rollback Strategy

Use the lowest-risk rollback path for the failure type:

- App deploy failed and the migration has not run: roll back the app deploy.
- Migration failed before changing data: fix the migration and rerun after
  verifying the database state.
- Migration changed schema or data and the app is unhealthy: prefer provider
  point-in-time recovery or a verified snapshot restore to a new database.
- A tested downgrade exists and no incompatible app traffic has written data:
  `alembic downgrade -1` may be used as a controlled rollback.

Practice downgrade mechanics locally:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic downgrade -1
.\.venv\Scripts\python.exe -m alembic upgrade head
```

For production, do not rely on `alembic downgrade -1` unless the specific
migration has been tested both directions against representative data.

## Production Restore Procedure

When a restore is needed:

1. Stop or pause writes to the affected environment if the provider supports it.
2. Preserve the current broken database for investigation.
3. Restore the selected backup or point-in-time target to a new database.
4. Run `python -m alembic current` against the restored database.
5. Run `python scripts/check_config.py` against the restored environment.
6. Start one backend instance against the restored database.
7. Smoke test `/health`, `/health/db`, auth, Project list, Project detail, and
   one write operation in the restored environment.
8. Cut traffic to the restored database only after the checks pass.
9. Record the request IDs, database revision, backup timestamp, restore target,
   and operator notes in a ProjectOps incident artifact.

## Security Rules For Backups

- Never commit `*.dump`, `*.sql`, `*.backup`, or copied database volumes.
- Never paste a production connection string into a PR, issue, chat, or log.
- Never email an unencrypted database export.
- Rotate database credentials if a backup or connection string is exposed.
- Delete local drill dumps after verification.
- Keep restore access separate from normal app-user access.

## Launch Readiness Sign-Off

ProjectOps is ready for private beta traffic only after:

1. Managed PostgreSQL automated backups are enabled.
2. The configured backup retention matches the recovery target.
3. A local restore drill has been completed.
4. A provider restore drill or snapshot restore has been completed.
5. The migration rollback strategy has been reviewed for the current release.
6. The smoke checklist in `docs/deployment-readiness.md` passes.

Record the provider backup/PITR status and private-beta go/no-go decision in
`docs/private-beta-deployment-drill.md`. Do not paste real database URLs,
backup contents, provider tokens, or screenshots that reveal secrets.
