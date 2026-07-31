# Frontend Learning Notes

These notes explain how the ProjectOps frontend is organized and how new features
should fit into the existing architecture.

## Frontend folder structure

`frontend/src/app` owns application entry and routing. Shared chrome lives in
`components/layout`, reusable interface pieces live in `components/ui`, and
domain screens live under `features`.

Project-specific functionality belongs in `features/projects` because the
current product experience is centered on a Project workspace.

## React Router flow

`App.tsx` renders `AppRouter`. The router maps URLs to page components such as
the Project Registry and Project detail page. Pages wrap their content in
`AppShell`, which provides the sidebar, mobile drawer, top bar, theme toggle,
and skip link.

## API client flow

Components do not call `fetch` directly. Feature API modules call the shared
`request` helper in `frontend/src/api/client.ts`. That helper applies the API
base URL, parses JSON, handles empty responses, and turns backend errors into
`ApiError` objects.

## Project list data flow

The Project Registry loads Project rows from `/api/v1/projects`. Search,
status filtering, archived inclusion, and sorting happen client-side because
the backend currently returns the full list.

`Project.repo_url` is only Project metadata. It is not proof that ProjectOps has
a real repository connection.

## Create/edit form flow

`ProjectForm` owns input state, required-name validation, pending state, and API
error display. Create and edit pages provide the submit function and navigate
after success.

## Archive modal flow

The archive modal owns its confirmation UI and archive request. It uses
`useFocusTrap` so keyboard focus moves into the modal, Escape closes it, and
focus returns to the trigger when the modal closes.

## Mobile navigation flow

`AppShell` owns mobile drawer open/close state. `TopBar` opens the drawer, and
`MobileNavigation` closes on Escape, backdrop click, close button, or route
navigation. Focus is trapped inside the drawer while it is open.

## Theme system

`useTheme` stores `dark` or `light`, applies it to `<html data-theme>`, and
persists it in `localStorage`. CSS uses semantic tokens, so components should
prefer variables such as `--surface`, `--text`, `--border`, and `--accent`.

## RepoIntegration frontend data flow

Milestone 10 adds real GitHub Repo Intake UI on the Project detail page.

`ProjectDetailPage` loads two separate pieces of data:

- Project metadata through `projectsApi.get`.
- Real repository connection state through `getProjectRepo`.

This separation matters because `Project.repo_url` and `RepoIntegration.repo_url`
mean different things. `Project.repo_url` is basic metadata a user typed into
the Project form. `RepoIntegration.repo_url` is the normalized repository
connection stored by the GitHub Repo Intake backend.

When `GET /repo` returns 404, the UI treats that as a normal "not connected"
state. The Project detail page still renders Project metadata.

## RepoIntegration API module responsibilities

`features/projects/api/projectRepo.ts` provides three small functions:

- `getProjectRepo(projectId)` reads the current connection.
- `attachProjectRepo(projectId, { repo_url })` creates or replaces it.
- `removeProjectRepo(projectId)` removes it and returns no body.

The module hides endpoint paths and HTTP methods from components. Components
receive typed `RepoIntegration` data and do not need to know the backend route
details.

## Repository connection state model

The Project detail page coordinates local state:

- `repo`: the current `RepoIntegration`, or `null`.
- `repoLoading`: whether the repo lookup is still pending.
- `repoError`: load or attach error text.
- `repoPending`: attach/replace pending state.
- `repoReplaceMode`: whether the connected card is showing the replace form.
- `repoRemoveOpen`: whether the remove confirmation modal is open.
- `repoRemovePending`: delete pending state.
- `repoRemoveError`: delete error text.

No global state is needed because the repository connection UI is local to one
Project detail page.

## Attach/replace/remove control flow

Attach and replace both use `POST /api/v1/projects/{project_id}/repo`. The
backend parser is the source of truth for GitHub URL validity. The frontend only
checks that the field is not empty.

Remove uses `DELETE /api/v1/projects/{project_id}/repo`. A confirmation modal
explains that removing the ProjectOps connection does not delete anything from
GitHub.

## Error handling flow

