# UI Inventory — Project Status

This document reflects the current state of the project against the locked MVP contract.

---

## Overall Status

**Phase:** MVP Tightening  
**Confidence:** High  
**Primary Risk:** Regression during final polish  
**Scope Creep Risk:** Low (MVP locked)

---

## What Is Complete ✅

### Architecture
- Service Worker as sole IndexedDB authority
- Message-based UI ↔ data contract
- Project-based data model (no sessions in Viewer)
- Deterministic derivation of components and styles

---

### Capture System
- Computed-style capture only
- Multi-state capture support
- Evidence-first data model
- Explicit save semantics

---

### Viewer
- Project home + project detail routing
- Component inventory derivation
- Style inventory derivation
- Drawer-based review
- Notes, tags, and overrides
- Safe re-derivation on delete
- URL-driven navigation
- DEV-only guardrail logging

---

### Export
- Viewer-driven export
- Figma import support
- Evidence preserved
- No mutation or inference

---

### Sidepanel
- Project creation
- Active tab ownership
- Capture lifecycle safety
- Cleanup on hide/unmount
- Inactive tab handling

---

## Known Issues / Regressions 🚨 (To Be Fixed in Milestone 8)

1. **Source Filter Regression**
   - Currently shows only top-level source
   - Must include capture-level URLs

2. **Visible Properties Regression**
   - Inline style evidence tables missing from component cards
   - Must be restored (read-only)

3. **State Semantics Bug**
   - Button interaction states incorrectly applied to form elements
   - Must enforce component-type-specific state models

---

## MVP Scope Adjustments (Approved)

- Components view: **Grid only**
- Styles view: **Table only**
- Remove view toggles
- Reduce UI complexity

---

## MVP Polish (Approved & Capped)

- Viewer header spacing and hierarchy
- Empty states:
  - No projects
  - No captures
  - No styles
- Non-active tab view polish

No new features permitted.

---

## Explicitly Out of Scope (Post-MVP)

- Draft UI
- State editing
- Cloud accounts
- Team workflows
- Sharing links
- Advanced filtering
- Auto-grouping or inference

---

## MVP Ship Criteria

MVP is ready to ship when:
- All regressions are resolved
- Scope reductions are complete
- Viewer feels finished and predictable
- No critical UI or data ambiguity remains

After this point, work shifts to **user feedback–driven iteration**.
