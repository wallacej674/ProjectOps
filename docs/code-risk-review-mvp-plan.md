# Code Risk Review MVP: Implementation Plan

Status: partially implemented. Local scanner/review checkpoint is recorded in [milestone-code-risk-review.md](milestone-code-risk-review.md); OpenAI was selected; the AI workflow checkpoint and remaining setup/evaluation steps are recorded in [openai-risk-explanations.md](openai-risk-explanations.md).
This is a supporting feature plan under [Release Readiness](release-readiness-main-feature-plan.md), the primary product direction selected 2026-09-07. DataForge document work and Deployment Operations are deferred.

## Outcome and first-release scope

Help a developer answer: **What code risks should I investigate or fix next, what evidence supports them, and how will I verify the change?**

The end-to-end journey is:

1. Run a local command against an explicitly selected repository.
2. Import its bounded scan report into an owned Project.
3. Inspect source-code and dependency findings, including scan coverage and failures.
4. Ask AI to explain one selected finding using a reviewed evidence packet.
5. Review and save an actionable work item with affected files and acceptance checks.
6. Fix the code outside this feature, rescan, and inspect the difference.

No deployed application, production URL, GitHub connection, or hosted worker is required. ProjectOps runs with its existing local frontend, backend, and PostgreSQL setup. Downloading scanner tools/rules and refreshing vulnerability information may use the internet. Hosted AI is optional and separately enabled; a scanner-only workflow remains useful if AI is unavailable.

The first release covers Python and JavaScript/TypeScript source checks plus supported npm/Python dependency inputs with concrete versions. It explains scanner findings; autonomous whole-repository AI discovery, automatic fixes, exploit execution, PR creation, secret scanning, and a general-purpose task-management system are outside this MVP.

## Product decisions

| Decision | Reason |
| --- | --- |
| Use Semgrep Community Edition for source checks and OSV-Scanner for dependencies | Reuse established detection engines; ProjectOps adds evidence review, planning, and history |
| Local command produces a report; authenticated UI imports it | No remote execution endpoint, arbitrary backend filesystem access, scanner daemon, or new job queue |
| Separate Code Risk Review storage from CodeMap Repo Analysis | Existing Repo Analysis requires a GitHub Repo Integration and represents bounded manifest/path evidence; local scans must not fabricate that integration |
| AI explains a selected finding and proposes work | Keeps model context bounded and suggestions anchored to identifiable evidence |
| Deterministic priority with visible rationale | AI prose must not silently change scanner severity or human decisions |
| Readiness receives an advisory evidence reference | A clean scan cannot establish operational production readiness |

Official documentation establishes that Semgrep can run local rules and produce machine-readable output, and OSV-Scanner can inspect supported lockfiles. Exact versions, rule licenses, flags, and output fixtures must be pinned in slice 0. See references at the end.

## Current code to build around

- [Repo Analysis model](../backend/app/models/repo_analysis.py) requires `repo_integration_id` and only has completed/failed states. Add a sibling risk-review model; keep current analyses readable.
- [Repo analysis orchestration](../backend/app/services/repo_analyses.py) fetches bounded GitHub evidence synchronously. Keep that behavior intact.
- [Readiness implementation](../backend/app/services/readiness.py) already calculates advisory status and evidence coverage. This MVP does not change scoring rules.
- [Artifact implementation](../backend/app/services/project_artifacts.py) supports attributed evidence references and human decisions. Reuse it for an explicit review-summary artifact, not as an unstructured finding database.
- [Project workspace navigation](../frontend/src/features/projects/utils/projectWorkspace.ts) provides the existing Repository view. Add a Code Risk Review subview without removing the current analysis UI or legacy links.
- [Backend dependencies](../backend/pyproject.toml) are version ranges in `pyproject.toml`. That alone cannot prove which Python dependency versions are installed. Report unavailable dependency coverage until a supported resolved inventory is supplied; never install the scanned project to discover it.

## Proposed domain and data model

These are proposed terms for implementation kickoff. Add accepted definitions to `CONTEXT.md` with the domain-modeling skill; do not describe unimplemented capabilities as current behavior.