Backend validation errors are shown directly so users see useful parser
feedback such as "Enter a valid GitHub repository URL." Network errors and
unexpected backend failures remain scoped to the repository section, not the
whole Project detail page.

## How this prepared for CodeMap frontend

Repo Intake stores normalized GitHub repository metadata first. CodeMap UI now
depends on `RepoIntegration` as a real connection record instead of guessing
from `Project.repo_url`.

## Testing strategy

Tests exercise public behavior through React screens or focused API modules.
They mock `fetch` at the API boundary and never call the real backend. Each
mutation test verifies what the user sees after the operation, not internal
component state.

## Accessibility decisions

Repository sections have accessible names, inputs have labels and helper/error
associations, errors use `role="alert"`, destructive removal uses a dialog with
focus trapping, and disabled future actions include visible text explaining
that they are later work.

## How to add the next frontend feature safely

Start with the backend contract. Add a small typed API module. Write one
behavior test at a time. Keep page components responsible for orchestration and
extract child components when a responsibility becomes stable enough to name.
Use existing tokens and layout patterns before inventing new UI.

## RepoAnalysis frontend data flow

Milestone 11 adds CodeMap Lite UI on the Project detail page. This introduces a
second Project-scoped repository concept:

- `RepoIntegration` means the Project has a stored GitHub repository connection.
- `RepoAnalysis` means ProjectOps ran CodeMap Lite against that connection and
  stored the result.

`ProjectDetailPage` loads analysis data only after repository loading finishes
and a `RepoIntegration` exists. A missing repository clears analysis state and
shows the repository-required CodeMap message. A missing latest analysis (`404`)
is treated as a normal empty state, while other errors are displayed in the
CodeMap section.

## RepoAnalysis API module responsibilities

`features/projects/api/projectAnalyses.ts` provides three focused functions:

- `runProjectAnalysis(projectId)` calls `POST /api/v1/projects/{project_id}/analyses/run` with no request body.
- `getLatestProjectAnalysis(projectId)` calls `GET /api/v1/projects/{project_id}/analyses/latest`.
- `listProjectAnalyses(projectId)` calls `GET /api/v1/projects/{project_id}/analyses`.

The API module keeps raw endpoint strings and HTTP methods out of page and
component code. The shared `request` helper still owns base URL handling, JSON
parsing, and `ApiError` creation.

## CodeMap section state model

The Project detail page coordinates local state for CodeMap Lite:

- `latestAnalysis`: the current/latest `RepoAnalysis`, or `null`.
- `analysisLoading`: latest-analysis fetch pending state.
- `analysisError`: latest fetch or run error text.
- `analysisRunning`: POST/run pending state.
- `analysisHistory`: newest-first stored analysis attempts.
- `historyLoading`: history fetch pending state.
- `historyError`: history fetch error text.

This stays local because analysis state is scoped to one Project detail screen.
No global store or query library is needed yet.

## Run-analysis control flow

When the user clicks Run Analysis, the page disables the button, clears the
current run error, and calls `runProjectAnalysis`. On success, it sets the
returned analysis as latest and prepends it to history while removing any older
entry with the same ID. On failure, it shows the backend error message in the
CodeMap section and leaves the user on the Project detail page.

The UI does not automatically run health checks, readiness evaluation, or any AI
summary after CodeMap completes.

## Analysis result rendering

`CodeMapAnalysisCard` owns the four visible states:

- No repository connected.
- Repository connected with no analysis yet.
- Completed latest analysis.
- Failed latest analysis.

Completed results render summary, detected stack, architecture signals, evidence
files/folders, warnings, and metadata. Failed results keep the stored failed
attempt visible with error text and retry action. History is always shown when a
repository is connected, including an empty state and a history-load error state.

## Error handling flow

A `404` from `GET /repo` means the Project has no repository connection. A `404`
from `GET /analyses/latest` means no analysis has been run yet. Those are normal
states, not full-page failures.

Run failures and history failures are scoped to the CodeMap section. Project
metadata and RepoIntegration UI remain visible so users can retry or adjust the
repository connection.

## How this prepares for readiness frontend later

