# Testing Checklist — Milestone 1 v2.2

## Manual smoke tests (developer)
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
  - timestamp uses createdAt
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
  - capture includes `screenshotBlobId` + metadata
  - image looks correctly cropped (not full viewport unless intended)

### G) Backward compatibility
- With old captures in DB:
  - open popup/debug UI
  - confirm it renders without crashes
  - confirm v2.2 fields show as “missing” rather than breaking

## Optional tests
- Large viewport: verify dimension cap/compression
- Dark mode page: confirm themeHint best-effort