| Record | Meaning and minimum data |
| --- | --- |
| Scan Target | A Project-scoped identity for a local source tree, with a display name and active/archive state. No absolute machine path in the backend. The CLI uses its opaque ID when exporting reports. |
| Code Risk Scan | Immutable imported result for a target: client run UUID, bundle digest, schema version, snapshot manifest hash, optional Git commit, dirty flag, scan timestamps, import time/actor, scanner/rule versions, coverage, safe errors, outcome |
| Risk Finding | Stable target-scoped identity for a detected issue, with scanner family, fingerprint algorithm version, and fingerprint. Human review state is separate from scan presence. |
| Finding Occurrence | A finding's evidence in one scan: relative path/location or package/version, advisory/rule identity, raw and normalized severity, scanner confidence if present, and sanitized bounded evidence |
| Finding Review | Human disposition/history: unreviewed, acknowledged, false positive, or accepted risk; reason, recorder, timestamp, and evidence version reviewed |
| AI Explanation | Versioned generated explanation for one occurrence/evidence digest: model identifier, prompt version, citations, limitations, output, status, request key, and usage when available |
| Risk Work Item | A user-accepted proposed change linked to finding IDs: title, rationale, affected files, acceptance checks, user priority, and todo/in-progress/done status |

Relationships: Account owns Project; Project owns targets, scans, findings, and work items. A scan has many occurrences; a finding may recur across scans. Explanations reference an exact occurrence and input digest. Findings and work items have explicit relations, not magic tags.

Use additive Alembic migrations after the actual head, currently `0014_health_alerts`. Uniqueness includes target/run UUID, scan/finding identity, and target/fingerprint-version/fingerprint. Re-importing the same UUID and bytes returns the existing result; the same UUID with different bytes returns 409. Imports commit the scan, occurrences, and activity atomically. An invalid bundle creates no partial database records.

Archive targets and retain scan history. Archived Projects/targets reject new imports and mutations, while owned historical reads follow existing application conventions. No automatic destructive retention or migration downgrade that erases evidence.

## Local runner and report contract

Create `backend/scripts/scan_code_risks.py` as a thin command over a testable runner module. Its proposed arguments are repository path, target ID, and output report path. It never needs a ProjectOps login or writes directly to the database; import happens in the authenticated browser.

Default supported runtime: local Docker containers for scanner consistency across Windows and Linux. Docker is already part of ProjectOps's local setup. The launcher uses argument arrays rather than composed shell commands, and never accepts executable names, shell fragments, arbitrary scanner flags, or rules from report content.

1. Validate the selected root and enumerate supported files. Do not follow symlinks, Windows junctions/reparse points, or paths escaping the root. Exclude `.git`, dependency installs, virtual environments, generated build output, and sensitive configuration files. Record exclusions and unsupported inputs.
2. Copy eligible files into a temporary scan snapshot. Hash the copied bytes and record relative paths; scanners inspect that same snapshot, not a changing working tree. Git commit is supplementary metadata because uncommitted changes are supported.
3. Mount the snapshot read-only into pinned scanner images. Use trusted external rules/configuration, no repository scripts, no dependency installation, no fix mode, no Docker socket, and no inherited application/provider credentials. Disable Semgrep metrics and remote upload. Keep scanner process resources bounded.
4. Semgrep uses a pinned, license-reviewed local rule set. Start with a small curated selection for dangerous execution/deserialization, injection-related patterns, unsafe rendering, and disabled transport verification where applicable. Do not promise detection of every authorization flaw or cross-file dataflow.
5. OSV inspects supported dependency inputs with exact versions. Start with `package-lock.json` and fixture-verified Python lockfile/pinned-requirements formats. Record whether dependency inventory is complete, unresolved, unsupported, or unavailable; distinguish production/development dependencies only where input evidence supports it.
6. Normalize output while preserving scanner provenance, errors, and coverage. Distinguish tool execution failure from an exit code meaning findings were detected. Handle scanner-specific exit/output semantics with fixtures for the pinned release.
7. Write a versioned JSON report atomically. No archives or arbitrary attachment extraction. Clean up only the verified temporary snapshot directory, using native filesystem operations appropriate for Windows.

Proposed initial caps: 5,000 eligible files, 1 MiB per file, 100 MiB snapshot, five minutes per scanner, 10,000 findings, and 10 MiB imported JSON. Hitting a limit produces explicit partial coverage; never silently discard findings and call the scan complete. Reject imports above the byte limit before full JSON parsing and enforce count/string/depth constraints server-side. Confirm practical runtime/memory limits with the small local fixture suite before freezing defaults.

Report contents include tool outcomes (`completed`, `partial`, `failed`, `unavailable`), coverage by file/ecosystem, immutable relative locations, advisory metadata, and optionally sanitized bounded snippets. Raw stdout/stderr, complete source files, absolute paths, environment values, and arbitrary scanner payload fields are not persisted by default. Import accepts the defined schema only, validates locations and safe link schemes, and escapes all rendered text.

