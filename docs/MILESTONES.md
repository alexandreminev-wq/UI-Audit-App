# Milestones (Canon) — v2.2

## Milestone 1 — Capture pipeline v2.2 ✅ COMPLETE
**Goal:** Comparable captures across sessions, with explicit versioning + durable screenshots.
**Status:** Complete (Tagged: `milestone-1-complete`)

### 1.0 Session & versioning foundations ✅
- ✅ Every capture has a required `sessionId`
- ✅ Extension writes a session record to `sessions` store
- ✅ Capture schema stamping:
  - `captureSchemaVersion: 2`
  - `stylePrimitiveVersion: 1`
- ✅ Session persistence across service worker restarts

### 1.1 Inspect & click-to-capture ✅
- ✅ Hover highlight overlay
- ✅ Click-to-capture (audit mode)
- ✅ Overlay hidden during screenshot (clean captures)
- ⬜ Hotkey capture (optional, deferred)

### 1.2 Capture record schema v2.2 ✅
- ✅ `conditions` per capture:
  - ✅ `viewport: { width, height }`
  - ✅ `devicePixelRatio`
  - ✅ `visualViewportScale` (best-effort)
  - 🟡 `browserZoom` (null - flaky detection, acceptable)
  - ✅ `timestamp` (uses `createdAt`)
  - ✅ `themeHint` (dark/light/unknown)
- ✅ `element.intent` anchors (best-effort):
  - ✅ `accessibleName`
  - ✅ `inputType`
  - ✅ `href`
  - ✅ `disabled`, `ariaDisabled`
  - ✅ `checked`, `ariaChecked` (when relevant)
  - ✅ `tagName`, `role`

### 1.3 Style primitives v2 ✅
- ✅ Spacing: per-side padding (paddingTop, paddingRight, paddingBottom, paddingLeft)
- ✅ Colors: store raw + canonical RGBA (backgroundColor, color, borderColor)
- ✅ Shadows: store raw + derived presence/layer count
- ✅ No dedupe keys, no bucketing, no signatures in extension (deferred to viewer)

### 1.4 Storage v2.2 ✅
- ✅ IndexedDB stores:
  - ✅ `sessions` — session records
  - ✅ `captures` — structured JSON capture records
  - ✅ `blobs` — `{ id, mimeType, width, height, blob, createdAt }`
- ✅ Capture references screenshots via `screenshotBlobId`
- ✅ Schema evolution: additive fields optional, old rows readable
- ✅ Message passing for blob retrieval (MV3-safe cross-context access)

### 1.5 Screenshots (OffscreenCanvas) ✅
- ✅ Take viewport screenshot + crop target rect
- ✅ Crop/encode/compress using OffscreenCanvas execution context
- ✅ Store output as blob in `blobs` store
- ✅ Capture stores `screenshotBlobId` and metadata (width, height, mimeType)
- ✅ Popup displays screenshot previews
- ✅ ArrayBuffer serialization fixed for chrome.runtime.sendMessage

### 1.6 Coverage tracking ✅
- ✅ Track pages visited during audit (URL list per session via tabs.onUpdated)
- ⬜ Coverage primitive (auto completeness) deferred to later milestone

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
