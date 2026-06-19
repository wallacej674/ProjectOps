# Milestone 7: Backend Stabilization and Security Hardening

## Summary

This milestone resolves five code-review findings from Milestone 6 and adds two security hardening features (SSRF mitigation, bounded response reading). All changes follow TDD (red-green-refactor, vertical slices). 111 tests pass.

---

## Changes

### 1. Readiness catalog deduplicated (Finding: duplication)

`_DEFAULT_READINESS_ITEMS` existed in both `repositories/readiness.py` (82 lines) and implicitly in migration 0005. A new canonical module `app/readiness_catalog.py` holds `DEFAULT_READINESS_CATALOG`. The repository seeder reads from it; migration 0005 is kept as a frozen point-in-time snapshot.

A parity test (`test_runtime_catalog_keys_match_migration_0005_keys`) catches drift between the canonical module and the migration.

### 2. Atomic upsert with ON CONFLICT DO UPDATE (Finding: race condition)

`upsert_project_assessment` now uses `pg_insert(...).on_conflict_do_update(constraint="uq_project_readiness_items", ...)`. The conflict update set includes `updated_at: func.now()` explicitly (ORM `onupdate` does not fire for raw `db.execute`). A `db.flush()` after execute expires any cached identity-map objects so subsequent ORM reads re-query the DB.

`notes` is intentionally excluded from the conflict set — it is a manual field owned by engineers and must survive re-evaluation.

### 3. `compute_top_gaps` centralised (Finding: inconsistency)

Both `readiness_service.evaluate_project` / `get_project_readiness` and `dashboard_service.build_readiness_summary` previously computed top-gaps differently. A single `compute_top_gaps(assessments, catalog, max_gaps=3)` function in `services/readiness.py` is the canonical implementation, imported by the dashboard service.

Ordering: `failed` before `unknown`, then by `sort_order`. Filter before slice so a deactivated catalog item does not silently reduce the count below `max_gaps`. Sentinel for unknown sort order is `_UNKNOWN_SORT_ORDER = 10_000` (not the magic literal 999).

### 4. `ReadinessStatus` Literal type for status validation (Finding: invalid status accepted)

`ReadinessStatus = Literal["passed", "failed", "unknown", "not_applicable"]` is defined in `schemas/readiness.py` and applied to both `ReadinessItemUpdate.status` (write) and `ProjectReadinessItemRead.status` (read). Invalid values (e.g. `"approved"`) return HTTP 422 before reaching the database.

### 5. Dead code removed (Finding: test helpers)

Removed unused `_find_item` helper (had a `if True:` predicate that made it always iterate the entire list), unused `SessionLocal` import from `test_readiness_service.py`.

---

## Security hardening

### SSRF mitigation (`app/services/url_validator.py`)

`validate_health_check_url(url, resolver=None)` validates every outbound health-check URL before any HTTP request is made:

- Scheme: only `http` / `https`
- Credentials: blocked (`user:password@`, `user@`)
- Hostname: required; `localhost` and `*.localhost` blocked
- Literal IPs: checked directly with `ipaddress.ip_address(hostname).is_global`
- IPv6 tunnelling prefixes blocked explicitly before `is_global` (covers cases where `is_global` returns `True` on some Python versions):
  - `::ffff:0:0/96` — IPv4-mapped
  - `64:ff9b::/96` — NAT64 well-known (RFC 6052)
  - `64:ff9b:1::/48` — NAT64 local-use (RFC 8215)
  - `2002::/16` — 6to4 (RFC 3056)
- DNS hostnames: resolved via injectable resolver, every returned IP checked; IPs deduplicated to avoid redundant checks from `getaddrinfo` multi-socket-type results
- `follow_redirects=False` on the real `httpx.Client`

**Known limitation — DNS rebinding:** A hostname may resolve to a public IP at validation time and be made to resolve to a private IP at request time (attacker-controlled short TTL). Full mitigation requires network-level egress controls. Documented in the module docstring.

**Known limitation — response body buffering:** `httpx` buffers the full response body before `response.text` is available. `MAX_RESPONSE_BODY_BYTES = 16_384` limits the stored preview string but does not bound how much the HTTP client reads from the wire. Streaming reads (`response.read(N)`) would fix this and are deferred to a future milestone.

The injectable `resolver` parameter is the stable test seam. Tests that trigger health checks patch `hc_module._resolve_url_addresses` via an autouse fixture; SSRF-specific tests override it per-test.

### Bounded response reading (`MAX_RESPONSE_BODY_BYTES = 16_384`)

`response.text[:MAX_RESPONSE_BODY_BYTES]` is applied before `_preview_response` truncation. Limits the stored `response_preview` to at most 16 KB of decoded text (see buffering limitation above).

---

## Test counts

| File | Tests |
|------|-------|
| `test_url_validator.py` | 22 (16 original + 5 IPv6 tunnel vectors + 1 hostname→6to4) |
| `test_health_check_service.py` | 12 (8 original + 4 new) |
| `test_readiness_service.py` | 14 (9 original + 5 new) |
| `test_readiness.py` | 12 (9 original + 3 new) |
| `test_health_checks.py` | 7 |
| `test_project_dashboard.py` | 11 |
| **Total** | **111** |

---

## Remaining medium/low findings (not fixed this milestone)

| # | Finding | Rationale for deferral |
|---|---------|------------------------|
| 8 | Readiness router prefix strategy inconsistent with projects router | No current bug; both register correctly. Consistency refactor deferred. |
| 10 | `seed_default_readiness_items` never updates existing catalog rows | By design: label/description edits need a migration, not a silent override. Document only. |
| 14 | Split import surface for `HealthCheckUrlSafetyError` | Minor; re-export in `__all__` kept for route-layer convenience. |
| 15 | Bounded-read test validates preview length, not wire buffering | Test is correct for current behaviour; will be redesigned when streaming is adopted. |
| 6 (body buffer) | Full response body buffered before slice | Requires streaming httpx reads; deferred as its own future slice. |
