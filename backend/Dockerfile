FROM python:3.12-slim

# Install system dependencies for WeasyPrint (Pango, Cairo, GDK-Pixbuf)
#
# fonts-noto-core + fonts-noto-devanagari, NOT the fonts-noto metapackage. The
# metapackage pulls in thousands of font files covering every script, and the
# templates ask for 'Noto Sans' / 'Noto Sans Devanagari' by family name — which
# forces fontconfig to scan the lot. On a 0.1-CPU / 512MB instance with a cold
# cache that scan took minutes and spiked RSS hard enough to get the worker
# OOM-killed mid-response: the compliance certificate and the parent circular
# both died with a dropped connection, while the JSON variant of the same
# endpoint returned 200. These two are the documents that collect the fee and
# satisfy CBSE, so they cannot be the slowest things in the image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libcairo2 \
    libffi-dev \
    libglib2.0-0 \
    fontconfig \
    fonts-noto-core \
    fonts-noto-devanagari \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

WORKDIR /app

# NOTE: paths below are relative to the REPOSITORY ROOT, not to backend/.
# Render builds with the repo root as the Docker context (its "Root Directory"
# setting does not change the context when a Dockerfile Path is given), so
# `COPY requirements.txt .` fails with "/requirements.txt": not found.
# Keep the backend/ prefix and leave Root Directory blank in the dashboard.

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .

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