Readiness UI can later consume `RepoAnalysis` as one input, but Milestone 11 does
not calculate readiness or make production-readiness claims. Keeping CodeMap as a
stored, typed `RepoAnalysis` snapshot gives later readiness components a clear
source of repository evidence without coupling them to GitHub intake or the run
button.

## HealthCheck frontend data flow

Milestone 12 adds Manual Health Monitoring UI on the Project detail page.

`HealthCheck` means ProjectOps manually checked whether a URL responded and
stored the result. It is different from `RepoAnalysis`, which is repository path
evidence, and different from Readiness, which is a later advisory checklist.

`ProjectDetailPage` loads health-check data only after the Project itself has
loaded and `Project.production_url` exists. A missing latest health check (`404`)
is treated as a normal "no checks yet" state. Other latest/history failures are
shown inside Health Monitoring instead of replacing the whole Project detail
screen.

## HealthCheck API module responsibilities

`features/projects/api/projectHealthChecks.ts` provides three focused functions:

- `runProjectHealthCheck(projectId, input?)` calls `POST /api/v1/projects/{project_id}/health-checks/run`.
- `getLatestProjectHealthCheck(projectId)` calls `GET /api/v1/projects/{project_id}/health-checks/latest`.
- `listProjectHealthChecks(projectId)` calls `GET /api/v1/projects/{project_id}/health-checks`.

The run helper sends no request body when the Project production URL should be
used. It sends `{ url }` only for one-time override checks.

## Health section state model

The Project detail page coordinates local state for Manual Health Monitoring:

- `latestHealthCheck`: the current/latest `HealthCheck`, or `null`.
- `healthLoading`: latest-health-check fetch pending state.
- `healthError`: latest fetch or run error text.
- `healthRunning`: POST/run pending state.
- `healthHistory`: newest-first stored health-check attempts.
- `healthHistoryLoading`: history fetch pending state.
- `healthHistoryError`: history fetch error text.

The override checkbox and override URL input live inside `HealthMonitoringCard`
because they are local form controls for a single card. No global store or query
library is needed.

## Run-health-check control flow

When the user clicks Run Health Check, the page disables the button, clears the
current run error, and calls `runProjectHealthCheck`. If the override checkbox
is off, the frontend omits the body so the backend uses `Project.production_url`.
If the override checkbox is on, the frontend sends `{ url }`.

On success, the returned `HealthCheck` becomes the latest result and is prepended
to history while removing any older entry with the same ID. On failure, the
error is scoped to the Health Monitoring section and the user remains on Project
detail.

## Latest health result rendering

`HealthMonitoringCard` renders five practical states:

- No production URL configured.
- Production URL configured with no checks yet.
- Latest healthy result.
- Latest unhealthy, timeout, or error result.
- Health-check history.

Status labels are displayed as text with a small symbol, not color alone.
Healthy uses success color; unhealthy uses danger color; timeout and error use
warning color. Each status also has explanatory copy so users understand that a
manual check is one stored observation, not scheduled monitoring.

## Health history rendering

History is a compact ordered list. Each row shows status, target URL, HTTP
status when available, response time when available, and checked timestamp. The
UI shows the newest six attempts because the backend route currently has no
pagination contract.

## Health error handling flow

`404` from latest means "no health check has been run yet." A backend
missing-target error remains visible as run error copy. SSRF-blocked validation
errors are rewritten into a safer product message:

`ProjectOps blocked this URL because health checks cannot target local, private, link-local, or otherwise unsafe network addresses.`

Blocked SSRF attempts are not stored by the backend, so they do not appear in
history. Timeout and network/client errors are stored by the backend and render
as latest HealthCheck results when returned.

## How this prepares for readiness frontend later

Readiness UI can later use the latest `HealthCheck` as one evidence source for a
health-related checklist item. It should not treat a single manual check as
uptime monitoring, incident state, or proof that the Project is production-ready.

## Readiness frontend data flow

Milestone 13 adds Production Readiness UI to the Project detail page.

Readiness means ProjectOps combined available evidence and manual review into an
advisory production-readiness checklist. It is distinct from:

- `RepoIntegration`: the Project has a repository connection.
- `RepoAnalysis`: CodeMap Lite inspected repository paths and stored signals.
- `HealthCheck`: ProjectOps manually checked whether one URL responded.

