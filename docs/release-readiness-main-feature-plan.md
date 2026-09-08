# Release Readiness: Main Feature Implementation Plan

Status: approved implementation plan, 2026-09-07. The first Release Brief/requirement workspace is implemented; see [the milestone record](milestone-release-workspace.md). Evidence assessment and AI workflows remain planned. This is the primary product-development direction. It supersedes Code Risk Review as the standalone next-feature priority; that capability becomes one evidence source. This document does not claim the new workflows are implemented or authorize deployment.

## Product outcome

ProjectOps helps a developer answer: **For this release, what matters, what evidence do we have, what remains uncertain, and what should a person or coding agent do next?**

Initial audience: solo developers and small teams preparing web applications for a private beta. Begin with one release and one critical user journey. Projects with documents, account isolation, or background processing are useful pilot cases. Later workflows can cover more architectures and release stages.

The main feature is Release Readiness. AI workflows help interpret intent, assess supplied evidence, investigate uncertainty, and prepare actionable handoffs. The product owns durable requirements, evidence, decisions, and verification history. Agent output is a proposal with provenance; agreement between agents is not independent evidence.

The distinctive journey is: release goal -> confirmed requirement -> relevant evidence -> explicit gap -> accepted next step -> agent context packet -> returned verification evidence -> reassessment. Measure whether this changes a developer's next action, not the number of agents or generated reports.

## Current foundation and gaps

| Existing implementation | Use in the new feature | Constraint |
| --- | --- | --- |
| Account-owned Projects and archive rules | Ownership and lifecycle | Every nested release resource must enforce the same ownership |
| `models/readiness.py`, `services/readiness.py` | Retain project-level catalog/checklist as baseline signals | Current statuses are passed/failed/unknown/not_applicable; these are not release-specific evidence assessments |
| Project Artifacts and evidence links | Reference plans, runbooks, decisions, and selected text | Artifacts are editable references; freeze the selected revision for an assessment |
| CodeMap Medium | Stack/configuration hints | Does not establish application behavior or inspect all source |
| Code Risk Review | Immutable finding occurrences, coverage, snapshots | Imported reports are user-supplied; scanner success does not establish exploitability or readiness |
| OpenAI explanation adapter and request records | Reuse bounded structured responses, consent, provenance, deduplication | Backend `OPENAI_API_KEY` is supported; live evaluation and source excerpts are still outstanding |
| Health Checks/Alerts | Runtime observations when available | A successful HTTP check does not prove authentication, recovery, or business correctness |
| Launch Report and Launch Decision | Human decision surface and historical artifacts | Preserve existing project-level meaning; add explicitly release-scoped summaries |
| Risk Work Items | Link security remediation to a next step | Do not force every release task to have a scanner finding |

All first-release product work runs with local PostgreSQL, FastAPI, React, and the OpenAI API. A local workflow worker may run beside the backend. Deployment evidence can remain unavailable until a real environment exists. No hosting prerequisite, external agent subscription, or new cloud infrastructure is needed for development.

## First-release user journey

1. Create a Release Brief: intended users, release stage, important workflows, data handled, external dependencies, unacceptable failure outcomes, constraints, and explicit exclusions.
2. Select existing artifact text or paste bounded plan text. ProjectOps identifies candidate requirements and assumptions. The developer edits and confirms the requirements before assessment.
3. Select evidence for one journey: relevant scan occurrences, existing readiness observations, selected artifact revisions, and imported verification results. Preview exactly what will go to OpenAI.
4. Run Release Gap Review. Display each assessment with requirement, supporting/contradicting evidence, missing information, limitations, and suggested verification.
5. Accept or revise the assessment. See the top three next steps with a visible ranking rationale, dependencies, acceptance checks, and unresolved decisions.
6. Choose one next step and export an Agent Context Packet as Markdown plus versioned JSON. The packet gives a coding agent a bounded assignment and the evidence it needs.
7. Work externally. Import an Agent Result containing claimed changes, source snapshot identity, actual test results or explicit not-run reasons, and unresolved questions. Preview it before attaching it as evidence.
8. Reassess against the new snapshot. Completing a next step does not automatically satisfy a requirement. Record a human release decision against a frozen summary when appropriate.

Worked example: a document application's confirmed requirement says a user cannot access another user's documents through download or search. Supplied evidence shows a download isolation test but no search isolation evidence. The review reports an unverified search path, not a proven vulnerability. The next step requests a negative search-isolation test with two synthetic accounts and specifies expected behavior. A returning agent report remains attributed evidence until the test result and snapshot are reviewed.

## Information architecture

Make the Project Dashboard open on its active Release Readiness workspace once a release exists. Projects without one see a short brief-creation flow. Retain all existing deep links and keep the current project overview accessible.

The primary workspace shows:

