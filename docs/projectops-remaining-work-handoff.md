# ProjectOps Remaining Work Handoff

Last reviewed: 2026-08-31

This is the current source of truth for unfinished ProjectOps work. Historical
milestone documents describe the scope that existed when each milestone was
delivered; they do not override this roadmap.

## Current Product State

ProjectOps is a working single-user-owner project command center with:

- Local email/password authentication and JWT access tokens.
- Account-owned Project CRUD and archive behavior.
- Public GitHub repository intake and read-only GitHub App access to authorized
  private repositories.
- CodeMap Medium repository analysis using paths plus a bounded allowlist of
  manifests and operational configuration files. Existing CodeMap Lite
  snapshots remain readable.
- Manual and scheduled Health Checks. Scheduled checks support 15-minute,
  hourly, 6-hour, and daily cadences through a Render cron worker.
- Advisory Production Readiness evaluation and manual review items.
- Project Artifacts, evidence links, coverage, and traceability.
- Launch Report, Guided Launch Checklist, and attributed Launch Decisions.
- Project-scoped and cross-Project Activity feeds.
- First-run demo workspace seeding outside production.
- Structured request logging, request IDs, safe error responses, optional
  Sentry integration, and dependency audit commands.
- A selected hosting architecture: Vercel frontend, Render Web Service API,
  Render Cron Job, and private Render Postgres.

## What Is Ready in the Repository

- The backend container and production entrypoint exist.
- Alembic migrations are linear through `0013_health_monitor`.
- `render.yaml` declares the API, scheduler, and PostgreSQL database.
- `frontend/vercel.json` provides SPA rewrites and browser security headers.
- Production configuration rejects localhost API fallback, wildcard CORS, and
  the development auth secret.
- `/health`, `/health/db`, config checking, and hosted smoke-check helpers exist.
- Backend and frontend test suites, linting, builds, dependency audits, and CI
  workflow coverage exist.
- Deployment, backup/restore, observability, and provider-specific runbooks
  exist under `docs/`.

## Immediate Ship Blocker

The application has not yet completed a real hosted private-beta deployment.
Provider access and user-controlled secrets are required for the remaining
steps. The next milestone is operational execution, not another broad product
feature.

## Next Milestone: Hosted Private-Beta Deployment

Goal: deploy the current repository to the selected Render and Vercel stack,
prove it works with production configuration, and record evidence.

Required work:

1. Create or sync the Render Blueprint from `render.yaml`.
2. Set the exact Vercel production origin as
   `PROJECTOPS_CORS_ALLOWED_ORIGINS`.
3. Configure optional GitHub App and Sentry variables only if those features
   will be exercised in the private beta.
4. Confirm Alembic reaches `0013_health_monitor` during the Render pre-deploy
   phase.
5. Confirm `/health` and `/health/db` on the hosted API.
6. Import `frontend/` into Vercel and set `VITE_API_BASE_URL` to the Render API.
7. Verify registration, login, logout, ownership isolation, Project lifecycle,
   repository intake, CodeMap Medium, manual Health Checks, scheduled Health
   Checks, readiness, artifacts, Launch Decisions, and Activity.
8. Confirm the cron worker stores a scheduled Health Check and that pausing the
   schedule prevents later execution.
9. Confirm request IDs in Render logs and, if enabled, Sentry.
10. Confirm managed database backups and PITR settings.
11. Perform a restore drill into a separate database. Do not overwrite the
    active database.
12. Record the evidence and private-beta go/no-go decision in
    `private-beta-deployment-drill.md`.

Use `private-beta-hosting-todo-checklist.md` while performing the work and
`render-vercel-deployment.md` for provider setup details.

## Work After the Hosted Deployment

### Priority 1: Private-Beta Operations

- Configure provider alerts for API availability, database health, scheduler
  failures, and unexpected application errors.
- Define severity levels, notification destinations, ownership, acknowledgement
  expectations, and a lightweight incident log.
- Observe actual request latency, database connections, health-check duration,
  and cron runtime before changing plan sizes.
- Run and record one rollback exercise for Render and one for Vercel.

### Priority 2: Multi-Instance Hardening

- Replace the in-process rate limiter before increasing the API above one
  instance.
- Define trusted proxy/header behavior and verify client IP handling.
- Add explicit request-body and upload limits before file upload exists.
- Review database pool sizing against Render Postgres connection limits.
- Separate liveness and readiness semantics if orchestration requirements grow.

### Priority 3: Browser Release Confidence

- Add a small Playwright smoke suite for landing, authentication, Project CRUD,
  one Project command-center load, and an authenticated deep link.
- Run browser smoke checks against preview or isolated non-production services,
  not the production database.
- Capture failure artifacts without exposing tokens or private content.

### Priority 4: Authentication Maturity

