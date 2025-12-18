```md
# MILESTONES

*Last updated: 2025-12-18 (Europe/Madrid)*

This file is the canonical milestone plan for the **UI Inventory App**. Milestones are scoped to keep changes incremental and verifiable, with a bias toward viewer-side analysis over extension-side complexity.

---

## Guiding principles (canon)

* We are building **guided capture + automatic grouping of what you captured**.
* We are **not** claiming complete UI coverage.
* **Service worker is the only IndexedDB accessor**.
* Popup, Content Script, and Viewer use **message passing only** (no direct IndexedDB access).
* Binary in MV3:
  * Prefer storing screenshots as **Blobs in IndexedDB** (via the service worker).
  * If bytes ever traverse messages, transfer as `number[]` and reconstruct on the receiving end.
* Keep capture schema versioned and forward-compatible (ignore unknown fields safely).
* Avoid “false evidence”:
  * Prefer **passive observation + user confirmation** over simulating pseudo-states (`:hover`, `:active`).

---

## Milestone 1 v2.2 — Extension capture + evidence + storage (✅ Complete)

### Goal
Enable guided element capture on real pages and store trustworthy evidence in IndexedDB via the MV3 service worker.

### Scope
* Element selection UX (click-to-select)
* Element locator strategy + intent anchors
* Capture “conditions” so evidence is comparable:
  * viewport `{ width, height }`
  * devicePixelRatio
  * browser zoom (best-effort)
  * theme hint (light/dark/unknown)
  * timestamp
* Store normalized style primitives:
  * per-side padding (and similar per-side fields as needed)
  * canonical RGBA color fields + raw strings
  * shadow raw + simplified derived fields (presence/count)
* Screenshot capture and blob storage (reference by id)
* Sessions concept:
  * each capture has `sessionId`
  * sessions are listable

### Acceptance criteria
* Captures persist reliably and are retrievable by session.
* Screenshots are retrievable by blob id.
* Version fields exist on capture records.
* Viewer/popup never access IndexedDB directly (enforced by architecture).

---

## Milestone 2 v2.2 — Viewer gallery + naive clustering (✅ Complete)

### Goal
Move analysis out of the extension into the viewer. The extension only captures and stores.

### Scope

#### Viewer foundations
* Build viewer via Vite into `dist/viewer.html` (build output only; **never hand-edit dist**).
* Popup “Open Viewer” opens viewer via `chrome.runtime.getURL("viewer.html")`.
* Viewer reads data only via SW messages:
  * `VIEWER/LIST_SESSIONS`
  * `VIEWER/LIST_CAPTURES`
  * `VIEWER/GET_CAPTURE`
  * `AUDIT/GET_BLOB`

#### Gallery + filters
* Sessions list + open session
* Capture gallery with thumbnails
* Filters that combine:
  * substring search (accessible name)
  * has screenshot
  * tag/type filter

#### Naive grouping
* Toggle grouped/ungrouped
* Grouping heuristic:
  * `tagName + unicode-safe normalized accessibleName`
* Group detail (occurrences + count)

#### Compare + export
* Compare A/B:
  * screenshots side-by-side
  * primitives diff showing differing paths only
* Export:
  * JSON (no embedded bytes; strip `styles.computed`)
  * CSV (stable schema mapping)

#### Stability + polish
* Loading/error states with Retry
* Empty states (“No captures…”, “No results…” + clear filters)
* Missing screenshot UX (“No screenshot” vs “Missing blob”)
* Stale request protection for rapid session switching
* Blob URL caching + cleanup
* Export progress + batching/yielding
* Type/tag chip on capture cards
* Group label tooltip
* Keyboard focus-visible styling

### Acceptance criteria
* All viewer features work without direct IndexedDB access.
* Grouping + compare are stable across session switching.
* Export completes and remains responsive on large sessions.

---

## Milestone 3 — Explainable clustering + variant detection (✅ Complete)

### Goal
Improve viewer-side grouping beyond naive `(tagName + accessibleName)` while preserving:
* no dedupe/signature keys stored in capture payload
* analysis remains viewer-side
* performance remains acceptable for large sessions

### Scope

#### 3.1 Grouping modes with primitives bucketing (✅ Complete)
* Three configurable grouping presets:
  * **Tag + Name:** `tagName::normalizedName` (fast, default)
  * **Tag + Role + Name:** `tagName::role::normalizedName`
  * **Tag + Role + Name + Primitives:** includes bucketed padding/colors/shadow
* Primitives bucketing functions:
  * Padding: rounded to nearest 4px
  * Colors: 16-step RGB buckets (0,16,32...240), alpha to 0.1 precision
  * Shadow: presence + layer count
* Viewer dropdown to switch modes without page reload

#### 3.2 Explainable "Why grouped?" tooltips (✅ Complete)
* Each group card shows a "Why?" affordance with tooltip
* Tooltip content shows:
  * Base grouping fields: tag, role (when enabled), name
  * Primitives breakdown (when primitives mode enabled):
    * Padding values (pt/pr/pb/pl)
    * Color tokens (bg/bd/c)
    * Shadow token

#### 3.3 Variant detection within groups (✅ Complete)
* Group detail view computes variant clusters using primitives bucketing
* UI shows:
  * "Variants: N" count
  * Variant filter chips (only when N > 1)
  * "V{index}" badge on each capture card
* Variants sorted deterministically (count DESC, then key ASC)
* Click chip to filter group items by variant
* Memoized computation (avoids rebuild on every render)

#### 3.4 Export enhancement (optional) (✅ Complete)
* Checkbox: "Include viewer-derived grouping fields"
* When enabled:
  * JSON adds `viewerDerived` object to each capture
  * CSV appends columns: `viewer_grouping_mode`, `viewer_group_key`, `viewer_variant_key`, `viewer_signature_version`
* **Export-only:** not persisted to IndexedDB

---

## Milestone 4 — Verified capture UX + environmental context (⏳ Next)

### Goal
Transform capture from “blind click” into **verified evidence** by adding a small on-page inspector (“Metadata Pill”), minimal scope context, and a freeze/confirm flow.

### Hard rules (canon for Milestone 4)
* **No IndexedDB access outside the service worker.**
* Popup/content script/viewer use **message passing only**.
* **No edits to dist outputs** (build artifacts only).
* Keep diffs small and verifiable; ship in slices.

### Milestone 4 slices

#### 4.1 The Metadata Pill (✅ target: implement first)
**What it is**
* A small, fixed overlay in the **top-right** of the page.
* Shows metadata for the element currently under hover:
  * Tag name (e.g., `<button>`)
  * A best-effort selector string (CSS-ish, not guaranteed unique)
  * A short semantic label when present (best-effort):
    * `aria-label` → `aria-labelledby` text → `title` → short `textContent`

**Constraints**
* No interaction.
* `pointer-events: none`.
* Must not appear in captured screenshots:
  * hide before screenshot capture, restore after.

**Acceptance criteria**
* When audit/hover mode is enabled, the pill appears and updates as the user hovers.
* When audit mode is disabled, the pill is removed.
* Captured screenshots do **not** include the pill.

---

#### 4.2 Pragmatic Landmarks (⏳ after 4.1 is verified)
**What it is**
* Extend pill context with a nearest “landmark scope” label.
* Only consider nearest ancestor (including self) matching one of:
  * `[role="banner"]`
  * `[role="navigation"]`
  * `[role="main"]`
  * `[role="contentinfo"]`

**Constraints**
* Keep algorithm pragmatic:
  * no full accessibility tree work
  * no exhaustive landmark roles
* Display-only (no new persistence required).

**Acceptance criteria**
* Pill shows the nearest matching landmark role (or “none”) for hovered elements.
* No measurable performance degradation on mousemove (updates only on element change).

---

#### 4.3 Live-Value Freeze + Confirm Save (⏳ after 4.2 is verified)
**What it is**
* Holding **Shift** “freezes” the pill values (tag/label/selector/landmark) even if hover changes.
* Adds a minimal **Confirm Save** flow:
  * User freezes, then clicks an element to capture
  * UI makes it clear the capture will reflect the frozen target
  * Allows user to confirm/cancel the save

**Constraints**
* Still no sidebar; keep UI minimal and resilient to CSS collisions.
* Avoid pseudo-state simulation; do not attempt to force `:hover/:active`.

**Acceptance criteria**
* Shift reliably freezes/unfreezes pill values.
* Confirm Save is required before capture is persisted.
* Cancel returns to normal hover mode without capturing.
* Screenshots never include overlays (pill/outline/confirm UI).

---
```
