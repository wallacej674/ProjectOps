# ProjectOps Remaining Work Handoff

Last reviewed: 2026-09-07

This is the current source of truth for unfinished ProjectOps work. Historical
milestone documents describe the scope that existed when each milestone was
delivered; they do not override this roadmap.

## Primary Product Direction: Release Readiness

The user selected release-specific, evidence-backed production readiness as the main feature. Follow [the main feature plan](release-readiness-main-feature-plan.md), its [AI workflow catalog](release-readiness-workflows.md), and [agent context contract](release-readiness-agent-context.md) when implementing this direction. The initial Release Brief/requirement workspace is implemented; evidence assessment and AI workflows remain planned.

The Release Brief and confirmed-requirement workspace is implemented; see [its milestone record](milestone-release-workspace.md). The next product milestone is release-scoped evidence contracts and deterministic assessment before the first AI gap-review workflow. Build the local review -> next-step -> agent-context -> returned-evidence journey before expanding specialist workflows. Code Risk Review is a supporting evidence source. Deployment remains a separate later milestone and is not a prerequisite for local feature development.

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
- In-app Health Alerts with acknowledgement, evidence, recovery, and monitoring-overdue warnings.
- Advisory project-level Production Readiness evaluation and manual review items.
- Local Code Risk Review with scan evidence, human review, work items, and OpenAI explanation runtime configured through backend `OPENAI_API_KEY`; live model evaluation and source excerpts remain outstanding.
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
- Alembic migrations are linear through `0017_release_workspace`.
- `render.yaml` declares the API, scheduler, and PostgreSQL database.
- `frontend/vercel.json` provides SPA rewrites and browser security headers.
- Production configuration rejects localhost API fallback, wildcard CORS, and
  the development auth secret.
- `/health`, `/health/db`, config checking, and hosted smoke-check helpers exist.
- Backend and frontend test suites, linting, builds, dependency audits, and CI
  workflow coverage exist.
- Deployment, backup/restore, observability, and provider-specific runbooks
  exist under `docs/`.

## Hosted Release Blocker (Separate from Feature Development)

The application has not yet completed a real hosted private-beta deployment.
Provider access and user-controlled secrets are required for the remaining
steps. These are prerequisites for hosting a private beta, not for the selected local Release Readiness feature work.

## Deferred Operational Milestone: Hosted Private-Beta Deployment

Goal: deploy the current repository to the selected Render and Vercel stack,
prove it works with production configuration, and record evidence.

Required work:

1. Create or sync the Render Blueprint from `render.yaml`.
2. Set the exact Vercel production origin as
   `PROJECTOPS_CORS_ALLOWED_ORIGINS`.
3. Configure optional GitHub App and Sentry variables only if those features
   will be exercised in the private beta.
4. Confirm Alembic reaches `0017_release_workspace` during the Render pre-deploy
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

## Operational Work After the Hosted Deployment

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

### Product Development Priority

Release Readiness is the main feature plan linked at the top of this handoff. It defines the first complete release-assessment and agent-handoff loop, staged specialist workflows, migration boundaries, and evaluation gates. Existing Code Risk Review and OpenAI workflow notes remain implementation references.

DataForge document processing and Deployment Operations provider integrations are deferred. Bounded selected artifact text and verification-result imports needed for Release Readiness are part of that plan; broad file processing is separate.

## Remaining Technical Debt

### Verification environment

- Backend integration tests require the dedicated PostgreSQL test service on
  port `55432`; local verification is incomplete when it is unavailable.
- Keep migrations and PostgreSQL-specific locking behavior in CI coverage.

### Health checking

- The real HTTP client now uses bounded streaming. Continue preserving URL safety and response limits.
- Scheduled monitoring now has in-app alerts; external delivery, uptime SLA, incident management, and public status pages remain future work.
- Add worker-level metrics and alerting before depending on the scheduler for
  operational paging.

### Repository analysis

- CodeMap Medium is deterministic evidence extraction, not code review,
  vulnerability scanning, dependency verification, or architectural proof.
- Analysis still runs synchronously and has bounded source coverage.
- GitHub webhooks and automatic repository refresh are not implemented.
- The CodeMap analyzer currently coordinates discovery, parsing, and scoring in
  one module. Revisit those seams after hosted deployment if the analyzer grows.

### Data and API ergonomics

- List endpoints use bounded private-beta result sets rather than cursor
  pagination.
- Activity and artifact taxonomies are represented in multiple backend/frontend
  locations and should be centralized when they next change materially.
- The Project Dashboard coordinates several independent requests; continue
  preserving isolated loading and error states when adding features.
- Scheduled Health Check orchestration now lives in the service layer, with database locking in the repository.
- GitHub App repository metadata crosses backend layers as untyped dictionaries.
  Introduce a typed value object and keep provider parsing in the service layer
  when the integration next changes.

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
- External health alert delivery, incident management, uptime percentages, or status pages.
- File uploads, OCR, document processing, embeddings, or semantic search.
- Release-specific AI assessment workflows, automatic next-step planning, and agent context/result exchange. Finding-level OpenAI explanation wiring exists; live evaluation is outstanding.
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