- Release goal, brief revision, stage, and the critical journey being assessed.
- Requirements with evidence state and human disposition shown separately.
- Top three next steps, why they rank here, and what each would resolve.
- Missing or stale evidence and the last assessed source snapshot.
- Workflow activity with progress, cost/usage, input previews, failures, and review checkpoints.
- A release-decision summary listing known gaps, accepted risks, exclusions, and unavailable operational evidence.

Use action labels such as **Review release gaps**, **Plan verification**, and **Prepare agent handoff**. Put agent internals and prompt versions in inspectable details. Repository, Security, Health, and Artifacts become supporting views. Do not lead with a universal percentage or a claim of guaranteed production safety.

## Domain and assessment rules

Canonical planned vocabulary is recorded in `../CONTEXT.md`. These terms describe the target product, not current delivery status.

| Dimension | Values and meaning |
| --- | --- |
| Requirement lifecycle | proposed, confirmed, retired; only confirmed revisions participate in the release assessment |
| Applicability | applicable, not_applicable, undecided; excluding a requirement needs an attributed reason |
| Evidence state | not_verified, supported, gap_found, conflicting, stale; scope is one requirement revision and specified snapshots |
| Assessment review | proposed, accepted, superseded; AI creates proposed assessments |
| Human disposition | open, accepted_risk, deferred; this never changes the underlying evidence state |
| Next-step state | proposed, accepted, in_progress, awaiting_verification, closed, cancelled |
| Release decision | go, no_go, defer; human-attributed and tied to exact assessment/evidence revisions |

A supported assessment means the stated criterion has relevant supporting evidence at a named scope; it does not certify the whole feature. Store evidence method, trust class, timestamps, source version, environment, and limitations alongside the state. A linked document, an agent assertion, an imported test report, and a ProjectOps-observed check are different evidence classes.

Missing evidence stays not_verified. A passing build supports buildability, not user isolation. An accepted risk can coexist with gap_found. Conflicting observations remain conflicting until a person resolves their scope or supplies better evidence. Stale evidence remains readable but cannot silently support the current release.

Derive staleness from explicit dependencies: a changed brief/requirement revision, changed linked artifact content, a changed file digest, changed verification environment, or an expired evidence policy. Use conservative warnings when dependencies are incomplete. Do not infer unaffected behavior from unchanged filenames or treat a Git commit alone as proof of matching content.

Prioritization is a versioned deterministic rule over confirmed release relevance, consequence of failure, evidence gaps/conflicts, dependencies, and human overrides. Return a readable reason with each rank. AI can suggest those inputs, but unconfirmed estimates cannot silently set them. Keep effort as a labeled estimate; show ties and preserve stable ordering. Avoid precision implied by an unexplained numeric security score.

## AI workflow design

See [workflow catalog](release-readiness-workflows.md) for the planned agent roles, triggers, inputs, outputs, and rollout order.

An agent role is a constrained prompt/tool policy. A workflow is a durable sequence of steps, some deterministic and some model-assisted. The initial roles can share one configured OpenAI model. Add specialized models only after task-specific evaluations demonstrate a benefit.

First-release roles: Release Brief Assistant, Requirements Analyst, Evidence Assessor, Next-Step Planner, and Agent Handoff Planner. The foundation also prepares for specialists in authorization, data lifecycle, reliability, dependencies, testing, operations, and change impact.

The application routes relevant workflows from developer-confirmed release attributes. Show suggested workflows and why they apply. The first release runs on explicit user actions; later opt-in triggers can react to imported evidence or changed snapshots. Empty or irrelevant domains should not launch model calls.

Use typed outputs at every step. Evidence IDs and requirement IDs must resolve within the owned Project and selected release revision. Model-proposed paths must refer to supplied evidence or be clearly labeled proposed new files. Validate graph dependencies and reject cycles. A synthesis step preserves disagreements and absent inputs; it cannot convert repeated AI assertions into corroboration.

## Durable execution and cost controls

Build a narrow workflow runner for this feature, backed by PostgreSQL and a local worker command. Do not require a general orchestration framework or multi-agent SDK for the first release.