`ProjectDetailPage` loads readiness independently with
`getProjectReadiness(projectId)`. A not-started response is a normal state:
`status: "not_started"`, `score: null`, and `items: []`.

## Readiness API module responsibilities

`features/projects/api/projectReadiness.ts` provides three focused functions:

- `evaluateProjectReadiness(projectId)` calls `POST /api/v1/projects/{project_id}/readiness/evaluate`.
- `getProjectReadiness(projectId)` calls `GET /api/v1/projects/{project_id}/readiness`.
- `updateProjectReadinessItem(projectId, itemKey, input)` calls `PATCH /api/v1/projects/{project_id}/readiness/items/{item_key}`.

The API module does not know UI state. It returns typed backend responses or
throws the shared `ApiError`.

## Readiness section state model

The page coordinates local readiness state:

- `readiness`: latest `ProjectReadinessSummary`, or `null`.
- `readinessLoading`: initial fetch pending state.
- `readinessError`: load or evaluate error text.
- `readinessEvaluating`: POST/evaluate pending state.

Manual item editor draft state lives inside `ReadinessAssessmentCard` because it
is local form state for one checklist row.

## Evaluate-readiness control flow

When the user clicks Run Readiness Evaluation, the page clears the current error,
sets `readinessEvaluating`, and calls `evaluateProjectReadiness`. The card
disables the button and announces the pending state with `aria-live`.

On success, the returned summary replaces `readiness`. On failure, the error is
scoped to the Readiness card; Project metadata, Repository Connection, CodeMap
Lite, and Health Monitoring remain visible.

## Score summary rendering

The score summary renders the backend score and status without celebratory or
certifying language. The progress bar is visual only; the score also has an
accessible text alternative such as "Advisory readiness score: 44 out of 100".

Counts display as text: passed, failed, unknown, and not applicable.

## Checklist rendering

Each readiness item includes nested catalog metadata from the backend. The UI
uses that metadata for label, description, category, and evaluation type.

Checklist rows show:

- Item label and description.
- Status text badge.
- Source explanation.
- Evidence explanation.
- Category.
- Notes when present.

Automatic items never show save controls.

## Manual item update flow

Manual items expose a status select and notes textarea. Save calls
`updateProjectReadinessItem` with the backend item key. The returned item
replaces the matching row inside the current readiness summary.

The current implementation does not recalculate summary counts locally after a
manual item save. Re-run readiness or reload the page to refresh aggregate
counts from the backend.

## Evidence display flow

Evidence text is deterministic:

- CodeMap evidence shows the analysis ID, signal, and whether that signal was detected.
- Health-check evidence shows the health check ID and stored status.
- Project evidence shows whether the relevant Project field is present.
- Missing automatic evidence shows "No evidence available yet" plus a next-step hint.
- Manual items explain that human review is required.

The frontend does not generate AI recommendations or infer readiness beyond the
backend response.

## Readiness error handling flow

Readiness load/evaluate errors stay inside the Readiness card. Manual item save
errors stay inside the relevant manual editor. This keeps other Project detail
sections usable when readiness fails.

## How this prepares for a richer Project Dashboard later

The Project detail readiness card proves the typed API contract, evidence copy,
summary rendering, and manual update flow. A future dashboard can reuse these
types and deterministic evidence labels without coupling dashboard layout to the
current Project detail card.

## Project command-center data flow

Milestone 14 adds a unified command-center layer to Project detail. The page
still loads each resource separately:

- Project metadata from the Project API.
- `RepoIntegration` from repository intake.
- Latest and historical `RepoAnalysis` from CodeMap Lite.
- Latest and historical `HealthCheck` from Manual Health Monitoring.
- `ProjectReadinessSummary` from Production Readiness.

The command center does not call the backend dashboard endpoint. It derives
summary state from resources already loaded by `ProjectDetailPage`, so the
overview and detailed sections share one frontend source of truth.

## Derived summary helper functions

`features/projects/utils/projectCommandCenter.ts` contains pure helper
functions:

