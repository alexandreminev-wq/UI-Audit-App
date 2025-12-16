# Project Status

## Canon version
Milestones/specs are based on **Milestone 1 v2.2**.

## What “done” means for Milestone 1 v2.2
A capture is considered valid when:
- It belongs to a session (`sessionId`)
- It includes schema stamping (`captureSchemaVersion: 2`)
- It includes conditions + intent anchors (best-effort)
- Styles are stored as primitives (raw + canonical where required)
- Screenshot is stored as a Blob in IDB and referenced by `screenshotBlobId`
- No dedupe/signature keys exist in the extension

## Current progress
- Hover highlight ✅
- Click-to-capture ✅
- IndexedDB persistence ✅/⬜ (depends on current repo state)
- Schema v2.2 fields ⬜
- Sessions store + sessionId enforcement ⬜
- Style primitives v2 ⬜
- OffscreenCanvas screenshot pipeline ⬜
- blobs store + screenshotBlobId ⬜

## Next implementation sequence (recommended)
1) Types: CaptureRecord v2.2 + SessionRecord + BlobRecord
2) IDB schema: add `sessions` + `blobs`, ensure `captures` shape tolerant
3) Session writing: create/activate session, attach `sessionId` to captures
4) Capture builder: conditions + intent anchors
5) Style primitives extraction: raw + canonical RGBA + shadow presence/layers
6) Screenshot pipeline: viewport capture → offscreen crop/encode → blob store → reference id
7) Popup/Debug UI: render v2.2 fields safely (tolerate missing fields)

## Known risks
- browserZoom is flaky; treat as optional and do not depend on it
- Backward compatibility: old capture rows may lack new fields; UI must tolerate undefined
