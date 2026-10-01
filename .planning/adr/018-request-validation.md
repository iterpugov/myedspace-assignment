# 018 — Requests are validated with class-validator and a global ValidationPipe

**Status:** accepted · **Date:** 2026-10-02

## Context
From slice 2 the API accepts request bodies, and the checkout URL carries values the user
can edit (ADR 017). Without validation a malformed id reaches the database and surfaces as
a 500. One mechanism is needed for every endpoint in slices 2–4.

## Decision
Request bodies are DTO classes decorated with `class-validator`, checked by one global
`ValidationPipe` registered in `configureApp`. The pipe runs with `whitelist` and
`forbidNonWhitelisted`, so an unknown property is a 400. DTO classes `implement` the types
in `@mes/contracts` (ADR 011).

A body that fails validation returns 400. A well-formed body that breaks a business rule
(unknown course, year outside the range) returns 422.

## Alternatives considered
- `zod` with a custom pipe — one dependency and natural nesting, but not the NestJS
  default, and DTO classes would no longer implement the contract types.
- Hand-written checks — no dependency, more code and tests per endpoint.

## Consequences
- Validation is declared next to the shape it protects and applies to every route.
- Nested objects need `@ValidateNested` and `@Type`; forgetting them skips validation
  silently, so each nested body has an integration test with a malformed element.
- A DTO must be imported as a value, not as a type, or the pipe sees nothing to validate.

## In production
The same, with the OpenAPI document generated from the DTOs.
