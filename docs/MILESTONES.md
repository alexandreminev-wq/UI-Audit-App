# MILESTONES

_Last updated: 2025-12-17 (Europe/Madrid)_

This file is the canonical milestone plan for the **UI Inventory App**. Milestones are scoped to keep changes incremental and verifiable, with a bias toward viewer-side analysis over extension-side complexity.

---

## Guiding principles (canon)

- We are building **guided capture + automatic grouping of what you captured**.
- We are **not** claiming complete UI coverage.
- **Service worker is the only IndexedDB accessor**.
- Popup + Viewer use **message passing only**.
- Screenshot bytes must survive MV3 messaging:
  - Transfer as `number[]` and reconstruct in the viewer.
- Keep capture schema versioned:
  - `captureSchemaVersion: 2`
  - `stylePrimitiveVersion: 1`

---

## Milestone 1 v2.2 — Extension capture + evidence + storage (✅ Complete)

### Goal
Enable guided element capture on real pages and store trustworthy evidence in IndexedDB via the MV3 service worker.

### Scope
- Element selection UX (click-to-select)
- Element locator strategy + intent anchors
- Capture “conditions” so evidence is comparable:
  - viewport `{ width, height }`
  - devicePixelRatio
  - browser zoom (best-effort)
  - theme hint (light/dark/unknown)
  - timestamp
- Store normalized style primitives:
  - per-side padding (and similar per-side fields as needed)
  - canonical RGBA color fields + raw strings
  - shadow raw + simplified derived fields (presence/count)
- Screenshot capture and blob storage (reference by id)
- Sessions concept:
  - each capture has `sessionId`
  - sessions are listable

### Acceptance criteria
- Captures persist reliably and are retrievable by session.
- Screenshots are retrievable by blob id.
- Version fields exist on capture records.
- Viewer/popup never access IndexedDB directly (enforced by architecture).

---

## Milestone 2 v2.2 — Viewer gallery + naive clustering (✅ Complete)

### Goal
Move analysis out of the extension into the viewer. The extension only captures and stores.

### Scope
#### Viewer foundations
- Build viewer via Vite into `dist/viewer.html`
- Popup “Open Viewer” opens viewer via `chrome.runtime.getURL("viewer.html")`
- Viewer reads data only via SW messages:
  - `VIEWER/LIST_SESSIONS`
  - `VIEWER/LIST_CAPTURES`
  - `VIEWER/GET_CAPTURE`
  - `AUDIT/GET_BLOB`

#### Gallery + filters
- Sessions list + open session
- Capture gallery with thumbnails
- Filters that combine:
  - substring search (accessible name)
  - has screenshot
  - tag/type filter

#### Naive grouping
- Toggle grouped/ungrouped
- Grouping heuristic:
  - `tagName + unicode-safe normalized accessibleName`
- Group detail (occurrences + count)

#### Compare + export
- Compare A/B:
  - screenshots side-by-side
  - primitives diff showing differing paths only
- Export:
  - JSON (no embedded bytes; strip `styles.computed`)
  - CSV (stable schema mapping)

#### Stability + polish
- Loading/error states with Retry
- Empty states (“No captures…”, “No results…” + clear filters)
- Missing screenshot UX (“No screenshot” vs “Missing blob”)
- Stale request protection for rapid session switching
- Blob URL caching + cleanup
- Export progress + batching/yielding
- Type/tag chip on capture cards
- Group label tooltip
- Keyboard focus-visible styling

### Acceptance criteria
- All viewer features work without direct IndexedDB access.
- Grouping + compare are stable across session switching.
- Export completes and remains responsive on large sessions.

---

## Milestone 3 — Viewer-side clustering improvements (⏳ Next)

### Goal
Improve viewer-side grouping beyond naive `(tagName + accessibleName)` while preserving:
- no dedupe/signature keys stored in capture payload
- analysis remains viewer-side
- performance remains acceptable for large sessions

### Proposed scope (plan-level; finalize during Milestone 3 planning)

#### 3.1 Improved similarity heuristics (viewer-only)
- Extend grouping keys with additional signals (still explainable):
  - role-ish/type hints (if present)
  - primitives buckets (spacing, typography, background/text/border colors, shadow presence)
  - size buckets (optional)
- Configurable “strictness” presets:
  - **Name-only** (current)
  - **Name + type**
  - **Name + type + primitives buckets** (new)

#### 3.2 Variant detection within a group
- Within a group, compute and surface “variant clusters”:
  - e.g., same label but different background color or padding
- Provide a lightweight “Why grouped?” explanation:
  - show which signals matched for the group key

#### 3.3 Large session performance (only if needed)
- Virtualization or pagination for capture grids
- Avoid fetching thumbnails eagerly for off-screen items (if virtualization added)
- Keep grouping computa
