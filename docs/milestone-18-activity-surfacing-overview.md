# Milestone 18: Activity Surfacing and Overview Upgrade

> Historical milestone record. Future boundaries describe this milestone at delivery; see `projectops-remaining-work-handoff.md` for current priorities.

Milestone 18 makes Recent Activity visible beyond one Project detail page.

The goal is refresh-based product history across Projects: users can see what
changed recently, which Projects are active, and where to click next without
introducing notifications, unread state, realtime transport, or audit logging.

## What Was Built

- `GET /api/v1/activity` cross-Project activity endpoint.
- Cross-Project activity response fields for Project name and status.
- Category, event type, Project ID, limit, and offset filters.
- Overview Recent Activity Across Projects feed.
- Overview Recently Active Projects section.
- Overview activity metrics backed by real Projects and loaded activity.
- Activity links from Overview to Project detail.
- Manual Refresh activity controls on Overview and Project detail.
- Project detail Activity summary fix: filters affect only the timeline list.
- Documentation clarifying recent activity versus unread notifications.

## Cross-Project Activity API

```text
GET /api/v1/activity
```

Supported query parameters:

```text
category=artifact
event_type=artifact_created
project_id=7
limit=25
offset=0
```

Behavior:

- Newest-first across local Projects.
- Empty activity returns `[]`.
- `limit` defaults to 25 and is capped at 100.
- `offset` supports simple pagination.
- `project_id` filters to one Project and returns 404 when that Project does
  not exist.
- Archived Project activity is included by default because ProjectOps has no
  user, team, or visibility model yet.

Example response item:

```json
{
  "id": 52,
  "project_id": 8,
  "project_name": "LaunchBudget",
  "project_status": "staging",
  "event_type": "health_check_healthy",
  "event_category": "health",
  "message": "Manual health check was healthy.",
  "related_resource_type": "health_check",
  "related_resource_id": 20,
  "metadata": { "http_status_code": 200 },
  "created_at": "2026-01-08T12:00:00Z"
}
```

## Overview Behavior

`/app/overview` now loads:

- all Projects, including archived Projects, for real metrics
- cross-Project activity for the activity feed and recently active Projects

The Overview page shows:

- Active Projects
- Projects with recent activity
- Recent activity events
- Projects needing setup
- Recent Activity Across Projects
- Recently Active Projects

Overview activity supports:

- category filter
- result count
- clear filters
- loading state
- empty state
- filtered no-results state
- error state
- manual refresh
- Project detail links

Activity copy intentionally says product history and recent indicators. It does
not say unread, notification inbox, realtime, live, audit log, or AI summary.

## Project Detail Summary Behavior

Project detail now keeps two activity states:

- filtered timeline list
- unfiltered command-center summary source

Filtering the Activity section changes only the timeline. The command-center
Activity summary remains stable and continues to show the unfiltered latest
activity and count from its own source.

Manual refresh reloads both sources while preserving the active category filter.

## Testing

Backend tests cover:

- cross-Project activity success
- newest-first ordering
- Project name/status fields
- empty result
- category filter
- event type filter
- Project ID filter
- limit and offset
- max limit validation
- missing Project filter 404
- dashboard summary stability
- no-events dashboard summary
- Project-scoped activity regression

Frontend tests cover:

- cross-Project activity API success, empty, error, and filters
- Overview loading, empty, error, populated, filtered, and no-results states
- Overview Project links
- Recently Active Projects
- manual refresh preserving filters
- Project detail stable Activity summary with filtered timeline
- Project detail refresh preserving filters

## Manual Verification

1. Open `/app/overview`.
2. Confirm Project metrics load from real Project data.
3. Confirm Recent Activity Across Projects appears when activity exists.
4. Confirm no fake activity appears when activity is empty.
5. Filter activity by category.
6. Clear filters.
7. Use Refresh activity.
8. Click an activity Project link and confirm it opens Project detail.
9. Open a Project detail page.
10. Confirm the command-center Activity card shows unfiltered activity.
11. Filter the Activity section.
12. Confirm the timeline changes and the command-center card does not.
13. Confirm the UI does not use realtime, unread, notification, audit log, or
    AI summary language.

## Known Limitations

- No realtime updates.
- No polling.
- No WebSockets or server-sent events.
- No email, Slack, SMS, push, or in-app notification inbox.
- No user-specific unread state.
- No authentication or permissions.
- No audit-grade compliance guarantees.
- No historical backfill for Projects that existed before activity recording.
- Recently Active Projects is derived from the loaded activity window.

## Future Milestone 19 Boundary

A good next milestone would refine activity ergonomics without jumping to
notifications:

- Activity grouping by day.
- Better related-resource labels and anchor links.
- Optional overview aggregate endpoint if the Overview grows.
- Full dashboard-summary client adoption for Project detail counts.
- Development-only backfill command.

Realtime notifications should wait until ProjectOps has users, authentication,
delivery preferences, and a clear notification product need.
