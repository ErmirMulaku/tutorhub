# TutorHub API — NestJS on Cloud Run.
#
# IMPORTANT: build from the REPO ROOT, not this directory — the API is an
# npm-workspace package that depends on packages/*:
#   docker build -f services/api/Dockerfile -t tutorhub-api .
#
# The install is scoped to the @ermulaku/api workspace (+ root), so the image
# never pulls the front-end toolchains (Next, webpack, Storybook, Cypress).
#
# Cloud Run injects PORT (8080) and exposes exactly one port per container, so
# the gRPC microservice is disabled here via GRPC_ENABLED=false.

# ---- deps ------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /repo

# npm ci reconciles the lockfile against every workspace, so all manifests must
# be present — even the ones whose dependencies we then skip installing.
COPY package.json package-lock.json ./
COPY packages/api-client/package.json packages/api-client/
COPY packages/slot-engine/package.json packages/slot-engine/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/marketplace/package.json apps/marketplace/
COPY apps/mobile/package.json apps/mobile/
COPY services/api/package.json services/api/

# --ignore-scripts: `prisma generate` needs the schema, copied in the next stage.
RUN npm ci --ignore-scripts --no-audit --no-fund \
      --workspace=@ermulaku/api --include-workspace-root

# ---- build: Prisma client, then tsc for the API and the libs it imports -----
FROM node:22-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .

RUN npx prisma generate --schema services/api/prisma/schema.prisma

# Build the dependency chain directly with tsc (no Nx daemon inside the image).
RUN npm run build --workspace=@ermulaku/types \
 && npm run build --workspace=@ermulaku/slot-engine \
 && npm run build --workspace=@ermulaku/api

# ---- runtime: production dependencies only ---------------------------------
FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
# Cloud Run injects PORT=8080; default to it so the image is correct standalone.
ENV PORT=8080
ENV GRPC_ENABLED=false

COPY package.json package-lock.json ./
COPY packages/api-client/package.json packages/api-client/
COPY packages/slot-engine/package.json packages/slot-engine/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/marketplace/package.json apps/marketplace/
COPY apps/mobile/package.json apps/mobile/
COPY services/api/package.json services/api/

RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
      --workspace=@ermulaku/api --include-workspace-root

# Compiled output for the API and the workspace libs it imports.
COPY --from=build /repo/services/api/dist ./services/api/dist
COPY --from=build /repo/packages/types/dist ./packages/types/dist
COPY --from=build /repo/packages/slot-engine/dist ./packages/slot-engine/dist
# Schema + migrations, so `prisma migrate deploy` can run as a release step.
COPY --from=build /repo/services/api/prisma ./services/api/prisma
COPY --from=build /repo/services/api/prisma.config.ts ./services/api/prisma.config.ts
# gRPC contract (unused while GRPC_ENABLED=false, but the path is resolved at import).
COPY --from=build /repo/proto ./proto

USER node
EXPOSE 8080
CMD ["node", "services/api/dist/main.js"]
