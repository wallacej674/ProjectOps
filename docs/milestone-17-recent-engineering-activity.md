# Milestone 17: Recent Engineering Activity Timeline

Milestone 17 adds a Project-scoped Recent Activity timeline to ProjectOps.

The goal is product history: users can see meaningful actions that happened
inside one Project, newest-first, without introducing realtime notifications or
audit-grade logging.

## What Was Built

- `project_activity_events` backend table.
- `ProjectActivityEvent` SQLAlchemy model.
- Activity repository and service.
- `GET /api/v1/projects/{project_id}/activity`.
- Category, event type, limit, and offset filters.
- Dashboard activity summary.
- Service-layer event recording for key workflows.
- Frontend activity API helper and TypeScript types.
- Recent Activity section on Project detail.
- Activity summary card in the unified command center.
- Activity section navigation item.
- Category filter, empty state, loading state, error state, and no-results state.

## Backend Model

Table:

```text
project_activity_events
```

Fields:

```text
id
project_id
event_type
event_category
message
related_resource_type
related_resource_id
metadata
created_at
```

`metadata` is stored as JSONB. In the SQLAlchemy model it is exposed as
`metadata_json` because `metadata` is reserved by SQLAlchemy declarative models.
The API response still returns the field as `metadata`.

## Event Categories

```text
project
repository
codemap
health
readiness
artifact
evidence
```

## Event Types

```text
project_created
project_updated
project_archived
repository_attached
repository_replaced
repository_removed
codemap_analysis_completed
codemap_analysis_failed
health_check_healthy
health_check_unhealthy
health_check_timeout
health_check_error
readiness_evaluated
readiness_manual_item_updated
artifact_created
artifact_updated
artifact_archived
readiness_artifact_linked
readiness_artifact_unlinked
```

Health uses status-specific event types because that makes filtering and display
clearer than a generic `health_check_run` event.

## Activity API

```text
GET /api/v1/projects/{project_id}/activity
```

Supported query parameters:

```text
category=artifact
event_type=artifact_created
limit=25
offset=0
```

Behavior:

- Project-scoped only.
- Newest-first order.
- Missing Project returns 404.
- Valid Project with no activity returns `[]`.
- `limit` defaults to 25 and is capped at 100.
- `offset` supports simple pagination.

## Dashboard Summary

The Project dashboard response now includes:

```json
{
  "activity": {
    "recent_count": 3,
    "latest_event": {
      "id": 10,
      "event_type": "artifact_created",
      "event_category": "artifact",
      "message": "Artifact was created.",
      "related_resource_type": "project_artifact",
      "related_resource_id": 41,
      "created_at": "2026-01-07T12:00:00Z"
    }
  }
}
```

The frontend command center still derives its display from data loaded directly
by Project detail, but the backend dashboard summary is ready for future
dashboard unification.

## Event Recording

Activity is recorded in service-layer workflows after the primary action
succeeds.

Recorded actions:

- Project create, update, archive.
- Repository attach, replace, remove.
- CodeMap analysis completed or failed.
- Health check healthy, unhealthy, timeout, or error.
- Readiness evaluation.
- Manual readiness item update.
- Artifact create, update, archive.
- Artifact linked or unlinked as readiness evidence.

Activity events are not backfilled for older rows.

## Frontend Behavior

Project detail now includes:

- Activity summary card.
- Activity section navigation item.
- Recent Activity section.
- Category filter.
- Result count.
- Clear filters action.
- Empty, loading, error, and no-results states.
- Timeline rows with category, message, timestamp, related resource, and small
  metadata details.

Activity errors do not hide Project metadata or other Project detail sections.

## Testing

Backend tests cover:

- Activity list route.
- Empty list.
- Newest-first ordering.
- Category and event type filters.
- Limit, offset, and max limit.
- Missing Project 404.
- Dashboard activity summary.
- Event recording for Project, repository, CodeMap, health, readiness,
  artifacts, and evidence links.

Frontend tests cover:

- Activity API helper.
- Timeline loading, empty, error, list, filter, clear-filter, and no-results
  behavior.
- Command-center activity summary.
- Section navigation.
- Project detail activity load failure isolation.

## Accessibility And Responsive Notes

- Recent Activity is a labeled region.
- Timeline rows use list semantics.
- Category filter has an explicit label.
- Loading and result counts use polite announcements.
- Error state uses `role="alert"`.
- Long messages, related resources, and metadata wrap.
- Mobile layout stacks filters and timeline content.

## Known Limitations

- No realtime updates.
- No polling.
- No WebSockets or server-sent events.
- No email, Slack, or in-app notification inbox.
- No background workers.
- No audit-grade guarantees.
- No user attribution because ProjectOps does not have user accounts yet.
- No historical backfill for pre-existing Projects.

## Future Milestone 18 Boundary

A good next milestone would be an activity refinement or activity-informed
workflow milestone:

- Batch/bulk activity count endpoint if timeline volume grows.
- Detail route for one activity event.
- Activity grouping by day.
- Optional backend backfill command for development environments.
- Improved related-resource labels and links.
- User attribution only after authentication exists.

Do not jump directly to realtime notifications until the product actually needs
notification behavior.
