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

## Milestone 2 — Viewer gallery v2.2 🟡 IN PROGRESS
**Goal:** Viewer owns grouping/compare/export and any “analysis” (extension only captures + stores).

### 2.0 Viewer entrypoint + build ✅
- ✅ viewer.html entrypoint built by Vite into dist/
- ✅ Viewer runs as an extension page (no server required)

### 2.1 Service worker becomes the Viewer data API ✅
- ✅ Message endpoints for viewer reads (list sessions, list captures for session, fetch single capture)
- ✅ Viewer fetches screenshot blobs via SW (no IndexedDB access in UI contexts)

### 2.2 Sessions list + session detail ✅
- ✅ List sessions
- ✅ Select a session and load its captures

### 2.3 Captures gallery + thumbnails ✅
- ✅ Grid view of captures
- ✅ Thumbnails fetched via blobId + mimeType
- ✅ Viewer-side filters:
  - ✅ search (name/url/tag/role)
  - ✅ has screenshot only
  - ✅ tag/type dropdown

### 2.4 Naive grouping + occurrences ✅
- ✅ Toggle: Ungrouped / Grouped
- ✅ Grouping heuristic v0:
  - tagName + normalized accessibleName
- ✅ Group cards show count + up to 3 thumbnails
- ✅ Group detail view shows occurrences (capture cards)

### 2.5 Compare two captures ✅
- ✅ “Set A / Set B” compare controls on capture cards
- ✅ Compare panel:
  - screenshots side-by-side
  - primitives diff (only fields that differ)

### 2.6 Export ✅
- ✅ Export JSON (no embedded screenshot bytes; computed styles omitted)
- ✅ Export CSV (flat subset of primitives + screenshotBlobId ref)
- ⬜ Optional: export includes session metadata + pages visited as separate file/section (polish)

### 2.x Remaining / stretch (still Milestone 2, if needed)
- ⬜ Better grouping heuristics (role + intent anchors + primitives)
- ⬜ Simple “cluster detail” route/deep-linking (optional)
- ⬜ Performance pass for large sessions (virtualize lists)

---

## Milestone 3 — Polish & richer export v2.2
- ⬜ Export HTML report
- ⬜ Tagging + notes in viewer
- ⬜ “Possible duplicates” review UX (viewer-driven)
- ⬜ Performance pass + caching strategy refinements
- ⬜ Viewer-side normalization versioning surfaced in UI (“ruleset vX”)

---

## Milestone 4 — Hosted MVP
- Supabase auth + projects
- Upload screenshots
- Share link
