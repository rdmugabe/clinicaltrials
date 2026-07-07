# TrialHub backend (Express + TypeScript, SQLite).
# Build context is the REPO ROOT (needed for the npm-workspaces lockfile):
#   docker build -f backend/Dockerfile -t trialhub-backend .
#
# ---- build stage: install everything + compile TS + native modules ----
FROM node:20-slim AS build
WORKDIR /app

# better-sqlite3 is a native addon — needs a C++ toolchain to compile.
# wget + ca-certificates let us fetch the Litestream binary below.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Litestream — continuous SQLite replication to S3-compatible storage. Fetched
# here (build stage has the tools) and copied into the slim runtime image. Only
# actually used at runtime when LITESTREAM_* env vars are set (see entrypoint).
ARG TARGETARCH=amd64
ARG LITESTREAM_VERSION=0.3.13
RUN wget -qO /tmp/litestream.tar.gz \
    "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-${TARGETARCH}.tar.gz" \
  && tar -xzf /tmp/litestream.tar.gz -C /usr/local/bin litestream \
  && rm /tmp/litestream.tar.gz

# Install against the monorepo lockfile (all workspace manifests must be present).
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

# Compile the backend (tsc -> backend/dist), then drop dev dependencies.
# `npm prune` removes dev deps without recompiling the already-built native addon.
COPY backend ./backend
RUN npm run build --workspace=backend \
  && npm prune --omit=dev

# ---- runtime stage: slim image, no build tools ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    DATA_DIR=/data

# Prod deps (incl. the compiled better-sqlite3) + built output + manifests.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/package.json ./

# Litestream binary + config + entrypoint (backups are opt-in via env vars).
COPY --from=build /usr/local/bin/litestream /usr/local/bin/litestream
COPY backend/litestream.yml /etc/litestream.yml
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# SQLite lives on a mounted volume in production; create the dir for local runs.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3001
# The entrypoint runs the app under Litestream when LITESTREAM_* is configured,
# otherwise runs node directly — so local/dev images work with no S3 setup.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
