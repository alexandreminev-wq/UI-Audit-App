# MILESTONES

*Last updated: 2025-12-24 (Europe/Madrid)*

This file is the canonical milestone plan for the **UI Inventory App**.
Milestones are scoped to keep changes incremental and verifiable, with a bias toward viewer-side analysis over extension-side complexity.

---

## Guiding principles (canon)

- Guided capture + automatic grouping of what you captured (no promise of complete coverage)
- Service worker is the only IndexedDB accessor
- Message passing only (no UI direct IndexedDB)
- Never hand-edit `dist/**`
- Avoid “false evidence”: do not simulate pseudo-states (`:hover`, `:active`)
- Prefer reversible changes; keep diffs small; version schemas when needed

---

## Milestone 1 v2.2 — Extension capture + evidence + storage (✅ Complete)

Goal: Guided element capture on real pages and store trustworthy evidence via SW-owned IndexedDB.

Includes:
- sessions created and required for captures
- capture schema versioning
- capture conditions (viewport/DPR/theme/zoom best-effort)
- style primitives (minimal normalized set)
- screenshot capture via offscreen document, stored as blobs and referenced by id

---

## Milestone 2 v2.2 — Viewer gallery + naive clustering (✅ Complete)

Goal: Move analysis out of the extension into the viewer. Extension only captures + stores.

Includes:
- sessions list + open session
- capture gallery + filters
- naive grouping: `tagName + normalized accessibleName`
- compare A/B screenshots + primitives diff
- export JSON/CSV (no embedded bytes)

---

## Milestone 3 — Viewer-side explainable clustering + variants (✅ Complete)

Goal: Improve viewer grouping beyond naive, remain explainable and view-only.

Includes:
- additional grouping modes (role + primitives bucketed)
- “Why grouped?” explanations
- variant detection within groups
- export option to include viewer-derived fields (export-only, not persisted)

---

## Milestone 4 — Verified capture UX (✅ Complete)

Goal: Increase capture correctness and trust.

Includes:
- metadata pill
- pragmatic landmarks (nearest landmark scope label)
- freeze + confirm save
- overlays excluded from screenshots (best-effort)

---

## Milestone 5 — Trust loop (✅ Complete)

Goal: Lightweight review/recovery loops.

Includes:
- viewer manual refresh
- undo last capture plumbing
- non-fatal capture toast if ACK missing

---

## Milestone 6 (legacy) — Viewer-only designer categories (✅ Complete, FROZEN)

Stopgap classification in viewer (Action/Input/Navigation/Content/Media/Container/Other).
Do not redesign/extend this UI in Milestone 6.1 work.

---

# Milestone 6 (new direction) — Projects + Chrome native side panel

## Product decisions (locked)
- Projects are the primary user-facing unit
- Sessions remain internal capture runs
- Projects can contain multiple sessions
- Strategy: (C) now keep session behavior but LINK sessions to project; (B) later add explicit “Start capture run”
- Viewer redesign is Milestone 7 (do not redesign now)

---

## Milestone 6.1 — Projects + side panel shell (✅ In progress; core flows working)

### Goal
Ship a projects-first capture workflow in the native Chrome side panel with real data wiring.

### Scope (implemented / verified)
- Side panel scaffold + icon opens side panel
- Tab resolution strategy for side panel (no sender.tab):
  - content script registers tab
  - SW stores last active audit tab id
- Audit toggle from side panel (per-tab)
- IndexedDB schema v3:
  - `projects` store
  - `projectSessions` store
- Link session→project on capture
- Side panel shell adoption + Tailwind styles loading
- Project-wide component list:
  - SW aggregates captures across all sessions linked to project
- Screenshots render in side panel via `AUDIT/GET_BLOB`
- Delete capture from side panel deletes from DB
- Project cards show component counts
- Viewer button (opens viewer.html; projectId query param hint)

### Still in 6.1 (next)
- Define designer-facing taxonomy + properties (doc + small classifier utility)
- Replace tagName-only categorization with functional category + typeKey mapping (view-only)
- Improve component properties display in detail view (visual essentials)
- Known issue: capture overlay sometimes appears in screenshot (fix later)

### Non-goals (6.1)
- No new viewer redesign
- No “Start capture run” button yet
- No “items” / multi-state framework yet

---

## Milestone 6.2 — Capture preview + confirm save + start capture run (⏳ Planned)

Goal: Make side panel workflow “review then commit”.

Includes:
- explicit “Start capture run” creates new session for project
- capture produces preview, nothing written until confirm
- improved capture review in side panel

---

## Milestone 6.3 — Notes + Item model + multi-state framework (⏳ Planned)

Goal: Add designer workflow features.

Includes:
- notes per item/state
- item concept separate from raw captures
- multi-state slots (hover/active/focus) via instructions (no simulation)

---

## Milestone 7 — Viewer becomes projects dashboard (⏳ Planned)

Goal: Viewer becomes project-centric dashboard.

Includes:
- projects list + project detail
- type rails, canonical/drift/outliers, etc.
