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
- Tailwind CSS v4 (utility layer) + a hand-authored semantic token system in `src/styles/index.css`
- Vitest + React Testing Library (tests)
- ESLint + `typescript-eslint`

No state-management, data-fetching, form, component, animation, or charting
library is used. The mobile drawer, modal, focus management, sorting,
repository connection UI, CodeMap Lite analysis UI, Manual Health Monitoring UI,
and Production Readiness UI are all built with plain React and CSS.

## Local development

The frontend talks to the ProjectOps FastAPI backend. Start the backend first
(see `../backend/README` and the root `README.md`), **including the database
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

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and produce a production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

## Architecture

The app is organized by feature, with shared layout and UI primitives factored
out. `App.tsx` mounts the router; each page composes the shared `AppShell`.

```
src/
  app/
    App.tsx                 # mounts <AppRouter/>
    router.tsx              # route map (BrowserRouter + Routes)
  api/
    client.ts               # fetch wrapper + ApiError (validation/not-found/network/unknown)
    projects.ts             # Projects endpoint methods
  components/
    layout/                 # AppShell, Sidebar, TopBar, MobileNavigation, navItems, navIcons
    ui/                     # StatusBadge, Mark, ViewToggle, EmptyState, ErrorState, LoadingSkeleton
  features/
    landing/                # LandingPage (marketing)
    overview/               # OverviewPage (engineering overview metrics)
    projects/
      api/                  # Project-scoped RepoIntegration, RepoAnalysis, HealthCheck, and Readiness API helpers
      components/           # ProjectCard, ProjectsTable, ProjectForm, ProjectFilters, ArchiveProjectModal
                            # RepositoryConnectionCard, RepositoryAttachForm, RepositoryRemoveModal
                            # CodeMapAnalysisCard, HealthMonitoringCard, ReadinessAssessmentCard
      pages/                # ProjectsPage, CreateProjectPage, ProjectDetailPage, EditProjectPage
      projectForm.ts        # form constants + input normalization
      projectSort.ts        # sort options + deterministic comparator
  hooks/                    # useTheme (persisted), useFocusTrap (drawer + modal)
  types/                    # Project / ProjectInput / ProjectStatus / RepoIntegration / RepoAnalysis / HealthCheck / Readiness
  utils/                    # formatDate
  styles/index.css          # semantic CSS tokens + component styles
  test/                     # setup + shared API mocks (mockApi.ts)
```

### Route map

| Route | Page | Notes |
| --- | --- | --- |
| `/` | Landing | Marketing page + command-center preview |
| `/app` | — | Redirects to `/app/overview` |
| `/app/overview` | Overview | Project metrics + future-state preview |
| `/app/projects` | Project Registry | List, search, filter, sort, card/table views, archive |
| `/app/projects/new` | Create Project | |
| `/app/projects/:projectId` | Project detail | Identity, metadata, setup progress, repository connection, CodeMap Lite analysis, Manual Health Monitoring, Production Readiness |
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

### Project sorting

The Registry sorts client-side (all Projects load through the list endpoint —
there are no server-side sort parameters). Options: Recently updated (default),
Oldest updated, Name A–Z, Name Z–A, Status. Ties break deterministically by
name (case-insensitive), then by id. Sorting composes with search, the status
filter, "Include archived", and both card and table views.

### Repository connection

The Project detail page shows real GitHub Repo Intake state from
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
Project detail page in this milestone.

Removing a repository connection deletes only the ProjectOps connection record.
It does not delete the GitHub repository. Repository analysis is handled separately
by the CodeMap Lite section on the same Project detail page.


### CodeMap Lite analysis

The Project detail page includes a real CodeMap Lite Analysis section backed by
`/api/v1/projects/:projectId/analyses`. CodeMap Lite is intentionally described
as rule-based path analysis, not AI code review.

States shown in the UI:

- No repository connected: analysis is disabled and the user is pointed back to
  Repository Connection.
- Repository connected, no analysis: the user can run CodeMap Lite and sees the
  boundaries of the feature.
- Completed analysis: summary, detected stack, architecture signals, evidence
  paths/folders, warnings, metadata, and history are displayed.
- Failed analysis: the failed attempt, error message, timestamp, retry action,
  and history remain visible.

CodeMap Lite does not clone repositories, inspect private code, perform deep
file-content analysis, calculate production readiness, run health checks, or use
AI-generated summaries. It uses public GitHub repository tree data and stores a
`RepoAnalysis` snapshot returned by the backend.

### Manual Health Monitoring

The Project detail page includes a real Health Monitoring section backed by
`/api/v1/projects/:projectId/health-checks`. Manual Health Monitoring means a
user clicks a button, ProjectOps checks one target URL, and the backend stores a
`HealthCheck` result. It is not scheduled uptime monitoring and does not create
alerts.

