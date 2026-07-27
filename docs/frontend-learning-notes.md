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

