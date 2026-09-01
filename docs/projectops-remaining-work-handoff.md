# ProjectOps Remaining Work Handoff

Repository:

`C:\Users\Administrator\Documents\GitHub\ProjectOps`

This handoff describes the **remaining work after Milestone 28** and should be used by Codex as a project reference when planning future milestones.

The project is already far beyond an MVP. The remaining work should focus on:

* backend integrity
* evidence clarity
* hosted private-beta deployment
* observability operations
* multi-instance hardening
* deployment automation
* browser-level release confidence
* account/product maturity only where justified

Do not treat this as permission to implement everything at once.

Future work should be completed in small, reviewable milestones.

---

# Current Product State

ProjectOps currently includes:

## Core product

* Project Registry
* Project CRUD/archive behavior
* Project command center
* GitHub repository connection
* read-only GitHub App connection for private repository selection
* CodeMap Lite path-based repository analysis
* Manual Health Monitoring
* Production Readiness evaluation
* Project Artifacts / DataForge Lite
* Artifact search/filtering
* Artifact-to-readiness evidence mapping
* Artifact evidence coverage and traceability
* Recent Engineering Activity timeline
* cross-project Overview activity
* first-run/demo workspace
* Launch Report
* Guided Launch Checklist
* Launch Decision
* Launch Decision latest state/history

## Authentication and ownership

* local email/password registration
* local sign-in
* Argon2 password hashing
* JWT bearer access tokens
* authenticated current-user lookup
* logout
* Project ownership
* protected Project routes
* ownership isolation across Project-scoped resources

## Security controls

* in-process fixed-window rate limiting
* registration throttling
* login throttling
* demo seed throttling
* CodeMap run throttling
* health-check throttling
* SSRF protections around health-check URLs
* dependency scanning with pip-audit/npm audit
* configuration validation
* safe error handling
* no secrets in CI

## Observability

* structured JSON request logging
* one request log per request
* X-Request-ID generation/preservation
* CORS exposure of X-Request-ID
* optional backend Sentry
* optional frontend Sentry
* monitoring sanitization
* frontend ErrorBoundary
* safe backend 500 responses
* request ID surfaced in appropriate error UI

## Deployment/recovery groundwork

* deployment-aware CORS
* frontend deployment API URL handling
* `/health`
* `/health/db`
* backend config-check helper
* local smoke-check helper
* Vercel SPA rewrite support
* deployment readiness documentation
* private-beta deployment drill document
* backup/restore runbook
* RPO/RTO guidance
* local pg_dump/pg_restore drill guidance
* CI quality/security gate

---

# Most Recently Completed Milestone

## Milestone 28 — Artifact Evidence Coverage and Traceability

Implemented:

* project-level readiness evidence coverage endpoint
* active, linked, and unlinked artifact coverage counts
* readiness item evidence coverage counts
* artifact-side readiness usage rows
* readiness item coverage rows with linked artifacts
* Production Readiness evidence coverage summary
* Project Artifacts usage labels and evidence usage filter
* Launch Report evidence coverage counts
* Guided Launch Checklist supporting-evidence item

Evidence coverage remains advisory visibility. It does not verify artifact
contents, automatically pass readiness items, approve launch safety, or create
compliance-grade evidence.

Earlier notable completed milestone:

## Milestone 26 — Launch Decision History and Sign-Off Hardening

Launch Decisions remain stored as Project Artifacts.

Canonical identity currently used by the frontend:

* `artifact_type = decision`
* `source_type = manual`
* tag `launch-decision`
* tag `go-no-go`
* exactly one decision tag:

  * `go`
  * `no-go`
  * `defer`

Implemented:

* latest decision
* newest-first decision history
* unrelated artifact filtering
* active-history filtering
* No-go notes required frontend-side
* Defer notes required frontend-side
* Go notes optional
* accessible validation
* save pending/error states
* command-center decision summary
* priority next actions for No-go/Defer
* Launch Report refresh after decision
* Activity refresh after decision
* decision artifacts remain visible in Project Artifacts
* honest copy that recorder identity is not yet stored

Known weakness:

Launch Decision credibility is still partly dependent on frontend conventions.

Direct use of the generic artifact API can potentially bypass Launch Decision-specific frontend rules.

---

# Previously Completed Milestone

# Milestone 27 — Launch Decision Attribution and Backend Integrity

