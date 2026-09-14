# syntax=docker/dockerfile:1

###############################################################################
# MovieFlix web
#
# Builds on Next.js `output: 'standalone'`, which traces the modules the server
# actually imports and emits a self-contained bundle. The runtime stage then
# carries no `node_modules` at all — roughly 200MB instead of 1GB.
###############################################################################

FROM node:22.14-bookworm-slim AS base
WORKDIR /app

# --- dependencies ------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# --- build -------------------------------------------------------------------
FROM deps AS build

# `NEXT_PUBLIC_*` is compiled into the browser bundle, so it has to exist HERE,
# at build time — passing it at `docker run` is too late and leaves the client
# pointing at whatever was baked in. That also means an image is specific to the
# API URL it was built for: a new backend URL needs a rebuild, not a restart.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
ARG NEXT_PUBLIC_APP_NAME=MovieFlix
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_TIMEOUT_MS=15000

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_API_TIMEOUT_MS=$NEXT_PUBLIC_API_TIMEOUT_MS

# `src/lib/env.ts` validates at import time and the build imports it, so a
# missing variable fails the build rather than the first request in production.
ENV API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Telemetry is opt-out, and a build container is not a useful thing to measure.
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN npm run build

# --- runtime -----------------------------------------------------------------
FROM base AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # The standalone server binds to localhost unless told otherwise, which
    # inside a container means nothing outside it can ever connect.
    HOSTNAME=0.0.0.0

# Static assets and `public/` sit outside the traced bundle and must be placed
# where the standalone server expects to find them.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `server.js` is what `output: 'standalone'` emits; there is no `next start` here.
CMD ["node", "server.js"]
