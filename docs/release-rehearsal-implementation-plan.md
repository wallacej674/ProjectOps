# Release Rehearsal implementation plan

Status: **approved; M0-M5 local implementation delivered and M6 deterministic validation delivered**. See [the implementation record](milestone-release-rehearsal.md), [contracts](release-rehearsal-contracts.md) and [local guide](release-rehearsal-guide.md). A user-approved live semantic evaluation is now complete: corrected prompt v2 passed 20/20 synthetic cases with zero unsupported support labels. See [the live report](rehearsal-live-evaluation-report.md). Human-rated usefulness and real-user pilot validation remain pending; the case set is not held out.
Date: 2026-09-07.

## Approval scope and outcome

Approve milestones M0-M6 to build the first complete Release Rehearsal inside the existing Release Readiness workspace. Approval includes the public test seams below and coordinated development subagents. Development proceeds milestone by milestone without requiring another permission request for ordinary local edits and tests within this scope.

The outcome is a working local workflow: **confirm release criteria -> collect evidence -> review gaps -> accept a verification task -> export an agent assignment -> import results -> reassess -> record a release decision**. A source or environment change makes affected evidence visibly out of date.

The initial audience is solo developers and small teams preparing a web-app private beta. Use an account-isolated document application as the executable example. ProjectOps assesses supplied evidence for the selected release; it does not claim complete repository understanding or certify production safety.

M0-M6 authorize local feature implementation, migrations in the development/test environment, synthetic fixtures, automated tests, documentation, and local verification. Hosting, publishing, production migrations, paid live AI evaluation, contacting pilot users, and the expansion milestones below are separate actions. Live evaluation will have a concrete synthetic input preview and explicit spend cap before execution. Deterministic and fake-provider development can finish without it; the feature must not be described as pilot-validated until live evaluation and usability checks actually happen.

## Relationship to existing plans

This plan refines [the feature proposal](release-rehearsal-feature-proposal.md) and [the existing Release Readiness plan](release-readiness-main-feature-plan.md). After approval, it becomes the sequence for the remaining first-release implementation. Preserve the existing [workflow catalog](release-readiness-workflows.md) and [agent contract](release-readiness-agent-context.md) except for the explicitly proposed refinements below.

- The Release Brief/requirement workspace is already implemented. Do not repeat it.
- The inspected migration head is `0017_release_workspace`; inspect the actual head again before creating each additive migration. The earlier plan's `0016` reference is stale.
- Start with one critical journey from the existing brief. "Release Rehearsal" is the user-facing workflow within Release Readiness, not a duplicate Project/Release entity.
- Express scenarios through independently assessable Requirement revisions. Split download isolation and search isolation into separately confirmed criteria in new fixtures; never rewrite existing user requirements automatically.
- Deliver manual assessment and deterministic next steps before model interpretation. The five planned AI roles are optional steps in a workflow, not five compulsory calls or a multi-agent conversation.
- Use the configured model initially, after checking its support during implementation. No model migration, new orchestration framework, graph database, custom trained model, or hosting prerequisite is proposed.

## Current implementation and reuse

| Existing area | Reuse | Additional work |
| --- | --- | --- |
| Release models, routes, workspace and revision hooks | Ownership, brief confirmation, requirement revisions, immutable materials, active navigation, draft recovery | Evidence/assessment resources and current-state projections |
| Code Risk Scan and Finding Occurrence | Immutable imported scans, file digests, rule/tool versions, exclusions, findings and coverage | Release-scoped evidence adapter; scanner coverage cannot imply behavioral coverage |
| CodeMap and readiness observations | Existing bounded manifest/path hints and baseline checks | Evidence references with explicit limitations; no conversion of legacy passed into release supported |
| Health Checks | Timestamped endpoint observations | Environment-scoped evidence; unknown code version remains unknown |
| Risk explanation adapter | Existing bounded Responses transport, preview digest, output validation patterns | Typed release output, refusal/incomplete handling, durable execution and shared budget admission |
| Project Artifacts, activity, launch views | Existing links and history | New release decision record and traceable links without changing historical launch semantics |

The current finding explanation path is synchronous and limits requests to one active and 20 per rolling day. It does not already provide the durable worker or shared token reservations planned here. Those are explicit M3 work.

## User experience

Extend `ReleaseReadinessPanel` with focused panels and resource hooks, retaining saved links, archive behavior, keyboard access, and unsaved-draft recovery.