Imported reports are user-supplied evidence. Their claimed scanner version and source hash are useful provenance, not independently attested proof. A target ID must belong to the authenticated Project; it cannot authorize import into a foreign Project.

## Network and AI behavior

Semgrep scanning should work without network after image/rule setup. OSV may query advisory data using package identities and versions; expose that mode in the runner. An offline mode can use prepared local vulnerability data and must display its data date. Missing/stale data must not be represented as a current clean scan. Verify exact offline flags against the pinned release.

AI selection is intentionally isolated behind one explanation interface. The planning preference question offers hosted AI, local AI, or deferring provider selection. If no answer arrives, retain provider choice as an explicit gate before slice 3; implement one real adapter, not several speculative provider SDKs. A fake adapter supports tests but does not satisfy delivery of the AI feature.

The explanation workflow:

- User selects a finding and sees exactly what evidence will be sent, the model destination, and whether it is external. Source transmission is off until the user explicitly requests that operation with the displayed packet.
- Build context from the immutable occurrence, scanner rule/advisory metadata, and user-selected sanitized code excerpts tied to the same source hash. Do not fetch arbitrary paths or URLs requested by a model. Default cap: three files, 200 lines total, 24 KiB context, with clear truncation indicators.
- Exclude sensitive files and likely credential material before persistence or model submission. Redaction is best-effort and does not guarantee all sensitive information is detected; the visible packet and user control remain necessary. No secret-detection feature is included in this MVP.
- Treat repository text, comments, rule messages, and reports as untrusted data. The model receives no shell, file-write, network browsing, or project mutation tools. Instructions embedded in source cannot modify the application policy.
- Require a structured response containing explanation, prerequisites for impact, uncertainty, proposed change, verification steps, and citations to supplied evidence IDs. Validate citations and shapes before display. Missing context should yield a limited explanation, not invented files or confirmed exploitability.
- Cache by occurrence/context/model/prompt version. Regeneration is explicit. Bound request duration, output length, concurrent requests, and per-account usage. Show timeout/failure without discarding scanner results or retrying indefinitely.
- Store an explanation as generated advice. Its priority suggestion is separate from scanner severity and the user's final priority. The model cannot dismiss findings, mark fixes verified, or automatically create work items.

The user subsequently authorized a backend-only `OPENAI_API_KEY` environment variable for this OpenAI integration. This overrides the AWS-specific credential workflow for this task; see `openai-risk-explanations.md`. The original planning requirement was: before credential-related implementation, load the required `aws-secrets-manager` skill per `AGENTS.md`, locate it if necessary, and use the prescribed runtime-resolution workflow. This plan does not select or provision an AI account, retrieve credentials, or authorize sending private repository code to an external model. Applicable provider skills/docs must be loaded once a provider is selected.

## Findings, priority, and rescans

Keep severity, review disposition, and current scan presence independent. A scanner match is a potential code risk; a dependency advisory match establishes an affected listed version, not application-level exploitability.

Default queue order: unreviewed critical/high findings, remaining unreviewed findings, acknowledged findings, then accepted-risk/false-positive findings behind a visible filter. Within groups sort by normalized severity and stable ID. Keep unknown severity explicit and visible for review; preserve original severity and mapping version. Do not invent numeric confidence when a tool supplies none. Users may set work-item priority with a rationale.

Source fingerprints combine target, scanner/rule identity, normalized relative path, and a stable tool fingerprint where supported. Use a documented context anchor fallback rather than line number alone; include collision handling. Dependency identity uses ecosystem, package, advisory identity/alias group, and manifest path; the affected installed version belongs to the occurrence so upgrades do not erase history. Ambiguous matches remain unmatched rather than silently merged.

Compare a scan only to a user-selected compatible baseline for the same target. Compatibility requires matching coverage/rule-policy/scanner normalization profiles for the affected finding. Imported older or alternate-branch results do not automatically replace the target's current baseline; selection is explicit.

- **New:** present now, absent from a comparable baseline.
- **Recurring:** identity present in both.
- **Not detected in this scan:** absent after a successful comparable scan covered the relevant file/ecosystem and rule. This is evidence of absence in that scan, not proof of remediation.
- **Not assessed:** rule removed, file excluded/deleted, scanner failed, inventory incomplete, or comparison otherwise incompatible.

Human review remains in history. If relevant code/evidence changes, flag the prior disposition as needing re-review; do not silently inherit a false-positive dismissal onto materially different evidence. A work item marked done means the user marked it done. Show whether a subsequent compatible scan still detects the associated finding.

## Interface and UI plan

All endpoints below are under `/api/v1/projects/{project_id}/code-risk`. Every nested lookup checks Project ownership and parent membership, using the existing foreign-resource 404 convention.

