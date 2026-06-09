FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=9090
ENV SERVE_FRONTEND=true
ENV FRONTEND_DIST_DIR=../../frontend/dist
ENV FIRST_PARTY_ANALYTICS_DIR=/data/first-party-analytics

COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend ./
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
RUN mkdir -p /data/first-party-analytics

EXPOSE 9090
CMD ["node", "src/server.js"]
