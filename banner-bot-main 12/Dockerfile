# ----------------------------------------------------------------------------
# Banner Bot — Railway image
#
# Puppeteer needs a real Chromium binary plus a handful of shared libs.
# We install Chromium from Debian Bookworm and tell Puppeteer to use it
# (PUPPETEER_SKIP_DOWNLOAD=true keeps the image small).
# ----------------------------------------------------------------------------
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-noto-color-emoji \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdrm2 \
      libgbm1 \
      libgtk-3-0 \
      libnss3 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxkbcommon0 \
      libxrandr2 \
      libxss1 \
      ca-certificates \
      tini \
   && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# Install dependencies first (better Docker layer caching).
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Then copy the rest of the source.
COPY . .

# Pre-create writable dirs (output/, output/logo-previews/) and hand them to
# the unprivileged `node` user.
RUN mkdir -p /app/output/logo-previews \
 && chown -R node:node /app

USER node

# Railway populates PORT; default to 3000 for local docker runs.
EXPOSE 3000

# Use tini as PID 1 so Chromium subprocesses get reaped on shutdown.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "start"]
