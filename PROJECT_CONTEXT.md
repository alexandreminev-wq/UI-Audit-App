# UI Inventory App — Project Context (Canon)

## What we are building
A Chrome Extension (MV3) that supports **guided UI capture**:
- user selects elements on real web pages
- extension captures structured evidence (DOM/intent + style primitives + screenshot)
- a Viewer groups/normalizes what was captured (viewer-side, not capture-side)

## What we are NOT claiming (yet)
We are not claiming complete coverage of a UI.
Wording should remain:
> guided capture + automatic grouping of what you captured

## Current milestone
**Milestone 2 v2.2 — Viewer gallery (in progress)**

Key decisions:
- **Sessions exist**: every capture has `sessionId`; a `sessions` store exists
- **Versioning exists now**: `captureSchemaVersion: 2` and `stylePrimitiveVersion: 1`
- **No dedupe/signature keys in extension**
- **Screenshots are processed using OffscreenCanvas (Option A)**
- IndexedDB stores are split:
  - `sessions`, `captures`, `blobs`
- browserZoom is best-effort and optional; expect null frequently
- **Architecture constraint:** popup/viewer/content scripts do NOT access IndexedDB directly  
  → the **service worker is the data API** via `chrome.runtime.sendMessage`

  Add this **entire section** right after the “Architecture constraint” paragraph (before “Data stored per capture”).

-------------

## Service Worker Message API (Canon)

All UI contexts (popup/viewer/content scripts) access data via
`chrome.runtime.sendMessage`. IndexedDB is only accessed in the service worker.

### VIEWER/* (Viewer data API)

#### VIEWER/LIST_SESSIONS
Request:
```ts
{ type: "VIEWER/LIST_SESSIONS"; limit?: number }
````

Response:

```ts
{ ok: true; sessions: SessionRecord[] } | { ok: false; error: string }
```

#### VIEWER/GET_SESSION

Request:
```ts
{ type: "VIEWER/GET_SESSION"; sessionId: string }
```

Response:
```ts
{ ok: true; session: SessionRecord } | { ok: false; error: string }
```

#### VIEWER/LIST_CAPTURES
Request:
```ts
{ type: "VIEWER/LIST_CAPTURES"; sessionId: string; limit?: number }
```

Response (lightweight list items):
```ts
{
  ok: true;
  captures: Array<{
    id: string;
    sessionId: string;
    createdAt: number | null;
    url: string;
    tagName: string | null;
    role: string | null;
    accessibleName: string | null;
    screenshot: {
      screenshotBlobId: string;
      mimeType: string;
      width: number;
      height: number;
    } | null;
  }>;
} | { ok: false; error: string }
```

#### VIEWER/GET_CAPTURE
Request:
```ts
{ type: "VIEWER/GET_CAPTURE"; captureId: string }
```

Response (full capture record):
```ts
{ ok: true; capture: CaptureRecord | CaptureRecordV2 } | { ok: false; error: string }
```

### AUDIT/* (Shared audit + blob API)

#### AUDIT/GET_BLOB

Request:
```ts
{ type: "AUDIT/GET_BLOB"; blobId: string }
```

Response (MV3-safe binary):
```ts
{ ok: true; arrayBuffer: number[] } | { ok: false; error: string }
```

> Note: We intentionally serialize binary as `number[]` because ArrayBuffer cannot be
> transferred reliably through `chrome.runtime.sendMessage` in MV3.

That’s it — it documents **both message namespaces** and matches what your Viewer and popup actually use today.

-----------------------------------------------------

## Data stored per capture (v2.2 summary)
- conditions: viewport, DPR, visualViewportScale, browserZoom?, themeHint?, timestamp
- element core: tagName, role?, intent anchors (best-effort)
- style primitives: spacing per-side, colors raw + canonical RGBA, shadows raw + presence/layers
- screenshot: blob ref via screenshotBlobId

## Viewer (Milestone 2) — what it owns
The Viewer is an extension page (viewer.html) that:
- lists sessions and loads captures via SW message API
- shows capture thumbnails by fetching blobs via SW (binary serialized as number[])
- supports viewer-side filters (search, has screenshot, tag/type)
- supports naive grouping (ex: tagName + normalized accessibleName)
- supports comparing two captures (screenshots + primitives diff)
- supports exporting JSON + CSV without embedding image bytes (references blobId)

## What comes next (Milestone 2 remainder / later milestones)
- better grouping heuristics (role, intent anchors, primitives, URL host, etc.)
- stable “normalization versioning” in viewer (rules evolve)
- performance pass for large sessions
- richer export formats + tagging/notes
