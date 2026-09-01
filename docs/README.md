# ProjectOps Documentation Index

Last reviewed: 2026-08-31

## Start Here

- `../README.md`: product overview, setup, and verification commands.
- `../CONTEXT.md`: canonical product vocabulary.
- `projectops-remaining-work-handoff.md`: current product state, next milestone,
  remaining work, and private-beta exit criteria.

## Selected Hosting Path

- `render-vercel-deployment.md`: authoritative Render and Vercel setup guide.
- `private-beta-hosting-todo-checklist.md`: operator checklist for the first deploy.
- `private-beta-deployment-drill.md`: evidence record and go/no-go worksheet.
- `deployment-readiness.md`: provider-neutral production configuration and risk
  review.
- `backup-restore-runbook.md`: PostgreSQL backup and recovery procedure.
- `observability-error-monitoring.md`: logging, request IDs, Sentry, and alerting
  boundaries.
- `ci-quality-gate.md`: CI, tests, audits, and release checks.

`aws-app-runner-vercel-deployment.md` is retained as an alternative architecture
reference. It is not the selected private-beta deployment path.

## Current Capability Notes

- `github-app-private-repositories.md`
- `milestone-34-scheduled-health-monitoring.md`
- `milestone-40-codemap-medium-repository-insights.md`
- `launch-decision-records.md`
- `authentication-ownership.md`
- `frontend-learning-notes.md`

## Historical Milestone Records

Files named `milestone-*.md` record the scope, decisions, verification, and
limitations at the time a milestone was delivered. Later milestones may have
implemented capabilities that those files explicitly excluded. Read the
historical boundary as “not part of that milestone,” not “not implemented in
the current product.” Current status always comes from the remaining-work
handoff and the current capability notes above.
