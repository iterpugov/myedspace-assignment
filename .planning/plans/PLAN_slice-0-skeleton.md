# PLAN — Slice 0 «Skeleton»

> Produced by the `planner` subagent on 2026-10-01 and saved unchanged. Open decisions in
> section 2 are the user's to make.

Slice 0 delivers an empty but fully wired stack: npm workspaces, NestJS API, React SPA, the types-only contracts package, Prisma with a baseline migration, and four compose services. It is blocked on three toolchain decisions (section 2), because the npm `latest` tags have moved since the ADRs were written and two of them conflict with ADR 013.

Nothing in the repo was changed. Experiments ran only in the session scratchpad.

## 1. Goal and done criteria

**Goal:** from a clean clone, `docker compose up` starts `db` → `migrate` → `api` → `web`, and the SPA page shows a health response from the API that ran a query against PostgreSQL.

**Requirements covered:** DEL-2, TEC-1, TEC-2.

| # | Criterion | Check |
|---|-----------|-------|
| 1 | Stack starts with one command, with no `.env` file present | `docker compose up --build -d --wait` exits 0 |
| 2 | Migration step ran and succeeded before the API started | `docker compose ps -a` shows `migrate` as `Exited (0)`; its logs show the baseline migration applied |
| 3 | API reaches the database | `curl -s localhost:<port>/api/health` returns `{"status":"ok","database":"up"}` |
| 4 | SPA loads and shows that response | Open `http://localhost:<port>/`; the page shows "API ok · database up" |
| 5 | History fallback works | `curl -s -o /dev/null -w '%{http_code}' localhost:<port>/some/deep/route` returns 200 |
| 6 | API 404s are not swallowed by the SPA | `curl -s localhost:<port>/api/nope` returns the NestJS 404 JSON |
| 7 | Only `web` publishes a port | `docker compose ps` shows a host port on `web` only |
| 8 | Test runners are wired | `npm test -w api` and `npm test -w web` each pass one smoke test |
| 9 | Nothing generated or secret is tracked | `git status --short` after build and test shows no `node_modules`, `dist`, generated client or `.env` |

**Out of scope:** domain models, catalogue, seed data, auth, module logic, Testcontainers wiring (first integration test, slice 1 or 2), React Hook Form (first form, slice 2), README content (slice 6).

## 2. Open decisions

### Needs your call before any code

Registry facts below were checked today with `npm view` and by unpacking the published packages.

**D1 — NestJS major and API module format.**
`@nestjs/core@latest` is 12.1.2 (GA 2026-08-27) and is ESM-only (`"type": "module"`). The Nest 12 project template defaults to ESM with Vitest; its CommonJS variant keeps Jest but runs it under `node --experimental-vm-modules`. The claim "NestJS compiles to CommonJS by default" is no longer true on 12. Nest 11.2.7 is published under the `legacy` tag and was patched on 2026-09-30.

| Option | Trade-off |
|---|---|
| A. Nest 11.2.7, CommonJS, Jest + ts-jest, TypeScript 5.9.3 | ADR 013 holds as written and nothing is experimental. It is the previous major. |
| B. Nest 12, CommonJS template, Jest, TypeScript 6.0.x | Current major and ADR 013 holds. Jest runs with an experimental flag, and Jest-ESM + Prisma + Testcontainers is the least-trodden path for slices 2–4. |
| C. Nest 12, ESM template, Vitest in the API | Follows the framework default, with one test runner for the repo. It contradicts ADR 013 and needs an ADR amendment. |

Recommendation: A. It is the only option with no experimental piece inside a 40-minute slice. I also have no hands-on knowledge of Nest 12, only what its template shows. If you want the current major, C is cleaner than B.

**D2 — Prisma major.**
`prisma@latest` currently points to `8.0.0-rc.19`, while `@prisma/client@latest` is 7.10.0. An unpinned `npm i prisma` would install a release candidate mismatched with the client. Whatever you choose, `prisma`, `@prisma/client` and the adapter are pinned to one exact version with no caret.

