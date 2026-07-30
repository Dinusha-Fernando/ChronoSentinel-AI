# Stage 1: Build the React frontend
FROM --platform=linux/amd64 node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Run Python FastAPI backend
FROM --platform=linux/amd64 python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Install python dependencies
COPY backend/requirements.txt /workspace/
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

# Copy backend files
COPY backend/ /workspace/backend/

# Copy frontend static files
COPY --from=frontend-builder /app/dist /workspace/frontend/dist

# Expose FastAPI port
EXPOSE 80

# Default command to run FastAPI web app on port 80
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "80"]