- `getRepositorySummary(repo)`
- `getCodeMapSummary(repo, latestAnalysis)`
- `getHealthSummary(project, latestHealthCheck)`
- `getReadinessSummary(readiness)`
- `getProjectSetupSteps(input)`
- `getProjectNextActions(input)`

These helpers return UI-ready labels, details, tones, metrics, timestamps, target
section IDs, and action priorities. Keeping this logic outside JSX makes it easy
to test and safe to refactor the layout later.

The helpers are defensive around missing readiness data. Some focused tests mock
only the section they are exercising, so an unrelated readiness fallback payload
must not crash the whole dashboard.

## Setup-progress logic

Setup progress is based on actual frontend state:

- Project created is complete once Project metadata loads.
- Repository connected requires a real `RepoIntegration`.
- CodeMap analysis run follows latest analysis state.
- Production URL added follows `Project.production_url`.
- Manual health check run follows latest `HealthCheck`.
- Readiness evaluated follows readiness status.
- Manual readiness review appears only when manual readiness items are present.

Status text is explicit: complete, incomplete, or needs attention. Color only
reinforces the text state.

## Recommended-next-action priority logic

Recommended actions are deterministic rules, not AI. They are sorted by numeric
priority and capped at five visible actions.

The first missing setup dependency generally wins:

1. Attach repository.
2. Run or retry CodeMap.
3. Add production URL.
4. Run or review health check.
5. Evaluate readiness.
6. Review backend-provided readiness top gaps.
7. Complete manual readiness review items.

Each action links to an existing section anchor such as `#repository`,
`#codemap`, `#health`, `#readiness`, or `#details`.

## How the unified dashboard composes existing feature sections

The command center is a summary and navigation layer. It does not replace the
detailed feature cards.

`ProjectDetailPage` computes summaries and then renders:

1. `ProjectCommandCenterHeader`
2. `ProjectSummaryCards`
3. `ProjectNextActions`
4. `ProjectSetupProgress`
5. `ProjectSectionNav`
6. Existing Repository, CodeMap, Health, Readiness, and Details sections

Repository attach/replace/remove, CodeMap run/history, health check
run/history, readiness evaluation/checklist/manual updates, and Project
metadata rendering all stay in their existing components.

## How to add the next Project detail section safely

When adding a future section:

1. Add a stable section ID and section-nav entry.
2. Add or extend a pure summary helper only if the command center needs to
   summarize the new evidence.
3. Write helper tests before changing JSX.
4. Add an integration test that proves the summary links to the detailed
   section and does not show fake metrics.
5. Keep workflow controls inside the detailed section component.
6. Update the milestone doc and these learning notes.

This keeps Project detail from turning back into a pile of unrelated cards while
preserving the clear boundaries between evidence sources.

## ProjectArtifact data model

Milestone 15 adds `ProjectArtifact`, the frontend type for DataForge Lite
artifact metadata.

A Project Artifact belongs to one Project and includes title, artifact type,
source type, optional URL, optional summary, optional content, optional tags,
status, and timestamps.

Artifact types are constrained to values such as `note`, `document`, `link`,
`runbook`, `decision`, `incident`, `requirement`, `risk`, `evidence`, and
`other`. Source types are `manual`, `external_url`, `imported`, and `system`.
Status is `active` or `archived`.

DataForge Lite stores metadata and references only. It does not upload files,
parse documents, preview PDFs, create embeddings, run semantic search, or use an
LLM to extract document content.

## Artifact backend flow

The backend follows the existing ProjectOps route/service/repository/model
shape:

- `ProjectArtifact` defines the `project_artifacts` table.
- Pydantic schemas validate create and update payloads.
- The service checks that the Project exists before artifact operations.
- Repository lookups always include `project_id`.
- DELETE archives by setting `status` to `archived`.

The list route hides archived artifacts by default and supports
`include_archived`, `artifact_type`, and `source_type` query parameters.

## Artifact frontend API flow

`features/projects/api/projectArtifacts.ts` is the only frontend module that
knows artifact endpoint paths.

It provides:

- `createProjectArtifact(projectId, input)`
- `listProjectArtifacts(projectId, options)`
- `getProjectArtifact(projectId, artifactId)`
- `updateProjectArtifact(projectId, artifactId, input)`
- `archiveProjectArtifact(projectId, artifactId)`

