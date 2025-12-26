# STATUS

_Last updated: 2025-12-25 (Europe/Madrid)_

This document tracks current focus, recently completed work, key decisions, and known issues.

---

## Current focus

Active work across Milestones 6.1–6.3:

- **Milestone 6.1** — Classification & designer-readable naming
  - Classifier utility (view-only) for categorizing captures
  - Designer-friendly type labels + functional categories
  - Directory grouping wired to real project captures

- **Milestone 6.2** — Visual Essentials (human-readable style display)
  - Show essential style properties designers expect in side panel
  - Background color, text color, padding, border radius, shadow presence
  - Clear, scannable presentation of visual primitives

- **Milestone 6.3** — Variable provenance display (tokens deferred)
  - Surface CSS variable references (e.g., `var(--...)`) as evidence when detectable
  - No token inference or declaration in v1; user-defined semantics only

## Upcoming (not current work)

**Milestone 7** — Viewer workflows (manual refinement, grouping, analysis)

This work begins after the capture + side panel model is validated and stabilized.

---

## Recently completed (high level)

- ✅ Milestones 1–5 (capture pipeline, viewer gallery/grouping, verified capture UX, trust loop)
- ✅ Milestone 6 (legacy viewer-only designer categories) — frozen
- ✅ Milestone 6.1 (in progress): core projects + side panel flows working:
  - Side panel scaffold, Tailwind styles loading
  - Projects + session linking via DB v3 (`projects`, `projectSessions`)
  - Side panel can toggle capture (per-tab)
  - Aggregated project captures list in side panel
  - Screenshot rendering in side panel via `AUDIT/GET_BLOB`
  - Delete capture works (real DB delete)
  - Component counts on project cards
  - Viewer open buttons from Start and Project screens
  - Auto-refresh after capture and auto-open captured component detail

---

## Key decisions (locked)

- **SW owns IndexedDB**: all reads/writes through SW messages only
- **Viewer-side analysis**: do not persist grouping keys/signatures to captures
- **Projects are user-facing; sessions are internal**
- **Per-tab capture enablement**:
  - capture mode does not "follow you" across tabs automatically
  - side panel UI stays in sync with the currently registered tab

---

## Known issues / deferred

- **Overlay occasionally appears in screenshots** (needs capture-time overlay suppression; deferred)
- **Project deep-linking in viewer** is best-effort only (viewer redesign is Milestone 7)
- **Large sessions**: virtualization deferred unless needed
- **Dark mode**: not implemented (low priority)
