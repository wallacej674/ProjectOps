# Milestone 6: Production Readiness Checklist

Milestone 6 adds a transparent, advisory production-readiness checklist to ProjectOps. It combines existing CodeMap Lite signals, health-check results, and project metadata with manual engineering review items to produce a score and a per-item assessment.

The score is advisory. It reflects posture based on available signals. It does not certify that a project is safe for production.

The main routes are:

```text
POST  /api/v1/projects/{project_id}/readiness/evaluate
GET   /api/v1/projects/{project_id}/readiness
PATCH /api/v1/projects/{project_id}/readiness/items/{item_key}
```

## What Was Built

- A `ReadinessItem` catalog model backed by the `readiness_items` table.
- A `ProjectReadinessItem` assessment model backed by the `project_readiness_items` table.
- An Alembic migration seeding 9 default readiness items.
- A readiness repository with upsert and create assessment methods.
- A readiness evaluation service applying automatic rules and preserving manual item state.
- A pure `calculate_readiness_score()` function for scoring.
- API schemas: `ProjectReadinessSummary`, `ProjectReadinessItemRead`, `ReadinessItemUpdate`.
- A dedicated `app/api/readiness.py` router registered in `main.py`.
- Dashboard `readiness` section updated with real score, counts, and top gaps.
- Tests for score calculation, evaluation rules, manual item behavior, routes, and dashboard output.

## Readiness Item Catalog

Nine default items are seeded when the migration runs:

| key | label | category | type |
|---|---|---|---|
| `readme_present` | README Present | documentation | automatic |
| `tests_present` | Tests Present | testing | automatic |
| `ci_configured` | CI Configured | testing | automatic |
| `env_example_present` | Environment Example Present | documentation | automatic |
| `production_url_configured` | Production URL Configured | observability | automatic |
| `latest_health_check_healthy` | Latest Health Check Healthy | observability | automatic |
| `deployment_docs_reviewed` | Deployment Docs Reviewed | engineering_review | manual |
| `logging_error_handling_reviewed` | Logging and Error Handling Reviewed | engineering_review | manual |
| `secrets_management_reviewed` | Secrets Management Reviewed | engineering_review | manual |

## Automatic Evaluation Rules

### CodeMap-backed items

`readme_present`, `tests_present`, `ci_configured`, `env_example_present` are evaluated from the latest **completed** `RepoAnalysis` for the project.

- If no completed analysis exists: `unknown`.
- If the corresponding signal is `true`: `passed`.
- If the corresponding signal is `false`: `failed`.
- Evidence stores the analysis ID, signal name, and detected value.

Signal mapping:

| key | signal |
|---|---|
| `readme_present` | `has_readme` |
| `tests_present` | `has_tests` |
| `ci_configured` | `has_ci` |
| `env_example_present` | `has_env_example` |

### production_url_configured

Evaluated from `Project.production_url`.

- If `production_url` is set: `passed`.
- If `production_url` is null or empty: `failed`.
- Evidence stores `{"field": "production_url", "present": true/false}`.
- This item is never `unknown`.

### latest_health_check_healthy

Evaluated from the latest `HealthCheck` for the project.

- If no health check exists: `unknown`.
- If the latest health check `status` is `healthy`: `passed`.
- If the latest health check `status` is `unhealthy`, `timeout`, or `error`: `failed`.
- Evidence stores the health check ID and status.

## Manual Item Behavior

Manual items (`deployment_docs_reviewed`, `logging_error_handling_reviewed`, `secrets_management_reviewed`) begin as `unknown` after the first `evaluate` call.

Use `PATCH /api/v1/projects/{project_id}/readiness/items/{item_key}` to update a manual item:

```json
{ "status": "passed", "notes": "Reviewed on 2026-06-19. Docs are complete." }
```

Allowed statuses: `passed`, `failed`, `unknown`, `not_applicable`.

Rules:
- Only manual items can be patched. Patching an automatic item returns `400`.
- Re-running `evaluate` does not reset manual items.
- Patching a manual item before `evaluate` has run creates the assessment row.

## Score Calculation

```
score = floor(passed_applicable / total_applicable × 100)
```

- `total_applicable` = count of items where `status != "not_applicable"`.
- `passed_applicable` = count of items where `status == "passed"`.
- `failed` and `unknown` remain in the denominator.
- `not_applicable` items are excluded from the denominator.
- Rounding: `math.floor` — conservative, never overstates readiness.
- If `total_applicable == 0` (no items exist yet): `score = null`, `status = "not_started"`.

### Readiness States

| Condition | State |
|---|---|
| No assessments exist for the project | `not_started` |
| `score < 50` | `needs_work` |
| `50 ≤ score < 80` | `in_progress` |
| `score ≥ 80` | `strong` |

## API Routes

### POST /api/v1/projects/{project_id}/readiness/evaluate

Runs automatic evaluation for all active catalog items. Creates or updates automatic assessment rows. Creates manual assessment rows as `unknown` if they do not exist yet. Preserves existing manual item statuses and notes.

Returns `201 ProjectReadinessSummary` with the full item list.

### GET /api/v1/projects/{project_id}/readiness

Returns the current assessment as stored. If `evaluate` has never been run, returns a `not_started` summary with an empty item list.

### PATCH /api/v1/projects/{project_id}/readiness/items/{item_key}

Updates a manual item's `status` and `notes`. Returns `200 ProjectReadinessItemRead`.

Errors:
- `404` if the project does not exist.
- `404` if the item key is not recognized.
- `400` if the item is automatic.

## Dashboard Integration

The `readiness` section of `GET /api/v1/projects/{project_id}/dashboard` now returns a real summary:

```json
{
  "score": 67,
  "status": "in_progress",
  "passed": 4,
  "failed": 2,
  "unknown": 3,
  "not_applicable": 0,
  "total_applicable": 9,
  "top_gaps": ["CI Configured", "Secrets Management Reviewed", "Logging and Error Handling Reviewed"]
}
```

When no `evaluate` has been run:

```json
{
  "score": null,
  "status": "not_started",
  "passed": 0,
  "failed": 0,
  "unknown": 0,
  "not_applicable": 0,
  "total_applicable": 0,
  "top_gaps": []
}
```

`top_gaps` contains labels (human text) of up to 3 failed or unknown items, ordered by catalog `sort_order`. It does not contain the full item list — use the dedicated readiness endpoint for the complete breakdown.

## Evidence

Each automatic assessment stores structured evidence so users can understand why an item passed or failed:

```json
// CodeMap item
{"analysis_id": 12, "signal": "has_readme", "value": true}

// Health check item
{"health_check_id": 5, "status": "healthy"}

// Project metadata item
{"field": "production_url", "present": true}
```

Manual items do not have evidence. They have `notes` instead.

## Seeding

The 9 default readiness items are seeded in the Alembic migration using `op.bulk_insert`. The migration uses `ON CONFLICT DO NOTHING` semantics to remain idempotent. The test conftest calls `seed_default_readiness_items(db)` after `create_all` because tests recreate tables from SQLAlchemy metadata rather than running migrations.

## What Is Not Included

This milestone does not include weighted scoring, custom per-project checklists, manual overrides for automatic items, readiness history snapshots, compliance frameworks, dependency or security scanning, deployment automation, scheduled monitoring, background jobs, frontend implementation, or authentication.

## Known Limitations

- CodeMap Lite signals are heuristic. They detect file paths, not code quality.
- There is no SSRF protection on the health check URL (documented in Milestone 5).
- There is no pagination on readiness item lists (9 items per project makes this unnecessary now).
- There is no per-item history — only the latest assessment is stored.
- The advisory score cannot certify production safety.
