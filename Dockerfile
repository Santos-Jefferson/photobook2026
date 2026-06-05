# syntax=docker/dockerfile:1

# ---------- build stage: install all deps + build the SPA ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Version (passed by the Makefile / Bamboo) — recorded as an image label.
ARG APP_VERSION=0.0.0

# Client config is baked into the bundle at build time (Vite). Optional — the
# defaults in src/config.js are used if these aren't provided.
ARG VITE_PHOTOBOOK_API_URL
ARG VITE_PHOTOBOOK_API_KEY
ENV VITE_PHOTOBOOK_API_URL=${VITE_PHOTOBOOK_API_URL}
ENV VITE_PHOTOBOOK_API_KEY=${VITE_PHOTOBOOK_API_KEY}

RUN npm run build

# ---------- runtime stage: only what the server needs ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5050
ARG APP_VERSION=0.0.0
LABEL org.opencontainers.image.title="photobook" \
      org.opencontainers.image.version="${APP_VERSION}"

# Production deps only (server uses msedge-tts + undici; the rest is bundled
# into dist/ already).
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App: built SPA + the server and shared lib.
COPY --from=build /app/dist ./dist
COPY server ./server
COPY lib ./lib

EXPOSE 5050
USER node
CMD ["node", "server/index.js"]
