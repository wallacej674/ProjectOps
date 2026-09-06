# ProjectOps Frontend

The ProjectOps web client: an engineering command center for managing Project
workspaces and preparing them for production. Built with React, TypeScript, and
Vite, styled with a semantic CSS-token design system (dark by default, with a
light theme).

## Tech stack

- React + TypeScript
- Vite (dev server and production build)
- React Router (routing)
- Native `fetch` (no HTTP client dependency)
- Optional Sentry-backed frontend error monitoring
- Tailwind CSS v4 (utility layer) + a hand-authored semantic token system in `src/styles/index.css`
- Vitest + React Testing Library (tests)
- ESLint + `typescript-eslint`

No state-management, data-fetching, form, component, animation, or charting
library is used. The mobile drawer, modal, focus management, sorting,
repository connection UI, CodeMap Medium analysis UI, manual and scheduled Health Monitoring UI,
Production Readiness UI, Launch Report UI, Guided Launch Checklist UI, Launch Decision UI, Project Artifacts UI, Overview activity surfacing,
first-run demo workspace onboarding, auth route guards, account display, and
Recent Activity UI are all built with plain React and CSS.

Repository Intake also supports a configured GitHub App. A signed-in user can
authorize installations they control, select an available public or private
repository, and attach it to a Project. The callback route is
`/app/github/callback`. GitHub user tokens are not stored by the frontend.

## Local development

The frontend talks to the ProjectOps FastAPI backend. Start the backend first
(see the root `README.md`), **including the database
migration** — an unmigrated database will make every Project request fail:

```bash
# repository root
docker compose up -d

# backend directory — apply migrations, then run the API
./.venv/Scripts/python.exe -m alembic upgrade head
./.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

Then run the frontend:

```bash
cd frontend
npm install
npm run dev          # Vite dev server on http://localhost:5173
```

The client calls `http://127.0.0.1:8000` by default; override with
`VITE_API_BASE_URL`. The backend must allow the dev origin via
`PROJECTOPS_CORS_ALLOWED_ORIGINS` (defaults include `http://localhost:5173`).
Production builds require `VITE_API_BASE_URL`; otherwise the API client reports
a configuration error instead of silently calling localhost.

Frontend error monitoring is disabled by default. To enable provider-backed
render crash capture in a deployed environment, set:

```text
VITE_ENABLE_ERROR_MONITORING=true
VITE_SENTRY_DSN=<provider dsn>
VITE_SENTRY_ENVIRONMENT=production
```

Do not commit a real DSN. The error boundary and API request ID surfacing work
locally with monitoring disabled.

Create or sign in to a local account before using `/app/*`. The frontend stores
the JWT bearer token in `localStorage` for local/demo persistence and attaches
it to protected API calls.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and produce a production build |
| `npm run preview` | Serve the built `dist/` output locally |
| `npm run smoke:preview` | Start Vite preview and verify `/`, `/app`, and a deep `/app/*` route serve the SPA shell |
| `npm run lint` | Run ESLint |
| `npm run audit` | Fail on high-or-critical npm dependency advisories |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

## Deployment

Frontend deployment is provider-neutral: build static files and deploy `dist/`.

```bash
npm ci
npm run build
npm run preview
```

Required production variable:

```text
VITE_API_BASE_URL=https://your-projectops-backend.example.com
```

The backend must list the deployed frontend origin in
`PROJECTOPS_CORS_ALLOWED_ORIGINS`. Because ProjectOps uses `BrowserRouter`,
static hosts must serve `index.html` for `/app/*` deep links. Vercel is covered
by `vercel.json`; other hosts need the equivalent SPA fallback rule. See
`../docs/deployment-readiness.md` for the full deployment checklist.

## Architecture

The app is organized by feature, with shared layout and UI primitives factored
out. `App.tsx` mounts the router; each page composes the shared `AppShell`.

