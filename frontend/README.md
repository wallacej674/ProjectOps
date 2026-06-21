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
library is used. The mobile drawer, modal, focus management, and sorting are all
built with plain React and CSS.

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
      components/           # ProjectCard, ProjectsTable, ProjectForm, ProjectFilters, ArchiveProjectModal
      pages/                # ProjectsPage, CreateProjectPage, ProjectDetailPage, EditProjectPage
      projectForm.ts        # form constants + input normalization
      projectSort.ts        # sort options + deterministic comparator
  hooks/                    # useTheme (persisted), useFocusTrap (drawer + modal)
  types/                    # Project / ProjectInput / ProjectStatus
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
| `/app/projects/:projectId` | Project detail | Identity, metadata, setup progress |
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

## Functional vs. preview UI

Real, backed-by-the-API functionality: Project list, create, read, update, and
archive (`/api/v1/projects`). Everything else surfaced in the UI is clearly
labeled as a **future-state preview** and is intentionally not wired to a
backend in this milestone:

- The landing command-center preview (readiness score, signal map).
- Overview's "future Project Dashboard" panel.
- Sidebar items labeled "Later": Repository Analysis, Health Monitoring,
  Readiness, Artifacts, Settings.
- Project detail "Setup progress" rows for repository analysis, health checks,
  and readiness evaluation.

## Known limitations

- Sorting/filtering are client-side; there is no pagination yet (all Projects
  load at once, matching the current backend list endpoint).
- The mobile drawer and archive modal communicate modality via
  `role="dialog"` + `aria-modal`; background content is not marked `inert`.
- No automated browser/visual-regression testing (Playwright/Cypress) is
  included. Responsive behavior was reviewed manually at 1440 / 834 / 390 px.
- Theme persistence is per-browser via `localStorage`; there is no account-level
  preference.

## Testing

Tests use Vitest + React Testing Library in a jsdom environment and **never call
the real backend** — `fetch` is mocked deterministically (see
`src/test/mockApi.ts`). Coverage spans the API client, Project list/search/
filter/sort, card/table views, empty/error states, the create/edit/archive
flows, the mobile drawer, theme behavior, and layout accessibility (skip link,
current-page marking, navigation landmark).
