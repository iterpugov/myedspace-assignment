# 011 — Workspaces with a types-only contracts package, four compose services, one origin

**Status:** accepted · **Date:** 2026-10-01

## Context
The API and the SPA are separate applications that must agree on request and response
shapes. `docker compose up` must start everything from a clean clone (DEL-2), migrations
run as their own step (ADR 006), and the auth cookie needs the SPA and the API on one
origin (ADR 008).

## Decision
The repository is an npm workspace with three packages:

| Package | Contents |
|---|---|
| `api/` | NestJS API |
| `web/` | React SPA |
| `packages/contracts/` | Request and response types shared by both |

`contracts` holds types only, no runtime code, so it has no build step. API DTO classes
implement the shared types; the SPA types its API calls with them.

Docker Compose runs four services:

| Service | Role |
|---|---|
| `db` | PostgreSQL |
| `migrate` | One-shot: migrations and seed, using the API image |
| `api` | NestJS API; starts after `migrate` succeeds |
| `web` | nginx: serves the built SPA and proxies `/api` to `api` |

Both images build from the repository root. Only `web` publishes a port.

## Alternatives considered
- Two independent packages with duplicated types — simplest Docker setup, but the two
  sides can drift apart silently.
- Shared validation schemas as well as types — one source for validation too, but the
  package then has runtime code and must be built in both images.
- Types generated from OpenAPI — no shared package, but decorators on every DTO and a
  generation step.
- A shared folder imported by relative path — no tooling, but breaks the API build layout.
- Serving the SPA from a dev server in the container — simpler Dockerfile, but a dev
  server standing in for a deployment.

## Consequences
- A DTO that drifts from the contract fails to compile; the SPA cannot use a field the API
  does not return.
- The browser sees a single origin, so there is no CORS setup.
- The images share one lock file and a root build context; adding runtime code to
  `contracts` would bring a build step with it.

## In production
The proxy role is taken by an ingress or CDN. Contracts are usually published from an
OpenAPI description so that non-TypeScript clients can use them too.
