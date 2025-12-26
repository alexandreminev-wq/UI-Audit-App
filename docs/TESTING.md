# Testing Checklist — v2.3 (Milestone 1–6.1)

_Last updated: 2025-12-25 (Europe/Madrid)_

This is a manual smoke-test checklist for developers.

---

## Milestone 1 v2.2 — Extension capture pipeline

### A) Session creation
- Enable capture mode
- Confirm a `sessions` record is created
- Confirm every capture has a non-empty `sessionId`

### B) Capture schema stamping
- Confirm every new capture includes:
  - `captureSchemaVersion: 2`
  - optional `stylePrimitiveVersion: 1`

### C) Conditions (best-effort)
- Confirm capture includes:
  - viewport width/height
  - devicePixelRatio
  - browserZoom best-effort (often null; acceptable)

### D) Intent anchors (best-effort)
Capture:
- button with accessible label
- link (href)
- checkbox (checked)
Confirm fields are populated where relevant.

### E) Style primitives
- Confirm per-side padding exists
- Confirm color fields store raw + rgba
- Confirm shadow fields store raw + presence

### F) Screenshots
- Capture an element with visible bounding box
- Confirm:
  - blob written to `blobs`
  - capture references `screenshotBlobId`
  - crop looks correct

---

## Milestone 4–5 — Verified capture UX + trust loop

### G) Metadata pill / landmarks / freeze + confirm
- Pill appears + updates
- Landmark role shows when applicable
- Shift freezes values
- Confirm Save required to persist
- Cancel returns to hover mode
- Screenshot should not include UI overlays (best-effort)

### H) Viewer trust loop
- Viewer manual refresh works
- Undo last capture works
- Capture ACK toast appears when capture ACK is delayed/missing (non-fatal)

---

## Milestone 6.1 — Projects + Side Panel

### I) Side panel opens and styles load
- Click extension icon: side panel opens
- Shell UI renders with expected styling (Tailwind tokens)

### J) Projects CRUD (minimum)
- Create a project
- Project appears on start screen list
- Reopen side panel: projects still list (persisted in IDB)

### K) Project linking + capture aggregation
- Open a project in side panel
- Enable capture; capture an element
- Confirm capture appears in project list
- Capture on another page/tab under same project and confirm captures aggregate

### L) Per-tab capture behavior + UI sync
- With a project open, enable capture on Tab A, capture works
- Switch to Tab B:
  - capture button state should reflect Tab B state after tab registers
  - enabling capture on Tab B works
- Refresh Tab B:
  - if capture is enabled for Tab B, content script should resume hover mode after registration

### M) Screenshots in side panel
- Capture an element that generates a screenshot
- Side panel list shows the screenshot without needing a full side panel reload
- Detail view shows screenshot once available

### N) Auto-refresh after capture
- Capture an element
- Side panel should:
  - auto-refresh list
  - auto-open the new component detail

### O) Delete capture (real delete)
- Delete from detail view
- Confirm capture disappears
- Exit project and re-enter; capture should still be gone

### P) Component counts
- Start screen shows a component count under each project name
- Capture/delete changes should eventually reflect in counts (may require reopening side panel depending on current UI refresh behavior)

### Q) Viewer button
- Start screen "Open Viewer" opens viewer.html in a new tab
- Project screen viewer button opens viewer.html?projectId=<id> (hint only for now)

### R) Per-tab capture sync
- Enable capture in Tab A, verify hover/capture works
- Switch to Tab B, verify side panel toggle reflects Tab B state (likely off)
- Enable capture in Tab B, refresh Tab B, confirm hover mode resumes (race condition fix)
- Switch back to Tab A, confirm its state is preserved and reflected

---

## Milestone 6.2–6.3 — Classification, Visual Essentials, Variable Provenance

### S) Classifier correctness (ARIA role vs tagName)
- Capture an element with `role="button"` (e.g., `<div role="button">`)
  - Verify classifier assigns `displayType: "Button"` (ARIA role takes precedence)
- Capture a semantic `<button>` element
  - Verify classifier assigns `displayType: "Button"` (semantic tagName)
- Capture a `<input type="checkbox">` element
  - Verify classifier assigns `displayType: "Checkbox"` (input type)
- Capture a `<div>` with no role
  - Verify classifier assigns a fallback category (e.g., "Container" or "Other")

### T) Visual Essentials readability (no raw JSON by default)
- Capture an element and open its detail view in side panel
- Verify Visual Essentials section shows:
  - Background color (human-readable, e.g., "rgba(255, 255, 255, 1)" or color swatch)
  - Text color (human-readable)
  - Padding (e.g., "16px 24px 16px 24px" or "top: 16px, right: 24px, ...")
  - Border radius (if present)
  - Shadow presence (e.g., "Yes" / "None" or descriptive)
- Verify no raw JSON blobs are shown by default in the essentials view
- Technical details (outerHTML, full computed style) may be collapsed/hidden

### U) Variable provenance display (when CSS variables present)
- Capture an element that uses CSS variables (e.g., `background: var(--primary-color)`)
- Open detail view in side panel
- Verify:
  - Raw CSS variable reference is shown (e.g., `var(--primary-color)`)
  - Computed value is also shown (best-effort)
  - No token inference or compliance labeling in v1 (deferred)
- If element does not use CSS variables:
  - Verify only computed values are shown (no false variable references)