1. **Define this release.** Reuse the brief and confirmed requirements. Offer proposed missing scenarios for review. Show criterion, consequence, verification method, and exclusions.
2. **Collect evidence.** Select existing material, scan occurrences and observations, or import a bounded verification report. Preview the exact selection, origin, version, environment, and missing information.
3. **Review release gaps.** Display requirement rows with separate evidence state and review/disposition indicators. Selecting a row reveals supporting evidence, contrary evidence, limitations, missing checks, and an assessment rationale. Show AI proposals before adoption.
4. **Choose the next check.** Show at most three prioritized Next Steps with impact, rationale, dependencies and acceptance checks. Users can accept, revise or defer them.
5. **Prepare agent handoff.** Preview and download Markdown and versioned JSON for one accepted task. Returning results have a preview distinguishing claims, executed checks and checks not run.
6. **Review what changed.** Compare the current assessment with a selected previous run. Explain new gaps, resolved gaps, changed scope and stale evidence.
7. **Record a decision.** Freeze a human go/no-go/defer record with the assessed versions, unresolved requirements, accepted risks, exclusions and operational unknowns.

Empty states must show the next useful action. A missing worker, provider failure, oversized input, unavailable source or stale edit must have a recoverable state. Keep history readable when new work fails. Do not add a new universal readiness percentage.

## Contracts and invariants

Use the existing glossary. Capture any approved terminology additions in `CONTEXT.md` during M0; the glossary remains free of implementation details.

| Record or dimension | Contract |
| --- | --- |
| Assessment scope | Versioned persistent selection of Release/brief revision, source target/snapshot/file digests and environment identity; unknown values remain explicit; actor/time and optimistic version required for changes |
| Evidence | Immutable ID and payload digest; source kind/ID; origin and attribution; method/tool/profile version; observed/imported timestamps; target/file scope; source snapshot and environment; coverage/exclusions; limitations |
| Verification record | Criterion and check identifier, assertion/expected behavior, intended vs executed command, outcome, actual-result excerpt/reference, tool version, start/end, environment, snapshot and not-run reason where applicable |
| Requirement Assessment | Exact requirement revision and selected evidence manifest; immutable outcome and rationale; citations; missing criteria; reviewer provenance; proposed/accepted/superseded review state |
| Evidence state | `not_verified`, `supported`, `gap_found`, `conflicting`; freshness tracked independently and projected as `stale` when appropriate |
| Human disposition | `open`, `accepted_risk`, `deferred`, with actor and reason; never changes evidence outcome |
| Next Step | Requirement links, objective, acceptance checks, priority rationale, dependencies, version and lifecycle; optional existing Risk Work Item link |
| Workflow run | Immutable consented manifest, model/prompt/schema/policy versions, execution states, idempotency, lease, budget reservations, outputs and safe failures |
| Context packet/result | Existing versioned packet IDs/digests, task/requirement revisions and source scope; returned work claims and verification records remain distinguishable |
| Release Decision | Actor, time, rationale and frozen assessment/evidence/disposition manifest; historical decisions never change silently |

Evidence origin distinguishes user-imported reports, manual assertions, existing ProjectOps observations and future verifier observations. An internally copied imported scan remains imported evidence. Matching a digest verifies content identity, not that a reported test actually ran. CodeMap observations without a commit/content identity cannot be silently assigned to a scan snapshot.

M1 provides scope read/update and preview of a bounded source-manifest import, using existing owned scan snapshots where possible. A user reviews and selects the current scope; there is no automatic repository monitoring. Source-manifest imports obey the 256 KiB envelope limit, at most 5,000 safe relative paths/digests, and explicit partial/full-inventory coverage. A file absent from a partial inventory is unknown, not deleted. Environment descriptions contain identifiers and non-sensitive facts, not configuration values. Changing the selection creates a new scope revision. UI warnings distinguish known changed dependencies from "scope changed; impact unknown"; incomplete dependency knowledge conservatively requires review.

Assessment rules:

- Only confirmed, applicable criteria enter the assessed scope. Undecided applicability is unresolved; exclusions require an attributed reason and remain visible.
- Missing relevant evidence stays not verified. A passing build does not establish isolation. Download-only evidence cannot support a criterion that also requires search isolation.
- The engine validates scope and permitted transitions. A human authors or accepts a cited interpretation; AI proposes it. Evidence attachment alone never marks a requirement supported.
- Observations contradict only when they address comparable criteria and scope. Conflicting current evidence remains visible. Prior failures from a superseded code version remain historical, not automatically current contradictions.
- Compare explicit requirement revisions, selected source digests, environment identity and policy expiry. A mismatch invalidates current support without deleting the historical outcome. Where dependency coverage is incomplete, conservatively flag review; unchanged filenames do not prove unchanged behavior.
- Marking a task completed or accepting an Agent Result does not satisfy a requirement. Closing a Next Step requires a recorded verification review; linked requirements may still remain unresolved.
- Rank actionable work by confirmed consequence, then evidence urgency (conflict, demonstrated gap, missing/stale verification), with explicit dependencies and attributed user overrides. Prerequisite work is presented before blocked dependents; ties use stable creation order. Unconfirmed AI severity cannot change rank. M0 records worked examples of this policy before coding it.
- All reads, writes, previews, exports and worker dispatch/completion enforce Project ownership and resource membership. Archived parents block new mutations. Optimistic edits return 409 and preserve drafts. Existing account ownership remains the authorization model.
- Exact duplicates are idempotent; reuse of an ID/key with different content is a conflict. Bound input bytes and collections before expensive parsing/persistence.

## Module design and persistence

Keep the existing FastAPI/SQLAlchemy/PostgreSQL and React structure. These are deep modules with small interfaces; exact filenames may follow repository conventions when each slice is implemented.

| Module | Interface responsibility | Implementation owned |
| --- | --- | --- |
| `readiness_evidence` | Preview/import/select evidence and evaluate freshness | Source adapters, immutable manifests, digest/scope validation, source-change policy |
| `release_readiness` | Review assessments, plan/update Next Steps, compare runs, record decisions | Assessment adoption, priority policy, dependencies, history and aggregate projections |
| `readiness_workflows` | Preview/start/read/cancel a workflow and run one worker iteration | Durable execution, provider adapter, leases, shared admission/reservations, output validation |
| `agent_context` | Export an accepted task and preview/import its result | Canonical packet rendering, correlation, deduplication and reviewed evidence attachment |

Use foreign keys and association tables for relationships; bounded JSON for versioned evidence and provider payloads. Extend through additive migrations for evidence, assessments and reviews, Next Steps, runs/steps and reservations, packets/results, and decisions. Do not reimplement already-persisted Release/Requirement/Material tables.

The first actual variable seams are evidence intake (existing scan/material/health adapters) and provider transport (real and fake). Avoid a generalized plugin framework or abstractions for hypothetical integrations.

New HTTP resources stay under `/api/v1/projects/{project_id}/releases/{release_id}`: assessment-scope read/update and source-manifest preview/import, evidence preview/import/list, assessment list/review, next-step actions, workflow preview/start/status/cancel, packet creation/download, result preview/import, comparison and decision preview/create/history. M0 freezes route spellings and DTOs before parallel backend/frontend edits. Existing routes retain their meaning.

## AI execution policy

Start with bounded structured outputs through the existing provider transport pattern. Structured Outputs constrains shape; refusal and incomplete output need explicit handling. Application validation checks citation identity, ownership, admissible scope and state rules; semantic adequacy remains a reviewed interpretation, and imported report truth is not independently established. See [official Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs).

The model receives only the selected manifest, has no execution tools, and returns proposed scenarios, cited assessments or verification work. Source/material text is untrusted data. Reject fabricated IDs, unsupplied paths, malformed output and unsupported state transitions. Newly suggested files must be explicitly labeled proposed files, not cited as inspected evidence.

Retain the planned defaults: at most 12 proposed requirements, 20 selected evidence records, a 256 KiB verification import, 24 KiB per model input and 3,000 output tokens per call; at most six paid dispatches per run. Source snippets remain a later expansion. Never silently truncate essential criteria to fit a packet.

M3 unifies admission across release workflows and the existing finding explanation route: one active AI operation per account and a shared rolling limit of 20 provider dispatches per day, plus configurable token reservations. Every dispatched call counts, including failed/uncertain calls; cache hits do not incur another reservation. Preserve accounting for recent legacy calls during transition. Reject starts that cannot reserve their permitted calls/tokens. Dollar estimates must identify the model/rate assumptions; unknown price is unavailable, not zero.

Reserve the maximum permitted calls/tokens atomically before enqueueing paid work. Reconcile actual reported usage; release unused reservation only when nondispatch or a known lower usage amount is established. Missing usage remains reserved conservatively for the accounting window. Separate budget reservation from active execution: a run waiting for human review holds no executing slot. An uncertain dispatch retains its executing slot until the configured uncertainty lease expires; expiry releases that slot but retains its budget reservation and never retries automatically. An explicit retry is a separately reserved attempt and warns that the earlier remote request may still finish or incur usage. Fencing prevents either attempt from overwriting the other's state. M0 freezes the rolling-window token ceilings and lease timings as configuration contracts, with M3 contention/recovery tests covering them.

