# ═══════════════════════════════════════
# NOPE. — Dockerfile (multi-stage build)
# ═══════════════════════════════════════
# Build:  docker build -t nope .
# Run:    docker run --env-file .env -p 4000:4000 nope

# ── Stage 1: Build ──
FROM oven/bun:1 AS builder

WORKDIR /app

# Install deps first (layer cache)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN bun run build

# ── Stage 2: Runtime ──
FROM oven/bun:1-slim AS runtime

# Install ffmpeg (required for TTS audio conversion)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 nope && \
    useradd --uid 1001 --gid nope --shell /bin/sh --create-home nope

WORKDIR /app

# Copy package manifest and install production deps only
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile && \
    chown -R nope:nope /app

# Copy compiled output from builder
COPY --from=builder --chown=nope:nope /app/dist/ ./dist/

# Copy static assets (web dashboard)
COPY --from=builder --chown=nope:nope /app/src/web/public/ ./dist/web/public/

EXPOSE 4000

# Healthcheck: hit the server root every 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD bun -e "fetch('http://localhost:4000/').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

USER nope

CMD ["bun", "run", "dist/web/server.js"]
