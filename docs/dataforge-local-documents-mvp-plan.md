# First Feature MVP: DataForge Local Documents

Status: deferred option. The selected next-feature direction is
[Code Risk Review](code-risk-review-mvp-plan.md). No document-workflow implementation has started.
Constraint: build, use, and verify the complete workflow locally, with no deployed application, hosting account, live endpoint, or external API.

## Recommendation and outcome

Deepen DataForge Lite into a useful workspace for a Project's plans, requirements, runbooks, and notes.

The first MVP journey is: **import a local Markdown or text document, inspect and edit it inside ProjectOps, revisit its saved revisions, search its current content, and link it as supporting readiness evidence.**

Use ProjectOps's own plans as dogfooding material. A Project with no repository connection, production URL, or Health Check must support the entire journey. Missing production evidence remains missing; it does not prevent document work.

Only the existing local frontend, backend, and PostgreSQL setup are required. Reading selected files in the browser and saving their text through the local backend requires no cloud storage or provider setup. This is text import: the original file is not stored, watched, or synchronized.

## Why this comes first

| Candidate | Can be fully useful before deployment? | Order |
| --- | --- | --- |
| DataForge local documents and revision history | Yes; works with local documents and the existing database | First |
| CodeMap snapshot comparison | Yes with stored analyses; fresh repository analysis still uses GitHub | Next candidate if repository understanding is the priority |
| Exportable review packet | Yes; can export incomplete evidence with explicit gaps | Follow after document workflow, or choose as a smaller milestone |
| Deployment Operations and external monitoring | Real value depends on hosted resources or live endpoints | Deferred until the user starts deployment |

This order reflects the user's current constraint, not measured customer demand. The hosted-beta drill remains a future release requirement, not a prerequisite for local feature development.

## Existing behavior to reuse

- [Artifact schema](../backend/app/schemas/project_artifact.py) already supports `content` up to 10,000 characters, title, summary, tags, and imported source type.
- [Artifact model](../backend/app/models/project_artifact.py) stores text in PostgreSQL and records creator attribution. It has no revision history.
- [DataForge evidence milestone](milestone-16-dataforge-evidence-layer.md) documents search over current title, summary, content, URL, and tags. Search itself is already implemented.
- [Evidence coverage milestone](milestone-28-artifact-evidence-coverage-traceability.md) supports linking artifacts to readiness items and inspecting their usage. Linking is already implemented.
- [Artifacts UI](../frontend/src/features/projects/components/ProjectArtifactsCard.tsx) and [artifact hook](../frontend/src/features/projects/hooks/useProjectArtifacts.ts) provide the existing create/edit/archive workflow.

The new capability is local text import, a readable document detail view, and retained revisions, integrated with existing search and evidence links. Do not rebuild the registry or add a second document entity duplicating Project Artifacts.

## Scope and behavior

### Local text import

- Accept one `.md` or `.txt` file at a time through an explicit file picker.
- Read it locally as UTF-8, rejecting invalid encoding, empty text, NUL-containing data, unsupported extensions, and files over a proposed 64 KiB byte cap before decoding.
- Preserve the existing 10,000-character content limit for this MVP. Validate decoded content against the server limit, including non-ASCII text. Never silently truncate a document. Tell the user to select a smaller document or excerpt when the limit is exceeded.
- Preview editable title, content, artifact type, summary, and tags before Save. Use the filename without its extension as the initial title. Save with `source_type=imported`.
- Reuse the JSON artifact API; do not introduce multipart storage, filesystem paths, object storage, or a backend file parser.
- Selecting or canceling a file creates no artifact. A failed Save retains the draft. Disable duplicate submissions while a request is pending.
- Importing the same file again creates a separate draft; never silently overwrite an existing artifact or merge by title. Later replacement imports are outside this MVP.

### Document detail and reading

- Open full content in an accessible detail panel from the artifact list, search results, or supporting-evidence references.
- Render escaped, whitespace-preserving text for both supported formats in the first slice. Label Markdown as source text; rich Markdown rendering is a follow-up.
- Do not execute embedded HTML, fetch images, follow document URLs automatically, or treat document instructions as application commands.
- Show author attribution where available, updated time, artifact type, tags, archive state, and readiness items using the artifact.
- Support a bookmarkable location using the current Project workspace pattern, for example `?view=artifacts&artifact=123`; closing the panel preserves list filters. Invalid/foreign IDs have an explicit unavailable state.

### Saved revision history

- Preserve each effective change to title, summary, content, URL, tags, artifact type, or source type as an append-only snapshot.
- Capture revision number, saved time, authenticated editor, and the complete allowlisted editable-field snapshot. A no-op update creates no revision. Archive/unarchive alone does not create a content revision.
- Reading an older revision never changes the current artifact. Restore and visual diffs are follow-ups.
- Search matches the current artifact only. State that historical revisions are not searched.
- Evidence links continue to reference the current artifact, not a frozen revision. Editing a linked document does not certify its contents or change readiness status. Show the current updated timestamp when opening supporting evidence.
- Revision history is application-level edit history, not audit-grade immutable approval evidence. Existing Launch Decisions remain editable attributed records under their current rules.

## Proposed implementation design

Keep Project Artifact as the domain record. Add `Project Artifact Revision` as a proposed glossary term during implementation using the domain-modeling skill.

Use one artifact mutation module to enforce validation, current-record updates, revision creation, and activity recording in a transaction. Both new imports and existing edit flows cross that interface. Import decoding remains in a small frontend module returning a validated draft or an actionable error.

