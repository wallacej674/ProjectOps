# Release Readiness Workflow Catalog

Status: planned. This catalog expands [the main implementation plan](release-readiness-main-feature-plan.md); entries are not claims of implemented agents.

A role has bounded inputs and a typed output. ProjectOps schedules it within a versioned workflow. Initially all roles can use the configured OpenAI model, with one active model step per account. Roles do not need separate persistent agents or separate API subscriptions. Tool access is explicitly granted by the application; source text cannot grant permissions.

## First coherent release

| Role / user action | Trigger and required input | Deliverable and completion condition |
| --- | --- | --- |
| Release Brief Assistant / Define this release | Developer enters audience, stage, critical journeys, data, constraints | Structured brief, labeled assumptions, and a short list of unanswered questions; developer confirms a revision |
| Requirements Analyst / Propose release requirements | Confirmed brief and selected plan text | Up to 12 proposed requirements with rationale, applicability, consequence, and verification criteria; developer confirms or excludes each |
| Evidence Assessor / Review release gaps | Confirmed requirement revisions and previewed evidence manifest | Per-requirement proposed evidence state, citations, contradictions, missing evidence, and scope; unknowns remain explicit |
| Next-Step Planner / Decide what to work on | Accepted assessments, deterministic priority order, existing accepted tasks | Up to three nonduplicate next-step proposals with dependencies and acceptance checks; ranking rationale is traceable |
| Agent Handoff Planner / Prepare agent context | One accepted next step and selected evidence | Concise implementation brief and investigation pointers; deterministic exporter verifies IDs, budgets, and the context contract before creating the packet |

These roles run as user-visible steps, not a five-agent conversation. Confirmation checkpoints separate intent from assessment and proposed work from accepted work. If a requirement is already explicit or a packet can be generated deterministically, skip the corresponding model call.

## Specialist expansion

| Role / user action | When it is relevant | Required evidence and bounded output |
| --- | --- | --- |
| Access-Control Reviewer / Review user isolation | Product has multiple identities, roles, or shared data | Selected access paths and isolation tests; identify coverage by operation, uncertain paths, and proposed negative tests; no exploit execution |
| Data-Lifecycle Reviewer / Review data handling | Product creates, exports, retains, or deletes user data | Confirmed retention/deletion requirements and selected data-flow evidence; propose checks for deletion propagation, persistence, and recovery |
| Failure-Recovery Reviewer / Review failure behavior | Background jobs, queues, uploads, or third-party operations | Retry/idempotency requirements, selected code/tests, failure reports; identify recoverability questions and fault-injection test plans |
| Verification Planner / Design the proof | A confirmed requirement lacks adequate evidence | Requirement plus existing tests and environment constraints; propose happy-path, negative, and recovery checks with observable expected results |
| Dependency-Risk Reviewer / Prioritize dependency work | OSV finding occurrences affect the release | Exact versions, advisory IDs, coverage and explicit usage evidence; distinguish affected version from reachable behavior and propose an upgrade investigation |
| Change-Impact Reviewer / Recheck changed assumptions | A new snapshot or brief revision is imported | Explicit evidence dependencies and diffs; propose which assessments need re-review, citing changed scope; deterministic freshness policy remains authoritative |
| Operations-Readiness Reviewer / Prepare operating checks | Release needs real-user availability or recovery | Monitoring, rollback, backup/restore, ownership and runtime observations; identify missing drills and operating requirements; unavailable deployment evidence remains unknown |
| Scope Reviewer / Find release-plan mismatches | Brief includes features excluded from implementation or evidence | Confirmed scope and selected capability evidence; propose requirement changes or missing-work investigations for human confirmation |
| Evidence-Challenge Reviewer / Challenge a conclusion | High-consequence assessment or contradictory evidence | Original evidence plus proposed conclusion; identify unsupported inference and counterexamples; preserve disagreements instead of majority voting |
| Release-Summary Writer / Prepare the decision | Human requests a release decision preview | Accepted assessments and exact evidence manifest; summarize supported scope, open gaps, accepted risks, exclusions, and operational unknowns; human records go/no-go/defer |
| Project Next-Step Advisor / Refresh project context | Human selects the active release and asks what comes next | Existing accepted work, dependencies and latest evidence; show the next useful task and prerequisites without inventing new product scope |

The catalog contains 16 roles. Delivering the first five well is the initial objective; later roles are independently gated by evidence intake and evaluations. A role without appropriate inputs offers a data-collection step rather than inventing conclusions.

## Routing and permissions

Suggested workflow selection follows confirmed release attributes. For example, user-owned documents suggest access-control and data-lifecycle review; background processing suggests failure-recovery review. The UI explains each suggestion. The developer chooses which to run and previews the evidence and budget.

Initial model capabilities: read only the consented bounded packet and return structured proposals. No shell, arbitrary filesystem/network reads, repository writes, production actions, messaging, or external task creation. Later read-only connectors must normalize evidence through the same ownership, provenance, freshness, and size checks.

Specialist outputs use the same requirement/evidence/next-step contracts as the initial roles. They cannot directly change human decisions. A specialist may propose new requirements, but those require confirmation before affecting release scope. Only a verified application-side check or an attributed human review can adopt a proposed assessment.

## Execution examples

**Before deployment:** define beta -> confirm isolation requirement -> assess supplied tests -> plan missing search-isolation test -> export next-step packet -> import result -> review evidence. Operations requirements remain not_verified where a deployed environment is needed.

**After a code change:** import new snapshot -> mark directly dependent evidence stale -> offer Change-Impact Review -> rerun the relevant assessment -> refresh accepted work and agent context. Do not automatically run every specialist.

**Before inviting real users:** generate a decision preview -> challenge high-consequence supported assessments -> present contradictions and unknowns -> record a human decision with its evidence scope. A recorded go decision is not a security certification.

## Evaluation rule for adding a role

Before enabling a role, supply labeled representative inputs, expected useful outputs, known unknown cases, malicious input cases, and a measurable cost/latency budget. Compare it to the current general Evidence Assessor. Keep a specialized role only when it improves a meaningful outcome such as missed-gap discovery, verification quality, or reduced review effort. Do not expand the catalog merely to increase the visible agent count.