```
src/
  app/
    App.tsx                 # mounts <AppRouter/> inside the top-level error boundary
    ErrorBoundary.tsx       # safe render-crash fallback + monitoring capture
    router.tsx              # route map (BrowserRouter + auth guards + Routes)
  api/
    auth.ts                 # auth endpoint helpers
    authStorage.ts          # localStorage session helpers
    authTypes.ts            # auth DTOs
    client.ts               # fetch wrapper + ApiError (validation/not-found/network/configuration/auth/unknown)
    projects.ts             # Projects endpoint methods
  components/
    layout/                 # AppShell, Sidebar, TopBar, MobileNavigation, navItems, navIcons
    ui/                     # StatusBadge, Mark, ViewToggle, EmptyState, ErrorState, LoadingSkeleton
  features/
    auth/                   # AuthProvider, ProtectedRoute, AuthPage
    landing/                # LandingPage (marketing)
    overview/               # OverviewPage (engineering overview metrics + cross-Project activity)
    projects/
      api/                  # Project-scoped RepoIntegration, RepoAnalysis, HealthCheck, Readiness, Launch Report, Launch Checklist, Artifact, and Activity API helpers
      components/           # ProjectCard, ProjectsTable, ProjectForm, ProjectFilters, ArchiveProjectModal
                            # RepositoryConnectionCard, RepositoryAttachForm, RepositoryRemoveModal
                            # CodeMapAnalysisCard, HealthMonitoringCard, ReadinessAssessmentCard, LaunchReportCard, LaunchChecklistCard, ProjectArtifactsCard
                            # ProjectActivityTimeline
      hooks/                # Project-scoped feature hooks such as useProjectArtifacts
      pages/                # ProjectsPage, CreateProjectPage, ProjectDetailPage, EditProjectPage
      projectForm.ts        # form constants + input normalization
      projectSort.ts        # sort options + deterministic comparator
  hooks/                    # useTheme (persisted), useFocusTrap (drawer + modal)
  observability/            # optional frontend monitoring setup and capture helpers
  types/                    # Project / RepoIntegration / RepoAnalysis / HealthCheck / Readiness / LaunchReport / LaunchChecklist / ProjectArtifact / ProjectActivity
  utils/                    # formatDate
  styles/index.css          # semantic CSS tokens + component styles
  test/                     # setup + shared API mocks (mockApi.ts)
```

### Route map

| Route | Page | Notes |
| --- | --- | --- |
| `/` | Landing | Marketing page + command-center preview |
| `/login` | Sign in | Public-only; redirects signed-in users into the app |
| `/register` | Create account | Public-only; redirects signed-in users into the app |
| `/app` | — | Redirects to `/app/overview` |
| `/app/overview` | Overview | Project metrics, first-run onboarding, cross-Project Recent Activity, Recently Active Projects |
| `/app/projects` | Project Registry | List, search, filter, sort, card/table views, archive |
| `/app/projects/new` | Create Project | |
| `/app/projects/:projectId` | Project Dashboard | Identity, metadata, setup progress, repository connection, CodeMap Medium analysis, manual and scheduled Health Monitoring, Production Readiness, Launch Report, Guided Launch Checklist, Launch Decision, Project Artifacts, Recent Activity |
| `/app/projects/:projectId/edit` | Edit Project | |
| `*` | — | Redirects to `/` |

## Behavior notes

### Theme

A dark/light toggle in the top bar sets `data-theme` on `<html>` and persists
the choice to `localStorage` (`projectops-theme`). The control always shows an
explicit text label ("Theme: Dark" / "Theme: Light") and an accessible
`aria-label`; it is never an unlabeled icon. All colors come from semantic CSS
tokens defined per theme.

### Navigation

- **Desktop (>900px):** a collapsible sidebar. Collapsing keeps icon-only nav
  items usable; the current page is marked with `aria-current="page"`.
- **Tablet/mobile (≤900px):** the sidebar is hidden and a labeled menu trigger
  appears in the top bar. It opens an off-canvas drawer with a backdrop. The
  drawer traps focus, closes on Escape / backdrop click / close button / route
  change, restores focus to the trigger, and respects `prefers-reduced-motion`.
- A "Skip to main content" link is the first focusable element.

### Authentication

`AuthProvider` owns the browser session and initializes from `localStorage` keys
scoped to ProjectOps. `ProtectedRoute` wraps app routes and redirects anonymous
users to sign in while preserving safe `/app` deep links. `PublicOnlyRoute`
keeps signed-in users out of the auth screens.