This has been implemented after Milestone 26 and before Milestone 28. The
historical plan below is retained as context for the integrity boundary.

## Goal

Make the backend authoritative for:

1. artifact creator attribution
2. Launch Decision semantic validation

while keeping Launch Decisions:

* artifact-backed
* mutable
* lightweight
* human-recorded
* non-certifying

Do NOT turn Launch Decisions into enterprise approvals.

---

## Milestone 27 Required Work

### Artifact creator attribution

Add trustworthy creator attribution for newly created Project Artifacts.

Preferred direction:

`ProjectArtifact.created_by_user_id`

Requirements:

* derived from authenticated backend context
* never client-controlled
* not PATCH-editable
* linked to existing User model
* minimal creator representation exposed in authorized artifact reads
* historical artifacts should remain valid if attribution is unavailable
* do not fabricate attribution for older artifacts

Prefer nullable historical compatibility initially unless the existing database proves a trustworthy backfill is possible.

---

### Backend Launch Decision recognition

Define a canonical rule for when generic artifact validation should treat an artifact as a Launch Decision.

Preferred rule:

The normalized tags contain both:

* `launch-decision`
* `go-no-go`

When those markers exist, validate the full shape.

Do NOT treat every generic `decision` artifact as a Launch Decision.

---

### Backend Launch Decision contract

Require:

* `artifact_type = decision`
* `source_type = manual`
* tag `launch-decision`
* tag `go-no-go`
* exactly one:

  * `go`
  * `no-go`
  * `defer`

Reject malformed combinations.

---

### Backend notes rules

Go:

* notes optional

No-go:

* meaningful notes required

Defer:

* meaningful notes required

Current frontend max:

* 2,000 characters

Server should enforce the intended maximum if compatible with artifact field constraints.

Do not truncate silently.

---

### PATCH integrity

Backend validation must evaluate the effective state after PATCH.

A valid Launch Decision must not be PATCHable into:

* missing notes for No-go
* missing notes for Defer
* wrong artifact type
* wrong source type
* no decision tag
* multiple decision tags

A normal artifact updated into a Launch Decision must satisfy the entire Launch Decision contract.

---

### Frontend attribution

Update Launch Decision history/latest summary to show:

`Recorded by <safe identity>`

when known.

Historical fallback should be honest, e.g.:

`Recorder unavailable for this historical record.`

Never substitute:

* Project owner
* current signed-in user
* guessed creator

for historical records without evidence.

---

### Language boundary

Attribution does NOT mean authority.

Allowed:

* Recorded by
* Human-recorded decision
* Decision record

Do not claim:

* Approved by
* Authorized by
* Certified by
* Signed by
* Compliance approved
* Production approved

---

# Work After Milestone 28

The recommended remaining roadmap starts with Milestone 29.

Do not automatically implement these together.

---

# Completed Milestone 28 — Artifact Evidence Coverage and Traceability

Milestone 28 has been implemented and verified. Future sessions should treat it
as completed unless tests or product behavior show a regression.

Implemented:

* project-level endpoint:
  `GET /api/v1/projects/{project_id}/readiness/evidence-coverage`
* active artifact, linked active artifact, and unlinked active artifact counts
* readiness items with/without linked supporting artifacts
* total readiness evidence link count
* artifact usage rows showing which readiness items each artifact supports
* readiness item coverage rows showing linked artifacts per item
* Production Readiness Evidence Coverage summary
* Project Artifacts usage labels and Evidence Usage filter
* Launch Report evidence coverage fields
* Guided Launch Checklist `Supporting evidence linked` item
* documentation at
  `docs/milestone-28-artifact-evidence-coverage-traceability.md`

Verification completed during implementation:

* backend Alembic migrations at head
* backend pytest suite passed
* backend compile check passed
* backend config check passed
* backend dependency audit reported no known vulnerabilities
* frontend test suite passed
* frontend lint/build/audit passed
* browser smoke test confirmed Evidence Coverage, artifact usage labels,
  Evidence Usage filtering, Launch Report fields, and Guided Launch Checklist
  fields render without browser console errors

Product boundary:

* evidence links are supporting references supplied by the team
* ProjectOps does not verify artifact contents
* evidence coverage does not automatically pass readiness items
* evidence coverage does not approve, certify, or make a Project compliance-ready

