# First Feature-Deepening MVP: Deployment Operations Lite

Status: deferred; no product implementation or deployment performed.
The user's current priority is feature development with no deployed resources.
Use [Code Risk Review](code-risk-review-mvp-plan.md) as the
next-feature plan. The recommendation below is retained for future reference.
Prepared: 2026-09-06 (America/Chicago).

## Recommendation

Build a read-only Deployment Operations workflow, starting with **one Render web service per linked Infrastructure Service**. Deliver a complete path from linking a service to seeing its deployment history in the Project Dashboard. Add Vercel after that path works with real provider evidence.

The user outcome is: **“For this Project and Environment, show me the linked hosting service, its latest observed deployment, when that information was refreshed, and the existing production Health Check.”**

“Latest observed deployment” does not mean “currently serving traffic.” A successful deployment and a healthy endpoint are separate observations. Show the provider-reported live deployment only when a verified provider field establishes it; otherwise leave it unknown.

This is the recommended next *feature* MVP. The hosted private-beta drill remains a separate release gate. Local development can proceed while provider access is arranged; completing this feature does not complete that drill.

## Why this MVP first

The ranking below is product judgment based on the repository, not measured customer demand or an effort estimate.

| Candidate | Existing foundation | Value of the next slice | Recommendation |
| --- | --- | --- | --- |
| Deployment Operations Lite | Project Dashboard, Operations Map, health observations, activity, selected Render/Vercel stack | Connects code and operational evidence to actual deployment history; directly exercises the deployment expansion in the roadmap | First feature MVP |
| External health alert delivery | Implemented alert lifecycle, acknowledgement, recovery, overdue detection | Helps users react while away from the app | Next if beta feedback prioritizes off-app monitoring; introduces delivery/retry/preferences work |
| Exportable launch packet | Launch Report, checklist, artifacts, attributed decisions | Small, useful handoff deliverable | Strong smaller alternative if provider integration is blocked or launch-review sharing becomes the main use case |
| Deeper CodeMap | Existing bounded manifest/configuration analysis | Richer repository understanding | Defer until a specific unanswered repository question justifies additional analysis |
| DataForge file processing | Metadata registry and evidence links | Makes documents usable inside ProjectOps | Defer: storage, processing, preview, and retention are several capabilities |
| Teams and roles | Single-account Project ownership | Enables shared ownership | Defer until collaboration demand justifies the authorization and lifecycle expansion |

Evidence from the current code and plans:

- [Remaining-work roadmap](projectops-remaining-work-handoff.md), Priority 5, explicitly calls for Environments, Infrastructure Services, immutable provider-sourced Deployment Records, and read-only Render/Vercel adapters.
- [Project model](../backend/app/models/project.py) has a single `production_url` and a lifecycle `status`; neither represents an Environment or provider deployment.
- [Operations Map](../frontend/src/features/projects/components/ProjectOperationsMap.tsx) currently shows repository, analysis, health, readiness, decisions, artifacts, and activity. Its implementation explicitly anticipates future deployment topology.
- [Dashboard assembly](../backend/app/services/dashboard.py) contains no deployment history. [Project Dashboard orchestration](../frontend/src/features/projects/pages/ProjectDetailPage.tsx) already loads feature evidence separately.
- [Health Alerts milestone](milestone-health-alerts.md) documents a completed in-app alert workflow, making another broad monitoring foundation redundant.
- [Launch Decision records](launch-decision-records.md) already cover human decisions; deployment outcomes should not be stored as editable decision artifacts.

## MVP scope and user journey

1. Open an owned Project and its new **Deployments** workspace view.
2. Create an Environment with a name and kind (`development`, `staging`, `production`, or `other`).
3. Link an existing Render web service through an account-owned provider connection. Select or enter its provider ID; the backend verifies access before accepting the link.
4. Refresh that service's deployments manually.
5. See a bounded recent history with provider status, available commit/branch, provider timestamps, observation time, and a provider dashboard link. Missing provider fields display as unavailable.
6. Open the Project overview and see deployment evidence alongside its existing Project-level production health, with independent timestamps and labels.
7. Refresh again without duplicate deployment entries. A provider failure preserves the prior evidence and visibly marks the refresh as failed.

First release supports Render web-service deployment history only. Database and cron inventory, Vercel, provider log links beyond a verified dashboard destination, scheduled refresh, webhooks, deployment triggering, rollback controls, and infrastructure provisioning follow later. No log ingestion, general-purpose queue, team model, AI analysis, or new readiness scoring is required.