| Option | Trade-off |
|---|---|
| A. 7.10.0 | Current stable. It needs `prisma.config.ts`, the `prisma-client` generator writing into the source tree, and `@prisma/adapter-pg`. There is no native engine binary, so no OpenSSL or `binaryTargets` problem in Docker. |
| B. 6.19.3 (`prev` tag) | Classic setup: URL in the schema, client generated into `node_modules`. It uses a native engine, so the slim image needs `openssl` and the schema needs `binaryTargets` for linux-arm64. Previous major. |

Recommendation: A, with B pre-approved as a fallback if generate + build + `migrate deploy` are not green within 15 minutes. Switching major mid-slice is your decision, so please approve the fallback now.

**D3 — TypeScript major.**
`typescript@latest` is 7.0.2. `ts-jest@29.4.14` declares `typescript >=4.3 <7`, `@nestjs/cli@12` bundles `~6.0.2`, and `@nestjs/cli@11` bundles `5.9.3`. TypeScript 7 is therefore out for the API under any D1 option that keeps Jest.

Recommendation: one TypeScript version for the whole repo, pinned in the root `package.json` to match the Nest CLI (5.9.3 with D1-A, 6.0.3 with B or C). The alternative is TypeScript 7 in `web/` only, which means two compilers type-checking the shared contracts.

**Recording.** Per `CLAUDE.md`, a decision exists only once it is in an ADR. I suggest one ADR 015 "Toolchain versions" covering D1–D3 and the base images, plus a line in `PROJECT.md`.

### Minor defaults — confirm or override in one line

| # | Question | Recommendation | Alternative |
|---|---|---|---|
| M1 | API prefix | `app.setGlobalPrefix('api')`; nginx passes the path unchanged, so paths are the same in tests, the Vite dev proxy and nginx | nginx strips `/api` |
| M2 | Published port | `8080`, overridable with `WEB_PORT`. On this machine 3000, 3001, 3400, 5000 and 7000 are already listening | 80 or 3000 |
| M3 | Node base image | `node:22-slim`: matches host Node 22.23, satisfies every engine range checked, and glibc matches the native bindings | `node:22-alpine` (musl bindings), `node:26-slim` |
| M4 | Other images | `postgres:17-alpine`, `nginx:1.30-alpine` (tags confirmed on Docker Hub) | `postgres:18-alpine`; from memory, its image changed the data-volume layout |
| M5 | Empty shells for the five modules | Not now. Each slice creates the module it fills; slice 0 adds only `prisma` and `health` infrastructure modules | Five empty `@Module({})` files now |
| M6 | Dockerfile layout | `api/Dockerfile` and `web/Dockerfile`, both with context `.` and an identical dependency-install prefix so BuildKit reuses the layer | One root `Dockerfile` with `api` and `web` targets |
| M7 | Compose without `.env` | Defaults inline as `${VAR:-default}`; `.env.example` documents the same values. A clean clone needs no `cp` step | Require `cp .env.example .env`, which breaks "one command" |
| M8 | DB data | Named volume `db-data`; reset with `docker compose down -v` | No volume |
| M9 | Host database for `prisma migrate dev` | Throwaway container via an npm script on port 54329; compose still publishes only `web` | A dev compose override publishing 5432 |
| M10 | Workspace package name | `@mes/contracts` | Any other scope |
| M11 | ADR 014 libraries installed now | React Router, TanStack Query and Tailwind (provider wiring is scaffolding); React Hook Form in slice 2 | Install all, or only React |

## 3. File scope

Paths are relative to the repository root. File names assume D1-A, D2-A and the minor defaults.