All functions call the shared `request` helper, so backend validation and 404
responses become `ApiError` objects consistently with repository, CodeMap,
health, and readiness APIs.

## Artifact section state model

`useProjectArtifacts(projectId)` coordinates local state for the Project detail
Artifacts section:

- `artifacts`: currently loaded artifacts.
- `loading`: list request pending state.
- `error`: list error text.
- `includeArchived`: whether archived artifacts are requested.
- `artifactTypeFilter`: optional type filter.
- `sourceTypeFilter`: optional source filter.
- `mutationPending`: create, edit, or archive pending state.

The hook reloads artifacts after create, edit, and archive. That keeps the UI
simple and lets the backend remain the source of truth for filtering and archive
behavior.

## Create/edit/archive control flow

`ProjectArtifactsCard` owns workflow UI state:

- Whether the create form is visible.
- Which artifact is being edited.
- Which artifact is being archived.
- Save/archive error text.

`ProjectArtifactForm` owns draft field values and client validation for required
title and optional HTTP/HTTPS URL format. Successful create or edit calls back to
the hook, then the hook reloads the list.

`ProjectArtifactArchiveModal` is a focus-trapped confirmation dialog. Archive
copy is explicit: archiving removes the artifact from the default active view
but does not delete the Project or any external document.

## Command-center artifact summary logic

`getArtifactsSummary(artifacts)` derives the Artifacts summary card:

- No active artifacts becomes `No artifacts`.
- Active artifacts show an active count.
- Archived artifacts show an archived metric when present in loaded state.
- The latest updated artifact supplies the timestamp and most-recent title.

`getProjectNextActions` adds `Add a project note or runbook.` only at low
priority after repository, CodeMap, production URL, health, and readiness work.

The Project detail command center still does not call
`GET /api/v1/projects/{project_id}/dashboard`; it uses data already loaded by
the page.

## How artifacts prepare future DataForge phases

DataForge Lite creates the durable Project-scoped record that later file upload,
document parsing, search, or readiness-evidence features can attach to.

Future phases can add storage metadata, file scan state, extracted text, or
search indexes without changing the basic user concept: an artifact is the
registry entry that says what important project knowledge exists and where it
lives.

## Artifact search data flow

Milestone 16 keeps artifact search backend-backed.

`ProjectArtifactsCard` owns the visible controls, while `useProjectArtifacts`
owns the filter state:

- `search`
- `selectedTags`
- `artifactTypeFilter`
- `sourceTypeFilter`
- `includeArchived`

When any filter changes, the hook calls `listProjectArtifacts(projectId,
options)`. The API helper serializes those options into query parameters such
as:

```text
/api/v1/projects/7/artifacts?search=deploy&tags=runbook&artifact_type=runbook
```

The backend returns the already-filtered list. The frontend does not duplicate
the search algorithm client-side, which keeps the UI aligned with API behavior.

There is no debounce dependency. Each search keystroke can reload the list. That
is acceptable for DataForge Lite and easy to optimize later with a small local
debounce if needed.

## Tag parsing and filtering logic

Tags are still stored as comma-separated text.

The frontend parses tags for display by splitting on commas, trimming
whitespace, and ignoring empty values. Tag chips are rendered as buttons. When a
tag chip is pressed, the hook stores a lowercased selected tag token and reloads
the backend list.

The backend performs any-match tag filtering. For example, `tags=runbook,ops`
returns artifacts tagged with either `runbook` or `ops`.

This is intentionally pragmatic. It improves artifact usability without adding a
tag table, JSON column migration, or complex tag editor before the product
needs them.

## Backend dashboard artifact summary logic

The backend dashboard endpoint now includes an `artifacts` summary object.

The dashboard service loads all Project artifacts with archived records
included, then derives:

- active artifact count
- archived artifact count
- total artifact count
- latest active artifact summary

Archived artifacts count as archived and total records, but they do not replace
the latest active artifact. This mirrors the frontend command-center behavior:
archived records should remain visible when requested, but they should not make
the Project look more current than its active evidence.

