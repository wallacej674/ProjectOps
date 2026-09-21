# Private-beta setup - 2026-09-08

Status: local setup prepared; not deployed. Render and Vercel accounts are
accessible and neither has a ProjectOps deployment. No paid resources, plan
upgrades, invitations, or provider-side configuration changes were made.

## Concrete deployment scope for approval

Publish the reviewed ProjectOps changes to the existing GitHub repository and
require green CI on that commit. Create the root Render Blueprint: one API, one
Release Rehearsal background worker, one five-minute health cron, and private
PostgreSQL 16 in Ohio. Import `frontend/` into Vercel with its existing Vite
configuration. Use provider-generated HTTPS domains initially and exact CORS.
Providers will build the repository; backend AI access is configured privately in
the Render runtime. No key belongs in the browser or this document.

Budget estimate: $58.50/month for one operator, before taxes, AI, and overages:
API $7, worker $7, Postgres compute $19, conservative 15 GB storage allowance
$4.50, cron minimum $1, and Vercel Pro $20. Render Hobby workspace is assumed;
Render Pro adds $25/month. See the dated official sources and assumptions in
[hosting research](private-beta-hosting-research.md). Confirm checkout estimates
before purchase. This is not a hard spending cap. Database automatic growth is
disabled; check capacity daily and approve resizing separately.

Vercel is currently on Hobby and shows an incomplete billing-address warning.
Its commercial beta requires the proposed Pro plan and the account owner must
complete billing information privately. Ongoing beta AI spending needs its own
allowance; the prior $1 evaluation authorization does not cover participant use.
The application currently does not enforce an aggregate beta dollar cap. Use a
small supervised pilot, monitor usage, and stop the worker to stop new background
AI dispatch if the agreed allowance is approached. Account for in-flight calls
and other AI endpoints before treating any stop action as a complete cost stop.

Approval needed before execution: recurring hosting at the quoted plans,
publishing the reviewed changes and deploying them through these providers, and
a separate AI allowance for hosted smoke checks and the pilot. Invitations are a
later action after the hosted gates pass; no outreach is authorized by this setup.

## Prepared implementation

- Invitation-only registration in the Blueprint, with a generated shared code.
  The API rejects invalid invitation configuration and validates codes before
  account creation. Existing logins continue when enrollment is closed.
- Dedicated AI worker sharing API model and runtime configuration. The API owns
  migrations; worker and cron check the exact schema revision before doing work.
- Evaluated model pinned to `gpt-5.4-mini-2026-03-17`. Startup checks do not call AI.
- One API and worker, private database, fixed 15 GB storage, and previews disabled.
- [Deployment runbook](render-vercel-deployment.md),
  [hosted checklist](private-beta-hosting-todo-checklist.md), and
  [drill evidence record](private-beta-deployment-drill.md).
- [Five-participant testing script](private-beta-user-testing.md) and
  [feedback form](private-beta-feedback-template.md), covering comprehension,
  evidence gaps, actionable next steps, and real verification follow-up.

## Local verification

The full backend suite passed 413 tests with one existing dependency deprecation
warning. After that full run, the final invitation and startup corrections passed all
33 auth/config tests, with both new regressions observed failing before the fix.
Eight deployment configuration/runbook checks and the worker missing-provider
check also passed. Backend compilation and diff whitespace checks passed. Frontend verification
passed 346 tests across 61 files, lint with zero errors and five existing Fast
Refresh warnings, and the production build with its existing bundle-size advisory.
No additional live AI calls were made for this setup. The completed synthetic
AI evaluation is documented in [the evaluation report](rehearsal-live-evaluation-report.md).

The workspace changes remain uncommitted and unpushed. Old green CI and dependency
audits do not establish the current revision's release gate.

## Before admitting participants

Deploy one reviewed commit across all services, verify migration head
`0020_rehearsal_handoff`, health endpoints, exact CORS, enrollment rejection,
account isolation, hosted AI completion and citations, packet/results reassessment,
and persistence after worker restart. Confirm backup retention and complete a
timed restore. Record evidence in the drill document rather than marking these
checks complete from local tests.

Choose a support contact, participant consent wording, and data retention/deletion
procedure before sending invitations. Begin with the synthetic project in the
pilot script; use owned, redacted real project evidence only with participant
consent. Human relevance/actionability and adoption remain unmeasured. Report
observed outcomes, including failures, without treating AI output as production
certification.
