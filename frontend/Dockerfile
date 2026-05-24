# Production: build once in the image; start serves static SPA in seconds (no `npm install` on every boot).
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Defaults match docker-compose: browser talks to Laravel on host port 8001 (`backend` publishes 8001:8000).
# Relative `/api` only works with Vite dev proxy or a reverse proxy — not with plain `serve`.
ARG VITE_API_BASE_URL=
ARG VITE_BACKEND_ORIGIN=http://localhost:8001
ARG VITE_STORAGE_MEDIA_ORIGIN=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BACKEND_ORIGIN=$VITE_BACKEND_ORIGIN
ENV VITE_STORAGE_MEDIA_ORIGIN=$VITE_STORAGE_MEDIA_ORIGIN

RUN npm run build

FROM node:20-alpine

WORKDIR /app
RUN npm install -g serve@14.2.4

COPY --from=build /app/dist ./dist

EXPOSE 5173

# Listen on all interfaces — default bind can be loopback-only and Docker will show 0% CPU / no reachable port.
CMD ["serve", "-s", "dist", "--no-port-switching", "-l", "tcp://0.0.0.0:5173"]