The local PostgreSQL-backed worker records queued/running/waiting-for-review/completed/partially-completed/failed/cancelled states. Claims use a lease and fencing version; network calls happen outside database locks. Cancellation and archive prevent later dispatch or adoption. Expired leases after a potentially submitted provider request produce an explicit uncertain outcome, not an automatic duplicate paid call. Preserve late usage without adopting late output. Do not promise exactly-once provider execution.

Each dispatch uses the frozen, previewed manifest. Changed evidence or added source requires a new preview. Derived intermediate outputs are stored with provenance and cannot expand evidence access. Model/prompt/schema changes invalidate cached output identity. Provider outages leave manual evidence and review available.

## Milestones and completion gates

| Milestone | Deliverable | Completion gate |
| --- | --- | --- |
| **M0: Freeze contracts and fixtures** | Approved DTOs, state policy, test seams, synthetic example, dependency map and evaluation labels; reconcile plan/glossary/handoff status | Manually trace supported, missing, conflicting and stale examples; each conclusion resolves to evidence or a named unknown |
| **M1: Evidence intake** | Versioned current assessment scope; immutable release evidence; scan/material/readiness/health adapters; bounded verification/source-manifest JSON import; selection/preview UI | Owner imports evidence and can inspect origin/scope; duplicate, foreign, malformed and oversized input handled; attachment never implies support |
| **M2: Assessments and verification work** | Manual proposed/accepted assessments; freshness projection; deterministic priority; Next Steps and dependency checks; gap-review UI | Download test supports download only; missing search evidence produces a verification task; risk acceptance never hides the gap |
| **M3: AI-assisted rehearsal** | Durable local worker, shared AI budget admission, typed provider outputs, optional scenario proposals, cited gap review and Next Step drafting | Fake-provider end-to-end review works; refusal, bad citations, cancellation, stale manifests, crash/uncertain dispatch and budget exhaustion preserve correct state |
| **M4: Agent handoff and return** | Markdown/JSON export, result preview/import, correlation, verification review and reassessment | One accepted task travels out and back; wrong/old packet remains rejected or explicitly stale; a claimed completion never automatically satisfies a requirement |
| **M5: Reassessment and release decision** | Selected-run comparison, explicit snapshot/environment update, affected evidence warnings, decision preview and immutable history | A relevant changed digest removes current support; repeat evaluation can restore it; a frozen prior decision stays unchanged |
| **M6: Local acceptance and pilot preparation** | Full synthetic journey, regression checks, labeled AI evaluation harness, local operator guide, accurate user copy and a pilot script | Required suites pass; full loop is demonstrated; fake/live results are clearly separated; remaining live evaluation and pilot actions are listed accurately |

Order: M0 -> M1 -> M2 -> M3 -> M4 -> M5 -> M6. Use a vertical behavior at a time within each milestone. M3 workflow infrastructure can be designed alongside M2 once contracts are stable; shared persistence and budget changes remain integrated sequentially. M1-M2 provide an independently usable manual evidence workflow, but the feature is not complete until the full M0-M6 local loop works.

The first implementation behavior after approval: a Project owner imports a verification record for a confirmed download-isolation requirement, retrieves its immutable origin/scope, and still sees the requirement as not verified until assessment review. Implement the HTTP behavior first, then its UI path.

## Public test seams proposed for approval

The repository's [TDD skill](../.agents/skills/tdd/SKILL.md) requires: **"Before writing any test, write down the seams under test and confirm them with the user."** Approval of this plan confirms the following seams. No new tests are written during this planning turn.

| Seam | Behaviors under test |
| --- | --- |
| Authenticated release HTTP interface | Ownership, revisions, archive, immutable evidence, assessment/disposition separation, Next Step lifecycle, packet correlation and decision history; real PostgreSQL, assertions through responses |
| Workflow command and worker interface | Enqueue/dispatch/claim/recovery/cancel/status, account-shared budgets and uncertain outcomes; observe through workflow status and fake-provider request receipts |
| Provider transport interface | Exact request manifest, schema compatibility, bounded response, refusals/incomplete output, invented citations and safe failure; fake external transport |
| Release workspace user interface | Evidence selection, assessment review, task acceptance, export/import, comparison and decision; test through user actions and HTTP responses, not hook internals |
| Running local browser interface | One complete rehearsal against isolated local services, including a source/environment change and preserved history; observe rendered interactions and downloaded contracts |
| Alembic migration interface | Upgrade existing data through the new revisions in an isolated PostgreSQL schema and use it through public interfaces; preserve existing migration-chain conventions |
| AI evaluation interface | A frozen synthetic case yields an assessable result with attributable evidence and useful next actions; fake transport in CI and separately authorized live runs |

