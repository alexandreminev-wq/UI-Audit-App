# UI Inventory — Milestones

This document defines the official project milestones.
Milestones marked as **LOCKED** define the MVP contract and should not be expanded.

---

## Milestone 1–6 (Completed)
Foundational architecture, capture pipeline, Viewer scaffolding, and explainable inventory model.
Details preserved in git history.

---

## Milestone 7 — Viewer Completion (LOCKED ✅)

**Goal:** Deliver a complete, trustworthy Viewer for reviewing captured UI inventory.

### 7.1–7.3 Viewer Shell & Navigation
- Project-based routing (no session UI)
- URL-driven project navigation
- Back/forward browser support
- Stable Viewer shell layout

**Status:** ✅ Done

---

### 7.4 Derived Inventory (Components + Styles)
- Components derived from saved captures only
- Styles derived independently from same capture set
- Draft captures excluded from Viewer
- Re-derivation on delete

**Status:** ✅ Done

---

### 7.5 Viewer Interactions
- Grid layout for components
- Table layout for styles
- Component details drawer
- State switching (default, hover, active, etc.)

**Status:** ✅ Done (pre-scope reduction)

---

### 7.6 Review Layers
- Notes + tags (annotations)
- Identity overrides (name, category, type, status)
- Explicit save semantics
- Non-mutating merges

**Status:** ✅ Done

---

### 7.7 Export
- Export derived inventory to Figma
- Evidence-first frames
- No layout guessing or mutation

**Status:** ✅ Done

---

## Milestone 8 — MVP Tightening & Regression Recovery (LOCKED 🚨)

**This milestone defines the FINAL MVP scope.**

No new features may be added beyond this milestone.

---

### 8.1 Regression Recovery (REQUIRED)

**Goal:** Restore previously working MVP-critical behavior.

- Restore **Source filter** to include capture-level URLs (not page-only)
- Restore **Visible Properties**:
  - Inline style evidence tables inside component cards
  - Read-only, no interaction
- Fix **state semantics**:
  - Buttons use interaction states (hover, active, focus, disabled)
  - Form elements use value states (checked/unchecked, selected/unselected)
  - Prevent cross-type state assignment

**Status:** ⏳ Planned

---

### 8.2 Scope Reduction (REQUIRED)

**Goal:** Reduce UI complexity to MVP-essential views only.

- Components:
  - Grid view only
  - Remove view toggles
- Styles:
  - Table view only
  - Remove view toggles
- Remove unused or redundant controls

**Status:** ⏳ Planned

---

### 8.3 Viewer Polish (CAPPED)

**Goal:** Finish the Viewer without expanding scope.

Allowed:
- Header spacing, alignment, hierarchy polish
- Viewer empty states:
  - No projects
  - Project with no captures
  - No styles
- Non-active tab view polish (copy + layout)

Not allowed:
- New controls
- New views
- New interaction patterns

**Status:** ⏳ Planned

---

## Milestone 9 — Post-MVP (NOT STARTED)

Explicitly out of MVP scope:
- Cloud sync
- Team accounts
- Sharing
- Advanced analytics
- Capture deduplication
- Automated grouping
- Design system enforcement

---

## MVP Definition (LOCKED)

MVP is complete when a solo designer can:
1. Create an audit
2. Capture UI elements
3. Review components and styles
4. Annotate and override identity
5. Export to Figma
6. Exit without broken or ambiguous state

Offline-only. Deterministic. Explainable.
