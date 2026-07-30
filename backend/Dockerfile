# Use standard official Python slim image
FROM --platform=linux/amd64 python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/workspace

WORKDIR /workspace

# Install system dependencies needed for compiling python packages (e.g. pg_config, gcc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt /workspace/
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

# Copy backend application files
COPY . /workspace/backend

# Expose port (default for uvicorn)
EXPOSE 8000

# Default command to run FastAPI web app
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
