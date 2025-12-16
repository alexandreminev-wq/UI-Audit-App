# UI Inventory App — Project Context (Canon)

## What we are building
A Chrome Extension (MV3) that supports **guided UI capture**:
- user selects elements on real web pages
- extension captures structured evidence (DOM/intent + style primitives + screenshot)
- later, a Viewer groups/normalizes what was captured

## What we are NOT claiming (yet)
We are not claiming complete coverage of a UI.
Wording should remain:
> guided capture + automatic grouping of what you captured

## Current milestone
Milestone 1 v2.2 — Capture pipeline v2.2

Key decisions:
- **Sessions exist in Milestone 1**: every capture has `sessionId`; a `sessions` store exists
- **Versioning exists now**: `captureSchemaVersion: 2` (optional `stylePrimitiveVersion: 1`)
- **No dedupe/signature keys in extension**
- **Screenshots are processed using OffscreenCanvas (Option A)**
- IndexedDB stores are split:
  - `sessions`, `captures`, `blobs`
- browserZoom is best-effort and optional; expect null frequently

## Data stored per capture (v2.2 summary)
- conditions: viewport, DPR, visualViewportScale, browserZoom?, themeHint?, timestamp
- element core: tagName, role?, intent anchors (best-effort)
- style primitives: spacing per-side, colors raw + canonical RGBA, shadows raw + presence/layers
- screenshot: blob ref via screenshotBlobId

## What comes next (Milestone 2)
Viewer reads sessions/captures/blobs and computes:
- normalization versioning
- signatures and grouping
- variant gallery + occurrences list
