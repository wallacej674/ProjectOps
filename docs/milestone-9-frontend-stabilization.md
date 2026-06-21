# Milestone 9: Frontend Stabilization, Architecture Refactor, and Quality Completion

This milestone hardened the Milestone 8 frontend foundation before adding any
new domain UI. It was a quality, architecture, responsive-design, testing, and
accessibility milestone. No new backend product functionality was added.

## Goals

1. Refactor the oversized single-file `App.tsx` into focused modules.
2. Establish a feature-oriented frontend structure.
3. Add a real mobile navigation drawer.
4. Add explicit, deterministic Project sorting.
5. Complete the frontend test matrix (create, edit, archive, mobile nav, theme, sorting).
6. Review and improve theme, responsive, and accessibility behavior.
7. Run a full backend regression and update documentation.

## Architecture refactor

`App.tsx` previously held the entire application (router, layout, every page,
the API-driven Project Registry, forms, and the archive modal) as dense
single-line components. It now mounts a single `<AppRouter/>`. Behavior was
preserved by writing characterization tests first, then extracting modules:

- `app/router.tsx` — the route map.
- `components/layout/` — `AppShell`, `Sidebar`, `TopBar`, `MobileNavigation`,
  plus `navItems` and `navIcons`.
- `components/ui/` — `StatusBadge`, `Mark`, `ViewToggle`, `EmptyState`,
  `ErrorState`, `LoadingSkeleton`.
- `features/landing`, `features/overview`, `features/projects`
  (`components/`, `pages/`, `projectForm.ts`, `projectSort.ts`).
- `hooks/` — `useTheme` (persisted), `useFocusTrap` (shared by the drawer and
  the archive modal).
- `utils/formatDate.ts`, `types/project.ts`.

## Mobile navigation drawer

At ≤900px the sidebar is replaced by a labeled menu trigger in the top bar that
opens an off-canvas drawer with a backdrop. The drawer traps focus, closes on
Escape / backdrop / close button / route change, restores focus to the trigger,
exposes `role="dialog"` + `aria-modal` + an accessible name, and respects
`prefers-reduced-motion`. Built with plain React + CSS — no new dependency.

## Project sorting

Client-side sorting (the list endpoint loads all Projects; there are no
server-side sort parameters). Options: Recently updated (default), Oldest
updated, Name A–Z, Name Z–A, Status. Ties break deterministically by name
(case-insensitive) then id. Sorting composes with search, the status filter,
"Include archived", and both card and table views.

## Testing

Frontend tests grew from 7 to 59, all using mocked `fetch` (never the real
backend). New/expanded coverage: characterization smoke tests across all routes,
the create / edit / archive flows, the mobile drawer, theme behavior, the sort
comparator and its UI integration, and layout accessibility (skip link,
`aria-current`, navigation landmark). A shared `src/test/mockApi.ts` helper
provides deterministic API responses, and Testing Library's async timeout was
raised to keep multi-step navigation flows stable under parallel load.

## Accessibility improvements

- Skip-to-main-content link as the first focusable element.
- `aria-current="page"` on the active navigation item (via `NavLink`).
- Replaced empty icon placeholders with real line icons, which also fixed a
  pre-existing bug where the collapsed sidebar showed blank nav items.
- A check glyph on completed Project setup-progress rows.
- Focus trap + focus restoration for the mobile drawer and the archive modal.
- `<th scope="col">` on the Projects table header.
- 44px minimum touch targets for interactive controls at mobile widths.
- Status remains conveyed as text (not color alone) on badges.

These are improvements, not a WCAG certification.

## Responsive review

Reviewed live in a browser at 1440 / 834 / 390 px using DOM measurement
(screenshot capture was unavailable in this environment). The main fix: in
table view at mobile widths the page scrolled horizontally because the table's
`min-width` stretched its grid track; adding `min-width:0` to the main column
lets `.table-wrap` scroll internally instead. Verified no horizontal overflow
across landing, overview, registry (cards + table), create form, detail, and
the archive modal, including with long Project names and long URLs.

## Verification

- Frontend: Vitest (59 passing), `tsc -b`, ESLint, and `vite build` all pass.
- Backend regression: `alembic upgrade head`, `pytest` (113 passing),
  `compileall` all pass. CORS tests included. No backend domain behavior changed.
- `git diff --check` clean.

## Out of scope (later milestones)

Frontend for GitHub repo intake, repository analysis, health monitoring,
readiness, and artifacts; authentication; scheduled monitoring; notifications;
a real command palette; project restoration; and AI-generated recommendations.
