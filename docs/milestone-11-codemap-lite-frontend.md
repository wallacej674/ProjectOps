# Milestone 11: CodeMap Lite Frontend

> Historical milestone record. CodeMap Medium now extends this UI and data contract; see `projectops-remaining-work-handoff.md`.

Milestone 11 connects the existing CodeMap Lite backend to the Project detail
frontend.

## What was built

- Project detail CodeMap Lite Analysis section.
- Repository-required state when no `RepoIntegration` exists.
- Ready-to-run state when a repository is connected but no analysis exists.
- Run Analysis / Run Again / Retry Analysis controls.
- Pending state while analysis is running.
- Latest completed analysis display.
- Latest failed analysis display.
- Analysis history list.
- Detected stack display.
- Architecture signal display with text labels.
- Evidence display for detected files and folders.
- Warning display.
- Scoped loading and error states for latest analysis, history, and run failures.
- Frontend API module for CodeMap Lite analysis routes.
- Frontend tests for API behavior and Project detail CodeMap UI behavior.

## Backend routes used

```text
POST /api/v1/projects/{project_id}/analyses/run
GET  /api/v1/projects/{project_id}/analyses/latest
GET  /api/v1/projects/{project_id}/analyses
GET  /api/v1/projects/{project_id}/repo
```

The run route expects no request body. The frontend does not invent query
parameters for analysis history.

## Repository connection vs repository analysis

`RepoIntegration` means a Project has an attached public GitHub repository
connection.

`RepoAnalysis` means ProjectOps ran CodeMap Lite against that connection and
stored the returned result.

The frontend keeps those concerns separate: `RepositoryConnectionCard` handles
attach, replace, remove, and display of the connection; `CodeMapAnalysisCard`
handles analysis state and results.

## Rule-based nature

The UI states that CodeMap Lite reads repository paths to infer basic
architecture signals. It is rule-based path analysis, not AI code review.

CodeMap Lite does not:

- Clone the repository.
- Use AI.
- Inspect private code.
- Inspect file contents deeply.
- Verify code quality.
- Claim production readiness.
- Run health checks.

## UI states

1. No repository connected: the run button is disabled and the user is directed
   to Repository Connection.
2. Repository connected, no analysis yet: the user can run CodeMap Lite and sees
   the feature boundaries.
3. Completed analysis: the UI shows summary, files scanned, detected stack,
   architecture signals, evidence, warnings, metadata, and history.
4. Failed analysis: the UI shows failed status, backend error text, likely cause
   copy, timestamp, retry action, and history.

## Local testing

```powershell
cd frontend
npm test
npm run lint
npm run build
```

There is no separate `npm run typecheck` script. `npm run build` runs `tsc -b`
before the Vite production build.

## Manual verification checklist

1. Create or open a Project with no repository connection.
2. Confirm CodeMap Lite says a GitHub repository must be attached first.
3. Attach a valid public GitHub repository.
4. Confirm CodeMap Lite changes to ready-to-analyze state.
5. Click Run Analysis.
6. Confirm the button becomes pending and disabled.
7. Confirm latest analysis appears after success.
8. Confirm summary, files scanned, detected stack, architecture signals,
   warnings, evidence, and metadata display.
9. Refresh the page and confirm latest analysis persists.
10. Run analysis again and confirm history updates.
11. Test invalid/no-repo behavior.
12. Confirm failed analysis display if the backend returns a failed analysis.
13. Confirm dark and light themes remain readable.
14. Confirm desktop, tablet, and mobile layouts do not overflow.

## Known limitations

- CodeMap Lite history is not paginated because the backend route has no
  pagination contract yet. The UI shows the newest six attempts.
- Sidebar Repository Analysis remains a future-state navigation item. The real
  CodeMap UI lives inside Project detail for this milestone.
- Analysis runs synchronously from the UI. There are no background jobs or live
  progress events.
- Public GitHub repository tree data is required. Private repositories and
  GitHub OAuth are out of scope.
- No health monitoring, readiness scoring, artifacts, or authentication UI is
  included in this milestone.

## Future Milestone 12 and 13 boundary

Milestone 12 adds Manual Health Monitoring UI separately from CodeMap Lite. A
later readiness frontend can consume the latest `RepoAnalysis` and latest
`HealthCheck` as inputs, but should not treat CodeMap Lite as a readiness score.
Readiness UI should stay separate from run-analysis and run-health-check control
flows and should explain which inputs are available, missing, or stale.

## Learning notes

- Keep backend route details inside focused API modules.
- Treat `404` no-repo and no-analysis responses as normal empty states.
- Keep run errors scoped to the CodeMap section so Project metadata remains
  usable.
- Display every signal with text, not color alone.
- Long paths need wrapping styles because evidence strings can be much wider
  than mobile viewports.

