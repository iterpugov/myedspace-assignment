# 020 — The plain activation code lives only in the response and the browser tab

**Status:** accepted · **Date:** 2026-10-02

## Context
The activation code is a bearer secret stored only as a hash (ADR 009), so the checkout
response is the single moment it exists in plain form. ADR 001 originally also wrote it to
the API log as a stand-in for an email, which would have left every unredeemed code
readable in `docker compose logs`.

## Decision

| Aspect | Choice |
|---|---|
| Logs | The code is never logged. The API logs only that an order was paid and how many codes were issued |
| Confirmation page | After payment the SPA navigates, replacing history, to `/checkout/confirmation` and passes the response in router state |
| Activation link | Built by the SPA as `/activate#code=<code>` — the code is in the fragment, not the query |

The confirmation page tells the parent to save the code, because it cannot be shown again.

## Alternatives considered
- Render the confirmation on the checkout page — less code, but a reload loses the code
  and shows the payment form again.
- Code in the confirmation URL or in `sessionStorage` — survives more, but puts the secret
  in history, server logs or script-readable storage.
- Code in the link's query string — sent to the server and written to access logs.

## Consequences
- The code survives a reload in the same tab and "Back" does not return to the form.
- Opening the confirmation address directly shows nothing to recover; a lost code is lost
  (no parent account, ADR 001).
- A fragment never reaches nginx, so the code stays out of access logs and `Referer`.

## In production
The link would be emailed, and a parent account could re-issue it.
