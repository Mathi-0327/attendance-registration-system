# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Copy all source files
COPY . .

# Build frontend (Vite) and backend (esbuild via script/build.ts)
RUN npm run build

# ── Stage 2: Production runtime ──────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only copy what's needed for runtime
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Copy face-api model files (required at runtime)
COPY --from=builder /app/attached_assets ./attached_assets

# Expose the app port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/session || exit 1

# Non-root user for security
RUN addgroup -S attendreg && adduser -S attendreg -G attendreg
USER attendreg

CMD ["node", "dist/index.cjs"]
