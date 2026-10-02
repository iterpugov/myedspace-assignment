# Design system

The SPA follows the visual language of the public MyEdSpace course pages: a vivid blue,
a lime call to action, square corners and stepped "notch" corners. This file is the single
description of that language; the tokens live in `src/index.css` and the primitives in
`src/ui/`.

Values were sampled from screenshots of myedspace.co.uk taken on 2026-10-01, so colours
are close approximations, not official brand values. No MES assets are used: no logo
file, photographs or review widgets.

## Principles

1. **Square everything.** No rounded corners on buttons, cards, inputs or images.
2. **Two loud colours, used sparingly.** Blue carries the brand, lime marks the one
   primary action on a screen. Everything else is white, lavender or ink.
3. **Big, tight headings; calm body text.** Headings are large, bold and blue (or white
   on blue). Body text is regular weight and near-black.
4. **Phone first.** Every page is usable at 360px wide; wider screens add columns, not
   content.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| `brand` | `#3333FF` | Hero and header background, headings on white, links, borders of outline controls |
| `brand-deep` | `#1C19E4` | Pressed and hover state of blue surfaces |
| `brand-strip` | `#2925F1` | Panels sitting on a blue background |
| `brand-soft` | `#6765F3` | Secondary headings and helper text in blue |
| `accent` | `#B1DB00` | Primary button background |
| `sky` | `#A4E1EF` | Alternate section background, eyebrow text on blue |
| `sky-light` | `#B4E6F3` | Hover state of sky surfaces |
| `surface` | `#FFFFFF` | Page and form background |
| `surface-tint` | `#F1F0FF` | Cards, decorative squares on white |
| `ink` | `#1D1E22` | Body text, text on lime |
| `line` | `#DFE3E6` | Input borders, dividers |
| `line-brand` | `#BFBFE8` | Borders of outline buttons and icon buttons |
| `disabled` | `#F2F4F5` | Read-only and disabled inputs |
| `danger` | `#FF4345` | Errors and the "live" badge |

Text on `brand` is white. Text on `accent`, `sky` and `surface-tint` is `ink`.

## Typography

One family: **Inter** (variable), bundled with the app so that nothing is fetched at
runtime. The MES site uses a tighter grotesque for headings; Inter with negative tracking
is the open substitute.

| Style | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|
| Display | 72 / 1.0 (48 on small screens) | 700 | −0.03em | Page title in the hero |
| Heading | 44 / 1.1 (32 on small screens) | 700 | −0.02em | Section titles |
| Subheading | 24 / 1.25 | 600 | −0.01em | Card titles, form section titles |
| Eyebrow | 28 / 1.2 | 600 | −0.01em | Line above the display title ("Year 10") |
| Body | 18 / 1.5 | 400 | 0 | Paragraphs, list items |
| Label | 16 / 1.4 | 600 | 0 | Form labels, button text |
| Small | 14 / 1.4 | 400 | 0 | Helper and error text |

## Layout

- Content width (`max-w-page`): 1200px maximum, centred, with 24px side padding (16px on small screens).
- Spacing follows a 4px base; sections are separated by 96px, blocks inside a section by 32px.
- Forms are a single column, at most 560px wide (`max-w-form`).
- Below 768px everything is one column: course cards stack, the header navigation wraps
  under the wordmark, and controls are at least 44px tall.

## Shape and decoration

- **Corners:** radius 0 everywhere.
- **Notch:** primary buttons and cards have a stepped corner — a small square (8px on
  buttons, 16px on cards) cut from the top-left and bottom-right, as if the shape were two
  offset rectangles. Implemented with `clip-path` as the utilities `notch-sm` and
  `notch-lg`.
- **Shadows:** none, except a light one on cards that sit on `sky`.

## Components

| Component | Description |
|---|---|
| `PageShell` | Header plus a white main area. An optional `hero` is shown on a blue band under the header (product page); without it the page is plain white (checkout, onboarding, LMS) |
| `Header` | Blue bar with a faint 1px `line-brand` outline: text wordmark on the left, navigation links on the right ("Courses", "Sign in"); the links wrap under the wordmark on a phone |
| `Button` | `primary`: lime, ink text, notched, 56px tall. `outline`: white, 1px `line-brand` border, blue text. `link` (`TextLink`): blue text, used for "Back". All show a visible focus ring and a disabled state |
| `Card` | `surface-tint` background, notched, 32px padding; optional small label above the title ("Unit 1") |
| `ChoiceCard` | A `Card` that is one option of a radio group: the whole card is the click target, and the selected card turns `brand` with white text |
| `Field` | Label above, square input 48px tall with a 1px `line` border; border turns `brand` on focus and `danger` on error; optional hint below in muted ink, error text below in `danger` |
| `Select` | Same look as `Field`, with a chevron on the right; used for the year |
| `Steps` | Row of equal segments, filled in `brand` up to the current step, with a "n of m steps" caption |
| `Notice` | Message block with a coloured left edge: `info` (brand) and `error` (danger). Errors are announced to assistive technology; an info notice only when marked `live` |

## Accessibility

- Text contrast: `ink` on white, lime, sky and lavender, and white on blue, all meet
  WCAG AA for the sizes used. `brand-soft` is used only for large text.
- Every control has a visible focus ring (2px `ink` outline on lime, 2px white on blue,
  2px `brand` elsewhere). On notched shapes the ring is drawn inside the edge, because the
  notch clips anything outside the box.

## Not reproduced

Marketing sections of the real site — review carousels, curriculum sliders, teacher
photography, the trust-score widgets — are outside the brief and are not built. The
pixel-block dividers and scattered squares of the real site are left out as well.

Components are built when a page first needs them: slice 1 builds `PageShell`, `Header`,
`Button` (primary), `TextLink`, `ChoiceCard`, `Select` and `Notice`; slice 2 adds `Card`
and `Field`. `Steps` and the `outline` button arrive with the pages that use them.

Only the colours in the table above exist in the Tailwind theme — the default palette is
switched off, so an undocumented colour does not compile.
