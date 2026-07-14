# Deployment — Cloud Run (API) + Vercel (front-ends)

```
                         ┌───────────────────────────┐
  students  ─────────▶   │ Vercel · marketplace      │  Next.js SSR
                         └──────────┬────────────────┘
                                    │  API_URL
                         ┌──────────▼────────────────┐      ┌──────────────┐
  tutors    ─────────▶   │ Cloud Run · API (Docker)  │─────▶│  Cloud SQL   │
                         └──────────▲────────────────┘      │  (Postgres)  │
                                    │                       └──────────────┘
                         ┌──────────┴────────────────┐
                         │ Vercel · dashboard        │  static SPA
                         └───────────────────────────┘
                                    ▲
                         Stripe ────┘  webhook → https://<api>/stripe/webhook
```

The API **must** run on Cloud Run, not Vercel: it is a long-lived Nest server with
Socket.IO WebSockets and a Prisma pool, none of which survive serverless functions.

---

## 0. Prerequisites

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com
```

Pick a region and reuse it everywhere (examples use `europe-west1`).

## 1. Cloud SQL (Postgres)

```bash
gcloud sql instances create tutorhub-db \
  --database-version=POSTGRES_17 --tier=db-f1-micro --region=europe-west1
gcloud sql databases create tutorhub --instance=tutorhub-db
gcloud sql users create tutorhub --instance=tutorhub-db --password='<DB_PASSWORD>'
```

The Cloud Run connection string uses the **Unix socket**, not a host/port:

```
postgresql://tutorhub:<DB_PASSWORD>@localhost/tutorhub?host=/cloudsql/<PROJECT_ID>:europe-west1:tutorhub-db&schema=public
```

## 2. Secrets

```bash
for s in DATABASE_URL JWT_SECRET STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
  gcloud secrets create $s --replication-policy=automatic
done
# then add a version to each, e.g.
printf '%s' '<the connection string above>' | gcloud secrets versions add DATABASE_URL --data-file=-
```

Use a **strong** `JWT_SECRET` — not the `dev-only-change-me` default.

## 3. Build and push the API image

Build from the **repo root** (the API is an npm-workspace package):

```bash
gcloud artifacts repositories create tutorhub \
  --repository-format=docker --location=europe-west1

REG=europe-west1-docker.pkg.dev/<PROJECT_ID>/tutorhub
gcloud auth configure-docker europe-west1-docker.pkg.dev

docker build --platform linux/amd64 -f services/api/Dockerfile -t $REG/api:latest .
docker push $REG/api:latest
```

`--platform linux/amd64` matters on Apple Silicon — Cloud Run will not run an arm64 image.

## 4. Run the migrations

Migrations are a **release step**, never run on boot. From your machine, via the proxy:

```bash
cloud-sql-proxy <PROJECT_ID>:europe-west1:tutorhub-db &
DATABASE_URL='postgresql://tutorhub:<DB_PASSWORD>@localhost:5432/tutorhub?schema=public' \
  npx prisma migrate deploy --schema services/api/prisma/schema.prisma
```

## 5. Deploy the API to Cloud Run

```bash
gcloud run deploy tutorhub-api \
  --image=$REG/api:latest \
  --region=europe-west1 \
  --allow-unauthenticated \
  --add-cloudsql-instances=<PROJECT_ID>:europe-west1:tutorhub-db \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest \
  --set-env-vars=NODE_ENV=production,GRPC_ENABLED=false \
  --session-affinity                       # required for Socket.IO
```

Note the resulting URL, e.g. `https://tutorhub-api-xxxx.europe-west1.run.app`.

`GRPC_ENABLED=false` is essential: Cloud Run exposes exactly **one** port, and the gRPC
microservice binds a second one (`:50051`). It stays available locally.

## 6. Deploy the front-ends to Vercel

Create **two** Vercel projects from the same repo, each with a different **Root Directory**.
Both need **Node.js 22.x** in project settings — Next.js 16 fails to build on Node 18.
Each app's `vercel.json` already sets the install/build commands (they `cd` to the repo
root so npm workspaces + Nx resolve).

**marketplace** — Root Directory `apps/marketplace`

| Env var                              | Value                                         |
| ------------------------------------ | --------------------------------------------- |
| `API_URL`                            | `https://<api>.run.app` (server-side fetches) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…`                                   |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`       | your Google OAuth client id                   |

**dashboard** — Root Directory `apps/dashboard`

| Env var   | Value                   |
| --------- | ----------------------- |
| `API_URL` | `https://<api>.run.app` |

⚠️ The dashboard inlines `API_URL` at **build time** (webpack `DefinePlugin`). Changing it
requires a **redeploy**, not just an env edit.

## 7. Wire the three services together

Once you know the Vercel URLs, close the loop:

**a. Lock down CORS** (the API defaults to reflecting any origin):

```bash
gcloud run services update tutorhub-api --region=europe-west1 \
  --set-env-vars=CORS_ORIGINS=https://<marketplace>.vercel.app\,https://<dashboard>.vercel.app,DASHBOARD_URL=https://<dashboard>.vercel.app
```

`DASHBOARD_URL` is where Stripe Connect returns tutors after payout onboarding.

**b. Stripe webhook.** The local `stripe listen` secret does **not** work in production.
In the Stripe dashboard → Developers → Webhooks, add an endpoint:

- URL: `https://<api>.run.app/stripe/webhook`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`

Copy the **new** `whsec_…` into the `STRIPE_WEBHOOK_SECRET` secret and redeploy.

**c. Google OAuth.** Add the production origin to your OAuth client's
**Authorized JavaScript origins**: `https://<marketplace>.vercel.app`.

## Gotchas worth remembering

- **Node 22 everywhere.** Node 18 fails both the Next build and the API's `lru-cache`.
- **Build from the repo root.** `docker build -f services/api/Dockerfile .` — not from `services/api`.
- **`--platform linux/amd64`** when building on Apple Silicon.
- **Cloud Run = one port.** Hence `GRPC_ENABLED=false`.
- **Session affinity** is required or Socket.IO will keep dropping.
- **Never commit secrets.** `.env` / `.env.local` are gitignored; `.env.example` is committed,
  so keep it filled with empty placeholders only.