The top bar shows the current account email or display name and a sign-out
button. Sign-out clears the local token; it does not revoke tokens server-side
because this milestone does not include a backend denylist or refresh-token
model.

### Project sorting

The Registry sorts client-side (all Projects load through the list endpoint —
there are no server-side sort parameters). Options: Recently updated (default),
Oldest updated, Name A–Z, Name Z–A, Status. Ties break deterministically by
name (case-insensitive), then by id. Sorting composes with search, the status
filter, "Include archived", and both card and table views.

### Repository connection

The Project Dashboard shows real GitHub Repo Intake state from
`/api/v1/projects/:projectId/repo`. Users can attach a public GitHub repository,
view normalized owner/name/provider/URL details, replace the connection with
another supported URL, or remove the connection.

Supported input formats:

- `https://github.com/owner/repo`
- `https://github.com/owner/repo.git`
- `git@github.com:owner/repo.git`

Important distinction: `Project.repo_url` is basic Project metadata from the
Project form. `RepoIntegration.repo_url` is the real repository connection
created by GitHub Repo Intake. The list page does not claim a Project is
"connected" based only on `Project.repo_url`; real connection state lives on the
Project Dashboard in this milestone.

Removing a repository connection deletes only the ProjectOps connection record.
It does not delete the GitHub repository. Repository analysis is handled separately
by the Repository Analysis section on the same Project Dashboard.


### Repository analysis

The Project Dashboard includes a real Repository Analysis section backed by
`/api/v1/projects/:projectId/analyses`. The analysis is intentionally described
as rule-based path analysis, not AI code review.

States shown in the UI:

- No repository connected: analysis is disabled and the user is pointed back to
  Repository Connection.
- Repository connected, no analysis: the user can run Repository Analysis and sees the
  boundaries of the feature.
- Completed analysis: summary, detected stack, architecture signals, evidence
  paths/folders, warnings, metadata, and history are displayed.
- Failed analysis: the failed attempt, error message, timestamp, retry action,
  and history remain visible.

Repository analysis does not clone repositories, inspect arbitrary source code,
calculate production readiness, run health checks, or use AI-generated
summaries. CodeMap Medium uses repository paths plus a bounded allowlist of
manifests and operational configuration files from public repositories or an
authorized read-only GitHub App installation. It stores a `RepoAnalysis`
snapshot returned by the backend.

### Health Monitoring

The Project Dashboard includes a real Health Monitoring section backed by
`/api/v1/projects/:projectId/health-checks` and
`/api/v1/projects/:projectId/health-monitor`. A user can run an on-demand check
or enable recurring checks at a supported cadence. Every result records whether
its execution source was manual or scheduled. This is operational observation
history, with in-app alerts after two scheduled failures and recovery after two scheduled successes. It is not an uptime guarantee.

States shown in the UI:

- No production URL configured: the run button is disabled, the user is pointed
  to Edit Project, and the copy explains that no target URL exists yet.
- Production URL configured, no checks yet: the user can run a manual check and
  sees the current target production URL.
- Latest result: status, target URL when different from the saved production
  URL, HTTP status, response time, checked timestamp, response preview, and
  error message are displayed when available.
- History: the newest stored attempts are shown in a compact list with status,
  execution source, target URL, HTTP status, response time, and timestamp.
- Scheduled monitoring: the user can choose 15 minutes, hourly, every 6 hours,
  or daily, then enable, update, or pause the schedule. The UI shows the next
  run and last scheduled result when available.

Status meanings:

- Healthy: the endpoint responded with a 2xx or 3xx status.
- Unhealthy: the endpoint responded, but returned a 4xx or 5xx status.
- Timeout: the endpoint did not respond before the backend timeout.
- Error: ProjectOps could not complete the request because of a network or
  client error.

The backend supports a one-time override URL body (`{ "url": "https://..." }`).
The UI exposes this as "Check a different URL this time" and explains that it
does not update the Project's saved production URL. SSRF-blocked URLs are shown
with safety-focused copy instead of raw stack traces.

### Production Readiness

The Project Dashboard includes a real Production Readiness section backed by
`/api/v1/projects/:projectId/readiness`. Readiness is an advisory assessment
based on available ProjectOps evidence. It is not a deployment approval,
security audit, certification, or uptime guarantee.

