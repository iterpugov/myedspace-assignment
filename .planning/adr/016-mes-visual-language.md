# 016 — The SPA follows the MyEdSpace visual language, described as a design system

**Status:** accepted · **Date:** 2026-10-02

## Context
The brief evaluates product flow among other things, and the reviewers work on the real
MyEdSpace product. ADR 014 chose Tailwind CSS but left the look undefined, which would
have produced six screens styled ad hoc.

## Decision
The SPA reproduces the visual language of the public MyEdSpace course pages: brand blue,
a lime primary action, square corners, large tight headings and the pixel-block motif.

The language is written down in [`web/DESIGN_SYSTEM.md`](../../web/DESIGN_SYSTEM.md):
tokens, typography, layout, shapes and a small set of components. Tokens are defined once
in the Tailwind theme, and pages are built only from the documented components.

No MES assets are used — no logo file, photographs or review widgets. Colours are sampled
from screenshots; the typeface is Inter, bundled with the app.

The foundation (tokens, components, page shell) is built in slice 1.

## Alternatives considered
- A minimal neutral foundation — about 15 minutes, consistent but anonymous.
- No design work — zero time, but the screens read as a set of unrelated forms.

## Consequences
- The mock looks like the product it models, and every screen is assembled from the same
  parts.
- Slice 1 grows by about 30 minutes, which puts the optional slice 5 at more risk.
- Colours and type are approximations and are labelled as such.

## In production
The product's own design system package and licensed typeface would be used instead of a
re-creation.
