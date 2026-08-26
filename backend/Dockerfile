FROM python:3.12-slim

# Install system dependencies for WeasyPrint (Pango, Cairo, GDK-Pixbuf)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libcairo2 \
    libffi-dev \
    libglib2.0-0 \
    fonts-noto \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create output directory
RUN mkdir -p /tmp/output

ENV OUTPUT_DIR=/tmp/output
ENV PORT=8000

EXPOSE 8000

# Migrations run here rather than in a Render preDeployCommand, which requires a
# paid instance type. The app refuses to start against an unmigrated database, so
# these two must stay together.
#
# $PORT is injected by the platform and must be honoured — a hardcoded port means
# the health check never connects. exec keeps uvicorn as PID 1 so it receives
# SIGTERM and shuts down gracefully.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
