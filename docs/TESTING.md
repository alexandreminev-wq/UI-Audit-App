# Testing Checklist — v2.2 (Milestone 1 + Milestone 2 + Milestone 4 + Milestone 5)

_Last updated: 2025-12-22 (Europe/Madrid)_

## Manual smoke tests (developer)

# Milestone 1 v2.2 — Extension capture pipeline

### A) Session creation
- Start audit mode
- Confirm a `sessions` record is created
- Confirm every capture has a non-empty `sessionId`

### B) Capture schema stamping
- Confirm every new capture includes:
  - `captureSchemaVersion: 2`
  - optional `stylePrimitiveVersion: 1`
- Confirm UI tolerates old rows missing v2.2 fields

### C) Conditions (best-effort)
- Confirm capture includes:
  - viewport width/height
  - devicePixelRatio
  - visualViewportScale (if available)
  - browserZoom best-effort/optional; expect null
  - timestamp uses createdAt (createdAt is canonical)
- Confirm nothing depends on browserZoom

### D) Intent anchors (best-effort)
- Capture:
  - button with accessible label
  - input type text
  - checkbox (checked state)
  - link (href)
- Confirm fields are populated where relevant and absent otherwise

### E) Style primitives
- Confirm per-side padding exists
- Confirm color fields store:
  - raw string
  - rgba canonical (or null if not parseable)
- Confirm shadow fields store:
  - raw string
  - presence and (optional) layer count

### F) Screenshots (OffscreenCanvas)
- Capture an element with a visible bounding box
- Confirm:
  - a blob is written to `blobs` store
  - capture includes screenshot reference + metadata
    - typically `capture.screenshot.screenshotBlobId` (v2.2)
  - image looks correctly cropped (not full viewport unless intended)

### G) Backward compatibility
- With old captures in DB:
  - open popup/debug UI
  - confirm it renders without crashes
  - confirm v2.2 fields show as “missing” rather than breaking

---

# Milestone 2 v2.2 — Viewer gallery + naive clustering

### H) Viewer opens + loads sessions
- Open Viewer from popup (“Open Viewer” button)
- Confirm sessions list loads
- Failure mode: simulate SW failure → Viewer shows error banner + Retry
- Retry works and sessions load

### I) Open session + stale protection
- Select session A, then quickly select session B
- Confirm captures displayed match the latest selected session (no stale overwrite)

### J) Gallery + filters
- Confirm thumbnails render for captures with screenshot refs
- Confirm type/tag chip is visible on capture cards
- Filters combine correctly:
  - search (substring)
  - has screenshot toggle
  - tag/type dropdown
- No-results state:
  - “No captures match your filters.” + Clear filters works

### K) Empty states
- Session with 0 captures shows:
  - “No captures in this session yet.”

### L) Missing screenshot vs missing blob
- Capture with no screenshot reference shows:
  - “No screenshot”
- Missing blob test:
  - Delete a blob record from IndexedDB (see snippet below)
  - Viewer should show:
    - “Missing blob”
  - Viewer should not crash; warnings should be deduped per blobId

### M) Grouping (naive)
- Toggle grouped view
- Confirm grouping heuristic:
  - `tagName + normalized accessibleName`
- Group cards show:
  - count
  - representative thumbnails
- Group label tooltip shows full label on hover
- Group detail shows occurrences list

### N) Compare A/B
- Set A and B from capture cards
- Compare panel shows:
  - screenshots side-by-side (or appropriate placeholders)
  - primitives diff showing only differing paths

### O) Export
- JSON export:
  - no embedded screenshot bytes
  - screenshot refs preserved (blob id)
  - `styles.computed` stripped
- CSV export:
  - stable flattened fields
- Export UX:
  - shows progress “Exporting X / Y…”
  - stays responsive during export
  - shows “Export complete” on success
  - shows “Export failed” on error

### P) Keyboard focus
- Use Tab to navigate sessions, filters, buttons
- Confirm `:focus-visible` outline is visible
- Mouse clicks should not cause outlines everywhere

---

# Milestone 4 — Verified capture UX + environmental context

### Q) Metadata pill
- Enable audit mode; hover over elements
- Pill appears in top-right corner showing:
  - tag name (e.g., `<button>`)
  - selector string (best-effort)
  - short semantic label (aria-label/title/textContent)
- Pill updates as hover changes
- When audit mode disabled, pill removed
- Pill and outline do NOT appear in captured screenshots

### R) Pragmatic landmarks
- Hover elements with landmark ancestors
- Pill shows `nearestLandmarkRole` when present:
  - banner, navigation, main, contentinfo, complementary, generic
- Elements without landmark ancestors show no landmark label

### S) Freeze + confirm save
- Hold Shift to freeze pill values
- Pill remains frozen even when hovering other elements
- Release Shift to unfreeze
- Click element while frozen → Confirm Save UI appears
- Confirm → capture persists
- Cancel → returns to hover mode without saving
- Screenshots never include pill, outline, or confirm UI

---

# Milestone 5 — Trust loop (undo + refresh + non-fatal feedback)

### T) Viewer Refresh button
- Open Viewer → Sessions header has "Refresh" button
- Click Refresh → sessions list reloads
- If session selected → captures for that session also reload
- UI remains responsive during refresh

### U) Undo last capture
- Capture an element
- Open Viewer → "Recent capture" toast appears with Undo button
- Click Undo → capture deleted; list refreshes
- If delete fails → error message in toast; viewer does not crash
- Click Dismiss → toast disappears

### V) Non-fatal capture toast
- Trigger a capture where service worker is slow/unresponsive
- Page shows toast: "Capture didn't complete. Try again, or reload the page."
- Overlay and pill still restore (no stuck UI)
- Toast appears after ~1200ms timeout
- Viewer continues working normally

---

## Useful debug snippet: force a "Missing blob" state
Run in DevTools console on `chrome-extension://<id>/viewer.html`:

```js
const DB_NAME = "ui-inventory";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const db = await openDb();
const captures = await reqToPromise(db.transaction("captures","readonly").objectStore("captures").getAll());
const c = captures.find(x => x?.screenshot?.screenshotBlobId);

if (!c) {
  console.log("No captures with screenshot.screenshotBlobId found.");
} else {
  const blobId = c.screenshot.screenshotBlobId;
  await reqToPromise(db.transaction("blobs","readwrite").objectStore("blobs").delete(blobId));
  console.log("Deleted blob:", blobId, "for capture:", c.id);
}


---

## Optional tests
- Large viewport: verify dimension cap/compression
- Dark mode page: confirm themeHint best-effort
- Large session (200–500 captures): verify viewer remains usable; export remains responsive