Do not reintroduce file upload, OCR, document parsing, AI scoring, automatic
evidence verification, automatic readiness passing, vector storage, RAG, or
compliance mapping as part of evidence coverage maintenance. Those would be
separate future milestones.

---

# Milestone 29 — Hosted Private-Beta Deployment Execution

This is one of the largest remaining ship gaps.

The application has deployment preparation, but the real hosted drill has not yet been completed.

## Goal

Deploy ProjectOps into a real private-beta environment and replace theoretical deployment readiness with recorded hosted evidence.

---

## Required work

### Select actual provider stack

Choose and document:

* frontend hosting provider
* backend web-service provider
* managed PostgreSQL provider

The repository currently supports a provider-neutral model.

Do not unnecessarily restructure the application around one vendor.

---

### Deploy backend

Configure:

* production environment
* database URL
* CORS origins
* log level
* health-check settings
* rate-limit config
* Sentry config if being used
* all required secrets through provider secret storage

Do not put production secrets into repository files.

---

### Deploy frontend

Configure:

* production API base URL
* optional Sentry settings
* SPA routing/deep-link behavior

Verify:

* `/`
* `/app`
* Project detail deep links
* refresh on nested route

---

### Managed PostgreSQL

Configure:

* production database
* TLS requirements if applicable
* migration access
* backup settings
* PITR if supported

Run:

`alembic upgrade head`

against the actual private-beta database.

Record evidence in the deployment drill.

---

### Hosted smoke tests

Run the existing backend smoke helper against the hosted backend:

* `/health`
* `/health/db`

Record result.

Do not print secrets or response bodies.

---

### Auth smoke

Test real hosted:

* registration if enabled
* login
* bearer authentication
* logout/client token clearing
* unauthorized access
* Project ownership isolation

Use disposable private-beta accounts.

---

### Product smoke

Test:

* create Project
* attach repo
* run CodeMap
* run health check
* readiness evaluation
* artifact creation
* readiness evidence linking
* Activity
* Launch Report
* Guided Launch Checklist
* Launch Decision
* Launch Decision attribution after M27

Do not use sensitive production targets for manual health checks.

---

### Hosted observability proof

Produce one controlled error/event and confirm:

* frontend/backend monitoring receives it as expected
* request ID is available
* no sensitive request body or authorization data leaks
* safe client-facing error remains intact

Record evidence without pasting DSNs or tokens.

---

### Managed backup proof

Verify provider configuration:

* backups enabled
* retention
* PITR status if supported
* encryption/provider defaults where documented
* restore procedure access

Do not claim restore readiness solely because a provider checkbox exists.

---

### Real restore drill

Preferably perform a non-production restore test against disposable infrastructure.

Verify:

* backup can be selected
* restore completes
* restored DB can be reached
* schema/data are usable
* ProjectOps can operate against restored copy if appropriate

Document evidence.

If cost/provider restrictions block this, document it explicitly as an unresolved go/no-go item.

---

### Responsive hosted QA

Review hosted application at approximately:

* desktop 1440px
* tablet 834px
* mobile 390px

Check:

* auth
* Overview
* Project command center
* Launch workspace
* Artifacts
* Activity
* dark theme
* light theme
* no horizontal overflow

---

### Deployment drill completion

Populate:

`docs/private-beta-deployment-drill.md`

with actual evidence.

Do not paste:

* DSNs
* JWTs
* database passwords
* provider secrets
* secret screenshots

---

### Private-beta go/no-go

Use existing Launch Report, Checklist, and Launch Decision.

Record a human decision.

The hosted deployment milestone is not complete until the actual state is documented.

---

# Milestone 30 — Private-Beta Alerting and Incident Response

ProjectOps has error monitoring but no real alerting/operational response policy.

## Goal

Define and configure a lightweight private-beta incident-response workflow.

This should remain proportional to a solo/small-team private beta.

---

## Suggested scope

### Sentry/provider alert rules

Configure useful alerts for:

* new production errors
* high-frequency errors
* major auth/API failures where possible

Avoid alert spam.

---

### Severity levels

Define simple severity categories, for example:

* Sev 1 — application broadly unavailable/data-risk event
* Sev 2 — major workflow broken
* Sev 3 — isolated feature error
* Sev 4 — low-priority defect

Do not overengineer enterprise incident terminology.

---

### Triage workflow

Document:

