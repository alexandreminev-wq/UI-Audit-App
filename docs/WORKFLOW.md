# Workflow

## Build / test loop (extension + viewer)
1) Build:
   - run your standard build command (e.g. `npm run build` / `pnpm -w build`)
   - confirm `viewer.html` is generated into the extension `dist/` output (Vite build output)
2) chrome://extensions → Reload extension
3) Refresh the target webpage tab (so the content script reloads)
4) Test capture flow in the page
5) Test Viewer:
   - open popup → click **Open Viewer**
   - verify sessions, gallery, thumbnails, grouping, compare, export

## Debug loop tips
- If thumbnails look wrong or missing, verify:
  - capture has screenshot reference (e.g. `capture.screenshot.screenshotBlobId`)
  - blob exists in `blobs` store
  - Viewer retrieves bytes via `AUDIT/GET_BLOB` and reconstructs `number[] → Blob → objectURL`

## Popup behavior
- Popup closes when you click the page (expected).

## Claude working rules
- Small incremental diffs only.
- Only apply changes when explicitly told **“apply changes”**.
- When applying changes:
  - edit files in-place
  - **show a unified diff after edits** for review
- Do not run build unless explicitly requested.
- Never edit `apps/**/dist/**`.
- 🚨 If making a risky change, commit first or create a backup file, and remove/ignore `.bak` files before committing.