Proposed additive storage:

- Add a current revision number to Project Artifact.
- Add `project_artifact_revisions` with artifact ID, revision number, allowlisted field snapshot, editor ID when known, recorded timestamp, and provenance (`saved` or `legacy_baseline`). Enforce uniqueness of artifact ID and revision number.
- Initialize pre-existing artifacts to revision zero without inventing old edit history. On their first effective edit, retain the pre-edit state as revision zero and append the newly saved revision one in the same transaction. Label the baseline as first captured at that time; do not attribute it to the editor making the new change.
- Newly created artifacts begin with revision one. Apply history consistently to artifact mutations, including Launch Decisions, while retaining existing Launch Decision validation.
- Use row locking for serial revision allocation and an expected-revision precondition for updates. Stale edits return 409 and preserve the browser draft so the user can reload and reconcile. Update all first-party mutation callers together. Treat this as an explicit API contract change and document the required precondition, including revision zero for legacy artifacts.
- Retain revisions when an artifact is archived. Existing ownership and archived-resource read conventions apply to revision reads; enforce same-Project membership throughout.

Proposed HTTP additions under `/api/v1/projects/{project_id}/artifacts/{artifact_id}`:

- `GET /revisions?limit=25&offset=0`: bounded history metadata with total count, newest revision first; no full content in the list.
- `GET /revisions/{revision_number}`: a single authorized saved snapshot.
- Extend artifact read/update contracts with the current revision and required expected revision for mutations. Reuse existing create/get/update endpoints rather than adding a separate import endpoint.

Likely touchpoints: artifact model/schema/service/repository, an additive migration after the actual current Alembic head, existing artifact routes, frontend artifact types/API wrapper/hook/form, a new import dialog and detail panel, and Project workspace URL handling. Keep revision transaction behavior out of route handlers and keep import/view state out of the large Project Dashboard page.

## Delivery slices

1. **Import and read:** build the file-to-draft workflow and document detail panel through existing create/get interfaces. Demonstrate import, cancel, failed save, reload, search, and opening full content. No new storage model is required for this slice.
2. **Retain edits:** add revision persistence, metadata/detail reads, expected-revision conflict behavior, and history UI. Verify existing artifact and Launch Decision callers use the new contract. This completes the history portion of the MVP.
3. **Connect evidence:** make linked artifacts open the same detail panel, preserve list navigation and filters, and clearly distinguish current content from a historical revision. Reuse existing evidence APIs and readiness semantics.
4. **Verify locally and document:** run the complete journey with a fresh Project that has no production URL, repo connection, or health history. Update current-state docs only after implementation and record actual results in a milestone note.

Start with slice 1. Do not front-load cloud storage, document parsing, an AI pipeline, or a general-purpose knowledge graph.

## Proposed test seams and completion criteria

The repository TDD skill requires agreement on test seams before tests are written. These are the proposed seams for implementation kickoff; this planning change creates no tests.

| Seam | Behavioral coverage |
| --- | --- |
| Import-to-draft interface | Valid UTF-8 text, unsupported format, byte/character bounds, non-ASCII limits, invalid encoding, empty input, exact content preservation |
| Artifact HTTP interface with PostgreSQL | Ownership, save/read/search, atomic revisions, baseline capture, no-op edits, stale edit conflict, rollback on failure, paginated history, archive access, existing Launch Decision validation |
| React user workflow | Select/preview/cancel/save/retry, full-content view, keyboard focus, deep links, revision selection, draft retained on conflict, supporting-evidence navigation |
| Local browser journey | Fresh Project with no deployment setup: import a plan, find it by a distinctive phrase, edit it, inspect the earlier text, link it to readiness, reload, and reopen the document |

Done means the complete local journey works with real database persistence and no provider calls; revision history preserves earlier text and rejects stale writes; another account cannot access documents or revisions; existing search and evidence behavior remains intact.

Run focused tests per slice, then relevant full backend/frontend suites, PostgreSQL migration verification, frontend lint/build, Python compilation, and `git diff --check`. Use the existing isolated test database, not a production database. A hosted deployment drill is explicitly not an acceptance criterion for this MVP.

## Skill usage

- `codebase-design`: design import and artifact-mutation interfaces that hide decoding and revision coordination.
- Repository `.agents/skills/tdd`: agree behavioral test seams, then implement one failing behavior at a time.
- `domain-modeling`: record accepted revision terminology in `CONTEXT.md` and distinguish a revision from current supporting evidence.
- `diagnosing-bugs`: use when an actual failure or regression needs diagnosis.
- `code-review`: review the completed implementation against this plan and repository standards.
- AWS, PDF, and Word document skills are unnecessary for this plain-text/local feature. Reassess applicable skills if later scope adds those capabilities.

## Deferred work

Larger document limits and artifact-list pagination should be designed together if the 10,000-character limit prevents realistic use. Also defer rich Markdown rendering, PDF/DOCX import, attachment storage, OCR, embeddings, AI summaries, revision restore/diff, pinned-revision evidence, collaboration, and automatic file synchronization.

The [Deployment Operations plan](deployment-operations-mvp-plan.md) remains a future reference. Revisit it when the user has deployed services and wants provider visibility.

Planning verification: inspected current artifact schemas, models, UI, evidence docs, and existing plans. Application code and database are unchanged; application tests were not rerun for this documentation-only update.