| Proposed HTTP interface | Behavior |
| --- | --- |
| `GET/POST /targets`, `PATCH /targets/{target_id}` | Owned target list/create/rename/archive; no backend filesystem path |
| `POST /targets/{target_id}/scans/import` | Bounded validated JSON import, idempotent by run UUID and digest |
| `GET /targets/{target_id}/scans`, `GET /scans/{scan_id}` | Paginated metadata/history and coverage; explicit tool failures |
| `GET /scans/{scan_id}/findings`, `GET /findings/{finding_id}` | Filtered paginated findings and occurrence/review history |
| `GET /scans/{scan_id}/comparison?baseline_id=...` | Compatible comparison or explicit reasons comparison is incomplete |
| `PATCH /findings/{finding_id}/review` | Version-preconditioned disposition with reason; stale writes return 409 |
| `POST /occurrences/{occurrence_id}/explanations`, `GET /explanations/{id}` | Explicit bounded AI request, request-key deduplication, generated output or safe failure |
| `GET/POST /work-items`, `PATCH /work-items/{id}` | User-accepted work items and version-preconditioned updates |
| `POST /scans/{scan_id}/evidence-artifact` | Explicit, idempotent creation of an attributed review-summary artifact with a stable scan reference |

AI runs as one bounded synchronous request initially, not an in-process background promise. Reserve a request record before the call, perform network work outside database locks, then persist success/failure. An interrupted request expires to a visible failed state and cannot remain pending indefinitely. No automatic retries that risk duplicate paid requests; explicit retry uses a new request key after the prior result is resolved.

Backend modules: `models/code_risk.py`, `schemas/code_risk.py`, `repositories/code_risk.py`, `services/code_risk.py`, `services/risk_explanations.py`, and `api/code_risk.py`. Put reusable runner/adapter logic under a small `app/code_risk/` package. The module interfaces own normalization, comparison, and transaction invariants; routes should not orchestrate those internals.

Frontend: `types/codeRisk.ts`, a feature API wrapper, a focused resource hook, and `CodeRiskReviewPanel`, `RiskFindingDetail`, and `RiskWorkItems` in the projects feature. Extend Repository navigation with `?view=repository&section=risks`, selected scan and finding parameters. Preserve existing CodeMap and launch navigation. Findings, coverage, and AI explanations need independent loading/error states.

The review-summary artifact contains scan identity, source snapshot, coverage, counts by severity, and unresolved review decisions. It can use existing evidence-link APIs. Linking it does not automatically pass readiness items. Keep the report itself immutable and indicate that the artifact is an editable human-selected reference. No new security score or automatic launch blocking in this MVP.

## Implementation slices and exit criteria

| Slice | Deliverable | Exit criterion |
| --- | --- | --- |
| 0. Contracts and scanner feasibility | Pin images/rules/licenses/output fixtures; agree test seams; define report schema; create tiny vulnerable and safe Python/TS samples plus dependency inventory fixtures | Both real scanners run on local Docker; clean/findings/error outputs parse; unsupported Python inventory is reported honestly |
| 1. Source scanning to UI | Semgrep runner, target/report import, persisted occurrences, finding list/detail with coverage | Scan a local sample and inspect a real finding in an owned Project with no GitHub or deployment setup |
| 2. Dependency risk and review | OSV adapter, advisory links, normalized severity, review actions, comparison/deduplication | Known advisory fixture is shown; partial scan does not clear existing findings; repeat import is idempotent; foreign-account access fails |
| 3. AI explanation to work item | One configured real AI adapter, evidence preview, grounded structured explanation, user-accepted work item | Explain a selected finding with valid citations; reject invented citations; create and reload a work item; model failure leaves scanning usable |
| 4. Rescan and readiness evidence | Compatible comparison, re-review indicators, work-item verification context, explicit evidence artifact | Modify a local fixture, rescan, and distinguish recurring/new/not-detected/not-assessed; link summary without changing readiness status |
| 5. Local end-to-end verification | Full local workflow, migration/compatibility checks, documentation and milestone record | ProjectOps itself can be inspected locally; all acceptance checks pass and limitations are recorded |

Start implementation with slices 0 and 1. Slices 1-2 are a useful scanner-only checkpoint; they are not completion of the agreed AI-assisted MVP. Finish slice 3 with a real selected model before calling the AI feature delivered. No hosting drill is required for this local MVP.

## Test strategy and release acceptance

The repository [TDD skill](../.agents/skills/tdd/SKILL.md) says: “Before writing any test, write down the seams under test and confirm them with the user.” The table below proposes those seams for kickoff. No tests are written in this planning change.

