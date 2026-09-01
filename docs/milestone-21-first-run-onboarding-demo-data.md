# Milestone 21: First-Run Onboarding and Demo Data

> Historical milestone record. Scope and exclusions describe this milestone at delivery; see `projectops-remaining-work-handoff.md` for current capabilities.

Milestone 21 makes a new ProjectOps workspace easier to understand before a
team has entered its own project data.

The goal is a demo-ready first run: users can create their first Project or
load a deterministic sample workspace that exercises the existing command
center without adding authentication, background jobs, hosted integrations, or
AI-generated claims.

## What Was Built

- First-run Overview panel when the workspace has no Projects.
- Demo data status API.
- Demo data seed API.
- Production-disabled demo seeding guard.
- Idempotent sample workspace creation.
- Seeded Project records, repository connection, CodeMap Lite snapshot, manual
  health-check snapshot, artifacts, readiness evaluation, evidence links, and
  recent activity.
- Frontend demo-data API helper.
- Frontend tests for empty workspace onboarding, demo seed navigation, and
  disabled demo state.
- Backend tests for status, production disabled behavior, idempotency, and
  seeded workspace contents.

## Demo Data API

```text
GET  /api/v1/demo-data/status
POST /api/v1/demo-data/seed
```

`GET /api/v1/demo-data/status` returns:

```json
{
  "enabled": true,
  "reason": null
}
```

In `PROJECTOPS_ENVIRONMENT=production` or `prod`, status returns:

```json
{
  "enabled": false,
  "reason": "Demo data seeding is disabled in production environments."
}
```

`POST /api/v1/demo-data/seed` creates the sample workspace outside production.
It returns the main demo Project and a `created` flag. Calling it again returns
the existing Project with `created: false` and does not duplicate the demo
workspace.

Production seeding returns `403`.

## Seeded Workspace

The seed creates:

- `ProjectOps Demo Command Center`: a staging Project with a production URL.
- A connected GitHub repository record for
  `https://github.com/projectops/demo-command-center`.
- A stored CodeMap Lite completed snapshot with stack, files, folders, signals,
  and a missing `.env.example` warning.
- A stored healthy manual health-check snapshot.
- Three active Project Artifacts:
  - Deployment runbook
  - Release risk review
  - Production readiness notes
- A readiness evaluation with manual review updates and one linked supporting
  artifact.
- Recent Activity events produced through the same product-history model used
  by normal workflows.
- `Checkout API Modernization`: a lighter companion Project that still needs
  setup, so Overview metrics have contrast.

The seed does not call GitHub, run live health checks, upload files, process
documents, generate AI summaries, or certify production safety.

## Frontend Behavior

When `/app/overview` loads and ProjectOps has no Projects, the page shows a
first-run panel with:

- Create Project
- Load demo workspace, when demo seeding is enabled
- A disabled-state explanation when demo seeding is unavailable

Clicking Load demo workspace calls the seed endpoint and navigates to the demo
Project command center. The Overview metrics and activity sections remain real
data surfaces; no fake activity is displayed unless the user explicitly loads
demo data.

## Testing

Backend tests cover:

- Demo status enabled outside production.
- Production disabled status.
- Production seed rejection.
- Seeded repository, analysis, health check, artifacts, readiness, evidence,
  and activity records.
- Idempotent repeated seed calls.

Frontend tests cover:

- Demo-data API helper paths.
- Empty-workspace first-run panel.
- Demo workspace seed action and navigation.
- Disabled demo-data state.
- Existing Overview activity behavior after adding the status call.

## Known Limitations

- Demo data is keyed by deterministic Project names, not by a tenant/workspace
  ownership model.
- No reset/delete demo data endpoint exists.
- Demo records use stored snapshots; they do not prove a live GitHub repository
  or live production endpoint exists.
- Demo seeding is environment-gated but not permission-gated because ProjectOps
  does not have authentication yet.
- The first-run panel appears only when there are no Projects at all, including
  archived Projects.
