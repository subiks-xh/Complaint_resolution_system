# syntax=docker/dockerfile:1

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ENV VITE_API_BASE_URL=/api
ENV VITE_API_URL=/api
RUN npm run build

FROM node:20-alpine AS backend
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ../frontend/dist

ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0
EXPOSE 5000

CMD ["node", "server.js"]
