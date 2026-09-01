# GitHub App Private Repository Support

## Product Scope

ProjectOps can attach repositories exposed through a user-authorized GitHub App
installation. The GitHub App is read-only and supports the existing Repository
Analysis workflow for public and private repositories.

This release does not add webhooks, automatic synchronization, repository
writes, organization administration, cloning, or long-lived user-token storage.

## GitHub App Setup

Create a GitHub App and configure:

- Callback URL: the hosted frontend `/app/github/callback` route.
- Request user authorization during installation: enabled.
- Repository contents permission: read-only.
- Repository metadata permission: read-only.
- No write permissions.
- No webhook events are required for this release.

Set the following backend runtime configuration:

- `PROJECTOPS_GITHUB_APP_CLIENT_ID`
- `PROJECTOPS_GITHUB_APP_CLIENT_SECRET`
- `PROJECTOPS_GITHUB_APP_ID`
- `PROJECTOPS_GITHUB_APP_SLUG`
- `PROJECTOPS_GITHUB_APP_PRIVATE_KEY`
- `PROJECTOPS_GITHUB_APP_CALLBACK_URL`

Configuration is all-or-nothing. ProjectOps rejects partial GitHub App
configuration and hides the connection action when it is not configured.

Do not commit the client secret or private key. For the selected Render hosting
path, store them only in Render's protected environment-variable settings. Keep
the multiline private-key formatting intact and never expose either value to
Vercel or a browser-visible `VITE_` variable. If the deployment returns to AWS,
follow the repository's AWS secret-safety requirements for runtime resolution.

## Authorization and Token Lifecycle

1. The authenticated backend produces a ten-minute signed OAuth state containing
   the ProjectOps user and Project identifiers.
2. GitHub redirects to the frontend callback with an authorization code.
3. The frontend submits the code and state through the authenticated API.
4. The backend rejects expired state or state belonging to another user.
5. The temporary GitHub user token is used to list installations accessible to
   that GitHub user, then discarded.
6. ProjectOps stores only installation/account identity.
7. Repository listing and analysis request short-lived installation tokens.

Tokens and private-key material are not returned through ProjectOps APIs,
stored in repository integration rows, included in Activity metadata, or logged
by this feature.

## Known Limitations

- Repository listing is limited to the first 100 repositories per installation.
- Revoked installations are reported as GitHub access failures until the user
  reconnects or removes the Project repository.
- Installation tokens are requested synchronously.
- There is no webhook-driven refresh or background synchronization.