```
package.json                     workspaces [api, web, packages/*], root scripts, pinned typescript, engines node >=22.12
package-lock.json                the single lock file for both images
.gitignore                       node_modules, dist, build, coverage, .env, .env.* (except .env.example),
                                 api/src/generated/, *.tsbuildinfo, .vite, npm logs, .DS_Store, .idea, .vscode, *.swp
.dockerignore                    .git, **/node_modules, **/dist, **/coverage, api/src/generated, **/.env*, .planning, .claude, task.txt
.env.example                     POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB, DATABASE_URL (host dev), WEB_PORT, PORT
docker-compose.yml               db, migrate, api, web; healthchecks and start ordering
packages/contracts/package.json  name, private, "types" and exports.types -> ./src/index.ts; no "type" field, no build
packages/contracts/src/index.ts  HealthResponse type
api/package.json                 Nest deps, exact Prisma pins, scripts: build, start, test, prisma:generate, prebuild/pretest -> generate
api/tsconfig.json                compiler options
api/tsconfig.build.json          rootDir ./src, excludes specs
api/nest-cli.json                sourceRoot, deleteOutDir
api/jest.config.ts               ts-jest, node environment
api/prisma.config.ts             schema path, migrations path, datasource.url from process.env.DATABASE_URL
api/prisma/schema.prisma         generator (output ../src/generated/prisma, moduleFormat cjs) and datasource; no models
api/prisma/migrations/<ts>_init/migration.sql   empty baseline migration
api/prisma/migrations/migration_lock.toml       provider lock
api/src/main.ts                  bootstrap, global prefix, shutdown hooks, PORT
api/src/app.module.ts            imports PrismaModule and HealthModule
api/src/prisma/prisma.module.ts  global module exporting PrismaService
api/src/prisma/prisma.service.ts PrismaClient with the pg adapter; connect and disconnect hooks
api/src/health/health.module.ts
api/src/health/health.controller.ts       GET /api/health -> SELECT 1 -> HealthResponse; 503 on failure
api/src/health/health.controller.spec.ts  smoke test with a stubbed PrismaService
api/Dockerfile                   deps -> build (generate + nest build) -> runtime
web/package.json                 React, Vite, Tailwind, Router, Query, Vitest, RTL, jsdom
web/index.html
web/vite.config.ts               react and tailwind plugins, dev proxy /api, vitest config (jsdom, setup file)
web/tsconfig.json                bundler resolution, strict, verbatimModuleSyntax
web/src/main.tsx                 QueryClientProvider, BrowserRouter
web/src/App.tsx                  one route showing the health status
web/src/api/health.ts            fetch('/api/health') typed with HealthResponse
web/src/index.css                Tailwind import
web/src/test/setup.ts            jest-dom matchers
web/src/App.test.tsx             smoke test with a mocked fetch
web/nginx.conf                   /api/ proxy and history fallback
web/Dockerfile                   deps -> build (vite build) -> nginx
```

The generated client at `api/src/generated/prisma/` is never committed.

## 4. Ordered implementation steps

1. **Record decisions.** Write ADR 015 and update `PROJECT.md` and `STATE.md` once D1–D3 are answered. Check: `STATE.md` lists no open technical decisions.
2. **Root workspace.** Add `package.json`, `.gitignore`, `.dockerignore`, `.env.example`. Check: `npm install` succeeds and `git status` shows no `node_modules`.
3. **Contracts.** Add `packages/contracts` with `HealthResponse`. Check: `ls -la node_modules/@mes` shows a symlink.
4. **API scaffold.** Hand-write the files from the Nest template; do not run `nest new`, which creates its own git repo, lock file and lint setup. Check: `npm run build -w api` leaves `api/dist/main.js` at the top of `dist`.
5. **Prisma.** Install the pinned packages; add the schema, config and service; add the baseline migration with `prisma migrate dev --create-only --name init` against the throwaway DB (M9), or write the two files by hand. Check: `npm run prisma:generate -w api` succeeds with `DATABASE_URL` unset, and `npx prisma migrate deploy` against the throwaway DB reports one migration applied.
6. **Health endpoint and API smoke test.** The DTO implements `HealthResponse` through `import type`. Check: `npm test -w api` passes; with the throwaway DB up, `curl localhost:$PORT/api/health` returns the JSON.
7. **Web scaffold.** Vite + React + Tailwind + Router + Query; the health page; the smoke test. Check: `npm run build -w web` and `npm test -w web` pass.
8. **Lock file hygiene.** Regenerate the lock from clean (`rm -rf node_modules package-lock.json && npm install`). Check: `grep -c 'linux-arm64-gnu' package-lock.json` is above zero.
9. **API image.** Check: `docker build -f api/Dockerfile -t mes-api .` succeeds, and a second build after touching only `api/src` reuses the `npm ci` layer.
10. **Web image and nginx config.** Check: `docker build -f web/Dockerfile -t mes-web .` succeeds.
11. **Compose.** Wire the four services. Check: criteria 1–7 from section 1.
12. **Clean-clone verification.** Run section 6.
13. **Review and commit.** Run `code-reviewer` on the full diff, fix findings, mark DEL-2, TEC-1 and TEC-2 in `REQUIREMENTS.md`, update `STATE.md` and `ROADMAP.md`, and move the plan to `plans/done/`.

