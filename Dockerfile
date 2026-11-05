# =============================================================================
# Stage 1: Build React 19 Frontend SPA
# =============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# =============================================================================
# Stage 2: Unified Production Full-Stack Container (FastAPI + React)
# =============================================================================
FROM python:3.12-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy compiled frontend from Stage 1 into the expected frontend/dist directory
COPY --from=frontend-builder /build/dist ./frontend/dist

# Expose combined port
EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/health || exit 1

# Start combined application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

