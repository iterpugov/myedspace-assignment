# 015 — Toolchain versions are pinned to the last proven majors

**Status:** accepted · **Date:** 2026-10-01

## Context
The npm `latest` tags moved shortly before this exercise. NestJS 12 is ESM-only and
defaults to Vitest, with Jest running under an experimental Node flag. The `prisma` CLI's
`latest` tag points to an 8.0 release candidate while the client is at 7.10. TypeScript 7
is outside the range `ts-jest` supports. ADR 013 chose Jest for the API, and slice 0 has
about 40 minutes.

## Decision

| Tool | Version | Note |
|---|---|---|
| NestJS | 11.x (11.2.7) | CommonJS build, Jest with `ts-jest` |
| Prisma | 7.10.0, exact | `prisma`, `@prisma/client` and `@prisma/adapter-pg` pinned to the same version |
| TypeScript | 5.9.3 | One version for the whole repository |
| Node image | `node:22-slim` | Matches the local Node 22 |
| Other images | `postgres:17-alpine`, `nginx:1.30-alpine` | |

If Prisma 7 does not build, migrate and run in Docker within 15 minutes, the fallback is
Prisma 6.19.3 with its classic setup.

## Alternatives considered
- NestJS 12 with Jest — the current major, but Jest runs with an experimental flag and the
  combination with Prisma and Testcontainers is the least-trodden path.
- NestJS 12 with Vitest in the API — the framework default and one runner for the repo,
  but it replaces the test stack agreed in ADR 013 with one nobody here has used yet.
- TypeScript 7 in `web/` only — two compilers type-checking the shared contracts.

## Consequences
- Nothing experimental sits in the build or test path; ADR 013 holds as written.
- The API is one major behind the framework's current release.
- Unpinned installs would silently pick a release candidate, so Prisma versions carry no
  caret.

## In production
Versions follow the organisation's supported baseline, with a scheduled upgrade to the
current NestJS major once its ESM test tooling is settled.
