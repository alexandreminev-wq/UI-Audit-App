# UI Inventory App — Claude Working Agreement (Canon)

This repo contains a **Chrome Extension (MV3)** that captures UI evidence (DOM + style primitives + screenshots) into IndexedDB, plus a **Viewer** (later milestone) that groups/normalizes what was captured.

## Product wording (avoid expectation drift)
This product provides **guided capture + automatic grouping of what you captured**.
It does NOT promise complete coverage unless/when a coverage primitive exists.

---

## Current focus
We are implementing **Milestone 1 v2.2** (Capture pipeline v2.2).

Milestone 1 v2.2 adds:
- **Sessions** (every capture belongs to a session)
- **Capture schema versioning** (`captureSchemaVersion`)
- **Style primitives v2** (raw + canonical)
- **Screenshots via OffscreenCanvas** (MV3-friendly)
- **IndexedDB store split**: `sessions`, `captures`, `blobs`

---

## Hard rules (do not violate)
### 1) No grouping/dedupe/signature keys computed in the extension
Do NOT compute any:
- signature keys
- near keys
- buckets (padding buckets, color buckets, etc.)
- “helpful” pre-grouping metadata

The extension stores **raw evidence + simple primitives only**.
The viewer (Milestone 2) owns normalization + signatures.

### 2) Capture record must be self-describing
Each capture must include:
- `captureSchemaVersion: 2`
- optional `stylePrimitiveVersion: 1`
- `sessionId`

This prevents “mystery meat” old rows later.

### 3) browserZoom is optional + flaky
Capture it best-effort if available, but:
- treat it as optional (`null` often)
- do not make logic depend on it
Prefer storing:
- `visualViewportScale` (best-effort)
- `devicePixelRatio`
- viewport dims

### 4) Screenshots are stored as Blobs (not data URLs)
- Store image blobs in `blobs` store
- Reference from capture by `screenshotBlobId`
This allows re-encoding later without rewriting capture records.

---

## Folder map (high level)
- `apps/extension/*` — Chrome extension (MV3)
- `apps/viewer/*` (or similar) — viewer app (later milestone)
- `docs/*` — canonical specs
- `.claude/commands/*` — reusable ClaudeCode prompts

---

## How to work (small, incremental steps)
- Make one change per step (types → capture builder → IDB schema → UI)
- Keep backward compatibility where possible:
  - old captures may be missing v2 fields
  - UI should tolerate `undefined` fields
- Prefer additive schema evolution over destructive migrations.

---

## Milestones
See `docs/MILESTONES.md` for the full map.
