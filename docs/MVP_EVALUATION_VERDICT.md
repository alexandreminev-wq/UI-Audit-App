# Current MVP Evaluation — Verdict

_Last updated: 2026-01-08_

This document captures the evaluation of the current codebase against the MVP definition.

---

## Executive Verdict

**The application is viable and implements most of the MVP definition.**

The core capture → review → export loop works. Two correctness issues in Phase 0 must be fixed before shipping.

---

## What's Strong (MVP-Ready)

### 1) Architecture boundaries are correct
- Service worker is the only IndexedDB accessor; UIs communicate via messaging.
- Capture stores evidence; Viewer derives meaning.
- This separation is explicitly documented and reflected in implementation.

### 2) Capture UX is sophisticated and designer-friendly
- Hover overlay + freeze + contextual capture menus.
- Region and viewport screenshot capture.
- Multi-state capture (default/hover/active) via CDP.
- Duplicate detection prompts.

### 3) CDP is integrated for better evidence
- Service worker supports forced pseudo-classes (hover/active).
- CDP-first evidence capture with fallbacks.
- This is the "hard part" many prototypes never reach.

### 4) Data model is solid
- `StylePrimitives` normalization exists (colors, spacing, border, typography, shadow, radius).
- Token provenance hooks exist (via inline `var(--...)` sources).

### 5) Viewer provides manual assessment workflow
- Component and style inventories derived at runtime.
- Filters (category, type, status, source, search).
- Identity overrides (name, category, type, status).
- Notes and tags.
- Visual essentials display.

### 6) Export exists
- Figma ZIP with `inventory.json` + screenshots.
- JSON debug export.

---

## What Must Be Fixed (Phase 0)

### 1) Border color style aggregation is broken
- Capture schema represents border color per-side.
- `deriveStyleInventory` treats `primitives.borderColor` as having `.raw` (single value).
- **Impact:** Border-color reporting is incorrect.
- **Fix:** Extract each side separately or collapse when uniform.

### 2) Token extraction is not property-specific
- `extractToken(sources)` scans all sources and returns first token found.
- That token is then applied to all style records.
- **Impact:** Token usage reports are noisy/misattributed.
- **Fix:** Pass property key to `extractToken` and return token for that specific property.

---

## What's Intentionally Deferred (Not Bugs)

These are NOT in MVP scope. They belong to Phase A/B/C:

| Feature | Phase |
|---------|-------|
| Automated variant detection | Phase A |
| Visual fingerprinting (`variantKey`) | Phase A |
| Consistency scoring / reports | Phase A |
| Near-duplicate detection | Phase A |
| Drift tracking | Phase B |
| Snapshot export/import/compare | Phase B |
| Page labeling / route templating | Phase C |
| URL list / sitemap ingestion | Phase C |
| Saved filters | Phase C |

---

## MVP Exit Criteria

MVP is complete when:

1. ✅ User can create an audit project
2. ✅ User can capture UI elements across pages
3. ✅ User can review components and styles in Viewer
4. ✅ User can annotate and override identity
5. ✅ User can export to Figma
6. ⚠️ **Phase 0 fixes complete** (border color, per-property tokens)
7. ✅ User can exit without broken or ambiguous state

**Status:** MVP is ~95% complete. Phase 0 fixes required before ship.

