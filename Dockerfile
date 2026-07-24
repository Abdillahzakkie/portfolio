# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Production image for the Next.js app (optional — Vercel is the primary target).
# Multi-stage, reproducible: the Node base tag and pnpm version are both pinned,
# and the build uses the frozen lockfile so a clean checkout and a warm one
# produce the same artifact. Pin the base image by digest in a regulated env.
#
# Requires next.config `output: 'standalone'` (already set) so the runtime stage
# copies only the minimal server bundle, not the full node_modules tree.
# ---------------------------------------------------------------------------
ARG NODE_IMAGE=node:24.11.0-alpine

# --- deps: install exactly what the lockfile pins --------------------------
FROM ${NODE_IMAGE} AS deps
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- builder: compile the Next.js standalone output ------------------------
FROM ${NODE_IMAGE} AS builder
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Telemetry off keeps builds hermetic and quiet; never bakes secrets into layers.
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- runner: minimal runtime, non-root ------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
# Standalone server + static assets only. Runtime secrets (MONGODB_URI,
# AUTH_SECRET, …) are injected at run time via env, never copied into the image.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