- Password reset with expiring, single-use tokens and a real email provider.
- Session renewal or refresh-token strategy with revocation and rotation.
- Account email verification and basic account administration.
- OAuth only if user demand justifies it; GitHub App authorization is repository
  access, not ProjectOps login.

### Priority 5: Product Expansion

- Teams, Organizations, invitations, roles, and ownership transfer.
- Health Alerts derived from repeated scheduled results, with deduplication,
  recovery events, and notification preferences.
- Multiple monitored endpoints and health trends only after alert semantics are
  trustworthy.
- Artifact file upload, object storage, malware scanning, preview, and retention.
- Exportable launch packets.
- Deeper repository analysis, AST/static analysis, dependency/security scanning,
  or AI-assisted evidence analysis as separate, explicitly scoped milestones.

## Remaining Technical Debt

### Verification environment

- Backend integration tests require the dedicated PostgreSQL test service on
  port `55432`; local verification is incomplete when it is unavailable.
- Keep migrations and PostgreSQL-specific locking behavior in CI coverage.

### Health checking

- `httpx` currently bounds the stored preview but may buffer more response data
  than the preview limit. Move to bounded streaming before accepting arbitrary
  large or untrusted response bodies at scale.
- Scheduled monitoring records observations but has no alerting, uptime SLA,
  incident state, or public status page.
- Add worker-level metrics and alerting before depending on the scheduler for
  operational paging.

### Repository analysis

- CodeMap Medium is deterministic evidence extraction, not code review,
  vulnerability scanning, dependency verification, or architectural proof.
- Analysis still runs synchronously and has bounded source coverage.
- GitHub webhooks and automatic repository refresh are not implemented.

### Data and API ergonomics

- List endpoints use bounded private-beta result sets rather than cursor
  pagination.
- Activity and artifact taxonomies are represented in multiple backend/frontend
  locations and should be centralized when they next change materially.
- The Project detail page coordinates several independent requests; continue
  preserving isolated loading and error states when adding features.

### Frontend quality

- ESLint currently reports Fast Refresh warnings in files that export components
  alongside shared helpers. They do not fail the build but should be cleaned up.
- Add automated accessibility and responsive browser coverage for the highest
  risk workflows after the first hosted deployment.

### Delivery hygiene

- The repository may contain a dirty worktree spanning several completed
  milestones. Before release, review the full diff, separate unrelated changes,
  and commit coherent units without discarding user work.
- CI/CD provider deployment is configured declaratively, but automatic promotion
  policy and environment separation still need hosted validation.

## Explicitly Not Implemented

- Teams, Organizations, invitations, roles, and ownership transfer.
- Password reset, email verification, refresh tokens, and OAuth login.
- GitHub webhooks or automatic repository synchronization.
- General-purpose job queues or workflow orchestration.
- Health alert delivery, incident management, uptime percentages, or status pages.
- File uploads, OCR, document processing, embeddings, or semantic search.
- AI-generated analysis or recommendations.
- Compliance certification or guaranteed production readiness.

## Product Truth Boundaries

- A Repo Analysis is bounded evidence from repository paths and allowlisted
  files; it is not proof of architecture, quality, or security.
- A Health Check is one stored observation. Scheduled repetition does not make
  it an uptime guarantee.
- Production Readiness is advisory and only as current as its evidence.
- An Artifact is metadata or evidence reference, not proof that the linked
  content is valid.
- A Launch Decision records human intent. It is not an approval workflow,
  compliance certification, or guarantee of safety.
- Activity is product history, not an unread notification inbox or audit log.

## Definition of Private-Beta Ready

ProjectOps is ready for invited private-beta users only when:

- GitHub Actions is green on the intended release revision.
- Render and Vercel deployments succeed from that revision.
- The database migration and backup/PITR evidence are recorded.
- Hosted health and authenticated product smoke checks pass.
- A scheduled Health Check has been executed by the Render cron worker.
- Production CORS, secrets, request IDs, and optional Sentry behavior are proven.
- A non-destructive restore drill and rollback procedure are documented.
- Known limitations are accepted in a recorded go/no-go decision.

This definition does not imply broader production maturity.

## Working Rules for Future Milestones

- Preserve existing user changes and inspect the dirty worktree first.
- Use the domain vocabulary in `CONTEXT.md`.
- Prefer one small vertical slice with explicit public seams.
- Use TDD for features and bug fixes at the highest practical seam.
- Keep authentication, authorization, SSRF protections, and secret handling intact.
- Add dependencies only when existing tools cannot meet the requirement.
- Run focused tests during development and the full relevant suite before handoff.
- Update current-state docs and add a historical milestone note when later work
  supersedes an old limitation.
- Do not deploy, provision paid services, alter DNS, or create provider secrets
  without explicit user authorization.