1. alert received
2. inspect event
3. retrieve Request ID
4. correlate backend logs
5. reproduce if possible
6. assess user impact
7. mitigate
8. document outcome

---

### Incident notes

Artifact system could potentially support incident records using the existing:

`artifact_type = incident`

Do not build a full incident-management platform.

Use existing artifact capabilities where sensible.

---

### Notification destination

If a real private-beta team exists, define where alerts go.

Possibilities:

* Sentry email
* provider alerting
* another lightweight existing channel

Do not add Slack/PagerDuty integrations automatically.

---

### Explicit exclusions

No:

* 24/7 on-call rotation
* PagerDuty platform
* SIEM
* SOC workflow
* full incident commander system
* public status page
* SLA promises

unless separately approved.

---

# Milestone 31 — Multi-Instance Production Hardening

The current in-process architecture contains assumptions that are acceptable for a small deployment but not for multiple backend instances.

## Goal

Remove major single-process assumptions and document production topology.

---

## Highest priority: Rate limiting

Current limiter:

* in-process
* fixed-window

Problem:

With multiple backend instances, each instance maintains independent counters.

This weakens throttling.

Replace or redesign using a shared mechanism.

Potential directions:

* Redis-backed limiter
* provider edge rate limiting
* API gateway rate limiting

Choose based on actual deployed infrastructure.

Do not add Redis just because it is common. Justify it.

---

## Proxy/header trust review

Hosted environments may introduce:

* reverse proxies
* forwarded client IP
* TLS termination

Review:

* `X-Forwarded-For`
* trusted proxy behavior
* client IP source used by rate limiter/logging

Do not blindly trust spoofable forwarding headers.

---

## Request/body-size limits

Review whether explicit limits are needed for:

* artifact content
* auth requests
* JSON bodies
* future uploaded material

Current ProjectOps has no file-upload system.

Keep scope proportional.

---

## Startup/config validation

Review whether production startup should fail early on:

* bad DB config
* missing production frontend origin
* missing required secret
* invalid monitoring configuration where enabled

Build on existing config-check logic.

---

## Database connection behavior

Review:

* pool sizing
* connection recycling
* managed Postgres connection constraints
* multi-instance total connection count

Do not prematurely optimize without provider limits.

---

## Health semantics

Decide what hosting platform health checks should use:

* `/health`
* `/health/db`

Be careful about DB-dependent liveness checks causing unnecessary restart loops.

Potentially document:

* liveness
* readiness

without necessarily creating Kubernetes-style infrastructure.

---

# Milestone 32 — Browser Smoke Checks in CI

Current CI verifies frontend unit tests/build but not true browser-level application startup.

## Goal

Add a small and reliable browser or hosted-shell smoke layer.

---

## Preferred minimal scope

At minimum verify:

* frontend production build succeeds
* frontend preview server starts
* `/` returns successfully
* `/app` returns SPA shell
* deep route such as `/app/projects/1/edit` returns SPA shell

This may be possible without a full browser framework.

## Current implementation

The lightweight hosted-shell version is implemented as
`frontend/scripts/preview-smoke.mjs` and wired into CI through
`npm run smoke:preview`. It starts Vite preview from the production `dist/`
output and verifies `/`, `/app`, and `/app/projects/1/edit` return the SPA
shell. It intentionally does not install Playwright/Cypress or run full account
workflows.

---

## Optional browser automation

If a browser framework is justified, keep the scope tiny.

Possible checks:

* landing page renders
* sign-in screen renders
* basic navigation shell renders

Do not turn this into a giant E2E suite immediately.

---

## Dependency rule

If Playwright/Cypress/etc. would be introduced, explain:

* why current tools cannot meet the requirement
* CI cost
* maintenance cost
* browser install behavior

and wait for approval if the milestone process requires dependency approval.

---

# Milestone 33 — Deployment Automation / CI-CD

Current GitHub Actions intentionally performs quality/security checks but does not deploy.

This is a future operational milestone.

## Goal

Create a safe private-beta deployment path after hosted manual deployment has already been proven.

Do not automate an unproven deployment process first.

---

## Possible approach

### Main branch

On successful CI:

* frontend deploy
* backend deploy

or trigger provider-native deployment mechanisms.

### Database migrations

Migration automation requires extra care.

Possible strategies:

* provider release command
* explicit migration job
* manual migrations during early beta

Do not run uncontrolled migrations from multiple parallel instances.

