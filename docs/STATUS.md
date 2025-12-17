# Project Status

## Current Milestone
**Milestone 1 v2.2: COMPLETE** ✅ (Tagged: `milestone-1-complete`)

## Milestone 1 v2.2 - Completion Summary
All core requirements achieved:

### Completed Features
## Milestone 2 v2.2 — Viewer gallery + naive clustering (Complete) — 2025-12-17

### What’s complete
- Viewer builds via Vite into `dist/` and is opened from popup via `chrome.runtime.getURL("viewer.html")`.
- Viewer uses message passing only; service worker remains the only IndexedDB accessor.
- Sessions list + session selection + captures gallery + thumbnails (blob fetch via `AUDIT/GET_BLOB` returning `{ ok: true, arrayBuffer: number[] }`).
- Filters: search (substring), has-screenshot toggle, tag/type dropdown. Filters combine correctly.
- Grouped/ungrouped toggle with naive grouping: `tagName + unicode-safe normalized accessibleName`.
- Group detail view with occurrences count.
- Compare A/B: side-by-side screenshots + primitives diff showing only differing paths.
- Export JSON + CSV:
  - no embedded image bytes (uses `screenshotBlobId` refs)
  - strips `styles.computed` from JSON
- Stability/perf improvements:
  - stale request protection for capture loads
  - blob URL caching + cleanup
  - missing blob handling UI (“No screenshot” vs “Missing blob”) with deduped logging
  - export progress + batching/yielding to keep UI responsive
- UX polish:
  - loading/error states with Retry
  - empty states (“No captures in this session yet”, “No captures match your filters” + Clear filters)
  - type/tag chip on capture cards
  - group label tooltip
  - focus-visible keyboard styling

### Acceptance checks (smoke)
- Sessions load (and error banner + Retry works if SW fails).
- Selecting sessions loads captures without stale overwrites when switching quickly.
- Missing screenshots show “No screenshot”; missing blob records show “Missing blob”.
- Export shows progress, completes, and UI remains responsive for large sessions.


### Known Limitations (Acceptable for MVP)
- `browserZoom` remains null (flaky detection, not critical)
- Hotkey capture not implemented (optional feature)
- No dedupe/signature keys in extension (deferred to Milestone 2 viewer)


## Technical Notes
- Extension follows MV3 architecture (service worker, offscreen document, content script)
- Message passing pattern established for cross-context communication
- ArrayBuffer data converted to Arrays for chrome.runtime.sendMessage compatibility
- Backward compatibility: old captures tolerate missing v2.2 fields
