# STATUS

_Last updated: 2025-12-17 (Europe/Madrid)_

This document tracks what is **done**, what is **in progress**, and what is **next** for the UI Inventory App.

---

## Current state

- **Milestone 1 v2.2:** ✅ Complete
- **Milestone 2 v2.2:** ✅ Complete
- **Milestone 3:** ⏳ Planning next

---

## Milestone 1 v2.2 — Capture + Evidence (Extension) — ✅ Complete

### Summary
The MV3 extension supports guided element capture and stores structured evidence (intent + conditions + style primitives + screenshot reference) via the **service worker**.

### Key outcomes
- Capture records include required **conditions** so evidence is comparable across sessions:
  - viewport `{ width, height }`
  - devicePixelRatio
  - browser zoom (best-effort)
  - theme hint (light/dark/unknown)
  - timestamp
- Styles store **normalized primitives** (not only raw strings), including per-side spacing and canonicalized colors/shadows (per canon).
- Screenshots are stored as blobs and referenced by id in the capture record.
- **Service worker is the only IndexedDB accessor**; UI contexts use message passing.

### Acceptance checks
- Captures are persisted reliably with session association.
- Screenshot evidence is stored and retrievable by blob id.
- Data versions are included (`captureSchemaVersion`, `stylePrimitiveVersion`).

---

## Milestone 2 v2.2 — Viewer Gallery + Naive Clustering — ✅ Complete (2025-12-17)

### Summary
A Viewer web app (built with Vite into `dist/viewer.html`) provides browsing, grouping, comparison, and export of captured UI evidence. Viewer performs all analysis client-side and reads data via the service worker.

### What’s complete

#### Viewer entry + architecture
- Viewer builds via Vite into `dist/` and is opened from the extension popup with:
  - `chrome.runtime.getURL("viewer.html")`
- Viewer does **not** touch IndexedDB directly; all reads go through:
  - `VIEWER/*` messages
  - `AUDIT/GET_BLOB` for screenshot bytes

#### Sessions + gallery
- Sessions list in a left sidebar
- Session selection loads captures
- Capture gallery shows thumbnails + metadata

#### Filters (combined)
- Search (substring match on accessible name)
- Has screenshot toggle
- Tag/type dropdown filter

#### Grouping (naive clustering)
- Grouped/Ungrouped toggle
- Grouping heuristic: `tagName + unicode-safe normalized accessibleName`
- Group detail shows occurrences and counts

#### Compare A/B
- Set A/B from capture cards
- Compare panel shows:
  - screenshots side-by-side
  - primitives diff showing only differing paths

#### Export
- JSON export:
  - no embedded image bytes (keeps blob id references)
  - strips `styles.computed`
- CSV export with stable flattened schema mapping
- Export UX improvements:
  - status: exporting / success / error
  - progress: “Exporting X / Y…”
  - batching + yielding to reduce UI freezes on large exports

#### Stability + polish
- Loading states for sessions and captures
- Error banners with Retry for sessions and captures
- Empty states:
  - “No captures in this session yet.”
  - “No captures match your filters.” + Clear filters
- Screenshot fallback UX:
  - “No screenshot” when no blob id exists
  - “Missing blob” when blob fetch fails/empty bytes (deduped logging)
- Stale request protection for capture loading (ignores out-of-order responses)
- Blob URL cache + cleanup on unmount
- GroupCard async cancellation guard
- Capture cards include a visible type/tag chip
- Group label tooltip for truncated labels
- Minimal keyboard `:focus-visible` styling

### Acceptance checks (smoke)
- Sessions load; failures show an error banner + Retry.
- Selecting sessions loads captures; rapidly switching sessions does not show stale captures.
- Captures render thumbnails; missing screenshots show “No screenshot”; missing blobs show “Missing blob”.
- Grouping and group drill-down work without crashes.
- Compare A/B works and diff only shows changed primitive paths.
- Export produces JSON/CSV with stable fields and remains responsive with progress visible.

---

## Milestone 3 — Viewer-side Clustering Improvements — ⏳ Planning

### Goal (draft)
Improve viewer-side clustering beyond naive grouping while preserving the architecture rule:
- **No dedupe/signature keys stored in the extension**
- Analysis remains **viewer-side**

### Likely scope candidates (to decide in planning)
- Better similarity heuristics using primitives (spacing/colors/typography/shadow presence)
- Optional viewer-side “signature” computation (computed on demand, not stored by extension)
- Large-session performance improvements (virtualization/pagination) if needed
- Grouping label/readability rules and compare workflow polish

### Not in scope (recommended defer)
- Deep-linking/router
- Dark mode
- Full UI redesign (do after Milestone 3 functionality is feature-frozen)

### Next steps
- Define Milestone 3 success criteria + slice plan
- Implement smallest first slice and keep changes incremental