## 5. Risks and fallbacks

Each claim is marked [V] verified on 2026-10-01 or [M] from memory.

### R1 — Prisma with NestJS in Docker

Approach, assuming D2-A:

- **Pins.** `prisma`, `@prisma/client` and `@prisma/adapter-pg` at exactly `7.10.0`. [V] The `prisma` `latest` tag is an 8.0 release candidate. [V] Prisma 7.10 requires Node `^20.19 || ^22.12 || >=24`.
- **Generator.** `provider = "prisma-client"` with `output = "../src/generated/prisma"` and `moduleFormat = "cjs"`. [V] The 7.10 CLI has a `moduleFormat` option with `esm` and `cjs`. [M] The output path is mandatory, and the generated code is TypeScript compiled by `nest build`.
- **Config.** `api/prisma.config.ts` reads `process.env.DATABASE_URL` directly. [V] `datasource.url` in the config file is required for migrate commands. [M] The `env()` helper throws when the variable is unset even for `generate`, which is why the plain `process.env` read is used; the build stage then needs no database URL.
- **Client.** `PrismaService` constructs `PrismaClient` with `new PrismaPg({ connectionString })`. [M]
- **Generation.** No `postinstall` hook, because `npm ci` runs in the image before the schema is copied. The Dockerfile runs `npm run prisma:generate -w api` after `COPY api`; `prebuild` and `pretest` scripts cover the host.
- **Migrate service.** Same image as `api`, working directory `/app/api`, command `npx prisma migrate deploy`. The runtime stage keeps `prisma`, `prisma.config.ts` and `prisma/`. The first version copies `node_modules` unpruned from the build stage; pruning is optional polish.
- **Baseline migration.** With no models, `migrate dev` creates nothing, so the baseline comes from `--create-only` [M] or is written by hand. `migrate deploy` still creates `_prisma_migrations`, which proves the path.
- **Seed, later slices.** Compile the seed with the API (`src/seed.ts` → `node dist/seed.js`) so the image needs no TypeScript runner. The migrate command becomes `prisma migrate deploy && node dist/seed.js`.

Fallbacks: pass a dummy `DATABASE_URL` build arg if generate insists on one; switch to D2-B (6.19.3, `prisma-client-js`, `apt-get install -y openssl`, `binaryTargets = ["native", "linux-arm64-openssl-3.0.x", "debian-openssl-3.0.x"]`) if the 15-minute box is exceeded.

### R2 — Types-only `packages/contracts`

Approach: plain `.ts` sources, with `"types": "./src/index.ts"` and `exports["."].types` in the package, consumed only through `import type`.

[V] Reproduced in the scratchpad with TypeScript 6.0.3: `module: nodenext`, `rootDir: ./src`, a class implementing the contract type. `tsc` exited 0 and `dist/` contained only `main.js` and `main.d.ts`, with no nested `dist/api/src` layout and no TS6059 error. Not run through `nest build`, ts-jest or Vite.

Rules that keep it working:

- The contracts `package.json` has no `"type": "module"`, otherwise `nodenext` demands `.js` extensions on its relative imports.
- Consumers always write `import type`; `verbatimModuleSyntax` in `web` enforces it.
- No enums or constants in the package.
- Both Dockerfiles copy `packages/contracts` before building.

Fallback: replace `src/index.ts` with a hand-written `index.d.ts`. Under `skipLibCheck` its internal errors go unreported, so add a `typecheck` script in the package with `skipLibCheck: false`.

### R3 — Root-context builds with one lock file

Approach:

