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
COPY api api
RUN npm run build -w api

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/api
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
