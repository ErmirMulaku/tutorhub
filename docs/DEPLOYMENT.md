# Deployment — AWS App Runner (API) + Vercel (front-ends)

```
                         ┌───────────────────────────┐
  students  ─────────▶   │ Vercel · marketplace      │  Next.js SSR
                         └──────────┬────────────────┘
                                    │  API_URL
                         ┌──────────▼────────────────┐      ┌──────────────┐
  tutors    ─────────▶   │ AWS App Runner · API      │─────▶│  Postgres    │
                         │ (Docker image from ECR)   │      │  (e.g. RDS)  │
                         └──────────▲────────────────┘      └──────────────┘
                                    │
                         ┌──────────┴────────────────┐
                         │ Vercel · dashboard        │  static SPA
                         └───────────────────────────┘
                                    ▲
                         Stripe ────┘  webhook → https://<api>/stripe/webhook
```

The API runs as a **long-lived container on AWS App Runner** (a Nest server with
Socket.IO WebSockets and a Prisma pool). App Runner pulls the image from **Amazon
ECR**; the front-ends are Next.js/SPA builds on **Vercel**.

---

## How it ships (CI/CD)

Four GitHub Actions workflows in `.github/workflows/`, each triggered by a push to
`master` that touches the relevant paths (plus manual `workflow_dispatch`):

| Workflow                 | Target                   | What it does                                                                                                                                                                                                |
| ------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deploy-api.yml`         | AWS App Runner (via ECR) | Builds `services/api/Dockerfile` (context = repo root, `linux/amd64`), pushes to ECR (`:<sha>` + `:latest`), runs `aws apprunner start-deployment`, polls the operation, then smoke-checks `POST /graphql`. |
| `deploy-marketplace.yml` | Vercel (marketplace)     | `vercel deploy --prod` for the marketplace project.                                                                                                                                                         |
| `deploy-dashboard.yml`   | Vercel (dashboard)       | `vercel deploy --prod` for the dashboard project.                                                                                                                                                           |
| `deploy-storybook.yml`   | Vercel (Storybook)       | `vercel deploy --prod` for the `@ermulaku/ui` Storybook static build.                                                                                                                                       |

The API workflow authenticates to AWS with **GitHub OIDC** — it assumes an IAM role,
so there are **no long-lived AWS keys** in GitHub.

⚠️ **Disable Vercel's own Git integration** for both Vercel projects, or every merge
deploys twice (once from Vercel's git hook, once from the workflow). Project Settings
→ Git → disconnect, or set `"git": { "deploymentEnabled": false }` in the app's
`vercel.json`.

---

## 1. One-time infrastructure

### AWS (API)

- **ECR repository** — create it and set the GitHub **repo variable** `ECR_REPOSITORY`
  (e.g. `tutorhub-api`). Everything uses region **`eu-central-1`**.
- **App Runner service** — source = that ECR repository, port **4000** (or `PORT`),
  health-check path **`/health`** (liveness — do **not** use `/ready`, which is
  DB-gated and would block deploys when the DB blips). Record its ARN as the GitHub
  **secret** `APPRUNNER_SERVICE_ARN`.
- **GitHub OIDC deploy role** — an IAM role GitHub can assume, trusted for this repo,
  allowing `ecr:*` on the repo plus `apprunner:StartDeployment`,
  `apprunner:DescribeService`, and `apprunner:ListOperations`. Record its ARN as the
  GitHub **secret** `AWS_DEPLOY_ROLE_ARN`.

GitHub config the API workflow expects:

| Kind     | Name                    |
| -------- | ----------------------- |
| secret   | `AWS_DEPLOY_ROLE_ARN`   |
| secret   | `APPRUNNER_SERVICE_ARN` |
| variable | `ECR_REPOSITORY`        |

### Database (Postgres)

A managed Postgres instance — **Amazon RDS for PostgreSQL** is the natural fit. The
app connects via `DATABASE_URL`. App Runner reaches a **private** RDS through a **VPC
connector**; if the instance is publicly reachable instead, lock it down by security
group and use strong credentials. Migrations are a manual release step (see §4).

### Vercel (front-ends + Storybook)

Three Vercel projects from this repo, each with a different **Root Directory**
(`apps/marketplace`, `apps/dashboard`, `packages/ui`) and **Node.js 22.x** (Next 16
fails on Node 18). Each project's `vercel.json` already sets the install/build
commands (they `cd` to the repo root so npm workspaces + Nx resolve). GitHub config
the Vercel workflows expect:

| Kind     | Name                            |
| -------- | ------------------------------- |
| secret   | `VERCEL_TOKEN`                  |
| variable | `VERCEL_ORG_ID`                 |
| variable | `VERCEL_PROJECT_ID_MARKETPLACE` |
| variable | `VERCEL_PROJECT_ID_DASHBOARD`   |
| variable | `VERCEL_PROJECT_ID_STORYBOOK`   |

---

## 2. Runtime configuration — App Runner (API)

Set these on the App Runner service's **instance configuration** (Console → your
service → Configuration → Edit → Environment, or `aws apprunner update-service`).
Store plain values as **environment variables** and credentials as **runtime
secrets** that reference **AWS Secrets Manager** (or SSM Parameter Store). Saving a
change triggers an App Runner redeployment.

> The App Runner **instance role** must be allowed to read the referenced secrets
> (`secretsmanager:GetSecretValue`, or `ssm:GetParameters` for SSM).

| Key                     | Kind   | Value / notes                                                                                                                               |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | secret | Postgres connection string.                                                                                                                 |
| `JWT_SECRET`            | secret | Long random value — not the `dev-only-change-me` default.                                                                                   |
| `STRIPE_SECRET_KEY`     | secret | `sk_…` (test or live). Omit to disable payments.                                                                                            |
| `STRIPE_WEBHOOK_SECRET` | secret | `whsec_…` from the production webhook endpoint (§5).                                                                                        |
| `OPENAI_API_KEY`        | secret | Powers the booking assistant (`/assistant/chat`). **Omit → the endpoint returns 503.** Only the API calls OpenAI; never put this on Vercel. |
| `OPENAI_MODEL`          | env    | Optional; defaults to `gpt-4o-mini`.                                                                                                        |
| `NODE_ENV`              | env    | `production`.                                                                                                                               |
| `GRPC_ENABLED`          | env    | `false` — App Runner exposes exactly one port; the gRPC microservice binds `:50051`.                                                        |
| `CORS_ORIGINS`          | env    | `https://<marketplace>,https://<dashboard>` (the API otherwise reflects any origin).                                                        |
| `DASHBOARD_URL`         | env    | `https://<dashboard>` — where Stripe Connect returns tutors after payout onboarding.                                                        |