States shown in the UI:

- Not evaluated: the card explains evidence sources and the advisory boundary.
- Evaluating: the run button is disabled and the pending state is announced.
- Latest result: advisory score, backend status, counts, top gaps, and checklist
  rows are displayed.
- Error: readiness errors remain scoped to the card, while Project metadata,
  Repository Connection, Repository Analysis, and Health Monitoring stay usable.

Checklist rows show item label, description, status, source, evidence, category,
and notes when present. Evidence is deterministic: CodeMap signal evidence,
health-check evidence, Project metadata evidence, or manual review notes.

Manual review items expose status and notes controls. Automatic items do not
show manual save controls. Saving a manual item calls
`PATCH /api/v1/projects/:projectId/readiness/items/:itemKey` and updates the
returned row in the current checklist.

Checklist rows can also show linked Project Artifacts as supporting evidence.
The Project Dashboard loads project-level evidence coverage from
`GET /api/v1/projects/:projectId/readiness/evidence-coverage`, then uses that
coverage to show linked artifacts per readiness item and a compact summary of
linked/unlinked active artifacts and readiness items with or without supporting
artifact links. The link control uses existing active artifacts from the same
Project and calls
`POST /api/v1/projects/:projectId/readiness/items/:itemKey/artifacts`.
Unlinking calls
`DELETE /api/v1/projects/:projectId/readiness/items/:itemKey/artifacts/:artifactId`.
Linked artifacts are team-supplied references; they do not automatically mark a
readiness item passed, and ProjectOps does not verify artifact contents in
DataForge Lite.

### Launch Report

The Project Dashboard includes a real Launch Report section backed by
`/api/v1/projects/:projectId/launch-report`. The report is a current snapshot
that summarizes readiness score, evidence coverage, blockers, and recommended
launch-review actions from existing ProjectOps signals.

States shown in the UI:

- Loading: the section announces that the report is loading.
- No report: the section explains that ProjectOps could not build the snapshot.
- Current report: decision, headline, readiness score, generated timestamp,
  evidence coverage, blockers, and recommended actions are displayed.
- Error: launch-report errors remain scoped to the card while Project metadata
  and other detail sections stay usable.

The Launch Report refreshes after actions that can change its evidence, such as
repository changes, Repo Analysis runs, manual or scheduled health checks, readiness
evaluation, manual readiness edits, readiness evidence links, and artifact
changes.

Evidence coverage in the Launch Report includes active artifact counts, linked
and unlinked active artifacts, readiness items with or without supporting
artifact links, and total evidence links. These are coverage signals only; they
do not prove evidence quality or sufficiency.

The report is intentionally read-only and does not store an immutable approval
record. It does not certify production safety, perform security review, run
deployments, create releases, or replace a human go/no-go decision.

### Guided Launch Checklist

The Project Dashboard includes a real Guided Launch Checklist section backed
by `/api/v1/projects/:projectId/launch-checklist`. The checklist turns the same
ProjectOps evidence used by the Launch Report into concrete operator items with
`done`, `needs attention`, and `todo` states.

States shown in the UI:

- Loading: the section announces that the checklist is loading.
- No checklist: the section explains that no checklist is available.
- Current checklist: status counts, generated timestamp, checklist rows, and
  action links are displayed.
- Error: checklist errors remain scoped to the card while Project metadata and
  other detail sections stay usable.

The checklist is derived, not stored. It refreshes with the Launch Report after
repository changes, Repo Analysis runs, manual or scheduled health checks, readiness changes,
readiness evidence changes, and artifact changes. It does not create a permanent
approval record or replace the deployment owner's go/no-go decision.

The checklist includes a supporting-evidence item. It is `done` when evidence
links exist, `needs attention` when active artifacts exist but none are linked
to readiness, and `todo` when no active artifacts exist.

### Launch Decision

The Project Dashboard includes a Launch Decision section that uses the existing
Project Artifacts API. Recording a decision creates a normal Project Artifact
with `artifact_type=decision`, `source_type=manual`, and tags including
`launch-decision`, `go-no-go`, and the selected decision value.

States shown in the UI:

- Loading: the section announces that the current launch decision is loading.
- No decision: the section says no launch decision has been recorded yet.
- Latest decision: decision value, artifact title, notes preview, recorded
  timestamp, status, artifact ID, and recorder attribution are displayed.
- Decision history: active launch decision artifacts are shown newest-first by
  recorded time, with a link back to Project Artifacts.
- Error: decision loading or submit errors remain scoped to the card.

The operator can record `Go`, `No-go`, or `Defer`. `Go` notes are optional but
recommended. `No-go` and `Defer` require notes so future review has context. The
form reminds users not to paste secrets into decision notes.

The command center includes a Launch Decision summary card and next actions.
No-go and Defer are surfaced ahead of advisory readiness actions because the
human decision is the recorded launch decision. A Go decision is shown as
recorded, not certified or approved.

This is a persisted artifact record for launch review, not deployment
automation, approval enforcement, role approval, an immutable audit trail, or a
compliance sign-off system. New Project Artifact records expose authenticated
creator attribution when available, so the UI shows `Recorded by` for known
recorders and an honest historical fallback when attribution is unavailable.

### Project Artifacts

The Project Dashboard includes a real Project Artifacts section backed by
`/api/v1/projects/:projectId/artifacts`. This is DataForge Lite: a metadata
registry for notes, links, runbooks, decisions, requirements, risks, incidents,
and evidence references.

States shown in the UI:

- Loading: the Artifacts section announces that records are loading.
- Empty: the section says no artifacts exist yet and offers Add Artifact.
- List: artifact title, type, source, status, URL, summary/content preview,
  tags, readiness evidence usage, updated date, and artifact ID are displayed.
- Search/filter: search scans artifact metadata and text fields; tag chips,
  artifact type, source type, evidence usage, and include-archived filters
  compose with the backend list route.
- No results: the section distinguishes "no artifacts yet" from "no artifacts
  match these filters."
- Error: artifact loading errors stay scoped to the Artifacts section while
  other Project Dashboard sections remain usable.
- Archived: archived artifacts are hidden by default and shown when "Include
  archived artifacts" is enabled.

Users can create, edit, search, filter, and archive artifact records. Tags are
still stored as comma-separated text in DataForge Lite; filtering normalizes tag
tokens case-insensitively and uses any-match semantics. The form validates
required title and optional HTTP/HTTPS URL format before submission, and backend
validation errors are shown in the section.

Artifact evidence usage labels show whether an artifact supports readiness
items or is not currently linked to readiness evidence. The Evidence Usage
filter can show all artifacts, linked artifacts, or artifacts not currently
linked to readiness evidence.

Project Artifacts do not upload files, preview documents, parse PDFs, run OCR,
create embeddings, perform semantic search, verify evidence, or use AI
extraction.

### Recent Activity

The Overview page includes a real cross-Project Recent Activity feed backed by
`/api/v1/activity`. It shows newest-first product history across local Projects,
Project names, lifecycle status, timestamps, category filters, result counts,
manual refresh, empty/error/no-results states, and links into the relevant
Project Dashboard.

The Project Dashboard includes a real Recent Activity section backed by
`/api/v1/projects/:projectId/activity`. It shows stored Project-scoped product
history for meaningful actions such as Project changes, repository changes,
CodeMap results, health-check outcomes, readiness work, artifact changes, and
readiness evidence links.

States shown in the UI:

- Loading: the section announces that recent activity is loading.
- Empty: the section says no activity has been recorded yet and explains that
  ProjectOps records activity as workflows are used.
- List: category, message, timestamp, related resource, and small metadata
  details are displayed newest-first.
- Filtered: category filtering reloads activity through the backend list route.
- No results: the section distinguishes no activity from no activity matching a
  selected category.
- Error: activity loading errors stay scoped to Recent Activity while Project
  metadata and other detail sections remain usable.
- Manual refresh: the Refresh activity button reloads activity while preserving
  the current category filter.

The Project Dashboard Activity summary uses a separate unfiltered
summary source from the filtered timeline list. Filtering the Activity section
changes only the timeline results; it does not rewrite the top summary card.

