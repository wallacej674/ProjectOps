# Authentication and Project Ownership

Milestone 22 adds the first real identity boundary for ProjectOps: local
email/password accounts, JWT bearer authentication, and account-owned Projects.
It intentionally stays smaller than a production identity platform.

## Scope

Implemented:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- Argon2 password hashing through `pwdlib`.
- Signed JWT bearer access tokens through `PyJWT`.
- Protected Project, activity, readiness, repository, analysis, health, and
  artifact routes.
- Account-owned Project creation and listing.
- Per-user demo workspace seeding outside production.
- Production-disabled demo seeding.
- Fixed-window rate limiting for login, registration, demo seed, CodeMap run,
  and manual health-check run endpoints.

Not implemented:

- Teams or organizations.
- Roles or fine-grained permissions.
- OAuth or SSO.
- Password reset.
- Refresh tokens.
- Account administration.
- Audit-grade identity history.

## Backend Model

Users are stored in `users` with normalized unique email, optional display name,
password hash, status, and timestamps. Projects now have nullable
`owner_user_id`. The nullable column keeps existing local rows migratable, while
all Projects created through the authenticated API receive the current user's
ID.

Services and repositories accept owner filters where user-facing routes need
visibility boundaries. Project child routes first verify ownership before
delegating to existing repository, analysis, health, readiness, artifact, and
activity behavior.

## Token Behavior

Access tokens are signed JWT bearer tokens. The backend requires
`PROJECTOPS_AUTH_SECRET_KEY` in production and rejects the checked-in local
development placeholder when `PROJECTOPS_ENVIRONMENT` is `production` or
`prod`.

```text
PROJECTOPS_AUTH_SECRET_KEY=<strong random secret>
PROJECTOPS_ACCESS_TOKEN_EXPIRE_MINUTES=60
```

Rotating the secret invalidates existing access tokens. `POST /logout` is a
client-side session clear acknowledgement; the backend does not keep a token
denylist in this milestone.

## Frontend Session Boundary

The frontend stores the access token and current user in `localStorage`, then
adds `Authorization: Bearer <token>` to protected API requests. It deliberately
does not attach bearer tokens to auth endpoints, public demo status, or health
checks.

`localStorage` is a pragmatic local/demo choice. Future production hardening
should revisit token storage, expiration UX, refresh behavior, cross-tab
session handling, CSRF/XSS posture, shared-store rate limiting, and request
size limits.

## Demo Data

`GET /api/v1/demo-data/status` remains public so empty-state UI can decide
whether to show the demo action. `POST /api/v1/demo-data/seed` checks the
production guard first; production returns 403 whether or not a token is sent.
Outside production, seeding requires authentication and is idempotent per user.

Demo records remain sample data only. They do not call live GitHub, run live
health checks, process files, use AI, or certify production safety.

## Testing Notes

Backend tests cover registration, login, token validation, `/me`, logout,
auth configuration, rate limiting, protected route rejection, cross-user Project
isolation, child-route ownership checks, CORS authorization preflight, and demo
seeding.

Frontend tests cover auth API helpers, bearer-token request behavior, protected
routes, public-only auth redirects, sign in, sign out, and account display.
