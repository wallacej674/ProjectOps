# Release Rehearsal v1 contracts

Approved implementation scope: M0-M6 in [the implementation plan](release-rehearsal-implementation-plan.md). Implementation started after user approval. These contracts freeze the public seams for coordinated development; refinements must be integrated here and in callers together.

Base: `/api/v1/projects/{project_id}/releases/{release_id}/rehearsal`.
All list results use `{items, total}` and bounded pagination. IDs are integer database identities except client idempotency keys, which are UUIDs. Read operations enforce owned Project and Release; mutations lock the owned Project and reject archived Project/Release. Writes with `version` fail 409 on stale state. JSON imports are limited to 256 KiB before parsing.

## Scope and evidence

- `GET /scope`: current scope or null.
- `POST /scope`: `{version: 0 for first scope or current version, source: {target: string|null, snapshot: string|null, files: {relative_path: sha256}, coverage: "partial"|"complete"}, environment: string|null}`. Creates immutable revision; response `{id, version, brief_revision, source, environment, created_at}`. File inventory cap 5000; explicit unknowns retained.
- `GET /scope/history`: scope revisions.
- `POST /evidence/preview` and `POST /evidence`: same validated envelope `{request_key, requirement_id, requirement_revision, scope_id, kind: "verification"|"material"|"scan"|"health"|"readiness"|"analysis", source_id: integer|null, verification: object|null}`. Preview returns `{digest, evidence, limitations}`; import returns evidence record. Import is user action, not a model submission.
- `GET /evidence`: immutable records with `{id, requirement_id, requirement_revision, scope_id, kind, origin, digest, payload, limitations, created_by, created_at}`. `payload` freezes original source, not its mutable current content.
- Verification object: `{check_id, criterion, expected, command, executed: boolean, outcome: "passed"|"failed"|"not_run", output, not_run_reason, tool, tool_version, started_at: datetime|null, finished_at: datetime|null}`. Executed checks require ordered timezone-aware times; not-run checks require reason. All text bounded. Import remains attributed user-supplied evidence.

## Assessments and Next Steps

- `GET /assessments`: each immutable assessment plus effective state/freshness and current review status.
- `POST /assessments`: `{requirement_id, requirement_revision, scope_id, evidence_ids: [int], outcome: "not_verified"|"supported"|"gap_found"|"conflicting", rationale, limitations: [str]}`. Creates proposed assessment. `supported`, `gap_found`, `conflicting` require eligible evidence; source/scope/criteria conflicts cannot silently support. Model proposals go through the same validation.
- `POST /assessments/{id}/review`: `{version, action: "accept"|"supersede", reason}`. Human review is separate from evidence; accepting a stale assessment cannot make current support.
- `GET /summary`: `{scope, requirements: [{id,title,consequence,applicability,state,outcome,freshness,reasons,assessment_id,disposition}], next_steps: [...], limitations: [...]}`. This is the frontend's principal aggregate read. Requirements without eligible accepted assessment remain not_verified. Freshness `current|stale|unknown`; state may project stale. Exclusions and undecided applicability visible.
- `POST /requirements/{id}/disposition`: `{disposition: "open"|"accepted_risk"|"deferred", reason}`. Store attribution/history; does not rewrite evidence outcome.
- `GET /next-steps`; `POST /next-steps`: `{requirement_ids:[int], title, rationale, acceptance_checks:[str], dependencies:[int]}` creates proposed record `{id,version,status,...}`. Priority derives from confirmed consequences, evidence urgency and dependencies; stable ties.
- `POST /next-steps/{id}/transition`: `{version,status: "accepted"|"in_progress"|"awaiting_verification"|"closed"|"cancelled",reason}`. Closing requires explicit verification review with evidence; completed imports only move to awaiting_verification. No dependency cycles or foreign IDs.

## Workflows