Recent Activity is stored product history, not realtime notifications. Recent
counts and badges are recent indicators, not user-specific unread state. The
frontend does not use WebSockets, server-sent events, background polling,
notification inboxes, or AI summaries.

### First-run demo workspace

When `/app/overview` loads with no Projects at all, the page shows a first-run
panel. Users can create their first Project or, when the backend says demo data
is enabled, load a sample workspace.

The frontend calls:

```text
GET  /api/v1/demo-data/status
POST /api/v1/demo-data/seed
```

Loading demo data opens the seeded Project command center. Demo records are
sample material for local exploration: they do not call live GitHub APIs, run a
live health check, process files, use AI, or certify production safety.
Seeding requires a signed-in account outside production and is idempotent for
that account.

## Functional vs. preview UI

Real, backed-by-the-API functionality: Project list, create, read, update, and
archive (`/api/v1/projects`), GitHub repository attach/read/replace/remove for a
single Project (`/api/v1/projects/:projectId/repo`), GitHub App repository
selection, CodeMap Medium analysis run/latest/history views
(`/api/v1/projects/:projectId/analyses`), manual health-check
run/latest/history views (`/api/v1/projects/:projectId/health-checks`), scheduled
monitoring controls (`/api/v1/projects/:projectId/health-monitor`), and Production Readiness
evaluate/fetch/manual-item update views (`/api/v1/projects/:projectId/readiness`),
readiness artifact evidence link/list/unlink views, and Project Artifact
create/list/update/archive/search/filter views
(`/api/v1/projects/:projectId/artifacts`), cross-Project Activity list/filter
views (`/api/v1/activity`), plus Project Activity list/filter views
(`/api/v1/projects/:projectId/activity`), Launch Report current-snapshot views
(`/api/v1/projects/:projectId/launch-report`), Guided Launch Checklist views
(`/api/v1/projects/:projectId/launch-checklist`), and environment-gated demo
workspace status/seed views (`/api/v1/demo-data/status`,
`/api/v1/demo-data/seed`).
Auth views and route guards are backed by `/api/v1/auth/register`,
`/api/v1/auth/login`, `/api/v1/auth/me`, and `/api/v1/auth/logout`.
Everything else surfaced in the UI is clearly labeled as a **future-state preview**
and is intentionally not wired to a frontend in this milestone:

- The landing command-center preview (readiness score, signal map).
- Sidebar items labeled "Later": Repository Analysis, Health Monitoring,
  Readiness, Artifacts, Settings. The real Repository Analysis, Health
  Monitoring, Production Readiness, and Project Artifacts controls live inside
  the Project Dashboard for now.


## Known limitations

- Sorting/filtering are client-side; there is no pagination yet (all Projects
  load at once, matching the current backend list endpoint).
- Repository connection counts are not shown on the Overview page or Project
  Registry because accurate counts would require additional backend support or
  inefficient per-Project calls.
- The mobile drawer and archive modal communicate modality via
  `role="dialog"` + `aria-modal`; background content is not marked `inert`.
- No automated browser/visual-regression testing (Playwright/Cypress) is
  included. Responsive behavior was reviewed manually at 1440 / 834 / 390 px.
- Theme persistence is per-browser via `localStorage`; there is no account-level
  preference.
- Auth persistence is per-browser via `localStorage`; there is no refresh-token
  flow, password reset, OAuth, team switcher, role management, or server-side
  token revocation.
- Manual readiness item saves update the checklist row locally but do not
  recalculate aggregate counts until readiness is re-evaluated or reloaded.
- There is no readiness history view or standalone Readiness route.
- There is no persisted launch approval, launch checklist editing, or standalone
  Launch route.
- Launch Decision records are Project Artifacts; there is no separate approval
  workflow, signer model, or immutable decision ledger.
- There is no standalone Artifacts route, artifact pagination, file upload,
  document parsing, semantic search, or artifact-based automatic readiness
  passing.
- Recent Activity is not realtime, does not backfill old Projects, and is not
  audit-grade compliance logging.

## Testing

