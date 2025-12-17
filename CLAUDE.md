# UI Inventory App — Claude Working Agreement (Canon) — v2.2

This repo contains:
- a **Chrome Extension (MV3)** that captures UI evidence (DOM/intent + style primitives + screenshot refs) into IndexedDB
- a **Viewer** (packaged web app) that browses, groups, compares, and exports what was captured

## Product wording (avoid expectation drift)
This product provides **guided capture + automatic grouping of what you captured**.
It does NOT promise complete coverage unless/when a coverage primitive exists.

---

## Current focus
**Milestone 3 planning and implementation (next).**

Completed:
- ✅ Milestone 1 v2.2 — capture pipeline + evidence + storage
- ✅ Milestone 2 v2.2 — viewer gallery + naive grouping + compare/export + polish

Milestone 3 will improve **viewer-side analysis/clustering** without moving complexity back into the extension.

---

## Hard rules (do not violate)

### 1) Service worker is the only IndexedDB accessor
- Viewer and popup must **never** read/write IndexedDB directly.
- All access is via SW message handlers (e.g. `VIEWER/*`, `AUDIT/GET_BLOB`).

### 2) No grouping/dedupe/signature keys computed in the extension
Do NOT compute or store in capture payload:
- signature keys
- near keys
- buckets (padding buckets, color buckets, etc.)
- “helpful” pre-grouping metadata

The extension stores **raw evidence + simple primitives only**.
Grouping, clustering, and any signatures are **viewer-side only**.

### 3) Capture record must be self-describing
Each capture must include:
- `captureSchemaVersion: 2`
- optional `stylePrimitiveVersion: 1`
- `sessionId`

This prevents “mystery meat” old rows later.

### 4) browserZoom is optional + flaky
Capture it best-effort if available, but:
- treat it as optional (`null` often)
- do not make logic depend on it
Prefer storing:
- `visualViewportScale` (best-effort)
- `devicePixelRatio`
- viewport dims

### 5) Screenshots are stored as Blobs (not data URLs)
- Store image blobs in `blobs` store
- Reference from capture via screenshot blob id (often `capture.screenshot.screenshotBlobId`)
This allows re-encoding later without rewriting capture records.

### 6) MV3 messaging binary constraint (important)
- Do not attempt to pass ArrayBuffers directly through message APIs.
- Blob bytes are transferred as `number[]` and reconstructed in the Viewer.

---

## Folder map (high level)
- `apps/extension/*` — Chrome extension (MV3, incl. viewer page packaged in build output)
- `docs/*` — canonical specs
- `.claude/commands/*` — reusable Claude Code prompts

---

## How to work (small, incremental steps)
- Make one change per step.
- Keep backward compatibility:
  - old captures may be missing fields
  - UI must tolerate `undefined` fields
- Prefer additive evolution over destructive migrations.

---

## Claude Code workflow rules (operational guardrails)
- Small incremental diffs only.
- Only apply changes when explicitly told **“apply changes”**.
- When applying changes:
  - **edit files in-place**
  - **show a unified diff after edits** for review
  - do not rewrite large sections unnecessarily
- 🚨 If a change is risky/large:
  - commit first (checkpoint) or create a backup
  - remove/ignore `.bak` files before committing
- Never edit `apps/**/dist/**`

---

## Milestones
See `docs/MILESTONES.md` for the full map and acceptance criteria.
