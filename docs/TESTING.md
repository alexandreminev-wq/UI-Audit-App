# Testing Checklist — v2.4 (Milestone 1–8.x)

_Last updated: 2026-01-07 (Europe/Madrid)_

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

### G.1) Capture interactivity: right-click menu + keyboard fallback
- Enable capture mode
- Hover a target element and **right-click**
  - Confirm an in-page capture menu appears near the pointer
  - Confirm the hovered element is “locked” while the menu is open
- Press `.` (period)
  - Confirm the same menu can be opened via keyboard fallback

### G.2) Capture interactivity: screenshot-first modes
- From the in-page capture menu, choose **Capture region… (drag)**
  - Confirm crosshair appears
  - Drag a rectangle and release
  - Confirm a new capture is created with screenshot and correct crop
- From the menu, choose **Capture visible viewport**
  - Confirm a new capture is created whose screenshot matches the visible viewport area
- For both:
  - Confirm hover highlight UI is not visible in the screenshot (best-effort)

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

### N.1) Accordion persistence
- In the component directory, expand one or more category accordions
- Open a component detail view, then close it
- Confirm the previously expanded category accordions remain expanded (no auto-collapse)

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

### S.1) Fieldset classification
- Capture a `<fieldset>` element
  - Verify it classifies to `Forms → Fieldset` by default (no manual override needed)

### S.2) Screenshot taxonomy
- Create a **Region** capture and a **Viewport** capture
  - Verify they appear under `Screenshots → Region/Viewport`
  - Verify they remain unique captures (no unwanted dedupe)

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