- `POST /workflows/preview`: `{evidence_ids:[int],requirement_ids:[int]}` -> `{manifest,digest,available,limits}`; frozen current scope, confirmed requirements and evidence; external destination explicit.
- `POST /workflows`: `{request_key,digest,evidence_ids,requirement_ids,consent:true}` -> run.
- `GET /workflows`; `GET /workflows/{id}`; `POST /workflows/{id}/cancel`.
- Public worker `run_once` with injected provider transport; jobs persist manifest, status, lease/fence, safe failure, usage. Fake and real transport satisfy the same interface. No model tool execution.
- AI result: `{assessments:[{requirement_id,outcome,evidence_ids,rationale,limitations}],next_steps:[{requirement_ids,title,rationale,acceptance_checks,dependencies:[]}],limitations:[str]}`. Model IDs must resolve in manifest; up to three Next Steps. Model output creates proposals only.
- One active account AI operation, 20 provider calls/rolling day across rehearsal and existing finding explanations. Complete serialized request input <=24 KiB and output <=3000 tokens, one call/run. Reserve 24,576 input tokens + 3,000 output tokens conservatively per dispatch; shared rolling budget 600,000 total tokens. Lease 120 seconds; worker absence warning after 60 seconds queued. Unknown dispatch retains reservation for rolling 24-hour accounting and cannot retry automatically. Provider timeout <=45 seconds. Queue/dispatch admission rechecks limits and archive. Release unused budget on confirmed nondispatch; reconcile known usage. No paid calls in automated tests.

## Handoff and decisions

- `POST /packets`: `{next_step_id,version,evidence_ids}` -> immutable `{id,digest,manifest,markdown}`. Accepted/in-progress Next Step only; JSON and Markdown render the same canonical content. Manifest contains exact current scope and requirement revisions; max16 KiB canonical payload.
- `GET /packets`; `GET /packets/{id}`.
- `POST /results/preview` and `POST /results`: `{request_key,packet_id,packet_digest,outcome:"completed"|"partial"|"blocked",summary,scope_id,checks:[{requirement_id,requirement_revision,verification}],limitations:[str]}`. Preview exposes stale reasons and claims. Reject mismatched packet identity; stale task/scope/requirement return is previewable but not silently attachable. Result import attaches evidence only after explicit user action; duplicate imports are idempotent. Scope must already be reviewed/selected.
- `GET /results`: attributed imports.
- `GET /decisions/preview` -> `{manifest,digest}` with current summary, exclusions, dispositions and limitations. `POST /decisions`: `{request_key,digest,decision:"go"|"no_go"|"defer",reason}`; exact preview digest required; response immutable record. `GET /decisions`: history.
- `GET /comparison?baseline_decision_id={id}`: current summary versus frozen decision manifest, changed criteria/evidence/scope and limitations. Without a baseline returns actionable empty comparison.

## Worked examples and test seams

Fixture: two atomic confirmed requirements, download isolation and search isolation. A passing download check supplies no search evidence. Import leaves both unverified; human accepts a scoped download assessment; search remains unknown. Accepting search risk leaves it unknown. Changing a relevant file digest makes prior download support stale. A passing reported search check still requires assessment review. A failed current check conflicting with a comparable current pass remains visible.

Public seams are authenticated release HTTP, worker command/status, external provider transport, rendered Release workspace/HTTP, a running local browser, Alembic upgrade, and frozen AI evaluation cases as approved in the plan. Red before green, one behavior at a time. Backend tests share a resetting PostgreSQL database: coordinator serializes DB test runs to prevent cross-agent interference. Frontend tests can run independently.


## Implemented contract refinements

- `GET /evidence/sources?kind=...&requirement_id=...` returns bounded `{items:[{id,title}],total}` selections from existing owned sources.
- `PATCH /next-steps/{id}` accepts `version` and the task input fields, retains prior content in history, and returns edited work to proposed for reacceptance. Transition input also accepts explicit `evidence_ids` for closure review.
- Summary requirement rows include `requirement_revision`, `criterion`, `verification_method`, lifecycle and disposition reason. Summary `next_steps` is the authoritative ranked top-three list.
- Workflow creation accepts `regenerate:false` by default. Identical successful requests reuse cached output through durable request-key aliases; regenerating requires new admission. Workflow status exposes `failure`, `warning`, `usage` and provenance, including `unknown_outcome`.
- Packets include the complete versioned Agent Result JSON schema, selected original evidence scopes and freshness reasons. Markdown includes the same digest and canonical manifest as JSON.
- Agent Result input accepts `schema_version:1`, `request_key`, `packet_id`, `packet_digest`, `scope_id`, `outcome`, `summary`, `checks`, `limitations` and, on import, the exact `preview_digest`. Preview returns `can_import`, `stale_reasons`, `source_changed` and `warnings`. Newly selected source scope requires review; changed task or requirement context prevents import.
- Decision previews freeze summary, accepted assessments, their cited evidence records, compact current unreviewed evidence references, historical observation counts and attributed disposition history. Comparison returns `{baseline,current:{manifest,digest},scope_changed,changes,limitations}` with requirement `before`/`after` values.
- Support remains an evidence-backed human interpretation. Source identity and execution in imported reports are user claims, explicitly labeled, not independently attested.
