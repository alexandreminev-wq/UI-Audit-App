# STYLE_KEYS — v2.2

*Last updated: 2025-12-31 (Europe/Madrid)*

This document defines the **minimal style evidence** we extract/store for MVP.
Goal: capture enough signal to support viewer-side comparison, and later designer-friendly summaries.

## Principles
- Prefer **normalized primitives** over raw shorthand strings (e.g., per-side padding).
- Store both:
  - **raw computed value** (debuggable)
  - **canonical form** (stable for comparisons)
- Keep the list minimal; expand only when we have a clear viewer/sidepanel use-case.
- Analysis/grouping/compliance remains view-only (not persisted).

---

## Spacing (required)
Stored as strings (computed style values), per-side:
- `paddingTop`
- `paddingRight`
- `paddingBottom`
- `paddingLeft`

## Box Model (Phase 2)
To support layout auditing and more faithful reproduction/export, we also capture:

### Margin (per-side, computed strings)
- `marginTop`
- `marginRight`
- `marginBottom`
- `marginLeft`

### Border widths (per-side, computed strings)
- `borderWidth.top`
- `borderWidth.right`
- `borderWidth.bottom`
- `borderWidth.left`

### Gap (computed strings)
- `gap.rowGap`
- `gap.columnGap`

---

## Color primitives (required minimum)
For each color-like property we store:
- `raw` (computed style string as-is)
- `rgba` (canonical RGBA if parseable, else null)

Minimum set:
- `backgroundColor`
- `color`
- `borderColor` (optional depending on element type)

---

## Shadow primitives (required minimum)
- `boxShadowRaw` (computed string)
- `shadowPresence`: `"none" | "some"`
- `shadowLayerCount` (optional)

---

## Notes for UI display (side panel + viewer)
- Side panel “Visual Essentials” may display a subset:
  - backgroundColor.raw, color.raw, spacing padding, shadowPresence, (and later: font properties)
- Side panel currently maps primitives into a `Record<string,string>` for shell component display.
- Do not add new capture keys without updating `CAPTURE_RECORD.md` and versioning as needed.