**Adding the OpenAI key** (the API, not Vercel):

```bash
# 1. Store the key in Secrets Manager (run this yourself; the value never leaves AWS).
aws secretsmanager create-secret --name tutorhub/openai-api-key \
  --secret-string 'sk-REPLACE_ME' --region eu-central-1
# (already exists? use: aws secretsmanager put-secret-value --secret-id tutorhub/openai-api-key --secret-string 'sk-…')

# 2. Reference it as a runtime secret on the service:
#    Console → App Runner → your service → Configuration → Edit → Environment
#      → Add environment secret:
#        OPENAI_API_KEY = arn:aws:secretsmanager:eu-central-1:<acct-id>:secret:tutorhub/openai-api-key
#    Saving redeploys the service. Once live, /assistant/chat stops returning 503.
```

---

## 3. Runtime configuration — Vercel (front-ends + Storybook)

**marketplace** — Root Directory `apps/marketplace`

| Env var                              | Value                                                            |
| ------------------------------------ | ---------------------------------------------------------------- |
| `API_URL`                            | `https://<app-runner-service-url>` (server-side fetches)         |
| `TUTOR_APP_URL`                      | `https://<dashboard>` — "Become a tutor" links to its `/signup`. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_…`                                                           |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`       | your Google OAuth client id                                      |

`TUTOR_APP_URL` is read server-side (in `Header`) and passed to the client menu, so
an env edit + redeploy is enough. Without it, the "Become a tutor" links fall back to
`http://localhost:3100`.

**dashboard** — Root Directory `apps/dashboard`

| Env var   | Value                              |
| --------- | ---------------------------------- |
| `API_URL` | `https://<app-runner-service-url>` |

⚠️ The dashboard inlines `API_URL` at **build time** (webpack `DefinePlugin`).
Changing it requires a **redeploy**, not just an env edit.

> The App Runner **service URL** (`aws apprunner describe-service … Service.ServiceUrl`)
> has no scheme — use `https://<ServiceUrl>` (or a custom domain) for `API_URL`.

**Storybook** — Root Directory `packages/ui`. No env vars; it's a static build of
the component catalog (`npx nx build-storybook @ermulaku/ui` → `storybook-static`),
so nothing to configure beyond the project itself (see §1).

---

## 4. Migrations

Migrations are a **release step**, never run on boot or in the deploy workflow (an
auto-migrate on every merge can drop/rewrite columns with no review). Run them
yourself against a reachable database **before** merging the schema change:

```bash
DATABASE_URL='<prod url>' \
  npx prisma migrate deploy --schema services/api/prisma/schema.prisma
```

Because the API workflow auto-deploys, a merge containing both a migration and the
code that needs it ships the code first — so **migrate, then merge**.

---

## 5. Wire the services together

Once the App Runner and Vercel URLs exist, close the loop:

**a. CORS + Connect return URL.** Set `CORS_ORIGINS` and `DASHBOARD_URL` on the App
Runner service (§2) to the real Vercel origins.

**b. Stripe webhook.** The local `stripe listen` secret does **not** work in
production. In the Stripe dashboard → Developers → Webhooks, add an endpoint:

- URL: `https://<api>/stripe/webhook`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`

Put the new `whsec_…` into the `STRIPE_WEBHOOK_SECRET` secret; App Runner redeploys.

**c. Google OAuth.** Add the production origin to your OAuth client's **Authorized
JavaScript origins**: `https://<marketplace>`.

---

## Gotchas worth remembering

- **Node 22 everywhere.** Node 18 fails both the Next build and the API's `lru-cache`.
- **Build from the repo root.** The API is an npm-workspace package —
  `docker build -f services/api/Dockerfile .`, not from `services/api`.
- **`linux/amd64`.** App Runner is x86_64; an arm64 image (Apple Silicon / arm runner)
  will not start. The workflow already pins the platform.
- **App Runner = one port.** Hence `GRPC_ENABLED=false`.
- **Socket.IO + autoscaling.** App Runner has no sticky sessions, so scaling past one
  instance needs a shared adapter (e.g. Redis) or the client's long-polling fallback.
- **Health check `/health`, not `/ready`.** `/ready` is DB-gated and would fail deploys
  during a DB blip.
- **Never commit secrets.** `.env` / `.env.local` are gitignored; `.env.example` is
  committed, so keep it filled with empty placeholders only.
