Below is an **updated `ARCHITECTURE.md`** that reflects **Milestone 4 completed** (Slices 4.1–4.3) and captures the *current, real behavior* without overcommitting to Milestone 5.

---

# Architecture (High Level) — v2.4

*Last updated: 2025-12-19 (Europe/Madrid)*

This project consists of:

1. a **Chrome Extension (MV3)** for guided UI capture + storage
2. a **Viewer app** (packaged with the extension) for browsing, grouping, comparing, and exporting captured evidence

## System components

### Extension components

#### Content script

**Responsibilities:**

* **Capture UX (Verified Capture)**

  * hover highlight overlay
  * metadata pill anchored to hovered element (verified target)
  * optional **freeze** to lock the current target reference (keyboard)
  * confirm-to-capture behavior (selection-only)

* **Evidence assembly**

  * extracts element intent + evidence anchors
  * extracts **style primitives** (minimal normalized primitives set)
  * captures **conditions** (viewport/DPR/theme/zoom best-effort)
  * captures **environmental scope context** (nearest landmark role)

* **Screenshot hygiene**

  * ensures overlay/pill are not included in captured screenshots (hidden during screenshot capture window)

> The content script does **not** write to IndexedDB. It only assembles capture payloads and communicates via message passing.

#### Service worker (MV3 background)

* Owns orchestration and **all IndexedDB reads/writes** (hard rule)
* Triggers screenshot capture and offscreen processing
* Exposes message APIs for:

  * `VIEWER/*` for sessions/captures
  * `AUDIT/GET_BLOB` for screenshot bytes

#### Offscreen execution context (Option A locked)

* Uses **OffscreenCanvas** to crop + encode images reliably
* Returns encoded Blob + metadata to background
* Avoids content-script lifecycle issues

---

## Viewer app (packaged web app)

* Built by **Vite** into packaged HTML
* Opened from popup via:

  * `chrome.runtime.getURL("viewer.html")` (or equivalent packaged path)

### Critical rule: Viewer does not access IndexedDB directly

Viewer reads everything via **service worker message passing only**.

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

  * groups carry a tokenized key (tag/role/name + primitives tokens)
  * UI shows a **Why?** tooltip derived from the key

#### Variants within groups (Milestone 3)

* Viewer computes **variant keys** based on bucketed primitives
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

  * session metadata
  * (optional) pages visited breadcrumb

* `captures`

  * structured capture records (JSON)
  * includes `sessionId`, schema versions, conditions, element intent, style primitives
  * optional `scope` context (landmarks)
  * references screenshot via `screenshotBlobId` (or equivalent nested screenshot metadata)

* `blobs`

  * `{ id, mimeType, width, height, blob }`
  * blobs are referenced by captures; blobs can be re-encoded later without editing captures

---

## Data flow (capture pipeline)

1. User enables audit/capture mode (popup → SW → content script)
2. Content script:

   * tracks hovered element
   * displays overlay + metadata pill (verified target)
   * optionally freezes target reference (keyboard)
3. On confirm capture:

   * content script assembles capture payload:

     * element core + intent anchors
     * conditions
     * style primitives (normalized minimal set)
     * scope: nearest landmark role
     * crop rect from element bounding box
4. Content script sends message to background:

   * capture payload + target crop rect
5. Background:

   * ensures active session exists
   * performs viewport capture
   * sends image + crop rect to offscreen context
6. Offscreen context:

   * crops via OffscreenCanvas
   * encodes/compresses (webp/jpeg) + caps size
   * returns Blob + metadata
7. Background writes:

   * blob to `blobs` store
   * capture record to `captures` store with `screenshotBlobId`

---

## Milestone 4 — Verified Capture UX (implemented)

Milestone 4 turns “blind click” capture into **verified evidence capture**.

### Slice 4.1 — Metadata Pill

* Fixed-position pill anchored to hovered element
* Shows only:

  * `<tag>`
  * readable selector-ish path
* Anchored above/below hovered element with viewport clamping
* Hidden during screenshot capture window

### Slice 4.2 — Pragmatic Landmarks (scope context)

* Content script computes nearest landmark role (innermost wins), using:

  * explicit ARIA role first
  * semantic tags fallback
  * capped ancestor walk
* Stored as optional:

  * `scope?: { nearestLandmarkRole?: LandmarkRole }`
* Preserved by service worker; viewer may ignore if unknown

### Slice 4.3 — Live-Value Freeze + Confirm Save

* Designed to capture **live DOM state as-is** (no simulated pseudo-states).
* User creates the desired state manually (hover/menus/pressed, etc.)
* Content script supports:

  * freeze target reference (keyboard)
  * confirm capture without relying on persisted dedupe keys
* Implementation details (high-level):

  * overlay/pill remain anchored to frozen element while frozen
  * capture flow hides overlay/pill during screenshot capture window to prevent self-inclusion
  * protections exist to avoid double-capture from overlapping pointer/click event sequences

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

## Non-goals (as of Milestone 4)

* No dedupe/signature keys persisted back into IndexedDB (analysis stays in viewer)
* No deep-link routing required
* No dark mode required
* No virtualization/pagination unless large sessions demand it
* No automatic pseudo-state simulation (hover/active) for evidence (avoid false evidence)
* No sidebar capture workflow yet (verified capture remains overlay/pill based)

---

## Next (Milestone 5 direction — Capture Review & Trust)

Milestone 5 will focus on reducing mistakes and increasing confidence after capture (review/undo/trust), while preserving:

* SW-only IndexedDB access
* message-passing boundaries
* minimal diffs and backwards-tolerant viewer reads

---
