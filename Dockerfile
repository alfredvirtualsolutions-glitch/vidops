# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base

# Install Python 3, FFmpeg, FFprobe, Git, curl, and Chromium dependencies for Remotion
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    git \
    curl \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create isolated Python virtual environment inside container
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install Node.js dependencies (use npm install to resolve Linux optional binaries from Windows lockfile)
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy application source
COPY . .

# Create output and media directories
RUN mkdir -p /app/basketball_output /app/clips /app/reels

EXPOSE 3000

CMD ["npm", "run", "dev"]
