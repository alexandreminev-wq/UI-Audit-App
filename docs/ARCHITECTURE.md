# Architecture (High Level) — v2.2 (Updated)

_Last updated: 2025-12-17 (Europe/Madrid)_

This project consists of:
1) a **Chrome Extension (MV3)** for guided UI capture + storage
2) a **Viewer app** (packaged with the extension) for browsing, grouping, comparing, and exporting captured evidence

## System components

### Extension components
- **Content script**
  - hover highlight
  - click-to-capture
  - extracts element intent + style primitives + conditions
  - requests screenshot capture/crop/encode via MV3 pipeline

- **Service worker (MV3 background)**
  - owns orchestration and **all IndexedDB reads/writes**
  - triggers screenshot capture and offscreen processing
  - exposes message APIs for Viewer data access (`VIEWER/*`, `AUDIT/GET_BLOB`)

- **Offscreen execution context (Option A locked)**
  - uses **OffscreenCanvas** to crop + encode images reliably
  - returns encoded Blob + metadata to background
  - avoids content-script lifecycle issues

### Viewer app (packaged web app)
- Built by **Vite** into `dist/viewer.html` and shipped inside the extension
- Opened from popup via:
  - `chrome.runtime.getURL("viewer.html")`
- **Critical rule:** Viewer does **not** access IndexedDB directly
  - Viewer reads everything via service worker message passing only
- Viewer responsibilities:
  - sessions list
  - capture gallery (thumbnails)
  - filters
  - naive grouping / clustering (viewer-side only)
  - compare A/B (screenshots + primitives diff)
  - export JSON/CSV (no embedded image bytes)

---

## Data stores (IndexedDB)
We use explicit stores to avoid rewriting captures when images are re-encoded.

- `sessions`
  - session metadata
  - (optional) pages visited breadcrumb

- `captures`
  - structured capture records (JSON)
  - includes `sessionId`, schema versions, conditions, element intent, style primitives
  - references screenshot via `screenshotBlobId` (or equivalent nested screenshot metadata)

- `blobs`
  - `{ id, mimeType, width, height, blob }`
  - blobs are referenced by captures; blobs can be re-encoded later without editing captures

---

## Data flow (capture pipeline)
1) User clicks element (content script)
2) Content script builds:
   - element core + intent anchors
   - conditions
   - style primitives
3) Content script sends message to background:
   - capture payload + target crop rect
4) Background:
   - ensures active session exists
   - performs viewport capture
   - sends image + crop rect to offscreen context
5) Offscreen context:
   - crops via OffscreenCanvas
   - encodes/compresses (webp/jpeg) + caps size
   - returns Blob + metadata
6) Background writes:
   - blob to `blobs` store
   - capture record to `captures` store with `screenshotBlobId`

---

## Data flow (Viewer reads + thumbnails)
**Rule:** Service worker is the only IndexedDB accessor. Viewer uses messages.

1) Viewer requests sessions:
   - `VIEWER/LIST_SESSIONS`
2) Viewer requests captures for a session:
   - `VIEWER/LIST_CAPTURES { sessionId }`
3) Viewer requests full capture detail when needed (compare/export):
   - `VIEWER/GET_CAPTURE { captureId }`
4) Viewer requests screenshot bytes:
   - `AUDIT/GET_BLOB { blobId }`

### Blob transfer constraint (MV3)
Chrome MV3 message passing does not reliably transfer ArrayBuffers end-to-end for this project’s pipeline.
So screenshot bytes are returned as:
- `{ ok: true, arrayBuffer: number[] }`

Viewer reconstructs:
- `Uint8Array(number[]) → Blob → URL.createObjectURL(...)`

Viewer caches object URLs and revokes them on unmount to avoid memory leaks.

---

## Viewer-side analysis (Milestone 2)
- Grouping/clustering is computed in the Viewer only (no stored dedupe keys)
- Naive grouping heuristic:
  - `tagName + unicode-safe normalized accessibleName`
- Compare A/B:
  - screenshots side-by-side
  - primitives diff showing only differing paths
- Export:
  - JSON/CSV
  - does not embed image bytes (keeps screenshot blob id references)
  - strips `styles.computed` from JSON export

---

## Non-goals (as of Milestone 2)
- no dedupe/signature keys stored in extension
- no viewer-side “true signatures” persisted back into storage
- no deep-linking/router required
- no dark mode required
- no virtualization/pagination (unless needed in Milestone 3 for very large sessions)

## Next (Milestone 3 direction)
- Improve viewer-side grouping beyond naive keys using explainable heuristics (primitives buckets, etc.)
- Keep analysis viewer-side; preserve SW-only IndexedDB access rule
