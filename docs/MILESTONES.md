# Milestones (Canon) — v2.2

## Milestone 1 — Capture pipeline v2.2
**Goal:** Comparable captures across sessions, with explicit versioning + durable screenshots.

### 1.0 Session & versioning foundations
- Every capture has a required `sessionId`
- Extension writes a session record to `sessions` store
- Capture schema stamping:
  - `captureSchemaVersion: 2`
  - optional `stylePrimitiveVersion: 1`

### 1.1 Inspect & click-to-capture
- Hover highlight ✅
- Click-to-capture (audit mode) ✅
- Hotkey capture (optional) ⬜

### 1.2 Capture record schema v2.2
- `conditions` per capture:
  - `viewport: { width, height }`
  - `devicePixelRatio`
  - `visualViewportScale` (best-effort)
  - `browserZoom` (best-effort; optional, expect null)
  - `timestamp` (use `createdAt`)
- `element.intent` anchors (best-effort):
  - `accessibleName`
  - `inputType`
  - `href`
  - `disabled`, `ariaDisabled`
  - `checked`, `ariaChecked` (when relevant)
  - keep: `tagName`, `role`

### 1.3 Style primitives v2 (no extension-side grouping)
- Spacing: per-side padding
- Colors: store raw + canonical RGBA
- Shadows: store raw + derived presence/layer count
- No dedupe keys, no bucketing, no signatures in extension

### 1.4 Storage v2.2 (explicit stores + evolution)
IndexedDB stores:
- `sessions` — session records
- `captures` — structured JSON capture records
- `blobs` — `{ id, mimeType, width, height, blob }`
Capture references screenshots via `screenshotBlobId`.

Schema evolution:
- additive fields are optional
- old rows remain readable

### 1.5 Screenshots (Option A locked: OffscreenCanvas)
- Take viewport screenshot + crop target rect
- Crop/encode/compress using OffscreenCanvas execution context
- Store output as blob in `blobs` store
- Capture stores `screenshotBlobId` and basic metadata

### 1.6 Minimal coverage hedge (optional)
- Track pages visited during audit (URL list per session)
- Coverage primitive (auto completeness) deferred

---

## Milestone 2 — Viewer gallery v2.2
**Goal:** Viewer owns normalization/signatures + variant grouping.

- Read `sessions` + `captures` + screenshot blobs
- Compute signatures in viewer (no precomputed keys from extension)
- Variant gallery + detail view
- Occurrences list with screenshots
- Viewer-side normalization versioning (rules evolve)

---

## Milestone 3 — Export & polish v2.2
- Export JSON/CSV/HTML including:
  - sessions + pages visited breadcrumb
  - conditions, intent anchors
  - raw + canonical primitives
  - screenshot refs (blob IDs), not data URLs
- Tagging + notes
- Possible duplicates (viewer-driven)
- Performance pass

---

## Milestone 4 — Hosted MVP
- Supabase auth + projects
- Upload screenshots
- Share link
