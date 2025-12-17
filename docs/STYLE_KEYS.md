# Project Status

## Current Milestone
**Milestone 2 v2.2: IN PROGRESS** 🟡

Milestone 1 v2.2 remains ✅ COMPLETE (Tagged: `milestone-1-complete`)

---

## Milestone 2 v2.2 - Progress Summary

### Completed so far
- ✅ Viewer entrypoint (viewer.html) built into dist via Vite
- ✅ Service Worker “data API” for viewer:
  - list sessions
  - list captures by session
  - fetch a capture by id
  - fetch blobs by id (existing AUDIT/GET_BLOB)
- ✅ Viewer UI:
  - sessions list (select session)
  - capture grid with screenshot thumbnails
  - viewer-side filters (search, screenshot-only, tag/type)
- ✅ Naive grouping:
  - grouped/ungrouped toggle
  - group cards with count + thumbnails
  - group detail view showing occurrences
- ✅ Compare:
  - select any two captures (A/B)
  - show screenshots side-by-side
  - show primitives diff (only differing fields)
- ✅ Export:
  - JSON export (no embedded screenshot bytes; computed styles omitted)
  - CSV export (flat subset + screenshotBlobId references)

### Known limitations (acceptable right now)
- Grouping heuristic is intentionally naive (tagName + normalized accessibleName)
- No deep-link routing (viewer state is in-memory)
- Export is “MVP-grade” (CSV is a subset; JSON is capture-focused)
- browserZoom still frequently null (by design / best-effort)

---

## Technical Notes (still true)
- MV3 architecture: service worker + offscreen document + content script + UI pages
- UI contexts (popup/viewer) do NOT access IndexedDB directly
- All data access goes through SW message passing
- Binary over sendMessage must be serialized (number[]), not ArrayBuffer
- Backward compatibility: old captures tolerate missing v2.2 fields