An Environment is a user-declared grouping. Do not infer it from `Project.status`, a branch name, or a URL. Existing `production_url` and scheduled monitoring retain their current behavior. Do not backfill invented environments or retroactively attach Health Checks to a service.

## Proposed domain and persistence

These terms are proposed here for review. Add accepted terms to `CONTEXT.md` when implementation starts, using the domain-modeling skill.

| Term | Meaning and minimum stored data |
| --- | --- |
| Environment | Project-scoped deployment grouping: Project ID, display name, normalized name, kind, archived timestamp. Unique active normalized name within a Project. |
| Infrastructure Service | One explicitly linked deployable provider resource within an Environment: Environment ID, account-owned connection reference, provider, provider resource ID, verified display metadata, archived timestamp. |
| Deployment Record | Stable identity of a provider deployment for a linked Infrastructure Service: provider deployment ID and first-observed timestamp. No user-editable provider outcome fields. |
| Deployment Observation | Append-only allowlisted facts about a Deployment Record at an observation time: raw status, normalized status, provider update time when available, optional commit/branch/URL, and content fingerprint. |
| Refresh state | Operational bookkeeping on a linked service: attempt ID/generation, started time, last successful observation time, safe error category, and bounded-fetch coverage. Kept separate from deployment outcomes. |

Ownership flows from Account to Project to Environment to Infrastructure Service to Deployment Record. A connection belongs to an Account; provider access alone does not authorize attaching a resource to another account's Project. Enforce parent membership on every nested read/write and return the existing 404 behavior for foreign resources.

Uniqueness covers `(infrastructure_service_id, provider_deployment_id)` and `(deployment_record_id, observation_fingerprint)`. Fingerprints exclude local fetch time so identical refreshes do not append duplicate observations. For the MVP, prevent an active provider resource from being linked twice within the same Project and connection; return a conflict and identify the existing Environment. Rebinding creates a new link instead of reassigning old history.

Append observations when a deployment transitions, for example from building to successful. Preserve earlier observations instead of freezing the first status or overwriting history. “Immutable” means application-level append-only evidence, not tamper-proof compliance storage. Expose no record-edit or record-delete endpoint.

Archive Environments and service links, preserving their history. Reject new links and refreshes on archived parents. Restoring a Project does not silently restore archived links. No hard deletion or destructive history backfill is needed.

## Module interface and integration points

Use a Deployment Operations module that owns linking, refresh coordination, normalization, persistence, and projections. Routes handle HTTP and ownership; callers should not coordinate provider pagination, deduplication, or transaction ordering themselves.

Proposed public HTTP interfaces, below `/api/v1/projects/{project_id}`:

| Interface | Behavior |
| --- | --- |
| `GET/POST /environments` | List or create Project-scoped Environments |
| `PATCH /environments/{environment_id}` | Rename, change kind, or archive an Environment |
| `GET/POST /environments/{environment_id}/services` | List or verify and link existing provider resources |
| `PATCH /environments/{environment_id}/services/{service_id}` | Edit local display label or archive the link; provider identity is fixed |
| `POST /environments/{environment_id}/services/{service_id}/refresh` | Perform one bounded read-only provider refresh; persist evidence atomically |
| `GET /environments/{environment_id}/services/{service_id}/deployments` | Return paginated stored records with latest observations and coverage metadata |
| `GET /deployment-summary` | Return stored per-Environment/service summaries; never fetch providers on dashboard reads |

The provider seam accepts a verified connection/resource reference and returns a typed bounded batch. Use a Render adapter and a deterministic fake for orchestration tests. Keep HTTP transport parsing at that seam; do not introduce a generic integration/plugin framework. Add the Vercel adapter only in its subsequent slice.

Likely files, following the current repository structure:

- New backend `app/models/deployment_operations.py`, `schemas/deployment_operations.py`, `repositories/deployment_operations.py`, `services/deployment_operations.py`, `services/render_deployments.py`, and `api/deployment_operations.py`.
- Register models and routes in the existing initialization points; add an additive Alembic revision after the actual current head, presently `0014_health_alerts`.
- New frontend `types/deploymentOperations.ts`, feature API wrapper, `useProjectDeployments` hook, and `ProjectDeploymentsPanel` under the existing projects feature.
- Extend `projectWorkspace.ts` and `ProjectSectionNav.tsx` with `?view=deployments`; compose the new panel into `ProjectDetailPage.tsx` without adding provider coordination to the page.
- Extend `ProjectOperationsMap.tsx` and the overview summaries with an independently loaded deployment signal. Preserve existing views and legacy links.
- Add deployment Activity categories/types only when integrating activity, updating database check constraints, backend schemas/filters, frontend types/filters, and rendering together.

