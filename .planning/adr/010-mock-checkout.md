# 010 — Mock checkout: one request, always approved, no card fields

**Status:** accepted · **Date:** 2026-10-01

## Context
The brief asks for a mock checkout with no real payment integration (PUR-3). The purchase
still has to end in a paid order and an activation code (PUR-4).

## Decision
The checkout form collects the parent's name and email and has a pay button. One request
creates the order as paid, its seat and the activation code.

On the backend, payment sits behind a small payment-gateway interface with a mock
implementation that always approves. The UI has no card fields.

## Alternatives considered
- A fake card form with test numbers and a declined-payment path — order statuses, failure
  handling and field validation for something the brief calls a mock.

## Consequences
- The place where a real provider plugs in is visible in the code.
- The declined-payment path does not exist; an order is never unpaid.
- No card data is ever asked for, even fake.

## In production
A hosted payment page from a provider, an order that starts as pending and is confirmed by
the provider's webhook, and idempotency keys against double submission.
