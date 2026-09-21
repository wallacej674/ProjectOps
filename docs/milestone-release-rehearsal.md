# Release Rehearsal implementation record

Date: 2026-09-07 (local).

The user approved M0-M6 in the [implementation plan](release-rehearsal-implementation-plan.md). Local implementation now includes the complete evidence-to-decision workflow. This record separates implementation from external validation.

## Delivered

- Additive migrations `0018_rehearsal_evidence`, `0019_rehearsal_workflows`, and `0020_rehearsal_handoff` after the existing release workspace.
- Immutable source/environment scopes and bounded evidence imports from verification reports and existing materials, scans, health, readiness and repository analysis. Origin and source limitations remain inspectable.
- Human-authored or AI-proposed assessments with explicit review, scope freshness, unresolved contradictions, and separate risk dispositions.
- Deterministic task priorities, prerequisites, versioned edits, acceptance and recorded verification review.
- Durable optional AI review using the existing Responses transport, exact preview/consent, structured output validation, shared account admission, successful-output reuse, lease fencing and conservative uncertain-outcome handling.
- Portable assignment JSON/Markdown with a frozen manifest, digest and result schema; previewed/idempotent results that import evidence without granting support automatically.
- Frozen attributed release decisions, cited evidence and disposition history, current unreviewed evidence references, and comparison against current scope.
- Integrated React panels with draft retention, reloadable errors, read-only archive behavior and result-preview gating.
- Twenty synthetic evaluation cases and a bounded offline evaluator for saved responses.

## Validation

Full backend regression: **401 passed** in 394.68 seconds, with one existing Starlette/httpx deprecation warning. This includes replaying migrations through `0020`, preserving an existing release and brief, and checking new table columns against application models. Frontend full regression passed 343 tests across 61 files. After two browser-QA regressions and their fixes, the affected suites passed 16 tests across three files (13 rehearsal cases, one release case and two draft cases). Final lint passed with zero errors and five existing React refresh warnings; the final production build passed with a 623 kB chunk-size advisory. Python dependency compatibility (`pip check`) and compilation passed. Targeted red/green checks have exercised the HTTP, worker and rendered UI seams. All model transport is fake during automated testing. The browser rehearsal completed the real HTTP/database loop on a synthetic isolated PostgreSQL schema, with fixture authentication rather than real account credentials: scope, evidence preview/import, assessment acceptance, task acceptance, packet download, result preview/import, reassessment, verification closure, frozen decision and source-change comparison. Earlier support became stale and the frozen decision remained unchanged. A sibling-panel evidence refresh bug discovered there was fixed with a regression test. Decision comparison now renders readable per-requirement state changes, retaining full evidence JSON in expandable details. Temporary harness files, loopback servers and the single fixture schema were removed after verification.

## Boundaries

No production deployment, production migration or pilot recruitment was performed. A subsequently authorized [live semantic evaluation](rehearsal-live-evaluation-report.md) completed two passes: v1 15/20, corrected v2 20/20, total estimated cost $0.069585. This establishes a limited synthetic regression result; human-rated usefulness, held-out performance and a live worker adoption smoke test remain unvalidated. Optional scenario/brief generation is not part of the initial single-call gap reviewer. Automatic test execution, source dependency graphs, operational integrations and learned ranking remain expansion work.

The first policy uses explicit source/environment identity, requirement revisions and source-observation changes to determine freshness. It does not infer transitive code dependencies or impose an arbitrary time expiry on imported evidence. Scope and verification execution remain attributed user claims unless an existing source provides stronger provenance.

See the [local guide](release-rehearsal-guide.md) for the workflow, worker command and evaluation command.


Dependency advisory audits remain pending. Sandbox network restrictions prevented npm/PyPI access. Automatic approval review then rejected the npm audit because it discloses private dependency metadata to the external registry without specific authorization. No audit findings or clean vulnerability result are claimed; no dependencies were changed by this feature.