---

### Environment separation

At minimum distinguish:

* test
* local/development
* private-beta/production

Do not introduce a complex staging environment unless it provides real value.

---

### Deployment rollback

Document:

* frontend rollback
* backend rollback
* migration compatibility
* when DB rollback is unsafe
* restore vs code rollback decision

Build on existing rollback/backup guidance.

---

# Milestone 34 — Scheduled Health Monitoring

This is a product expansion, not required for initial private-beta launch.

Current health checks are manual only.

## Goal

Allow ProjectOps to run health checks on a schedule and retain results.

Only start this after hosted operations are stable.

---

## Potential scope

* Project monitoring schedule
* enabled/disabled state
* execution cadence
* background job architecture
* repeated HealthCheck records
* latest scheduled health state
* Activity events
* dashboard indication

---

## Architecture decision required

Potential execution platforms:

* hosted cron
* background worker
* task queue
* provider scheduler

Do NOT jump directly to Celery/Redis unless justified.

For private beta, a provider cron invoking a protected endpoint may be sufficient.

---

## Security concerns

Scheduled checks must preserve:

* SSRF protection
* Project ownership
* target restrictions
* timeout behavior

Consider whether scheduled checks should only use Project.production_url rather than arbitrary override URLs.

---

## Explicit exclusions initially

No:

* second-by-second monitoring
* uptime SLA
* public status page
* distributed probes
* global regions
* full synthetic monitoring

---

# Milestone 35 — Health Alerts

If scheduled monitoring is eventually implemented, alerts become useful.

Potential behavior:

* consecutive failure threshold
* recovery event
* avoid alerting on one transient failure
* notification integration chosen deliberately

Do not build alerts before scheduled checks exist.

---

# Milestone 36 — Account Recovery and Authentication Maturity

Current auth intentionally remains basic.

Known missing auth features include:

* password reset
* refresh tokens
* OAuth
* account management
* email verification

These should NOT all be implemented just because they are standard SaaS features.

Build only based on real private-beta needs.

---

## Highest likely value

### Password reset

If real external beta users rely on ProjectOps, lack of password reset becomes a support risk.

Potential future scope:

* reset token
* expiration
* one-time use
* password replacement
* token revocation considerations
* rate limiting
* safe generic messaging

This likely requires email delivery/provider integration.

Plan separately.

---

### Refresh tokens/session improvements

Current bearer-token lifetime/UX should be reviewed after real usage.

Do not redesign auth until actual token behavior is inspected.

---

### OAuth

Not necessary unless user demand justifies it.

---

# Milestone 37 — Teams / Organizations / Roles

ProjectOps currently has single-account ownership semantics.

Do not build organizations prematurely.

This becomes justified only if ProjectOps shifts from personal/private-beta project tracking into team collaboration.

Possible future model:

* Organization
* Membership
* Project organization ownership
* roles

Potential roles:

* owner
* member

Do not create a complicated RBAC matrix without demonstrated need.

---

# Milestone 38 — Stronger Launch Sign-Off Workflow

Current Launch Decision should remain lightweight through Milestones 27+.

Only consider stronger sign-off if ProjectOps genuinely needs organizational approvals.

Possible future features:

* decision creator identity
* approver identity
* role authority
* append-only revisions
* explicit superseded decisions
* sign-off policy
* approval requirements

Do NOT call such records audit-grade without appropriate controls.

---

# Milestone 39 — Exportable Launch Packet

This should come only after Launch Decision attribution and evidence semantics are stable.

Possible export content:

* Project metadata
* readiness score/state
* readiness item results
* linked evidence references
* Launch Report
* Guided Checklist
* latest Launch Decision
* decision history
* creator attribution
* recent Activity
* generated timestamp

Potential formats:

* JSON
* printable HTML
* PDF later

Do not make the packet claim certification.

---

# Milestone 40 — CodeMap Evolution

Phase 1, CodeMap Medium Repository Insights, is implemented. It adds bounded
inspection of selected public manifests and configuration files, deterministic
runtime/framework/command/dependency/operational insights, evidence-file
attribution, versioned stored snapshots, and legacy CodeMap Lite compatibility.
It does not clone repositories, execute code, inspect arbitrary source files,
scan vulnerabilities, or use AI.

CodeMap Lite is intentionally simple today:

* GitHub tree metadata
* paths only
* no clone
* no contents
* no AST
* no AI