States shown in the UI:

- No production URL configured: the run button is disabled, the user is pointed
  to Edit Project, and the copy explains that no target URL exists yet.
- Production URL configured, no checks yet: the user can run a manual check and
  sees the current target production URL.
- Latest result: status, target URL when different from the saved production
  URL, HTTP status, response time, checked timestamp, response preview, and
  error message are displayed when available.
- History: the newest stored attempts are shown in a compact list with status,
  target URL, HTTP status, response time, and timestamp.

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

The Project detail page includes a real Production Readiness section backed by
`/api/v1/projects/:projectId/readiness`. Readiness is an advisory assessment
based on available ProjectOps evidence. It is not a deployment approval,
security audit, certification, or uptime guarantee.

States shown in the UI:

- Not evaluated: the card explains evidence sources and the advisory boundary.
- Evaluating: the run button is disabled and the pending state is announced.
- Latest result: advisory score, backend status, counts, top gaps, and checklist
  rows are displayed.
- Error: readiness errors remain scoped to the card, while Project metadata,
  Repository Connection, CodeMap Lite, and Health Monitoring stay usable.

Checklist rows show item label, description, status, source, evidence, category,
and notes when present. Evidence is deterministic: CodeMap signal evidence,
health-check evidence, Project metadata evidence, or manual review notes.

Manual review items expose status and notes controls. Automatic items do not
show manual save controls. Saving a manual item calls
`PATCH /api/v1/projects/:projectId/readiness/items/:itemKey` and updates the
returned row in the current checklist.
## Functional vs. preview UI

Real, backed-by-the-API functionality: Project list, create, read, update, and
archive (`/api/v1/projects`), GitHub repository attach/read/replace/remove for a
single Project (`/api/v1/projects/:projectId/repo`), CodeMap Lite analysis
run/latest/history views (`/api/v1/projects/:projectId/analyses`), and manual
health-check run/latest/history views
(`/api/v1/projects/:projectId/health-checks`), and Production Readiness
evaluate/fetch/manual-item update views (`/api/v1/projects/:projectId/readiness`).
Everything else surfaced in the UI is clearly labeled as a **future-state preview**
and is intentionally not wired to a frontend in this milestone:

- The landing command-center preview (readiness score, signal map).
- Overview's "future Project Dashboard" panel.
- Sidebar items labeled "Later": Repository Analysis, Health Monitoring,
  Readiness, Artifacts, Settings. The real Repository Analysis, Health
  Monitoring, and Production Readiness controls live inside Project detail for now.


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
- Manual readiness item saves update the checklist row locally but do not
  recalculate aggregate counts until readiness is re-evaluated or reloaded.
- There is no readiness history view or standalone Readiness route.

## Testing

Tests use Vitest + React Testing Library in a jsdom environment and **never call
the real backend** — `fetch` is mocked deterministically (see
`src/test/mockApi.ts`). Coverage spans the API client, Project list/search/
filter/sort, card/table views, empty/error states, the create/edit/archive
flows, repository attach/replace/remove behavior, the mobile drawer, theme
behavior, readiness API/client behavior, Project detail readiness behavior, and
layout accessibility (skip link, current-page marking, navigation landmark).

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

Manual CodeMap Lite verification:

1. Create or open a Project without a repository connection.
2. Confirm CodeMap Lite says a GitHub repository must be attached first.
3. Attach a valid public GitHub repository.
4. Confirm CodeMap Lite changes to the ready-to-analyze state.
5. Click Run Analysis and confirm the button is disabled while pending.
6. Confirm the latest analysis displays summary, files scanned, stack, signals,
   evidence, warnings, and metadata.
7. Refresh and confirm the latest analysis persists.
8. Run analysis again and confirm history updates.
9. Test backend failure/no-repo responses and confirm failed attempts or errors
   are shown without hiding Project metadata.

Manual Health Monitoring verification:

1. Create or open a Project without a production URL.
2. Confirm Health Monitoring says a production URL is required and the run
   button is disabled.
3. Edit the Project and add a production URL.
4. Return to Project detail and confirm the ready-to-check state.
5. Click Run Health Check and confirm the button is disabled while pending.
6. Confirm latest status, HTTP status, response time, timestamp, and preview or
   error text display after the backend responds.
7. Run again and confirm history updates.
8. Use "Check a different URL this time" and confirm the override URL is sent
   without changing the saved Project production URL.
9. Try a blocked local/private URL through the override and confirm the safety
   message is shown.
10. Confirm the section does not claim scheduled monitoring, uptime percentage,
    alerts, readiness, or production status pages exist.

Manual Production Readiness verification:

1. Create or open a Project.
2. Confirm Project metadata, Repository Connection, CodeMap Lite, and Health
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
