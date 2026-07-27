# Milestone 10: GitHub Repo Intake Frontend

Milestone 10 connects the existing GitHub Repo Intake backend to the ProjectOps
frontend. The experience lives on the Project detail page.

## Scope

Implemented frontend behavior:

- Show real repository connection state for one Project.
- Attach a public GitHub repository URL.
- Display normalized provider, owner, repo name, URL, connection status, default
  branch, and last verified time.
- Replace the connected repository through the same attach endpoint.
- Remove the repository connection with confirmation.
- Keep CodeMap analysis clearly future-state.

Out of scope:

- CodeMap analysis UI.
- Health monitoring UI.
- Readiness UI.
- Authentication, GitHub OAuth, private repositories, tokens, webhooks, file
  browsing, commit history, and background jobs.

## Backend contract used

The frontend uses the existing Project-scoped repo routes:

```text
GET    /api/v1/projects/{project_id}/repo
POST   /api/v1/projects/{project_id}/repo
DELETE /api/v1/projects/{project_id}/repo
```

`POST` expects:

```json
{ "repo_url": "https://github.com/owner/repo" }
```

`GET` and `POST` return:

```text
RepoIntegrationRead
```

Important response fields:

- `provider`
- `repo_owner`
- `repo_name`
- `repo_url`
- `default_branch`
- `is_connected`
- `last_verified_at`

No attached repo returns `404` with a message such as:

```text
Project 7 does not have an attached repo.
```

Invalid GitHub URLs return `422`:

```text
Enter a valid GitHub repository URL.
```

`DELETE` returns `204 No Content`.

## Supported URL formats

- `https://github.com/owner/repo`
- `https://github.com/owner/repo.git`
- `git@github.com:owner/repo.git`

The backend remains the source of truth for URL parsing. The frontend only
checks that the field is not empty.

## Project.repo_url vs RepoIntegration.repo_url

`Project.repo_url` is basic Project metadata from the Project form.

`RepoIntegration.repo_url` is the real normalized repository connection created
by GitHub Repo Intake.

The Project Registry does not claim a Project is connected based only on
`Project.repo_url`. Real connection state is displayed on Project detail.

## UI behavior

The Repository Connection card has three main states:

- Loading: repo state is still being read.
- Not connected: explains repo intake, shows URL input and supported examples.
- Connected: shows normalized repo details plus replace/remove actions.

The disabled "Run CodeMap Analysis" action is visible to show the next step, but
it remains non-functional until the CodeMap frontend milestone.

## Manual verification

1. Create a Project.
2. Open Project detail.
3. Confirm the repo section says no repository is connected.
4. Submit an empty repo URL and confirm client validation.
5. Submit an invalid GitHub URL and confirm backend validation appears.
6. Attach a valid public GitHub URL.
7. Confirm owner, repo name, provider, and normalized URL display.
8. Refresh the page and confirm connection persists.
9. Replace with a different valid GitHub URL.
10. Confirm updated repo details display.
11. Open remove modal.
12. Cancel and confirm repo remains.
13. Open remove modal again.
14. Press Escape and confirm modal closes.
15. Remove repo.
16. Confirm repo section returns to not-connected state.
17. Confirm Project itself still exists.
18. Confirm Repository Analysis nav is still future/disabled.
19. Confirm dark and light modes both look good.
20. Confirm mobile layout remains usable.

## Known limitations

- No repository connection counts are shown in Overview or the Project Registry.
- Default branch and last verified time are shown as "Not verified yet" until
  backend verification supplies values.
- The Repository Connection modal uses `role="dialog"` and focus trapping; the
  rest of the page is not marked `inert`.
- No automated browser visual-regression dependency is included.
