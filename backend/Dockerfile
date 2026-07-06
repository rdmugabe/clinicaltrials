# TrialHub backend (Express + TypeScript, SQLite).
# Build context is the REPO ROOT (needed for the npm-workspaces lockfile):
#   docker build -f backend/Dockerfile -t trialhub-backend .
#
# ---- build stage: install everything + compile TS + native modules ----
FROM node:20-slim AS build
WORKDIR /app

# better-sqlite3 is a native addon — needs a C++ toolchain to compile.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

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

# SQLite lives on a mounted volume in production; create the dir for local runs.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3001
CMD ["node", "backend/dist/index.js"]
