# OpenAI explanation workflow checkpoint

OpenAI was selected for Code Risk Review. The evidence preview, request lifecycle, history, Responses adapter, backend environment configuration, output validation, and editable work-item suggestions are implemented. The user authorized `OPENAI_API_KEY` in the backend environment for this integration; AWS Secrets Manager is not required for this workflow. No real key was retrieved, no private code was transmitted, and no paid OpenAI request was made during implementation.

## Set up when ready

Add `OPENAI_API_KEY` to the root `.env` or the backend process environment, then restart the backend. The checked-in `.env.example` contains a blank entry. Keep the real value in the ignored `.env`; do not put it in frontend configuration or prefix it with `VITE_`.

An absent or blank key keeps generation unavailable. A nonblank key enables the explicit send action; actual provider access and billing are checked by OpenAI when a request is sent. This does not require deploying ProjectOps. Configuration is cached until backend restart.

The backend sends the key only as an authorization header to the fixed OpenAI Responses endpoint. It excludes the key from settings serialization and representation, does not follow redirects, and does not inherit proxy settings. Provider errors are returned as generic saved failures without raw response bodies.


## Available behavior

Open a finding under Repository > Code Risk Review and choose **Preview AI evidence**. The view shows the exact packet and model destination. Sending requires a separate checkbox for that packet. While runtime access is unavailable, the send button is disabled and manual review/work items remain available.

The current packet contains bounded scanner metadata, coverage, and snapshot identity. Raw scanner messages, source anchors, source code, and arbitrary report fields are omitted. Source excerpt selection and sanitation remain a later portion of the accepted plan; no source upload is exposed in this checkpoint. The model must acknowledge missing context rather than claim it inspected code.

Generated results, once the runtime is connected, have an explanation, conditions for impact, uncertainty, proposed change, verification steps, evidence references, and a proposed work item. **Use suggestion in work-item draft** copies the proposal into the existing editable form. The human chooses final priority and accepts the work item. A validated explanation reference is retained with the accepted item. Generation never changes severity, review disposition, readiness, or work-item status.

## Runtime contract

- OpenAI Responses endpoint only, no model tools, `store=false`, structured JSON schema, maximum 3,000 output tokens, 45-second total timeout, maximum 128 KiB response.
- `store=false` controls response storage; it is not a claim of zero provider retention.
- Configurable model: `PROJECTOPS_CODE_RISK_AI_MODEL`, default pinned `gpt-5.4-mini-2026-03-17`. This is an initial evaluation candidate, not a measured quality endorsement.
- One active request per account and 20 provider reservations per rolling 24 hours across Projects. Failures count toward the limit. This bounds usage, not a fixed dollar amount.
- An account lock protects reservation and deduplication, then releases before network work. Repeated request keys return the same record, including cache hits. Regeneration requires a new key and explicit action.
- Cache identity includes occurrence, packet digest, model, and prompt version. Cached output is reused without another model request.
- Pending records expire after 90 seconds when read/listed or another request is reserved. Expiration does not imply the provider did not process the request. No automatic retries.
- Only completed, schema-valid output with supplied evidence IDs and allowed file paths is saved. Refusal, incomplete output, timeout, malformed output, and unsupported citations become a generic persisted failure. Provider response bodies are not exposed in errors.
- `app/code_risk/openai_explanations.py` reads the backend setting and calls OpenAI through a bounded HTTP client. Runtime integration tests use a dummy key and intercept HTTP requests; they exercise the actual service-to-adapter connection without paid requests. These tests do not prove live model quality.

## Storage and verification

Migration `0016_risk_explanations` adds explanation history and idempotency mappings. It preserves existing scanner data and refuses destructive downgrade. Use the existing local Alembic upgrade workflow after stopping older backend processes.

Tests cover owned preview, explicit consent, stale preview, archived targets, valid output, invalid citations/files, safe failures, cache hits, concurrent duplicate requests, account quota, human work-item acceptance, Responses request shape/refusal/incomplete responses, and the UI preview-to-editable-draft journey. Full checkpoint suites passed: 345 backend tests and 326 frontend tests. After review fixes, 29 focused backend tests, the additional expiry test, and all four risk-panel tests passed. Final build and lint passed with five existing Fast Refresh warnings and the existing bundle-size warning. The migration was tested in an isolated schema and then applied to the verified local development database at `0016_risk_explanations`.

Remaining before live release: supply the API key when ready, exercise a live synthetic fixture, and evaluate grounding/uncertainty on representative findings. Source excerpts need their own reviewed sanitation workflow. No deployment is required for those steps.

References: [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [pinned model](https://developers.openai.com/api/docs/models/gpt-5.4-mini).