Use one failing behavior test, minimal implementation, then the next behavior. Mock external transport/time where necessary, keep internal modules real, and prefer real PostgreSQL. Expected results come from worked examples and labeled cases rather than reproducing implementation logic. Review/refactoring follows a completed red/green slice.

Required cases include wrong owner/Project/release, archived writes, concurrent stale edits, duplicate imports, partial scans, missing source identity, incomparable environments, weak/irrelevant tests, stale evidence, conflicting current results, accepted risk, dependency cycles, stale packets, unexecuted checks, model refusal/incomplete output, malicious source instructions, fabricated citations, preview mismatch, shared-budget bypass attempts, worker crash/cancel/late completion and draft recovery.

Run focused backend/frontend tests after each behavior. At milestone integration run relevant release/ownership/migration regressions and frontend lint/build when affected. At M6 run the complete backend/frontend suites, applicable CI checks, dependency audits and `git diff --check`. Add a small real-browser local walkthrough for the complete loop; record any automated browser-tool limitation rather than substituting a claim of visual verification. No deployed smoke check is implied.

## Evaluation and market gate

Prepare at least 20 synthetic labeled cases. Every accepted actionable assessment must expose evidence and scope. Target at least 90% human-rated relevant/actionable next actions and zero unsupported readiness claims on that initial set; these are acceptance targets, not statistical guarantees. Include clean controls and cases where the right answer is unknown. Log model/prompt/version, latency, usage, false alarms and failures.

M0-M6 can complete locally with live evaluation explicitly pending. Customer pilots require the separately authorized live evaluation to meet these thresholds; fix failures and rerun the affected evaluations before pilot entry. Report deterministic, fake-provider, live-provider and human-pilot outcomes separately.

After separately approved live evaluation, use the prepared script with five pilot developers and their existing tools on the same release. Look for three discovering a material missed issue/investigation, four completing a verification loop, repeat use on a later release and concrete paid-continuation commitments. Record onboarding burden and wasted work as well as positive outcomes. Pilot participation and willingness to pay cannot be completed or promised by code alone.

## Expansion after the first loop

| Expansion | Implementation direction | Gate before starting |
| --- | --- | --- |
| **E1: Source understanding** | Reviewed bounded source intake, language parsing, React/TypeScript and FastAPI adapters, explicit route/handler/test links; unresolved edges visible | Pilot shows manual evidence selection is the bottleneck; agree source access contract and supported framework/version matrix |
| **E2: Executable rehearsals** | Local/CI verifier for selected existing API/browser tests, later approved generated checks; disposable environment, synthetic data, resource/network limits and trace references | Separate execution design and test seams approved; never execute imported command strings automatically |
| **E3: Operational evidence** | Deployment identity, selected trace/error/latency evidence, recovery/load checks and environment comparisons | Real target integrations and scope available; hosted infrastructure and load/fault actions separately authorized |
| **E4: Learned ranking** | Permissioned outcome collection, held-out-project/temporal evaluation against deterministic ranking; optional semantic retrieval for candidate evidence | Enough labeled outcomes and a measurable improvement; no cross-customer training by default |

These expansions retain the goal of a fuller code/behavior/operations picture. M0-M6 establish the trustworthy evidence loop that they feed. They are roadmap direction, not included implementation authorization in this approval.

## Subagent execution and progress reporting

Use one coordinating agent and up to three bounded subagents. After M0 contracts are stable, assign backend behavior, frontend behavior and independent review/evaluation work with explicit file ownership. Each implementing agent follows the same approved TDD seams. The coordinator owns migration numbering, shared types/contracts, integration, verification and status documentation.

Do not have two agents edit the same shared file or advance the migration chain independently. Where a dependency changes, pause only dependent work and reconcile the contract. Use subagents for review even when implementation must be sequential. Report milestone outcome, tests, limitations and next slice; do not ask again for ordinary in-scope work already approved.

Once approved, update the remaining-work handoff and old plan references to point to this sequence, keeping implemented/planned status accurate. Approval of this document is the final step before M0 begins.