- Workflow states: queued, running, waiting_for_review, completed, partially_completed, failed, cancelled. Store immutable input manifest, workflow/prompt/schema versions, requested and reported model, step outputs, usage, timestamps, and safe failures.
- Worker claims use row locks with a lease and fencing version. Network calls run outside database locks. Completion writes must match the active lease/version; a late response cannot overwrite cancellation or a superseding run.
- A workflow reserves estimated budget before dispatch. Reconcile actual token usage when supplied. Missing usage remains unknown; keep a conservative reservation until policy reconciliation.
- Initial ceilings: one active workflow per account, one model step at a time, six paid calls per run, a 24 KiB evidence packet per model step, and 3,000 output tokens per step. Retain a shared rolling account budget across workflow calls and existing finding explanations so neither route bypasses the limit. Make limits configurable with safe defaults.
- Preview the complete frozen manifest and call budget before starting. If a later step needs new source material, pause for another preview. Automatic submission is restricted to the already-consented manifest.
- Deduplicate run requests by account/request key and step executions by run/step/input digest. Cache successful steps by exact inputs, model, and policy versions. Cache reuse preserves original provenance.
- Separate safely retryable local operations from ambiguous provider calls. After a crash or timeout that may have reached OpenAI, show the uncertain outcome and require an explicit retry; do not automatically incur another charge.
- Cancellation prevents further dispatch and ignores late output as a usable assessment, while recording incurred usage if known. Worker absence is visible; no request remains silently queued indefinitely.
- Use mocked provider transport for automated tests. Keep real synthetic evaluations explicit and budgeted. No key is required to develop or run deterministic/mocked tests.

## Evidence intake and agent handoffs

The first release supports existing artifact text and bounded plain-text/JSON imports. Reuse scan ingestion; add a strict verification-result envelope rather than interpreting arbitrary logs as trusted test results. Plan for at most 20 selected evidence records and 256 KiB per imported envelope initially; enforce byte, item, and string limits before persistence. Larger needs must produce explicit scope reduction or an actionable validation error.

Source snippets are a separate slice: select up to three files/200 lines/24 KiB total, tied to an existing snapshot. Exclude sensitive paths, sanitize before persistence/submission, show truncation and best-effort redaction, and require an exact preview. Imported excerpts remain user-supplied; a claimed digest alone is not proof that the excerpt matches the file. No arbitrary backend filesystem reads, URL fetching, repository execution, or model-directed tool expansion.

The first Agent Context Packet is a downloadable/copyable artifact. It does not install plugins, edit repository `AGENTS.md`, message external agents, or grant execution rights. See [agent context contract](release-readiness-agent-context.md). Markdown is for humans/agents; JSON is authoritative for references and result matching.

Phase 2 may expose a read-only context interface and MCP adapter with the same ownership and field-selection policies. Authentication and permission design precede that integration. Returning results requires an explicit user-reviewed import initially. A future execution integration must separately define repository access, sandbox policy, write scope, and approval semantics.

## Persistence and module plan

Use additive migrations after the actual Alembic head at implementation time (currently `0016_risk_explanations`). Do not repurpose old project-readiness rows or reinterpret historical launch reports.

Proposed records:

- `releases` and immutable `release_brief_revisions`: project, name, stage, lifecycle, brief revision, active release selection.
- `release_requirements` and revisions: confirmed criterion, origin references, applicability, consequence, verification method, human recorder.
- `release_evidence` and typed source links: immutable selected payload/digest and links to existing artifacts/scans/health observations; preserve attribution and source-class limitations.
- `release_assessments` and assessment-evidence links: requirement revision, findings, citations, scope, evidence state, proposed/accepted status, review history.
- `release_next_steps` and dependency/requirement links: accepted action, rank rationale, acceptance checks, ownership, lifecycle; optional relations to existing Risk Work Items.
- `readiness_workflow_runs` and steps: immutable inputs, execution state, usage reservation, leases, idempotency, output provenance.
- `agent_context_packets` and `agent_result_imports`: export version/digest, selected next step, result correlation, reviewed evidence links.
- `release_decisions`: human decision, rationale, exclusions, risk dispositions, frozen assessment manifest; optionally surface through a linked Project Artifact.

Prefer foreign keys/association tables for ownership and relationships, bounded JSON for versioned evidence and provider payloads. Enforce optimistic revisions on human edits; stale writes return 409 with draft preservation. Archive preserves history. Evidence edits create new revisions. Every read/import/export checks Project ownership and membership; archived parents reject mutations. Existing single-owner behavior remains the first-release authorization model.

Proposed deep modules: `release_readiness` owns revisions/assessment policy/next-step transitions; `readiness_evidence` owns normalization/provenance/staleness; `readiness_workflows` owns lifecycle/budget/provider execution; `agent_context` owns scoped export and result correlation. Implement following existing models/schemas/repositories/services/api layering. Frontend state lives in focused resource hooks and panels, not a larger monolithic Project detail component.

Candidate interfaces under `/api/v1/projects/{project_id}/releases`:

| Interface | Responsibility |
| --- | --- |
| Release create/read/update and brief revision confirmation | Define the assessed release without rewriting history |
| Requirement proposal/revision confirmation | Separate model proposals from agreed release criteria |
| Evidence preview/import/link/list | Validate bounded evidence and freeze selected revisions |
| Workflow preview/start/get/cancel and step review | Show destination/cost/scope, then run the consented manifest |
| Assessment list/review | Record accepted interpretations without changing source evidence |
| Next-step list/accept/update | Human-controlled work plan with stable dependency checks |
| Context packet create/read/download | Export one accepted next step and selected evidence |
| Agent result preview/import | Correlate returned claims with packet/snapshot; review before linking |
| Decision preview/create/read | Record an attributed release decision and exact supporting scope |

