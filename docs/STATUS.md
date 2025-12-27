# STATUS

*Last updated: 2025-12-27 (Europe/Madrid)*

This document reflects the **current state of the UI Inventory App**: what is complete, what is in progress, and what is explicitly out of scope for now. It is intended to prevent rework, scope creep, and accidental regressions.

---

## Overall Project Status

**Phase:** Milestone 7 — Style Normalization + Finish Viewer  
**Branch:** `m7-style-normalization`  
**Confidence:** High (foundational systems are stable)

The project has completed its **core capture, classification, and styling foundations** and is now focused on turning the Viewer into a production-ready audit workspace that matches the Sidepanel in visual language and conceptual model.

---

## What Is Working Well

### Capture & Storage
- Content script capture is stable.
- Service Worker is the **only** IndexedDB accessor.
- Capture records (`CaptureRecordV2`) include:
  - structural context
  - classifier outputs
  - style primitives + evidence
- Message passing patterns are reliable and understood.

### Sidepanel (Capture Cockpit)
- Sidepanel shell is stable.
- Visual Essentials UI is implemented.
- Category / Type / naming improvements are in place.
- Shared theme tokens are now the runtime source of truth.
- Layout and Tailwind output are preserved after theme unification.

### Styling Infrastructure (Major Win)
- **Shared theme layer exists**:
  - `apps/extension/src/ui/theme/theme.css`
  - HSL tuple semantic tokens
  - `:root` + `.dark` definitions
- Sidepanel consumes shared theme correctly.
- Legacy OKLCH tokens are neutralized.
- Runtime verification via `getComputedStyle` confirms correctness.
- CSS entry chain is now understood and documented.
- Dark mode infrastructure exists (not enabled yet).

---

## What Is Explicitly Complete

### Milestones
- Milestones 1–6: **Complete**
- Milestone 7.0 (Guardrails & Styling Foundation): **Complete**

### Key Decisions Locked
- Option C (shared theme primitives, no component refactor)
- Viewer computes derived labels at runtime only
- No persisted grouping/signature keys
- No edits to `dist/**`
- Prefer incremental, reversible diffs

---

## What Is In Progress

### Milestone 7.1 — Viewer Shell Integration
**Status:** Not started (next task)

Planned work:
- Import Viewer shell into extension repo.
- Remove Viewer-local theme/token systems.
- Consume shared `theme.css`.
- Normalize visual primitives and layout scaffolding.
- Ensure CSP-safe font usage.

No data wiring or feature parity work has begun yet.

---

## Known Gaps (Intentional)

These are **not bugs** — they are deferred by design:

- Viewer still uses mock/static data.
- Viewer IA is not fully implemented.
- No export from real data yet.
- No dark mode toggle.
- No bulk operations or automation.
- No Figma export.

---

## Known Risks / Watchouts

- CSS entry points differ per surface; always verify runtime tokens.
- Viewer integration must avoid importing prototype-only assumptions.
- Avoid “helpful refactors” during styling normalization.
- Do not persist derived Viewer labels or groupings.
- Keep Sidepanel stable while Viewer evolves.

---

## Validation & Debugging Practices

**Theme validation**
```js
getComputedStyle(document.documentElement)
  .getPropertyValue("--foreground")
````

Must return HSL tuple values.

**Build rules**

* Rebuild + reload extension after CSS changes.
* Inspect compiled `sidepanel-*.css` only to debug, not to edit.

---

## What Success Looks Like for Milestone 7

By the end of Milestone 7:

* Sidepanel + Viewer feel like the same product.
* Viewer IA is stable and matches intended workflows.
* Viewer consumes real data through a canonical mapping layer.
* Export reflects current Viewer filters deterministically.
* Limitations are documented honestly.

---

## Next Concrete Step

👉 **Begin Milestone 7.1: Viewer Shell Integration**

Focus:

* UI foundation
* Styling consistency
* Layout normalization

Do **not** start data wiring or export yet.

---

*This STATUS file should be updated whenever a milestone slice is completed or a major decision is locked.*