| Test seam | Important behaviors |
| --- | --- |
| Runner command and scanner adapter outputs | Windows paths/spaces, root containment, symlinks/junctions, stable snapshot, limits/cancellation, versioned JSON, findings vs tool failure, no repo execution or mutation |
| Code Risk HTTP interface with real test PostgreSQL | Ownership, nested-resource isolation, invalid/oversized imports, transaction rollback, idempotency, stable identities, partial coverage, compatible comparison, concurrent review edits, archive behavior |
| Explanation interface | Bounded evidence, source-instruction injection, invalid citations, structured-response validation, unsupported exploitability claims, model timeout/usage cap, duplicate-request handling |
| React user workflow | Import, empty/partial/failed states, severity/review filters, keyboard access, deep links, context consent, explanation retry, work-item creation, scan comparison |
| Local browser journey | Real scanner report -> import -> inspect -> model explanation -> accept work item -> edit test fixture externally -> rescan -> compare -> readiness evidence link |

Use sanitized synthetic fixtures with independently specified expected findings, plus fixed advisory data for deterministic tests. Include both vulnerable and safe controls for each selected rule; record missed expected findings as a failed acceptance check. Model tests use a fake adapter for deterministic behavior, plus a small manual evaluation against the chosen real model. Do not equate valid JSON with a correct explanation: each evaluation must check evidence support, uncertainty, proposed fix relevance, and actionable verification steps.

Release acceptance:

1. The complete local journey works without deployment or GitHub setup.
2. Real Semgrep and OSV output is normalized with source/version/coverage provenance; dependency gaps are visible.
3. No failed or partial scan produces a false clean result or clears findings outside its coverage.
4. Repeated imports and line-only shifts do not create spurious duplicates in the supported fingerprint cases; ambiguous matches remain explicit.
5. AI output cites supplied evidence, labels uncertainty, and cannot mutate code or review status. One real adapter is demonstrated.
6. Work items contain proposed changes and acceptance checks, and preserve their source findings and human acceptance.
7. Cross-account reads/writes are denied, source snippets are escaped, and ordinary logs contain no source bodies or model packets.
8. Existing CodeMap, artifacts, launch decisions, monitoring, and readiness semantics remain compatible.

Run focused checks per slice, then backend PostgreSQL tests/migration checks/compilation, frontend tests/lint/build, existing CI dependency audits, and `git diff --check`. Run a real-scanner smoke suite separately from deterministic tests, using pinned images/data and explicit network policy. Do not scan live targets or install vulnerable fixture dependencies.

## Skills and remaining decisions

- `codebase-design`: keep runner, ingestion/comparison, and AI explanation interfaces small; inject real/fake adapters at those seams.
- `domain-modeling`: record accepted terms and distinguish findings, occurrences, human review, and generated advice.
- Repository `tdd`: agree seams, then one failing behavior and implementation at a time.
- `diagnosing-bugs`: apply when concrete scanner, migration, or workflow failures arise.
- `code-review`: review completed slices against this plan and repository standards before handoff.
- AWS/provider skills: only when the selected provider or credential implementation requires them; no AWS infrastructure is needed for the scanner workflow.

Decisions to close during slice 0: exact scanner versions and licensed rule inventory, concrete Python inventory formats, and fixture-measured resource caps. Close the AI destination/model/data-sharing choice before slice 3. No paid provider setup or private-source transmission is implied by accepting this plan.

Later extensions: AI discovery beyond scanner findings, broader languages, configuration-readiness checks, SARIF import, direct local-runner integration, CI report ingestion, secret scanning with redaction, richer dependency reachability, and verified remediation assistance. Each needs a separate bounded acceptance slice.

## Verified references

- [Semgrep local rules](https://docs.semgrep.dev/running-rules): local YAML rules and selected rulesets.
- [Semgrep CLI reference](https://docs.semgrep.dev/cli-reference): local scan behavior, machine-readable options, and exit-code semantics.
- [OSV usage](https://google.github.io/osv-scanner/usage/): source/dependency scanning, JSON reports, containers, and cached vulnerability matching.
- [OSV supported manifests](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/): supported npm/Python inputs; do not assume an arbitrary dependency declaration is a resolved inventory.
- [OSV installation](https://google.github.io/osv-scanner/installation/): Windows support and version compatibility information.

Planning verification: inspected repository models, services, schemas, navigation, and roadmap; checked scanner primary documentation. No scanner installation, application changes, database migration, model calls, or security scan was performed. This document does not claim any vulnerability was found in ProjectOps.

