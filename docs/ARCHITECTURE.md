Here’s an updated **ARCHITECTURE.md** reflecting **Milestone 3 completion** and setting up **Milestone 4** (Metadata Pill / scope / freeze) without overcommitting to new schema yet.

---

# Architecture (High Level) — v2.3 (Updated)

*Last updated: 2025-12-22 (Europe/Madrid)*

This project consists of:

1. a **Chrome Extension (MV3)** for guided UI capture + storage
2. a **Viewer app** (packaged with the extension) for browsing, grouping, comparing, and exporting captured evidence

**Note:** User-facing concepts (e.g., projects, design systems) may layer on top of this architecture but do not alter its core constraints (SW-only IndexedDB access, message passing, viewer-side analysis).

## System components

### Extension components

#### Content script

* **Selection UX**

  * hover highlight
  * click-to-capture (selection-only)
* **Evidence assembly**

  * extracts element intent + evidence anchors
  * extracts **style primitives** (minimal normalized primitives set)
  * captures **conditions** (viewport/DPR/theme/zoom best-effort)
* Requests screenshot capture/crop/encode via MV3 pipeline (background + offscreen)

#### Service worker (MV3 background)

* Owns orchestration and **all IndexedDB reads/writes** (hard rule)
* Triggers screenshot capture and offscreen processing
* Exposes message APIs for Viewer data access:

  * `VIEWER/*` for sessions/captures
  * `AUDIT/GET_BLOB` for screenshot bytes

#### Offscreen execution context (Option A locked)

* Uses **OffscreenCanvas** to crop + encode images reliably
* Returns encoded Blob + metadata to background
* Avoids content-script lifecycle issues

---

## Viewer app (packaged web app)

* Built by **Vite** into `dist/viewer.html` (shipped inside the extension)
* Opened from popup via:

  * `chrome.runtime.getURL("viewer.html")` (or equivalent packaged path)

### Critical rule: Viewer does not access IndexedDB directly

* Viewer reads everything via service worker message passing only.

### Viewer responsibilities (Milestone 2 + 3)

* Sessions list + open session
* Capture gallery + thumbnails (blob fetch via SW)
* Filters: search, has screenshot, tag/type dropdown
* Grouped/ungrouped toggle

#### Viewer-side grouping & explainability (Milestone 3)

Grouping/clustering remains **viewer-only** (no persisted signatures in DB).

* Supported grouping modes:

  1. **Tag + Name**
  2. **Tag + Role + Name**
  3. **Tag + Role + Name + Primitives (bucketed)**

* “Why grouped?” is explainable:

  * groups carry a tokenized key (e.g. tag/role/name + primitives tokens)
  * UI shows a **Why?** tooltip derived from the key

#### Variants within groups (Milestone 3)

* Within a selected group, Viewer computes **variant keys** based on bucketed primitives
* Group detail supports:

  * `Variants: N`
  * variant chips to filter occurrences
  * per-item variant badge (V1…VN)
  * deterministic ordering (count DESC, key ASC)

#### Compare A/B (Milestone 2)

* Side-by-side screenshots
* Primitives diff shows only differing paths
* Uses stale-request guards for async fetches

#### Export (Milestone 2 + 3)

* Export JSON + CSV:

  * **no embedded image bytes** (uses screenshot blob id refs)
  * strips `styles.computed` from JSON export
  * batching/yielding + progress (“Exporting X/Y…”) to avoid UI freezes

* Optional export toggle (Milestone 3):

  * “Include viewer-derived grouping fields”
  * JSON adds:

    * `viewerDerived: { groupingMode, groupKey, variantKey, signatureVersion: 1 }`
  * CSV appends:

    * `viewer_grouping_mode`, `viewer_group_key`, `viewer_variant_key`, `viewer_signature_version`
  * **Export-only**: not persisted back to IndexedDB

---

## Data stores (IndexedDB)

We use explicit stores to avoid rewriting captures when images are re-encoded.

* `sessions`

  * internal capture run metadata (session = one audit/capture run)
  * (optional) pages visited breadcrumb

* `captures`

  * structured capture records (JSON)
  * includes `sessionId`, schema versions, conditions, element intent, style primitives
  * references screenshot via `screenshotBlobId` (or equivalent nested screenshot metadata)

* `blobs`

  * `{ id, mimeType, width, height, blob }`
  * blobs are referenced by captures; blobs can be re-encoded later without editing captures

---

## Data flow (capture pipeline)

1. User interacts with page (content script selection UX)
2. Content script builds:

   * element core + intent anchors
   * conditions
   * style primitives (normalized minimal set)
3. Content script sends message to background:

   * capture payload + target crop rect
4. Background:

   * ensures active session exists
   * performs viewport capture
   * sends image + crop rect to offscreen context
5. Offscreen context:

   * crops via OffscreenCanvas
   * encodes/compresses (webp/jpeg) + caps size
   * returns Blob + metadata
6. Background writes:

   * blob to `blobs` store
   * capture record to `captures` store with `screenshotBlobId`

---

## Data flow (Viewer reads + thumbnails)

**Rule:** Service worker is the only IndexedDB accessor. Viewer uses messages.

1. Viewer requests sessions:

   * `VIEWER/LIST_SESSIONS`
2. Viewer requests captures for a session:

   * `VIEWER/LIST_CAPTURES { sessionId }`
3. Viewer requests full capture detail when needed (compare/export):

   * `VIEWER/GET_CAPTURE { captureId }`
4. Viewer requests screenshot bytes:

   * `AUDIT/GET_BLOB { blobId }`

### Blob transfer constraint (MV3)

Chrome MV3 message passing does not reliably transfer ArrayBuffers end-to-end for this project’s pipeline.
So screenshot bytes are returned as:

* `{ ok: true, arrayBuffer: number[] }`

Viewer reconstructs:

* `Uint8Array(number[]) → Blob → URL.createObjectURL(...)`

Viewer caches object URLs and revokes them on unmount to avoid memory leaks.

---

## Style primitives + bucketing (viewer-side)

* Extension stores **normalized primitives** (raw + canonical where relevant)
* Viewer may **bucket** primitives for grouping/variants (heuristic + explainable)

  * example: padding buckets, RGB buckets (clamped), alpha buckets, shadow presence/count

Bucketing remains viewer-derived and versionable via `signatureVersion`.

---

## Non-goals (as of Milestone 3)

* No dedupe/signature keys persisted back into IndexedDB (analysis stays in viewer)
* No deep-link routing required
* No dark mode required
* No virtualization/pagination unless large sessions demand it
* No “simulated” pseudo-state evidence (hover/active) captured automatically (to avoid false evidence)

---

## Recently completed

* **Milestone 4**: Verified capture UX (metadata pill, pragmatic landmarks, freeze + confirm)
* **Milestone 5**: Trust loop (viewer refresh, undo last capture, non-fatal toast feedback)
* **Milestone 6**: Designer categories (viewer-side classification: Action, Input, Navigation, Content, Media, Container, Other)

See `docs/MILESTONES.md` for full roadmap and acceptance criteria.
