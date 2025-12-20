# STATUS

_Last updated: 2025-12-19 (Europe/Madrid)_

This document tracks what is **done**, what is **in progress**, and what is **next** for the UI Inventory App.

---

## Current state

- **Milestone 1 v2.2:** ✅ Complete
- **Milestone 2 v2.2:** ✅ Complete
- **Milestone 3:** ✅ Complete (2025-12-17)
- **Milestone 4:** ✅ Complete (2025-12-19)

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

## Milestone 3 — Explainable Clustering + Variant Detection — ✅ Complete (2025-12-17)

### Summary
Enhanced viewer-side grouping with multiple modes, primitives-based bucketing, explainability tooltips, and within-group variant detection. All analysis remains viewer-side with no persistence.

### What's complete

#### Grouping modes
- Three grouping presets (viewer dropdown):
  - **Tag + Name:** `tagName::normalizedName` (default, fast)
  - **Tag + Role + Name:** `tagName::role::normalizedName`
  - **Tag + Role + Name + Primitives:** includes bucketed padding/colors/shadow
- Primitives bucketing helpers:
  - Padding: rounded to nearest 4px
  - Colors (RGB): 16-step buckets (0,16,32...240), alpha to 0.1 precision
  - Shadow: presence + layer count

#### Explainable "Why grouped?" affordance
- Each group card shows a "Why?" tooltip
- Tooltip displays:
  - Base grouping: tag, role (if not "norole"), name
  - Primitives breakdown (if primitives mode):
    - Padding: `pt8 pr12 pb8 pl12`
    - Colors: `bg240,240,240,1 bdnone c0,0,0,1`
    - Shadow: `shsome-2`

#### Variant detection within groups
- Group detail view computes variants using primitives bucketing
- Shows "Variants: N" count
- Variant filter chips (only shown when N > 1):
  - "Variant 1 (5)", "Variant 2 (3)", etc.
  - Click to filter group items by variant
  - "All variants" chip to clear filter
- Each capture card shows "V{index}" badge when multiple variants exist
- Variants sorted by count DESC, then key ASC (stable ordering)
- Memoized computation (no rebuild on every render)

#### Export enhancement (optional)
- Checkbox: "Include viewer-derived grouping fields"
- When enabled, JSON export adds `viewerDerived` to each capture:
  ```json
  {
    "groupingMode": "nameTypePrimitives",
    "groupKey": "button::norole::submit::p8-12-8-12::bg...",
    "variantKey": "v::p8-12-8-12::bg240,240,240,1::...",
    "signatureVersion": 1
  }
