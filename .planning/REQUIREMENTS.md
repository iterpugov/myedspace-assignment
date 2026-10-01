# REQUIREMENTS

Requirements taken from the brief (`task.txt`, kept locally and not committed), with IDs for plans, tests
and commits to reference. Nothing here is a design decision.

Markers: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` changed or descoped (say why).

## Parent purchase flow

- [ ] **PUR-1** Parent lands on a product page
- [ ] **PUR-2** Parent selects a course
- [ ] **PUR-3** Parent completes a mock checkout (no real payment integration)
- [ ] **PUR-4** After purchase, the system generates a student access path (e.g. invitation link)

## Student onboarding

- [ ] **ONB-1** Student accesses onboarding via the invitation or purchase outcome
- [ ] **ONB-2** Student completes a basic onboarding form
- [ ] **ONB-3** Student activates their account (e.g. sets a password; no real auth system required)
- [ ] **ONB-4** On completion, the student can access the platform

## LMS access

- [ ] **LMS-1** Only authenticated students can access the LMS
- [ ] **LMS-2** LMS contains a simple dashboard
- [ ] **LMS-3** LMS shows a list of lessons
- [ ] **LMS-4** Students can get access to a lesson

## Catalogue data (provided)

- [ ] **CAT-1** A course has subject, year and price
- [ ] **CAT-2** Sample courses: Maths (Year 5–13, £199), English (Year 5–13, £199),
  Science (Year 5–11, £199)

## Technical

- [x] **TEC-1** React frontend
- [x] **TEC-2** Java or Node.js backend
- [ ] **TEC-3** The journey works end to end

## Deliverables

- [ ] **DEL-1** Source code in a GitHub repository (public, or private shared with
  `leopro`, `azamzamy`, `ser-within-mes`, `Josephaberry54`)
- [x] **DEL-2** `docker compose up` starts all required services with a single command
- [ ] **DEL-3** README: architecture overview
- [ ] **DEL-4** README: key technical decisions
- [ ] **DEL-5** README: how AI tools were used, with artefacts attached (plans, snippets)
