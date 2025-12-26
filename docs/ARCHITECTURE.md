# Architecture (High Level) — v2.6

*Last updated: 2025-12-25 (Europe/Madrid)*

This project consists of:

1) a **Chrome Extension (MV3)** for guided UI capture + storage  
2) a **Viewer app** (packaged with the extension) for browsing, grouping, comparing, and exporting captured evidence  
3) a **Chrome native Side Panel** UI for **Projects-first capture workflows** (Milestone 6.1+)

**Non-negotiable rules (canon):**
- **Service worker is the only IndexedDB accessor.**
- Content script / side panel / viewer use **message passing only** (no direct IDB access).
- **Never edit `dist/**` by hand** (build outputs only).
- Viewer/sidepanel compute grouping/labels at runtime; **do not persist derived grouping/signatures** into capture rows.

---

## System components

### 1) Content Script (apps/extension/src/content/*)

Responsibilities:
- **Selection UX**
  - hover highlight/outline
  - click-to-capture (guided capture)
  - metadata pill + pragmatic landmarks + freeze/confirm (Milestone 4)
- **Evidence assembly**
  - element identity + intent anchors (best-effort)
  - capture conditions (viewport/DPR/theme/zoom best-effort)
  - style primitives (minimal normalized set)
- **Triggers capture pipeline**
  - sends capture payload + crop rect to SW
- **Tab registration**
  - sends `UI/REGISTER_ACTIVE_TAB` on load so the SW can resolve “active audit tab” for side panel messages
  - (per-tab capture) asks SW `AUDIT/GET_STATE` after registration and resumes hover mode if enabled

### 2) Service Worker (apps/extension/src/background/serviceWorker.ts)

Responsibilities:
- Owns orchestration and **all IndexedDB reads/writes** (hard rule).
- Owns “state maps” for runtime behavior:
  - audit enabled by tab
  - active session ID by tab
  - active project ID by tab
  - last active audit tab id fallback (because side panel has no `sender.tab`)
- Message APIs:
  - `AUDIT/*` capture pipeline + blob retrieval
  - `VIEWER/*` data access for viewer
  - `UI/*` data access for side panel and project workflows

### 3) Offscreen document (MV3)

Responsibilities:
- Crops/encodes screenshots via **OffscreenCanvas**
- Returns encoded Blob + metadata back to SW

---

## IndexedDB data model (canonical)

**Stores**
- `sessions`
  - internal capture run metadata (session is an internal abstraction)
- `captures`
  - structured capture evidence records
  - captures reference screenshots via blob id (no embedded bytes)
- `blobs`
  - `{ id, mimeType, width, height, blob }`
- `projects` (Milestone 6.1)
  - user-facing “container” object
- `projectSessions` (Milestone 6.1)
  - links `{ projectId, sessionId }` (idempotent) so a project can span multiple sessions

**Key rule:** sessions remain internal. Projects layer on top without changing capture schema.

**User annotations:** User-provided annotations (names, notes, status, grouping) are stored separately from capture records and merged at runtime in the viewer. Capture records remain immutable evidence.

---

## Data flow: capture pipeline

1) User enables capture mode (side panel or other UI)
2) Content script activates hover UX and selection
3) On capture:
   - content script assembles evidence (intent, conditions, primitives, crop rect)
   - sends to SW (`AUDIT/CAPTURE`)
4) SW:
   - ensures session exists for tab
   - triggers screenshot capture and offscreen crop/encode
   - writes blob to `blobs`
   - writes capture record to `captures`
   - links session to active project (if a project is selected for that tab)
5) SW broadcasts:
   - `AUDIT/CAPTURED` (generic)
   - `UI/CAPTURE_SAVED { projectId, captureId }` (side panel auto-refresh hint)

---

## Data flow: Side panel (Projects-first)

### Side panel constraints
Chrome side panel messages often have **no `sender.tab`**, so SW must resolve a tab via:
- `resolveTabId(msg, sender)` which falls back to `lastActiveAuditTabId`
- Content script must register itself as active via `UI/REGISTER_ACTIVE_TAB`

### Side panel → SW message surface (current)
- Projects:
  - `UI/LIST_PROJECTS`
  - `UI/CREATE_PROJECT { title }`
  - `UI/SET_ACTIVE_PROJECT_FOR_TAB { projectId }`
  - `UI/GET_PROJECT_CAPTURES` (returns captures aggregated across sessions linked to active project)
  - `UI/GET_PROJECT_COMPONENT_COUNTS` (counts per project for Start Screen)
  - `UI/DELETE_CAPTURE { captureId }` (real delete)
- Capture:
  - `AUDIT/GET_STATE`
  - `AUDIT/TOGGLE { enabled }`
  - `AUDIT/GET_BLOB { blobId }`

### Side panel UX (today)
- Start screen: create/select project, shows component counts, includes “Open Viewer”
- Project screen: capture toggle, refresh, open viewer, list captured components, view details, delete capture

---

## Data flow: Viewer reads + thumbnails

**Rule:** Service worker is the only IndexedDB accessor. Viewer uses messages.

1) Viewer requests sessions:
   - `VIEWER/LIST_SESSIONS`
2) Viewer requests captures for a session:
   - `VIEWER/LIST_CAPTURES { sessionId }`
3) Viewer requests screenshot bytes:
   - `AUDIT/GET_BLOB { blobId }`

### Blob transfer constraint (MV3)
ArrayBuffers do not reliably survive `chrome.runtime.sendMessage` for this pipeline, so blob bytes are returned as:

- `{ ok: true, arrayBuffer: number[] }`

Viewer/side panel reconstruct:
- `Uint8Array(number[]) → Blob → URL.createObjectURL(...)`

---

## Non-goals (current)
- No persisted grouping/signature keys in IndexedDB
- No viewer redesign until Milestone 7
- No deep linking guarantees (projectId query params are “best effort” hints for future viewer work)
- No automatic pseudo-state simulation (`:hover/:active`) for evidence
- No guarantee that overlays never appear in screenshots (work remains; fix later)
