# Private beta hosting research

Verified 2026-09-08 against official vendor documentation and the Render pricing page rendered in a browser. Research only: no account inspection, resource creation, configuration changes, or credential access.

## Recommended deployment shape

Keep the repository's existing Render backend / Vercel frontend split. Add one always-on Render background worker for `python -m app.jobs.run_readiness_workflows`, using the same commit, database, model configuration, and runtime provider key as the API. The health scheduler remains a separate cron job. This is a recommendation based on the repository's durable database-backed workflow implementation, not a requirement to buy a new queue service.

Use one API instance and one worker initially. Treat 512 MB as a trial sizing assumption: measure peak memory during scans and simultaneous beta requests before admitting participants. More CPU/RAM may be necessary for analysis workloads.

## Blueprint compatibility

`0.5c-512mb` is valid for web, worker, and cron services; `0.5c-1g` is valid for Postgres. Ohio is supported. Use `type: worker`, Docker runtime, and `dockerCommand` to override the image's API command. Keep Postgres `ipAllowList: []` to block external database access. The database connection reference provides the private connection URL. [Render Blueprint reference](https://render.com/docs/blueprint-spec)

`rootDir: backend` makes Dockerfile/context paths relative to `backend`, so the existing `./Dockerfile` and `.` are appropriate. Changes outside that root normally do not trigger service builds; Blueprint changes are still processed. [Render monorepo support](https://render.com/docs/monorepo-support)

API and worker can share values through `fromService` references, including other environment variables. References update on Blueprint sync, not immediately when a source changes. `sync: false` prompts only on initial creation; new variables on existing services must be configured manually. Environment groups cannot contain `sync: false` or references to service values. Keep runtime provider keys out of committed YAML. [Render Blueprint environment variables](https://render.com/docs/blueprint-spec#setting-environment-variables)

## Migration and startup ordering

Render runs pre-deploy commands after building and before starting that service. They run on a separate instance; failures stop that deployment and leave an existing successful deployment running. Paid API and worker services support them. [Render deployment lifecycle](https://render.com/docs/deploys#pre-deploy-command)

Recommendation: keep the API as the single migration owner. Add a bounded schema-readiness check before the worker and health cron begin database work. Do not infer that referring to the API's environment variables guarantees that the API's migration has completed. The documented per-service lifecycle does not establish a cross-service migration barrier. For the initial release, verify successful API migrations, then worker startup, then frontend smoke checks. Keep subsequent migrations compatible with the previously deployed service version during rolling updates.

## Monthly estimate

Assumptions: one operator, one always-on API, one always-on worker, one 1 GB Postgres instance with 15 GB disk, a health run every five minutes, 30 days, one Vercel deploying seat, low beta traffic, and no optional paid add-ons. All amounts are USD before taxes. These are planning estimates, not a hard spending cap.

| Item | Estimate / month |
| --- | ---: |
| Render API, `0.5c-512mb` | $7.00 |
| Render worker, `0.5c-512mb` | $7.00 |
| Render Postgres, `0.5c-1g` | $19.00 |
| 15 GB database disk, conservative allowance | $4.50 |
| Health cron, average 30 seconds per run | $1.00 |
| Render Hobby workspace, one operator | $0.00 |
| Vercel Pro, one deploying seat | $20.00 |
| **Base planning total** | **$58.50** |

The official Render pricing table shows $7 services/workers, $19 database compute, $0.30/GB expandable Postgres storage, and $0.00016/minute cron compute. It also mentions 1 GB included storage; budgeting all 15 GB is conservative by up to $0.30 pending the checkout estimate. Do not confuse database storage with service disks priced separately at $0.25/GB. [Render pricing](https://render.com/pricing)

Cron calculation: 8,640 runs/month times 0.5 minute times $0.00016 = $0.6912, raised to the $1 minimum. At one minute/run it is approximately $1.38. Runtime is prorated by the second; very long jobs are stopped at 12 hours. [Cron billing](https://render.com/docs/cronjobs#compute-plans-and-billing)

A Render Pro workspace adds $25/month, making the same estimate $83.50. A solo Hobby workspace supports one operator and up to 25 services; Pro is needed for multiple hosting collaborators or features such as environment isolation. Application testers do not need hosting collaborator seats. [Render workspace features](https://render.com/docs/platform-features-by-plan), [Render pricing](https://render.com/pricing)

Vercel Hobby is restricted to personal, non-commercial use. A beta for a product intended to become a business should use Pro. Pro's $20 monthly platform fee includes one deploying seat and $20 infrastructure usage credit; additional deploying seats cost $20 each. Application testers are users of ProjectOps, not paid deployment seats. [Vercel Hobby restrictions](https://vercel.com/docs/plans/hobby), [Vercel Pro pricing](https://vercel.com/docs/plans/pro-plan)

Provider AI usage, excess bandwidth/build usage, additional seats, domains, and any larger instance sizes are extra. A sensible initial planning envelope is $65/month plus a separately approved AI allowance for the solo setup, or $90/month plus AI with Render Pro. This envelope is a recommendation and has not been authorized or configured.

## Spending controls and operational limits

Disable automatic database disk growth for a tightly bounded beta and review storage usage daily, or explicitly budget for automatic growth. With autoscaling enabled, 90% usage triggers a permanent approximately 50% increase rounded to five GB; disks cannot shrink. Turning it off trades predictable allocation for the need to intervene before the disk fills. [Render Postgres storage](https://render.com/docs/postgresql-creating-connecting#adding-storage)

Set Render's build-pipeline spending limit, but do not describe it as a total account budget: it controls additional pipeline work, not every running-service charge. Keep preview environments off and instance counts fixed; check the billing dashboard during the pilot. [Render build pipeline](https://render.com/docs/build-pipeline)

Enable Vercel spend notifications and the explicit pause-production action for a chosen excess-usage amount. Merely setting the amount does not stop usage. Checks can lag by several minutes, and the control excludes seats, integrations, and add-ons. It also does not stop the separately hosted Render backend or its AI worker. [Vercel spend management](https://vercel.com/docs/spend-management)

## Remaining launch decisions

- Confirm the Render workspace tier and the $58.50 or $83.50 base estimate in the actual creation screen before committing recurring spend.
- Confirm the Git branch/commit and the frontend/API URLs; apply the exact frontend origin to CORS.
- Configure the provider key privately in the hosting runtime and verify API/worker agree on the evaluated model configuration.
- Complete invitation-only application access, startup/migration checks, worker completion, restart persistence, and participant smoke tests before inviting users.
- Set a separate beta AI budget; the prior $1 authorization covered evaluation, not ongoing beta traffic.

No deployment has occurred as part of this research.
