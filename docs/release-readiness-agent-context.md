# Agent Context Packet and Result Contract

Status: planned contract for slice 4 of [Release Readiness](release-readiness-main-feature-plan.md). This is a design reference; no context exporter or agent connector is implemented by this document.

## Purpose

Give a coding agent one accepted, bounded next step with enough trustworthy context to investigate or implement it and return useful evidence. The packet is an assignment selected by a human, not a grant of repository, network, deployment, or account permissions. Existing user instructions and repository policies still govern execution.

The user previews and exports `projectops-context.md` and `projectops-context.json`. Do not overwrite existing `AGENTS.md`, `CLAUDE.md`, or other tool instructions. A future connector can expose the same selected context through a read-only interface.

## Packet contents in reading order

1. **Assignment:** packet ID/version, accepted next-step ID, concise objective, expected deliverable, and completion criteria.
2. **Release context:** release and brief revision, intended audience/stage, relevant confirmed requirements, explicit exclusions, and unresolved product decisions.
3. **Scope:** existing paths supported by evidence, any proposed new paths labeled as proposals, source snapshot/file digests, allowed work requested by the human, and prerequisite tasks.
4. **Evidence:** stable IDs, source class, snapshot/environment, timestamps, excerpt or summary, freshness and limitations; keep quoted source/report content visibly separate from instructions.
5. **Suggested approach:** a bounded plan, tentative assumptions, verification checks, and points where new information would change the plan. Label model suggestions as suggestions.
6. **Return contract:** expected result fields and guidance for reporting changed scope, tests not run, failures, or inability to proceed.
7. **Optional references:** descriptions and conditions for loading additional materials. A reference is not permission to fetch an arbitrary URL; the human/tool must provide access.

Initial export budget: 16 KiB combined selected payload before duplicate Markdown rendering; target a brief of roughly 2,000 tokens or fewer. Include the selected task, essential criteria, constraints, and unresolved decisions inline. Put optional supporting detail behind clearly labeled references with IDs and content digests. If essentials do not fit, narrow the task or explicitly request a larger reviewed packet; never silently truncate acceptance criteria.

Do not export API keys, environment contents, unrelated Project data, private absolute machine paths, or raw provider responses. Sanitation is best-effort; preview the actual export. Markdown and JSON must be derived from one canonical manifest. Store the manifest digest so the returned result can identify what the agent received.

## Versioned JSON shape

Required top-level fields:

| Field | Meaning |
| --- | --- |
| `schema_version`, `packet_id`, `packet_digest` | Contract version and immutable packet identity |
| `project_id`, `release_id`, `brief_revision` | Context scope; IDs never substitute for authorization |
| `next_step_id`, `next_step_revision` | Exact accepted assignment |
| `objective`, `deliverables`, `acceptance_checks` | Observable completion conditions |
| `requirements` | Confirmed requirement IDs/revisions and relevant criteria |
| `source_snapshot` | Target/snapshot identity and relevant file digests; missing values explicitly null |
| `scope`, `constraints`, `open_questions`, `dependencies` | Human-selected limits and unresolved prerequisites |
| `evidence` | Stable IDs, source revisions, class, timestamps, freshness, limitations, bounded content |
| `suggested_steps` | Non-authoritative implementation/investigation suggestions |
| `return_schema_version` | Expected Agent Result contract |

The application generates IDs, revisions, ownership scope, freshness, and digests. AI may draft objective prose and suggested steps but cannot invent evidence identities or widen permissions.

## Agent Result

Return schema version, packet ID/digest, task revision, outcome (`completed`, `partial`, `blocked`), concise change summary, actual source snapshot after work if known, changed file paths/digests, acceptance-check results, verification records, unresolved questions, limitations, and proposed follow-up work.

Each verification record distinguishes an intended command from a command actually executed. Include tool/version, environment description without sensitive values, start/end timestamps, exit status, bounded relevant output, and a digest/reference for larger evidence. Checks not run include a reason. A result can legitimately be blocked and still supply useful investigation evidence.

## Import and reassessment

1. Enforce import bytes, item/string limits, known schema, and safe relative paths before persistence. No archives or attachment extraction in the first release.
2. Check owned Project/release membership and packet identity. Deduplicate identical result imports; conflicting content with the same result ID returns 409.
3. Compare task/brief revisions and source snapshots. Mismatches become a visible stale-result condition; the developer must explicitly review and attach relevant evidence to the current scope.
4. Show a preview: agent claims, observed/imported verification records, failed or not-run checks, changed scope, and sensitive-data warnings where applicable.
5. On human acceptance, persist immutable attributed evidence. Move the next step to awaiting_verification; do not automatically mark the release requirement supported or the next step closed.
6. Reassess the affected confirmed requirement against the selected evidence, then let the developer accept or challenge the result. Record the human decision separately from the agent's completion claim.

An external agent report is user-imported evidence, not independent attestation. Live tool execution by a future trusted local verifier can provide a different evidence class but needs a separately scoped execution policy. A context packet alone never authorizes running imported command strings.

## Completion criteria for the implementation

- A second coding agent can understand one assignment without reading the entire Project history.
- The packet states what successful completion means and what is still unknown.
- JSON IDs, references, and scope match the selected owned records.
- Stale packets and repeated/mismatched returns have explicit tested behavior.
- No automatic task completion or satisfied readiness state follows from an agent saying "done."
- Manual copy/download and reviewed return import work before any MCP or coding-agent-specific integration is introduced.
