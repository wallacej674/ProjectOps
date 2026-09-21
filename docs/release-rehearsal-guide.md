# Release Rehearsal local guide

Release Rehearsal extends the Release Readiness workspace. It connects confirmed criteria to frozen evidence, reviewed assessments, prioritized verification work, portable agent assignments, and an attributed release decision. It assesses supplied evidence for an explicit source and environment; it does not certify production safety.

## Use the workflow

1. Open a Project's Release Readiness workspace, confirm the release brief and each independently assessable requirement, then open Release Rehearsal.
2. Select the source target, version or digest, file inventory coverage, and verification environment. Unknown identities remain unknown. Save a new scope when these change.
3. Preview and import verification reports or existing material, scan, health, readiness, and repository-analysis observations. An attachment alone does not satisfy a requirement.
4. Propose and review an assessment. Support requires a matching executed pass for the exact criterion and current known scope, without unresolved current failures. Missing checks remain not verified. Risk acceptance and deferral preserve the evidence state.
5. Review the next three prioritized tasks, inspect prerequisites, and accept a task. Editing proposed or accepted work creates a new version that needs acceptance again.
6. Export an accepted task as an Agent Context Packet. JSON and Markdown carry the same manifest and digest. The packet grants no repository, execution, or deployment permissions.
7. Import a schema-version-1 Agent Result using the packet's return schema. Preview the exact report first. A new, explicitly selected source scope may be reviewed; an outdated task or requirement requires a current assignment. Imported checks move work toward verification and never automatically support a requirement.
8. Reassess the evidence, then preview and record a human go/no-go/defer decision with a reason. Compare current context against that frozen decision later.

## Optional AI review

The UI previews the exact external input and requires explicit consent. One workflow uses at most one provider call to propose cited assessments and up to three Next Steps. Proposals need human review. Manual assessment remains available when the provider is unavailable.

The backend API and a separate worker must run against the same development database. After applying the additive migrations through `0020_rehearsal_handoff`, start the worker from `backend`:

```powershell
.venv/Scripts/python.exe -m app.jobs.run_readiness_workflows
```

Use `--once` to process at most one queued operation. Existing provider configuration is reused. The worker stores queued/running/completed/failed/cancelled/unknown-outcome history. An uncertain dispatch is never automatically retried. A queued warning means the worker may be absent or delayed.

Admission is shared with finding explanations: one active account operation, 20 calls and 600,000 reserved/observed tokens per rolling day. Rehearsal bounds the complete serialized provider input to 24 KiB and output to 3,000 tokens. Identical successful previews can reuse cached output; explicit regeneration consumes new admission. Cancellation after dispatch cannot guarantee that the provider did not process the request.

## Validation and evaluation

The backend tests use an isolated test database and fake provider transport; no paid model requests are needed. Run database tests serially because the repository's test fixture recreates its public schema.

```powershell
# backend
.venv/Scripts/python.exe -m pytest -q
# frontend
npm test -- --run
npm run lint
npm run build
```

Twenty synthetic evaluation cases live at `backend/tests/fixtures/rehearsal/evaluation-cases.json`. Score separately saved responses offline:

```powershell
# backend
.venv/Scripts/python.exe scripts/evaluate_rehearsal.py tests/fixtures/rehearsal/evaluation-cases.json responses.json
```

The evaluator checks expected labels, missing requirements, foreign citations, and unsupported support. It does not measure semantic correctness or human usefulness. A [live semantic evaluation](rehearsal-live-evaluation-report.md) now records the original failures and a corrected 20/20 synthetic rerun. Human-rated usefulness and pilot validation are still pending. Usability recruitment, production deployment, automatic code execution, source-graph expansion, and learned ranking remain follow-up work.