## Readiness artifact evidence model

Artifact evidence links are stored separately from readiness status and notes.

The join table connects:

- Project
- readiness item
- artifact

The unique key prevents the same artifact from being linked twice to the same
readiness item.

This matters because linked artifacts are supporting references. They are not
automatic evidence of completion, and they do not change readiness scoring.
Manual review status remains an engineer decision.

## Link and unlink evidence control flow

`ProjectDetailPage` coordinates evidence state with a map:

```text
readiness item key -> linked artifact evidence rows
```

After readiness loads, the page fetches linked artifacts for each checklist
item. The current catalog is small, so one request per item is acceptable for
this milestone. A future bulk endpoint could reduce this if the checklist grows.

`ReadinessAssessmentCard` receives:

- active Project artifacts
- evidence rows by readiness item key
- link and unlink handlers

Each checklist item renders a select for active artifacts that are not already
linked to that item. Linking calls the API, appends the returned evidence row to
the local evidence map, and leaves readiness status unchanged. Unlinking deletes
only the evidence link and removes that row from the local map.

Backend duplicate-link errors are displayed with `role="alert"` so the user can
understand why the action did not complete.

## Why DataForge Lite does not analyze document contents yet

ProjectOps currently stores artifact metadata and references only.

Document analysis would require more product and engineering boundaries:

- file storage
- upload limits
- malware scanning
- access control
- parsing/OCR reliability
- extracted text retention policy
- user-visible provenance
- background jobs
- review and correction workflows

Milestone 16 deliberately stops before those concerns. It makes artifacts
searchable and linkable as team-supplied supporting evidence without claiming
that ProjectOps verified the contents.

## Activity backend model

Milestone 17 adds `ProjectActivityEvent`, a Project-scoped product history
record.

Each event answers:

- what happened
- which Project it happened in
- what category and event type it belongs to
- what short message should be shown
- which related resource was involved
- what small metadata details explain the event
- when it happened

The database column is named `metadata`, but the SQLAlchemy model uses
`metadata_json` because `metadata` is reserved by SQLAlchemy declarative models.
The API still returns `metadata` to the frontend.

Activity is product history, not a notification system or audit log.

## Event recording flow

Activity events are recorded inside service-layer workflows after the primary
action succeeds.

Examples:

- `ProjectService.create_project` creates the Project, then records
  `project_created`.
- `RepoIntegrationService.attach_github_repo` checks whether a repo already
  exists, then records either `repository_attached` or `repository_replaced`.
- `RepoAnalysisService.run_analysis` stores a completed or failed analysis, then
  records a matching CodeMap event.
- `HealthCheckService._store_health_check` stores the health result, then
  records a status-specific health event.
- `ReadinessService.link_artifact_evidence` creates the evidence link, then
  records `readiness_artifact_linked`.

This follows the existing ProjectOps architecture: routes handle HTTP, services
handle behavior, repositories handle database access.

## Activity frontend API flow

`features/projects/api/projectActivity.ts` owns the activity endpoint path.

It exposes:

```ts
listProjectActivity(projectId, filters)
```

Supported frontend filters:

- `category`
- `eventType`
- `limit`
- `offset`

The helper serializes those filters into query parameters such as:

```text
/api/v1/projects/7/activity?category=artifact&limit=25
```

Components do not call `fetch` directly. They call this API helper, which uses
the shared `request` function and returns typed `ProjectActivityEvent` objects
or `ApiError`.

## Timeline rendering

`ProjectActivityTimeline` is a presentational component.

It receives:

- events
- loading state
- error text
- current category filter
- category change handler
- clear-filter handler

The component renders:

- a labeled Recent Activity region
- a category filter
- a result count
- empty/loading/error/no-results states
- an ordered list of timeline events

The timeline displays the backend-provided message directly. That keeps display
copy deterministic and avoids inventing AI summaries client-side.

## Activity filtering

Project detail owns `activityCategoryFilter`.

When the filter changes, `ProjectDetailPage` reloads activity from the backend.
The frontend does not filter the full event list locally because the backend is
the source of truth for pagination and filtering.