## Refresh behavior and truth boundaries

- Initial proposed budget: at most 50 recent deployments, two provider pages, and a 10-second total network deadline per explicit refresh. Confirm provider pagination before fixing these defaults. Return `coverage=recent_window` plus truncation information; never claim complete historical coverage.
- Use fixed provider API origins and verified identifiers, with bounded response parsing. Do not fetch user-entered dashboard URLs. Dashboard links must be validated HTTPS provider destinations.
- Fetch outside database row locks. At completion, recheck ownership, active parents, connection identity, and refresh generation. Discard a superseded result so a slow request cannot replace a newer refresh's projection.
- Serialize refresh claims per linked service. An overlapping request receives a clear conflict with retry guidance; a timed-out claim becomes eligible for another attempt.
- On a complete successful bounded fetch, commit records, changed observations, refresh success state, and activity together. Repeated unchanged refreshes create no deployment Activity events.
- A timeout, denied provider access, rate limit, malformed response, or failed page preserves prior observations and last-success time. Show safe failure categories and retry guidance. Never turn a provider error into an empty successful history.
- Unknown provider statuses remain `unknown`, with the allowlisted raw status available. Normalize only statuses verified against provider fixtures. Sort deployments by provider creation time with a stable ID tiebreaker; use provider update time where available to avoid regressing a projection with older evidence.
- Manual refresh has no automatic freshness guarantee. Always show last successful refresh and whether the latest attempt failed. Do not label cached deployment evidence “live.”
- A healthy URL cannot establish which deployment served it. Display existing health explicitly as Project production health, not Environment/service health. Do not infer causality from adjacent deployment and health timestamps.

## Implementation sequence

Each numbered slice includes its UI or observable interface and its focused verification. Work one failing behavioral test and implementation at a time.

### 0. Confirm contracts and remove integration uncertainty

- Agree the proposed user journey, domain terms, and test seams below.
- Verify Render resource lookup, deployment fields, status mapping, pagination, timestamps, and dashboard destinations from current official documentation and sanitized fixtures.
- Resolve the account-owned provider-connection mechanism before implementing live linking. This plan does not assume the existing GitHub App connection can be reused for Render.
- Load the required `aws-secrets-manager` skill before any credential implementation, following repository `AGENTS.md`; locate it if not immediately available. Provider credentials must resolve server-side at runtime and never enter model context, browser storage, or artifact content. No credential retrieval or configuration is part of this planning change.
- Reconcile the deployment drill's older `0013_health_monitor` target with the actual migration head before using it as release evidence; preserve its historical results.
- Exit: verified provider contract, an agreed connection approach, and accepted test interfaces. Provider-account access is required for a later real smoke check, not for fixture-backed local development.

### 1. Environment and service-link workflow

- Add additive schema, ownership checks, and Environment CRUD/archive behavior.
- Implement verified Render service linking and a Deployments panel with explicit empty states.
- Use a fake provider connection for local integration tests; require real account-scoped access verification for actual links.
- Exit: an owner creates an Environment and links a service; another account cannot see or mutate either; archive behavior preserves history.

### 2. Refresh and deployment history: first usable feature

- Implement the Render adapter, typed normalized batch, immutable observations, deduplication, and bounded synchronous refresh.
- Render stored history with status, optional revision, observation time, coverage, provider destination, and explicit retry state.
- Exit: one successful refresh is visible end to end; repeated and failed refreshes behave as specified; a later provider status adds evidence without erasing the earlier observation.

### 3. Project command-center integration

- Add deployment summary and Operations Map entry, plus meaningful deployment Activity events.
- Place deployment evidence beside existing health without changing health scheduling, alert recovery, readiness scoring, or launch decisions.
- Exit: a deployment-summary failure leaves other Project panels usable; existing deep links still work; the same deployment is not announced repeatedly.

### 4. Verify with a real service and release deliberately

- Run the focused and full relevant checks below, then exercise a linked Render service in an isolated non-production setup.
- Compare recorded provider ID, outcome, timestamps, and revision against the provider dashboard. Prove failed refresh preserves the last good data.
- Update README, documentation index, current-state handoff, and a new milestone record with actual results and limitations.
- Complete the existing hosted private-beta drill before inviting beta users. Rollback disables the new feature and retains additive history; do not remove the evidence tables as an automatic rollback step.
- Exit: the MVP acceptance criteria pass with recorded real-provider evidence. Fixture-only success is local implementation completion, not hosted integration validation.