Tests use Vitest + React Testing Library in a jsdom environment and **never call
the real backend** — `fetch` is mocked deterministically (see
`src/test/mockApi.ts`). Coverage spans the API client, Project list/search/
filter/sort, card/table views, empty/error states, the create/edit/archive
flows, repository attach/replace/remove behavior, the mobile drawer, theme
behavior, readiness API/client behavior, Project Dashboard readiness behavior,
artifact API/client behavior, Project Dashboard artifact behavior, and layout
activity API/client behavior, Project Dashboard activity behavior, and layout
accessibility (skip link, current-page marking, navigation landmark), auth API
helpers, auth route guards, bearer-token attachment, and sign-out behavior.

Manual repository verification:

1. Create or open a Project.
2. Confirm the Repository Connection section starts as not connected.
3. Submit an empty URL and confirm client validation.
4. Submit an invalid GitHub URL and confirm backend validation is shown.
5. Attach a valid public GitHub URL and confirm normalized details display.
6. Refresh and confirm the connection persists.
7. Replace the connection with another supported GitHub URL.
8. Open removal confirmation, cancel, then reopen and remove.
9. Confirm the Project still exists and the CodeMap section returns to the repository-required state.

Manual CodeMap Medium verification:

1. Create or open a Project without a repository connection.
2. Confirm Repository Analysis says a GitHub repository must be attached first.
3. Attach a valid public GitHub repository.
4. Confirm Repository Analysis changes to the ready-to-analyze state.
5. Click Run Analysis and confirm the button is disabled while pending.
6. Confirm the latest analysis displays summary, files scanned, stack, signals,
   evidence, warnings, and metadata.
7. Refresh and confirm the latest analysis persists.
8. Run analysis again and confirm history updates.
9. Test backend failure/no-repo responses and confirm failed attempts or errors
   are shown without hiding Project metadata.

Manual and scheduled Health Monitoring verification:

1. Create or open a Project without a production URL.
2. Confirm Health Monitoring says a production URL is required and the run
   button is disabled.
3. Edit the Project and add a production URL.
4. Return to the Project Dashboard and confirm the ready-to-check state.
5. Click Run Health Check and confirm the button is disabled while pending.
6. Confirm latest status, HTTP status, response time, timestamp, and preview or
   error text display after the backend responds.
7. Run again and confirm history updates.
8. Use "Check a different URL this time" and confirm the override URL is sent
   without changing the saved Project production URL.
9. Try a blocked local/private URL through the override and confirm the safety
   message is shown.
10. Enable a supported schedule, confirm its next-run state, then pause it.
11. Confirm the section does not claim uptime percentage, external alert delivery, readiness, or
    production status pages exist.

Manual Production Readiness verification:

1. Create or open a Project.
2. Confirm Project metadata, Repository Connection, Repository Analysis, and Health
   Monitoring still load.
3. Confirm Production Readiness says the assessment is advisory.
4. Click Run Readiness Evaluation and confirm the button disables while pending.
5. Confirm advisory score, status, counts, top gaps, and checklist rows display.
6. Confirm source and evidence details are visible for checklist items.
7. Confirm missing evidence is understandable.
8. Update a manual item status and notes.
9. Confirm automatic items do not expose manual save controls.
10. Confirm no UI copy claims certification, deployment approval, security
    verification, or guaranteed production safety.

Manual Project Artifacts verification:

1. Create or open a Project.
2. Confirm the Artifacts section appears on the Project Dashboard.
3. Confirm the empty state appears when no active artifacts exist.
4. Create a note artifact.
5. Create an external URL artifact.
6. Confirm artifact count updates in the command-center summary.
7. Filter artifacts by type and source.
8. Edit artifact metadata.
9. Archive an artifact through the confirmation dialog.
10. Confirm archived artifacts are hidden by default.
11. Enable Include archived artifacts and confirm archived records appear.
12. Confirm no UI copy claims file analysis, AI extraction, or document
    verification exists.


### Health Alerts

The Health section shows attributed acknowledgement, recovery progress, alert
history, and paginated supporting scheduled checks. Overview and the Operations
Map distinguish active alerts, isolated failures, and overdue monitoring. The
cross-Project Health Monitoring page filters active alerts and overdue schedules.
Alternative-target manual checks do not determine production-target health.
Visible pages refresh monitoring every 60 seconds and on return; errors retain
prior data with a stale-data warning. See `../docs/milestone-health-alerts.md`.
