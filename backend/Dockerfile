# Base image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies needed for compiling packages
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files into /app/backend to maintain package structure
COPY . /app/backend/

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PORT=8000

# Expose port
EXPOSE 8000

# Run FastAPI app binding to the PORT environment variable passed by Render
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}