## Proposed test seams and acceptance criteria

Use the installed repository TDD skill. It explicitly requires agreeing test seams before writing tests; this document proposes those seams for the implementation kickoff. No new tests are written by this planning change.

| Seam | Observable scenarios |
| --- | --- |
| Project-scoped HTTP interface with PostgreSQL | Ownership and nested-parent isolation; duplicate link conflict; archive behavior; refresh idempotency; append-only transitions; pagination; transaction rollback; concurrent/superseded refresh handling |
| Provider adapter interface with fixture-backed HTTP | Valid and missing fields; unknown status; timeout; malformed data; bounded pages/bytes; rate limit; provider-denied resource; safe URL construction |
| React user workflow with API interception | Create/link/refresh/view; empty state; missing revision; retry retains data; independent loading failures; accessible labels; deployment workspace deep link |
| Isolated browser smoke journey | Sign in, open a Project, link a configured test service, refresh, inspect history, revisit the dashboard; capture only safe failure artifacts |

The MVP is done when:

1. An owner can complete the Render journey without editing database rows.
2. Foreign Projects, Environments, services, and connection references are inaccessible.
3. Identical refreshes do not duplicate deployment records, observations, or activity; changed statuses retain prior evidence.
4. Refresh errors preserve last-known data and are distinguishable from “no deployments.”
5. Archived or rebound resources cannot accept in-flight stale results.
6. Users can distinguish configured Environment, deployment observation, Project health, and refresh age.
7. Existing monitoring, artifact, launch, and navigation behavior still passes its relevant regression checks.
8. A real non-production Render result matches the provider dashboard and is recorded as verification evidence.

Verification commands follow existing tooling: backend PostgreSQL `pytest`, `compileall`, migration checks and config check; frontend `npm test`, `npm run lint`, and `npm run build`; `git diff --check`. Run dependency audits per existing CI. Add a browser tool only for the meaningful smoke journey if existing preview checks cannot exercise it. Do not run provider calls inside normal unit/integration tests or run tests against production data.

## Skills to use during development

| Skill | Application |
| --- | --- |
| `codebase-design` | Keep provider complexity and persistence coordination behind the Deployment Operations interface; revisit seams before expanding Project Dashboard orchestration |
| `domain-modeling` | Resolve Environment/Service/Record/Observation definitions and capture accepted vocabulary in `CONTEXT.md`; use an ADR only if a durable tradeoff warrants it |
| Repository `.agents/skills/tdd` | Agree seams, then one failing behavior and one implementation per cycle |
| `diagnosing-bugs` | Use the diagnosis loop when an actual failure or regression appears |
| `code-review` | Review the completed implementation against this plan and repository standards before handoff |
| `writing-for-agents` | Use if implementation updates agent instructions or creates a skill; not needed merely to write product code |
| AWS skills | Not needed for the selected Render feature design. Use the required secrets skill for credential work and relevant AWS skills if actual AWS infrastructure or SDK work enters scope; prefer AWS MCP and IaC per `AGENTS.md` |

No subagents are needed for this planning pass. A later invoked skill may prescribe delegated reviews; follow its actual instructions then.

## What follows the MVP

1. Add Vercel using the same verified provider interface. Explicitly distinguish production from preview deployments and scope resources to the correct provider account/team. This is a separate acceptance slice, not a condition for finishing Render MVP.
2. Add verified provider log destinations, then bounded log retrieval only if users need it inside ProjectOps.
3. Use beta feedback to choose between external health alert delivery and richer deployment history. Add automatic refresh only with a concrete freshness requirement.
4. Revisit Environment-scoped monitoring when multiple endpoints become a real requirement; migrate deliberately rather than guessing associations from the current production URL.

## Provider feasibility references

Checked during planning; these establish read-only deployment-list capability, not a complete verified adapter contract:

- [Render: List deploys](https://api-docs.render.com/reference/list-deploys) documents service-scoped deployment listing with cursor pagination and error responses.
- [Vercel REST API](https://vercel.com/docs/rest-api) documents deployment listing and team-scoped resource access. Exact response mappings and production/preview filters must be verified in the Vercel slice.

Repository inspection was read-only before this documentation change. Historical test results were reviewed but suites and hosted services were not revalidated during planning.
