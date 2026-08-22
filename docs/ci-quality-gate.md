# CI Quality Gate

Milestone 20 adds a minimal GitHub Actions quality gate for ProjectOps. The
workflow checks release confidence only; it does not deploy ProjectOps, publish
images, create releases, or manage production secrets.

Workflow file:

```text
.github/workflows/ci.yml
```

## When CI Runs

The workflow runs on:

- Pushes to `main`.
- Pull requests targeting `main`.

ProjectOps intentionally avoids path filters for now. Backend, frontend, and
documentation changes can affect production readiness, so the full quality gate
runs for every pull request.

## CI Jobs

### Backend

The backend job uses Python 3.11 and a disposable PostgreSQL 16 service
container. It installs backend dependencies from `backend/pyproject.toml` with
the `dev` extra, then runs:

```bash
python -m alembic upgrade head
python -m pytest
python -m compileall app tests
python scripts/check_config.py
```

These checks verify that migrations apply, tests pass, Python files compile,
and deployment-critical backend settings are valid for a safe test
configuration.

### Frontend

The frontend job uses Node.js 20 and installs dependencies with `npm ci` from
`frontend/package-lock.json`, then runs:

```bash
npm test
npm run lint
npm run build
```

`VITE_API_BASE_URL` is set to `http://127.0.0.1:8000` so the production build
exercises the deployment-aware API URL guard without relying on a real backend.

### Dependency Security Scan

The dependency security scan job installs the backend and frontend dependency
trees, then runs:

```bash
python -m pip_audit
npm run audit
```

`pip-audit` checks installed Python packages against known vulnerability
advisories. `npm run audit` wraps `npm audit --audit-level=high`, so high and
critical npm advisories fail CI. The job uses the same read-only workflow
permissions and does not require production secrets.

### Diff Hygiene

The diff hygiene job runs:

```bash
git diff --check
```

Locally, this checks your current working-tree diff. In GitHub Actions, the job
checks the pull-request or push commit range so it catches whitespace errors in
committed changes before merge.

## CI Environment

The backend CI database is a GitHub Actions service container, not a hosted or
production database.

Safe CI backend variables:

```text
PROJECTOPS_ENVIRONMENT=test
PROJECTOPS_DATABASE_URL=postgresql+psycopg://projectops:projectops@localhost:5432/projectops_test
PROJECTOPS_TEST_DATABASE_URL=postgresql+psycopg://projectops:projectops@localhost:5432/projectops_test
PROJECTOPS_CORS_ALLOWED_ORIGINS=http://localhost:5173
PROJECTOPS_HEALTH_CHECK_TIMEOUT_SECONDS=5
PROJECTOPS_AUTH_SECRET_KEY=ci-only-auth-secret-for-projectops-tests
PROJECTOPS_ACCESS_TOKEN_EXPIRE_MINUTES=60
```

Safe CI frontend variable:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

These are test-only values. The workflow does not require repository secrets and
does not print database URLs or production configuration.

## Run Equivalent Checks Locally

From the repository root:

```powershell
docker compose up -d
```

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m compileall app tests
.\.venv\Scripts\python.exe scripts\check_config.py
.\.venv\Scripts\python.exe -m pip_audit
```

Frontend:

```powershell
cd frontend
npm test
npm run lint
$env:VITE_API_BASE_URL = "http://127.0.0.1:8000"
npm run build
npm run audit
```

Diff hygiene:

```powershell
git diff --check
```

## Common Failures

Migration failure:

- Confirm `PROJECTOPS_DATABASE_URL` points to a PostgreSQL database.
- Confirm the database service is healthy.
- Check new Alembic migrations for missing model imports or invalid SQL.

Backend test failure:

- Run the failing test locally from `backend`.
- Confirm Docker Compose is running locally.
- Remember that tests use `PROJECTOPS_TEST_DATABASE_URL` and reset tables for
  tests that use the database fixtures.

Config check failure:

- Verify `PROJECTOPS_CORS_ALLOWED_ORIGINS` is set.
- In production-like checks, do not use wildcard CORS.
- Set `PROJECTOPS_AUTH_SECRET_KEY` to a non-default secret for production-like
  checks.
- The config script should fail with a concise message, not a traceback.

Frontend test failure:

- Run `npm test` from `frontend`.
- Frontend tests mock `fetch`; failures usually come from UI behavior,
  accessibility, routing, or API-client contract changes rather than a live
  backend outage.

Frontend build failure:

- Run `npm run build` from `frontend`.
- Set `VITE_API_BASE_URL` before production-mode builds.
- Fix TypeScript errors before investigating Vite output.

Lint failure:

- Run `npm run lint` from `frontend`.
- Prefer small, local fixes over disabling lint rules globally.

Dependency security scan failure:

- For backend failures, inspect the `pip-audit` package, version, advisory, and
  fixed-version output, then raise the affected package constraint and rerun
  backend tests.
- For frontend failures, run `npm audit` from `frontend`; if the fix is
  compatible with current semver ranges, use `npm audit fix`, then rerun
  frontend tests, lint, and build.
- Do not ignore advisories unless there is a documented false positive or an
  explicit risk acceptance decision.

Whitespace failure:

- Run `git diff --check` from the repository root.
- Remove trailing whitespace or conflict markers reported by Git.

## Branch Protection Recommendation

Configure branch protection in GitHub, not in this repository:

- Require a pull request before merging into `main`.
- Require the GitHub Actions CI checks before merging.
- Block force pushes to `main`.
- Optionally require branches to be up to date before merging.

## Security Notes

- The workflow uses `pull_request`, not `pull_request_target`.
- The workflow grants only `contents: read`.
- The PostgreSQL credentials are disposable CI values.
- No production database, hosted service credentials, GitHub environments, or
  repository secrets are used.
- The workflow does not deploy code or publish artifacts.
- Dependency scanning checks known package advisories only. It is not static
  analysis, penetration testing, or a supply-chain review of every transitive
  maintainer.

## Future CI/CD Improvements

Future milestones may add coverage reporting, Playwright smoke checks,
deployment pipelines, preview deployments, release tagging, Docker image
publishing, Software Bill of Materials generation, or deeper supply-chain
policy checks. Those should be added only when their provider, ownership, and
failure policies are clear.
