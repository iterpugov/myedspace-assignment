# Build context is the repository root (npm workspaces, one lock file).

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci

FROM deps AS build
COPY packages/contracts packages/contracts
COPY web web
RUN npm run build -w web

FROM nginx:1.30-alpine AS runtime
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
