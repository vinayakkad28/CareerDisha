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

# Render (and most PaaS) inject $PORT and route traffic to it; a hardcoded
# port means the platform health check never connects. exec so uvicorn is
# PID 1 and receives SIGTERM for graceful shutdown.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
