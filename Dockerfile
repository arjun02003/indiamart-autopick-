# ─── Build stage ───────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Frontend build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ─── Production stage ───────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Copy backend with dependencies
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

# Data volume mount point
VOLUME ["/app/backend/data"]

EXPOSE 3001
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/ || exit 1

CMD ["node", "backend/server.js"]
