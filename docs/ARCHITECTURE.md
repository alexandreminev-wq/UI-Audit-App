# Architecture (High Level) — v2.2

This project currently focuses on the **Chrome Extension (MV3)** capture pipeline.
A Viewer app will come later.

## Extension components
- **Content script**
  - hover highlight
  - click-to-capture
  - extracts element intent + style primitives
  - requests screenshot capture/crop/encode via MV3 pipeline

- **Service worker (MV3 background)**
  - owns orchestration and IndexedDB writes (often easiest place for persistence logic)
  - triggers screenshot capture and offscreen processing

- **Offscreen execution context (Option A locked)**
  - uses **OffscreenCanvas** to crop + encode images reliably
  - returns encoded Blob + metadata to background
  - avoids content-script lifecycle issues

## Data stores (IndexedDB)
We use explicit stores to avoid rewriting captures when images are re-encoded.

- `sessions`
  - session metadata
  - (optional) pages visited breadcrumb

- `captures`
  - structured capture records (JSON)
  - includes `sessionId`, schema versions, conditions, element intent, style primitives
  - references screenshot via `screenshotBlobId`

- `blobs`
  - `{ id, mimeType, width, height, blob }`
  - blobs are referenced by captures; blobs can be re-encoded later without editing captures

## Data flow (capture)
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

## Non-goals (Milestone 1)
- no dedupe/grouping keys in extension
- no viewer-side normalization/signatures yet
- no automatic coverage primitive (optional “pages visited” only)