- Both Dockerfiles start with the same instructions: `FROM node:22-slim`, `WORKDIR /app`, copy the root `package.json`, `package-lock.json` and the three workspace `package.json` files, then `npm ci`. The identical prefix lets BuildKit share the install layer, and source edits do not invalidate it. [M]
- The API build stage then copies `packages/contracts` and `api`, generates the client and builds. The web build stage copies `packages/contracts` and `web` and runs `vite build`.
- Runtime stages: API is `node:22-slim` with `/app` from the build stage and `CMD ["node", "dist/main.js"]`; web is nginx with `web/dist` and the config.
- `migrate` and `api` share one build definition through a YAML anchor and one image name, so the image is built once.
- [M] npm can omit other-platform optional dependencies from a lock generated over an existing `node_modules`. Vite 8 and Tailwind 4 ship native bindings, so the lock is regenerated from clean and checked (step 8).

Fallbacks: if the lock lacks Linux bindings, use `npm install` instead of `npm ci` in the images and note it for the README. If `.dockerignore` hides something needed, loosen it one entry at a time.

### R4 — nginx proxy and history fallback

Approach:

- `location /api/ { proxy_pass http://api:3000; }` with no URI part, so the `/api` prefix reaches Nest unchanged (M1). Forward `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`.
- `location / { try_files $uri $uri/ /index.html; }` for the SPA.
- The trailing slash on `/api/` keeps `/apixyz` out of the proxy, and unknown API paths return the API's 404.
- `web` depends on `api` being healthy. The API healthcheck is a `node -e "fetch(...)"` one-liner because the slim image has no `curl`. The container port 3000 is internal, so the busy host port 3000 does not matter.

Fallback: if nginx fails with "host not found in upstream" or holds a stale address after `api` is recreated, add `resolver 127.0.0.11` and proxy through a variable.

### Schedule

40 minutes is tight; expect 50–60 if one fallback fires.

- Three packages are newer than the planner's knowledge: Nest 12, Vitest 5.0.3 (2026-09-03) and Vite 8.3. Vitest 4.1.11 is the fallback.
- The first build pulls `postgres` and `nginx`; only `node:22-slim` is cached locally.
- Hand-writing the Nest scaffold costs a few minutes over `nest new` but avoids cleanup.
- Host ports 3000 and 3001 are taken, so a host-run API needs `PORT=3100`, documented in `.env.example`.

## 6. Verification from a clean clone

```
git clone <repo> /tmp/mes-clean && cd /tmp/mes-clean
docker compose up --build -d --wait
docker compose ps -a
curl -s localhost:8080/api/health
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/some/deep/route
curl -s localhost:8080/api/nope
docker compose down -v
```

Expected, in order: `--wait` exits 0; `migrate` shows `Exited (0)` and only `web` has a host port; the health JSON; `200`; the NestJS 404 body. Then open `http://localhost:8080/` in a browser and confirm the status line.

## 7. Pipeline and commits

Pipeline: simplified — code → `code-reviewer` → commit. No `tdd-guide`, no `security-reviewer`; `typescript-reviewer` is optional here since there is no behaviour beyond the health endpoint.

Proposed commit series:

```
docs(planning): record toolchain versions for the skeleton

- ADR 015: NestJS, Prisma and TypeScript majors, base images
- Plan for slice 0 added
```

```
chore(repo): add npm workspaces, ignore files and contracts package

- Root workspace with api, web and packages/contracts
- .gitignore, .dockerignore and .env.example with local defaults
```

```
feat(api): scaffold NestJS API with Prisma and a health endpoint

- GET /api/health runs a trivial query against PostgreSQL
- Baseline migration; client generated at build time
- Jest wired with one smoke test
```

```
feat(web): scaffold React SPA that shows API health

- Vite, Tailwind, React Router and TanStack Query wired
- Vitest and RTL wired with one smoke test
```

```
build(docker): add compose stack with db, migrate, api and web

- migrate runs prisma migrate deploy before the API starts
- nginx serves the SPA and proxies /api; only web publishes a port
- Slice 0 closed: DEL-2, TEC-1, TEC-2
```

The last commit also updates `REQUIREMENTS.md`, `STATE.md` and `ROADMAP.md` and moves the plan to `.planning/plans/done/`.
