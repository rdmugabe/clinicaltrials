# TrialHub frontend (Next.js 14). Proxies /api -> $BACKEND_URL at runtime.
# Build context is the REPO ROOT (npm-workspaces lockfile):
#   docker build -f frontend/Dockerfile -t trialhub-frontend .
#
# ---- build stage ----
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci

# next build (BACKEND_URL is read at server start, not needed at build time),
# then drop dev deps.
COPY frontend ./frontend
RUN npm run build --workspace=frontend \
  && npm prune --omit=dev

# ---- runtime stage ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3002

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/public ./frontend/public
COPY --from=build /app/frontend/next.config.js ./frontend/
COPY --from=build /app/frontend/package.json ./frontend/
COPY --from=build /app/package.json ./

EXPOSE 3002
# `next start` binds to $PORT (Render/host injects it) and reads BACKEND_URL
# from next.config.js at startup.
CMD ["npm", "--workspace=frontend", "run", "start"]