Freeze detailed request/response contracts in slice 0. Preserve legacy routes, navigation, and score semantics; use separate Release Readiness DTOs. Do not auto-convert legacy passed values into supported release assessments. Offer reviewed links to those observations as evidence instead.

## Delivery sequence and exit criteria

| Slice | Concrete deliverable | Exit criterion |
| --- | --- | --- |
| 0. Contracts and fixtures | One synthetic document-app release, requirement/evidence/status contracts, workflow policies, evaluation cases | Walk the full example manually; each conclusion identifies its evidence or explicit unknown; agreed public test seams documented |
| 1. Release workspace | Brief revisions, manually confirmed requirements, release-first navigation, basic evidence links | A local user can define a beta and inspect requirement scope without AI; legacy links still work |
| 2. Evidence assessments | Immutable evidence selection, proposed/accepted assessments, deterministic staleness and prioritization | Missing, conflicting, stale, and supported evidence remain distinguishable; ownership and revision tests pass |
| 3. AI review workflow | Durable runner and first five roles, preview/consent, typed outputs, budget and failure handling | A release brief becomes reviewed requirements, proposed assessments, and three next steps using bounded calls; crash/retry/cancel tests pass |
| 4. Agent handoff loop | Markdown/JSON packet, result preview/import, next-step evidence and reassessment | Another coding agent can act on one packet; imported results never silently close requirements; stale/mismatched results are rejected or explicitly marked |
| 5. Pilot readiness | Live synthetic evaluations, usability checks, release summary and decision record | Validate grounding, actionable recommendations, and uncertainty; pilot users complete the entire loop locally |
| 6. Specialist workflows | Access control, data lifecycle, reliability, tests, and dependency review | Add one specialist at a time only after its evaluation set and input requirements pass |
| 7. Continuous context | Change-impact workflow, optional read-only agent context interface, runtime/operations evidence | Relevant changes flag affected evidence; outsiders cannot read context; operational unknowns remain visible until observed |

Slices 0-5 are the first coherent product release. Do not start broad specialist expansion before a real user completes the handoff/reassessment loop. Parallel AI branches can be introduced in slice 6 when they use disjoint evidence and the shared budget/merge policy is tested. These are product workflows, not a request to spawn development subagents during this planning task.

## Testing and evaluation

Use the repository TDD skill: one vertical behavior, failing test, minimal implementation. Test at public interfaces with real PostgreSQL persistence and a fake provider at the external network seam. Reuse the existing migration-chain test and frontend testing setup.

Required cases: cross-Project references/export access, archived-parent writes, conflicting brief edits, exact packet consent, missing citations, invented paths, malicious source instructions, no-source uncertainty, duplicate requests/results, shared budget exhaustion, concurrent worker claims, crash after submission, cancellation/late output, stale evidence, requirement exclusions, conflicting test results, accepted risk, and preserving human drafts during navigation/failure.

Prepare at least 20 synthetic cases spanning correct/incorrect account isolation, absent tests, contradictory reports, dependency-only evidence, stale results, irrelevant requirements, prompt injection, and unavailable runtime checks. Include safe controls and cases where the correct output is not_verified. Human-labeled expected evidence states and acceptable next actions are the evaluation reference.

Release gates: all deterministic isolation/state/citation tests pass; no unsupported automatic satisfied/ready transitions; malformed output is rejected; every actionable assessment cites supplied evidence and exposes scope. For initial live evaluation, target at least 90% human-rated relevant/actionable next steps on the labeled set with zero unsupported readiness claims. Treat this as an acceptance target, not a claim of statistical reliability. Record model/prompt/version/cost/latency and failures. Failing cases stay in regression evaluations.

For five pilot developers, record their next steps before using ProjectOps, then compare after one Release Gap Review. Seek a material previously missed issue or investigation for at least three, and successful packet-to-evidence completion for at least four. Capture false alarms and wasted work as well as useful discoveries. These are proposed learning thresholds; a small pilot does not prove market fit.

## What remains deliberately separate

Hosting ProjectOps, enterprise organization/roles, compliance certification, autonomous code changes, unrestricted agent browsing/execution, production remediation, and broad document ingestion are separate milestones. A preparation assessment can identify the need for a restore drill; only real drill evidence can support recovery behavior. Keep that distinction visible before and after deployment.

Implementation should begin with slice 0 followed by slice 1, using the document-isolation example. Complete the full narrow journey before increasing workflow breadth.
