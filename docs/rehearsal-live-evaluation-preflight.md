# Live rehearsal evaluation preflight

Status: historical preflight. The user subsequently approved execution; two live passes are complete. See [the evaluation report](rehearsal-live-evaluation-report.md) for results, costs and remaining validation boundaries.

## Frozen first pass

- Model: `gpt-5.4-mini-2026-03-17`, matching the code's default model. Runtime overrides and account availability have not been inspected.
- Destination: OpenAI Responses API, `https://api.openai.com/v1/responses`.
- Exact requests: [preview JSON](rehearsal-live-evaluation-preview.json), SHA-256 `e48747d229714aaf9b9d59b701b7a841186613f036253cb3f1b68f8c19e05842`.
- Twenty existing synthetic cases; expected labels and next-action grading notes are withheld from model input. No repository source, real customer records, or environment configuration is included.
- Uses the application's actual rehearsal instructions and structured response schema, with tools disabled and `store:false`.
- Maximum 20 requests, no automatic retries, output cap 3,000 tokens each. The largest serialized request is 3,588 bytes, below the existing 24 KiB bound.
- Proposed spend cap: USD 1.00. Reserving the full existing 24,576 input-token allowance plus 3,000 output tokens for each call gives USD 0.63864 at standard rates of USD 0.75 input and USD 4.50 output per million tokens. This is conservative planning, not a measured bill or account-wide spending guarantee. Failed/uncertain dispatches retain their reservation.
- Rates and snapshot verified in [official model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

## Evaluation procedure

After credential handling and the cap are approved, verify configuration without printing secret values. Build/test the bounded runner through the already-approved provider/evaluation seams. Persist an attempt record before each request, save structured outputs and reported usage, and stop on an uncertain provider outcome or exhausted admission. Do not silently resume or repeat a submitted request.

Score all returned outputs with the frozen labels; report missing/failed cases in the denominator. Require no invented citations or unsupported support before recommending broader beta use. Review the usefulness and scope of each proposed next check, preserving the distinction between agent review and human validation. Retain failures rather than changing labels to fit outputs. Any prompt or runtime correction requires a separately identified version and rerun within approved admission/spend limits.

These compact fixtures evaluate semantic interpretation through the real provider prompt and response schema. They are not full persisted release manifests and do not by themselves validate the worker's live adoption path. Report that boundary explicitly; full application behavior already has fake-provider integration tests. A live application-manifest probe and real-user usability validation remain separate evidence to collect before claiming those gates passed.

## Execution record

The user approved the $1 total cap and use of the existing OpenAI runtime configuration. The configured key was not displayed. V1 passed 15/20 cases and exposed two unsupported support labels; corrected prompt v2 passed 20/20 with zero unsupported support labels. Combined estimated token cost was $0.069585. See the linked report for exact inputs, outputs, usage and limitations.

The bounded runner journals before dispatch and never automatically resumes or retries an existing journal. Successful execution used a nonsynced local output path after an initial journal replacement failed before any request. The runner now pins the separately versioned v2 preview. Do not treat a new invocation with a fresh journal as a free replay; saved outputs can be rescored offline.
