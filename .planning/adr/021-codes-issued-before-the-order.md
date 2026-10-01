# 021 — Activation codes are issued before the order is saved, in separate transactions

**Status:** accepted · **Date:** 2026-10-02

## Context
A paid order must come with an activation code, and the plain code must be in the checkout
response (ADR 009, ADR 010). The order belongs to `checkout` and the code to `activation`
(ADR 012). Both live in one database today, so one shared transaction is available — but
it would tie the modules together in a way that cannot survive a split into services.

## Decision
The modules do not share a transaction. Checkout runs in this order:

1. Validate the seats against the catalogue.
2. `ActivationService.issue()` creates the codes in its own transaction and returns the
   plain codes.
3. The payment gateway is charged.
4. `checkout` saves the order and its seats in its own transaction.
5. Only then are the codes returned to the parent.

`checkout` generates the seat ids up front and passes them to `issue()`. A code row keeps
the seat id without a foreign key, because the seat does not exist yet when the code is
written.

## Alternatives considered
- One transaction, with `issue(tx, …)` taking the caller's transaction handle — atomic and
  the least code, but only possible while both modules share a database.
- Order first, then the code — a failure in between leaves a paid order with no code, and
  a retry cannot return the same code because only its hash is stored.
- Reserve the code, confirm it through an outbox event — the strictest, but adds a code
  state, an outbox table and a relay.
- Outbox with an asynchronous confirmation page — the code can no longer be in the
  response.

## Consequences
- The boundary is the one two services would have: one call, no shared transaction.
- A failure after step 2 leaves an orphan code. Its plain text was never shown to anyone
  and cannot be guessed, so it is harmless; nothing compensates for it.
- The database does not guarantee that a code's seat exists.
- Checkout fails before the charge if `activation` fails, never after.

## In production
The same order of calls between two services. Orphan codes would be removed by age, and
the "reserve, then confirm through an outbox" variant would be used if an unpaid code must
never be redeemable. A charge without a saved order is reconciled from the payment
provider's webhook.
