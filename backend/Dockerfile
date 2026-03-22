FROM python:3.12-slim

# Install system dependencies for WeasyPrint (Pango, Cairo, GDK-Pixbuf)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
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

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