Future evolution should be deliberate.

Potential levels:

## CodeMap Medium

Retrieve selected safe text files such as:

* README
* package manifests
* CI config
* deployment manifests

Then derive richer deterministic signals.

## AST/static analysis

Potentially analyze supported languages.

This is a separate architecture milestone.

## LLM analysis

Only consider after deterministic repository evidence is strong.

Do not introduce AI simply to make the product sound more advanced.

---

# Milestone 41 — Artifact File Upload / Document Processing

Current DataForge artifacts are metadata/content/URL based.

No upload system exists.

Potential future requirements:

* object storage
* upload authorization
* size limits
* MIME validation
* malware considerations
* download controls
* ownership
* retention
* deletion

This is a substantial security boundary.

Do not casually add upload fields directly to Postgres.

---

# Milestone 42 — AI-Assisted Evidence Analysis

This is intentionally far in the future.

Possible use:

* summarize user-provided artifact
* suggest relevant readiness links
* explain why an artifact may support a readiness item

Critical product boundary:

AI should suggest.

It should NOT automatically:

* verify evidence
* approve readiness
* certify launch safety
* replace operator judgment

AI-generated conclusions must be labeled as generated/advisory.

---

# Remaining Cross-Cutting Technical Debt

These are known issues/areas that may be addressed opportunistically or as dedicated milestones.

---

## 1. Dirty worktree

The repository has accumulated substantial modified/untracked work across milestones.

Future Codex sessions must always:

* inspect `git status`
* preserve unrelated work
* avoid reset/clean
* distinguish new changes from existing changes

Do not assume a clean baseline.

---

## 2. Frontend warnings

Existing Fast Refresh warnings have appeared in:

* `frontend/src/features/auth/AuthContext.tsx`
* `frontend/src/features/auth/AuthPage.tsx`

These were existing warnings during Milestone 26.

Do not misrepresent them as new failures.

A future cleanup milestone may address them if worthwhile.

---

## 3. Pagination

Several resource lists may eventually need pagination as data grows.

Examples:

* artifacts
* activity
* analyses
* health checks

Do not add pagination everywhere without a concrete need.

---

## 4. Taxonomy duplication

Some backend/frontend enum/taxonomy duplication may exist.

Examples historically included:

* Activity taxonomy
* readiness definitions

Where practical, centralize within each layer, but do not force code generation/shared packages prematurely.

---

## 5. Backend dashboard endpoint

A backend Project dashboard endpoint exists historically, while the frontend command center currently derives state from independent loaded resources.

Do not switch architectures casually.

Potential future optimization only if:

* excessive request count matters
* inconsistent loading becomes a real UX problem
* consolidated server computation adds value

---

## 6. Independent loading states

Project detail currently loads multiple resources independently.

This can briefly show partial state.

Consider future orchestration only if real usability requires it.

---

## 7. Artifact tags

Artifact tags remain lightweight rather than normalized relational tag entities.

This is currently acceptable.

Do not create a tag table solely for normalization unless filtering/management requirements justify it.

---

## 8. Health response body handling

Earlier backend hardening explicitly deferred a true streaming response-size limit.

Current preview protections should be reviewed if health monitoring is expanded.

---

## 9. Router consistency

Some historical backend router-prefix consistency cleanup was deferred.

Address only if it improves maintainability without large churn.

---

## 10. Error monitoring

Sentry integration exists but provider proof still needs hosted verification.

Do not claim production monitoring is operational until this is done.

---

# Remaining Operational Gaps

These are currently more important than adding another dozen UI features.

Priority gaps:

1. Real hosted deployment
2. Real hosted DB/migrations
3. Sentry/provider proof
4. real backup/PITR evidence
5. restore drill
6. production alerting policy
7. shared/multi-instance throttling
8. deployment automation
9. browser-level smoke confidence

---

# Remaining Product Gaps

Lower priority than hosted validation but still valuable:

1. scheduled monitoring
2. monitoring alerts
3. password reset
4. teams/organizations only if collaboration becomes a requirement
5. stronger launch sign-off only if authority semantics are added
6. launch packet export
7. CodeMap deeper analysis
8. file uploads
9. AI-assisted workflows

---

# Recommended Priority Order

Use this ordering unless new repository/provider constraints materially change it.

## Priority 1