The clear-filter button sets the category back to `""`, which reloads all
categories.

## Activity and command-center integration

`getActivitySummary(activityEvents)` derives the Activity command-center card:

- no events becomes `No activity recorded yet`
- one event becomes `1 event`
- multiple loaded events show the loaded count
- the latest event supplies the card detail and timestamp

Activity is intentionally not a next-action driver. It tells the user what
happened; it does not tell them to do work unless another feature already
created a next action.

## How activity prepares future notifications and audit history

Stored activity events create a durable event stream that future features can
reuse, but Milestone 17 stops before notification behavior.

## Milestone 18 cross-Project activity backend flow

Milestone 18 adds a top-level activity route:

```text
GET /api/v1/activity
```

The route is app-level, not Project-detail-level. It asks the activity service
for newest-first events across Projects. The repository joins
`project_activity_events` to `projects` so each event can include Project
context such as `project_name` and `project_status`. That lets the Overview
page show activity rows and links without making one request per Project.

Supported filters:

```text
category=artifact
event_type=artifact_created
project_id=7
limit=25
offset=0
```

The endpoint returns `[]` when no activity exists. A missing `project_id` filter
returns a 404 because that filter names a specific Project. Since ProjectOps
does not have authentication or visibility rules yet, the cross-Project feed
returns activity for local Projects, including archived Projects.

## Overview activity frontend flow

`OverviewPage` now loads two independent data sets:

- `projectsApi.list(true)` for Project metrics.
- `listActivity({ category, limit: 25 })` for the cross-Project activity feed.

The Overview feed renders real product history:

- category badge
- event message
- Project name and lifecycle status
- timestamp
- link to `/app/projects/:projectId`

The Recently Active Projects section is derived from the loaded activity window.
It groups by Project and keeps the newest event for each Project. This avoids a
separate overview aggregate endpoint while the app is still small.

## Stable summary versus filtered list state

Project detail now keeps separate activity state:

- `activityEvents`: the filtered Activity section list.
- `activitySummaryEvents`: an unfiltered source for the command-center Activity
  summary card.

When the user changes the Activity category filter, only `activityEvents`
changes. The command-center Activity summary keeps using the unfiltered summary
source, so it does not switch from "latest activity" to "latest filtered
activity" by accident.

This is the key state-management lesson: if two pieces of UI answer different
questions, they need different state even when they read from the same backend
resource.

## Manual refresh control flow

Overview and Project detail both use a Refresh activity button. Refreshing:

- calls the same API helper as initial load
- preserves the current category filter
- shows a pending/disabled state while loading
- does not start polling

Project detail refreshes both the filtered timeline and the unfiltered summary
source. That keeps the visible list current without corrupting the summary.

## Why this is not realtime notifications yet

Recent Activity is product history. It records meaningful ProjectOps actions
after they happen. It is not:

- realtime monitoring
- unread state
- user-specific notifications
- a notification inbox
- audit-grade compliance history

Those features need authentication, users, preferences, delivery channels, and
stronger event semantics. Milestone 18 intentionally stops at refresh-based
activity surfacing.

Future milestones can add:

- grouped timeline views
- related-resource links
- event detail pages
- backfill tools
- user attribution after authentication exists
- notification rules only if users need active interruption

Audit history would require stricter guarantees than this milestone provides:
user identity, immutable retention rules, permission checks, tamper resistance,
and operational controls. Those are intentionally out of scope for this product
timeline.

## Milestone 19: Deployment-aware API base URL

The frontend API client now resolves `VITE_API_BASE_URL` when a request is made,
not once at module import time. That keeps tests and runtime behavior aligned:
tests can override the Vite environment, local development can still fall back
to `http://127.0.0.1:8000`, and production builds fail clearly if the deployed
backend URL was not configured.

The important control flow is:

1. `request()` calls `resolveApiBaseUrl()`.
2. If `VITE_API_BASE_URL` exists, it is trimmed and trailing slashes are removed.
3. If no URL exists and the build is production, the client raises a
   configuration `ApiError`.
4. If no URL exists outside production, the local FastAPI default is used.

This keeps the production bundle from silently calling localhost while
preserving the easy local development path.
