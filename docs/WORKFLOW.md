# Workflow

## Build / test loop (extension + viewer)
1) Build:
   - run your standard build command (e.g. `npm run build` / `pnpm -w build`)
   - confirm `viewer.html` is generated into the extension `dist/` output (Vite build output)
2) chrome://extensions → Reload extension
3) Refresh the target webpage tab (so the content script reloads)
4) Test capture flow in the page (see Milestone 4 notes below)
5) Test Viewer:
   - open popup → click **Open Viewer**
   - verify sessions, gallery, thumbnails, grouping, compare, export

---

## Milestone 4 testing notes (Verified Capture UX)

When audit mode is enabled:

- **Mouse hover is passive**
  - Moving the pointer updates the overlay + metadata pill
  - No capture occurs until user action (click or frozen confirm)

- **Freeze flow**
  - Hold **Shift** to freeze the current hovered element
  - Overlay + pill remain anchored while frozen
  - Capture reflects the frozen target reference
  - Release Shift to return to normal hover behavior

- **Greedy interaction blocking**
  - While audit mode is ON:
    - page navigation and click handlers are blocked
    - user must disable audit mode (or press Escape, if enabled) to browse normally

- **Screenshot hygiene**
  - Overlay and pill must never appear in captured screenshots
  - Always verify at least one capture per session visually

If behavior feels inconsistent:
- reload the page tab (content scripts do not hot-reload cleanly)
- confirm audit mode state via popup toggle

---

## Debug loop tips

### Capture & screenshots
- If thumbnails look wrong or missing, verify:
  - capture has screenshot reference (e.g. `capture.screenshot.screenshotBlobId`)
  - blob exists in `blobs` store
  - Viewer retrieves bytes via `AUDIT/GET_BLOB`
  - Viewer reconstructs:
    - `number[] → Uint8Array → Blob → objectURL`

### Overlay issues
- If overlays appear in screenshots:
  - confirm overlay/pill are hidden **before** screenshot capture
  - confirm restore happens **after** capture completes
- If double-captures occur:
  - verify pointerdown vs click paths are gated correctly
  - ensure frozen capture path only fires once

---

## Popup behavior
- Popup closes when you click the page (expected).
- Popup state should not be relied on for capture confirmation (content script is authoritative).

---

## Claude working rules
- Small incremental diffs only.
- Only apply changes when explicitly told **“apply changes”**.
- When applying changes:
  - edit files in-place
  - **show a unified diff after edits** for review
- Do not run build unless explicitly requested.
- Never edit `apps/**/dist/**`.
- 🚨 If making a risky change:
  - commit first or create a backup file
  - remove/ignore `.bak` files before committing
