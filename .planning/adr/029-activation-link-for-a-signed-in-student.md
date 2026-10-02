# 029 — The activation link opens "Add a course" for a signed-in student

**Status:** accepted · **Date:** 2026-10-02

## Context
The activation link always opened the onboarding form (ADR 023, 027). A student who is
already signed in and opens the link from a second purchase saw a form for creating another
account, and had to find "Add a course" and paste the code.

## Decision
`/activate#code=…` checks the session before showing anything.

- Signed in, and the link has a code: the SPA goes to `/lms/add-course` with the code in
  the field. The code travels in router state, and the navigation replaces the history
  entry, so the code is never in the address bar after the first paint and is not sent to
  the server (ADR 020). Once the code is in the field, it is removed from the history
  entry.
- The code is only prefilled. The course is added when the student presses "Add course" on
  a page that names the account and offers "Not <name>? Sign out, then open your link
  again."
- No session, an expired session, a failed session request, or a link without a code: the
  onboarding form, as before. While the session is unknown the page shows "Loading…" and
  no form.
- The choice is made once, on the first session answer from the API; a value left in the
  SPA's cache by an earlier page does not count. It is not made again when the session
  changes later, for example after the onboarding on that page succeeds.
- If the guard sends the student to sign-in, the code is dropped. A signed-out student who
  has an account signs in and opens the link again, or pastes the code.

## Alternatives considered
- Redeeming on arrival — fewest clicks, but at a shared browser a paid seat would land on
  whoever is signed in, with no confirmation and no undo.
- Leaving the code in the history entry — a reload would keep the prefill, but "Back" would
  show an unused code to whoever is signed in next at a shared browser.
- Keeping the fragment on `/lms/add-course` — one mechanism, but the code would stay in the
  address bar while the guard resolves the session.
- Carrying the code through sign-in — covers the signed-out student too, but changes where
  sign-in lands (ADR 026).
- Showing the form at once and redirecting later — the onboarding form would flash for a
  signed-in student.

## Consequences
- Every visitor of `/activate` waits for one session request before the form appears.
- The code is in history state only for the moment between the two pages. Going back to
  the add-course page, or the next student at a shared browser, finds an empty form. The
  price: a reload loses the prefill, and the student opens the link again.
- A sibling at a shared browser is taken to the other child's page; the page says whose
  account it is and how to get out.

## In production
The link would show what the code grants and to whom before anything is used, and the
parent would attach a purchase to a child in their own account.