**Milestone 29 — Hosted Private-Beta Deployment Execution**

Reason:

This is the largest unresolved shipping gap.

ProjectOps cannot truthfully call itself hosted/private-beta operational until this is completed.

---

## Priority 2

**Milestone 30 — Private-Beta Alerting and Incident Response**

Reason:

Error collection without an alert/triage process provides incomplete operational value.

---

## Priority 3

**Milestone 31 — Multi-Instance Production Hardening**

Reason:

Needed before scaling backend instances.

---

## Priority 4

**Milestone 32 — Browser Smoke Checks in CI**

Reason:

Adds release confidence at relatively low product complexity.

---

## Priority 5

**Milestone 33 — Deployment Automation / CI-CD**

Reason:

Automate only after manual deployment has been proven.

---

## Later Product Expansion

* scheduled monitoring
* health alerts
* auth maturity
* teams
* stronger sign-off
* exports
* deeper CodeMap
* uploads
* AI

---

# What NOT To Build Yet

Unless specifically requested, Codex should avoid expanding ProjectOps into:

* enterprise IAM
* complex RBAC
* SOC tooling
* SIEM
* compliance platform
* Kubernetes platform
* full observability suite
* PagerDuty clone
* GitHub clone
* generic document management system
* AI chatbot
* autonomous deployment agent
* automatic production approval engine
* automated compliance certification
* audit platform

ProjectOps should remain focused.

---

# Product Truth Boundaries

ProjectOps may accurately describe itself using terms like:

* engineering command center
* readiness signals
* advisory readiness
* human-recorded Launch Decision
* supporting evidence
* Project health signal
* Project history
* operational visibility
* private-beta readiness
* readiness projection

Avoid unsupported claims such as:

* certified production ready
* compliance approved
* security approved
* audit-grade
* fully monitored
* guaranteed safe to deploy
* enterprise secure
* automatically verified
* AI verified

---

# Standard Codex Milestone Process

Every future milestone should use the following workflow.

---

## Before edits

Codex must inspect:

* repository structure
* relevant implementation
* tests
* migrations
* documentation
* `git status`
* existing modified/untracked files

Do not edit before the user approves the implementation plan.

---

## Required first-response sections

Before implementation, provide:

### Current Repository State

### Git Status and Existing Changes

### Backend Baseline

### Frontend Baseline

### CI/Security Gate Baseline

### Current Feature Review

### Milestone Goal

### Functional Scope

### Backend Plan

### Frontend Plan

### Test Plan

### Accessibility Plan

### Responsive Plan

### Documentation Plan

### Files to Create or Modify

### Dependencies and Justification

### Exclusions

### Risks and Assumptions

### Approval Request

No edits before approval.

---

# Git Safety Requirements

The repository is often dirty.

Never blindly:

* reset
* clean
* discard
* checkout over changes
* overwrite unrelated files

Do not use destructive Git operations.

Preserve existing unrelated work.

If a dirty file must be edited, inspect its current state carefully and preserve prior modifications.

---

# Development Method

Use TDD for meaningful behavior.

Expected sequence:

1. inspect existing behavior
2. write/update failing tests
3. implement smallest coherent behavior
4. run focused tests
5. explain slice
6. continue
7. run full verification

Do not make giant unreviewable changes.

---

# Required Per-Slice Explanation

After each meaningful implementation slice, report:

## Slice name:

## Files changed:

## What changed:

## Why it changed:

## Relevant concepts:

## Data/control flow:

## Tests or checks added/updated:

## How I can manually verify it:

## Risk or tradeoff:

These explanations are required because the user wants to understand the engineering, not only receive code.

---

# Dependency Rule

Avoid adding dependencies unless there is a concrete need.

Before adding one, explain:

* problem it solves
* why existing tools are insufficient
* runtime/build impact
* security/maintenance implications
* alternatives considered

Do not add libraries merely for convenience.

---

# Backend Verification Standard

Unless the repository changes materially, run:

```text
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m compileall app tests
.\.venv\Scripts\python.exe scripts/check_config.py
.\.venv\Scripts\pip-audit
```

Report exact results.

---

# Frontend Verification Standard

Run:

```text
cd frontend
npm test
npm run lint
npm run build
npm audit --audit-level=high
```

Separate:

* failures
* new warnings
* existing warnings

Do not conceal regressions.

---

# Repository Verification

Run:

```text
git diff --check
git status
```

Review the actual diff.

Because pre-existing changes exist, identify milestone-specific edits separately.

---

# CI Review

If CI is touched:

* preserve read-only/default-safe permissions
* do not expose production secrets
* do not introduce `pull_request_target`
* do not connect tests to production DB
* preserve security scans
* verify workflow validity

Do not introduce deployment automatically unless the milestone is explicitly CI/CD deployment.

---

# Security Review Standard

Every milestone that touches backend/auth/data boundaries should review:

* authentication
* authorization
* ownership
* cross-user leakage
* client-controlled trusted fields
* validation
* SSRF if URLs are involved
* XSS
* logging of sensitive data
* monitoring sanitization
* secrets/config exposure
* error response safety
* dependency risk
* rate limiting where relevant

Do not claim a penetration test unless one actually occurs.

---

# Accessibility Standard

Frontend milestones should inspect:

* labels
* keyboard access
* focus behavior
* semantic elements
* alerts
* loading states
* error association
* color-independent status communication
* mobile usability

Do not claim WCAG compliance unless formally assessed.

---

# Responsive Standard

When applicable, manually review around:

* 1440px
* 834px
* 390px

Check:

* no horizontal overflow
* cards wrap correctly
* forms remain usable
* nav remains usable
* long URLs/emails wrap
* dark/light themes remain readable

---

# Documentation Standard

Update only relevant documentation.

Common files:

* `README.md`
* `frontend/README.md`
* milestone-specific docs
* deployment docs
* observability docs
* backup/restore docs
* private-beta drill docs

Documentation must reflect actual implementation, including known limitations.

---

# Final Completion Report Standard

Every milestone should end with:

## Milestone X Completed: <Name>

### Goal

### Architecture Chosen

### Backend Changes

### Frontend Changes

### Database Changes

### Files Created

### Files Modified

### Tests Added/Updated

### Accessibility Review

### Responsive Review

### Security/Privacy Review

### Verification Results

Include exact counts/results.

### Existing Warnings

### Known Limitations

### Dirty Worktree Status

### Suggested Next Milestone

Do not automatically begin the next milestone.

---

# Definition of Overall Project Private-Beta Readiness

ProjectOps should not be considered fully private-beta operational until at minimum:

* [x] Milestone 27 backend Launch Decision integrity completed
* [x] Milestone 28 artifact evidence coverage completed
* [ ] hosted frontend exists
* [ ] hosted backend exists
* [ ] managed PostgreSQL exists
* [ ] migrations run successfully in hosted environment
* [ ] `/health` passes hosted
* [ ] `/health/db` passes hosted
* [ ] auth smoke passes hosted
* [ ] Project ownership smoke passes hosted
* [ ] primary product workflow smoke passes hosted
* [ ] Sentry/error monitoring is proven with real hosted event if enabled
* [ ] Request ID correlation is proven hosted
* [ ] managed backups are enabled
* [ ] PITR status is documented
* [ ] restore capability has been realistically tested or explicitly marked unresolved
* [ ] responsive hosted QA completed
* [ ] deployment drill contains real evidence
* [ ] private-beta Launch Decision recorded
* [ ] no critical/high dependency vulnerabilities
* [ ] CI remains green
* [ ] known limitations are documented

---

# Longer-Term Production Readiness Does NOT Yet Exist

Even after private-beta deployment, do not imply ProjectOps has enterprise production maturity.

Major later gaps may still include:

* distributed/shared rate limiting
* stronger incident response
* CI/CD deployment automation
* account recovery
* scheduled monitoring
* alerts
* roles/teams
* penetration testing
* audit-grade records
* advanced disaster recovery
* stronger scale testing

That is acceptable.

The goal is to advance honestly in layers.

---

# Codex Guiding Principle

ProjectOps should evolve by strengthening real engineering value and operational truth.

Prefer:

* accurate backend invariants
* useful evidence
* real hosted validation
* reliable operations
* small maintainable systems
* clear human decision boundaries

over:

* flashy features
* premature enterprise architecture
* unnecessary AI
* unsupported security claims
* fake approval semantics
* architectural complexity without user value

When deciding between adding a new feature and strengthening an existing trust boundary, prefer the trust boundary when it materially affects correctness or credibility.

Do not begin any milestone automatically from this handoff.

Use it as the reference for planning the next approved milestone.
