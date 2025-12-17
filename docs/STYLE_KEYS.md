# STYLE_KEYS — v2.2

This document defines the **minimal style evidence** we extract/store for MVP.
Goal: capture enough signal to support viewer-side grouping, comparison, and later normalization.

## Principles
- Prefer **normalized primitives** over raw shorthand strings (e.g., per-side padding).
- Store both:
  - **raw computed value** (for debugging)
  - **canonical form** (for grouping stability)
- Keep the list minimal; expand only when we have a viewer use-case.

## Spacing
Stored as strings (computed style values), per-side:
- `paddingTop`
- `paddingRight`
- `paddingBottom`
- `paddingLeft`

## Color primitives
For each color-like property we store:
- `raw` (computed style string as-is)
- `rgba` (canonical RGBA if parseable)

Minimum set:
- `backgroundColor`
- `color`
- `borderColor` (optional depending on component type)

## Shadow primitives
- `boxShadowRaw` (computed string)
- `shadowPresence`: `"none" | "some"`
- `shadowLayerCount` (optional)

## Notes
- These keys are stored in `styles.primitives` and versioned via `stylePrimitiveVersion: 1`.
- Viewer may compute additional derived fields (group keys, variant buckets), but these are **not stored back** into capture records in v2.2.
- Padding values are stored as computed style strings (typically `px`), not numeric tokens.
- See `CAPTURE_RECORD.md` for the canonical schema (`styles.primitives`).
