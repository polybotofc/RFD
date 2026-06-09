# RFD Platform - Complete Dockerfile
# Multi-stage build for optimized production image

# =====================
# Stage 1: Dependencies
# =====================
FROM node:20-alpine AS deps

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY backend/package.json backend/package-lock.json* ./
COPY frontend/package.json frontend/package-lock.json* ./

# Install backend dependencies
RUN cd backend && npm ci --only=production

# Install frontend dependencies
RUN cd frontend && npm ci

# =====================
# Stage 2: Backend Build
# =====================
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend/package*.json ./

WORKDIR /app/backend

# Build backend (none needed for Node.js, but keeping for extensibility)
RUN npm run build || true

# =====================
# Stage 3: Frontend Build
# =====================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY frontend/package*.json ./

WORKDIR /app/frontend

# Copy source code
COPY frontend/ ./

# Build Next.js
RUN npm run build

# =====================
# Stage 4: Production
# =====================
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create necessary directories
RUN mkdir -p /app/data /app/games /app/thumbnails /app/logs /app/uploads/games /app/uploads/thumbnails && \
    chown -R nextjs:nodejs /app

# Copy backend
COPY --from=backend-builder /app/backend ./backend

# Copy frontend build output
COPY --from=frontend-builder /app/frontend/.next ./.next
COPY --from=frontend-builder /app/frontend/public ./public
COPY --from=frontend-builder /app/frontend/src/styles ./src/styles

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV API_PORT=3001

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Switch to non-root user
USER nextjs

# Start both services using a script
COPY <<-EOF /app/start.sh
#!/bin/sh
set -e

# Start backend
cd /app/backend
node src/server.js &
BACKEND_PID=$!

# Start frontend
cd /app
exec npm run start
EOF

RUN chmod +x /app/start.sh

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["/app/start.sh"]