# Worker de InmoPanel. Se construye desde la raíz del repositorio (ver docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/shared/package.json backend/shared/
COPY backend/worker/package.json backend/worker/
COPY frontend/package.json frontend/
RUN npm ci --workspace @inmogest/worker --workspace @inmogest/shared --include-workspace-root=false
COPY tsconfig.base.json ./
COPY backend/shared backend/shared
COPY backend/worker backend/worker
RUN npm run build -w @inmogest/shared && npm run build -w @inmogest/worker

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/shared/package.json backend/shared/package.json
COPY --from=build /app/backend/shared/dist backend/shared/dist
COPY --from=build /app/backend/worker/package.json backend/worker/package.json
COPY --from=build /app/backend/worker/dist backend/worker/dist
USER node
CMD ["node", "backend/worker/dist/index.js"]
