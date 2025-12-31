# STATUS

  # UI Inventory MVP — Project Status

  ## Overall Status
  🟢 **Viewer parity audit complete**

  Milestone 7.5.1 completed via comprehensive audit. Viewer drawer structure is semantically correct for inventory context. No implementation changes required.

  ---

  ## What Works Today

  ### Capture (Sidepanel)
  - UI elements are captured from live pages
  - CaptureRecords written to IndexedDB
  - Each capture includes:
    - id
    - projectId
    - sessionId
    - element metadata
    - style primitives
    - screenshot reference
    - URL
  - Sidepanel capture confirmed working end-to-end

  ---

  ### Viewer (Read-only)
  - All data derived from IndexedDB captures
  - Projects load correctly
  - Component and Style inventories populate correctly
  - Drawer shows real derived data
  - Project scoping enforced at boundary
  - Selection hygiene guarantees in place

  ---

  ## Recent Milestones
## Current Focus

**Milestone 7 — Viewer completion + annotation parity**

The Viewer Details Drawer is now functionally complete for component inspection and annotation.

### Completed
- Viewer shell, layout, scrolling, and preview canvas
- Component + Style detail drawers
- Identity sections
- Visual Essentials (read-only)
- HTML Structure (derived)
- Annotations (Notes + Tags):
  - IndexedDB-backed
  - Component-scoped (not capture-scoped)
  - Shared across Viewer and Sidepanel
- Explicit Save / Cancel / Delete actions
- Delete parity with Sidepanel confirmed working

### Key Architectural Decisions
- Annotations are keyed by `projectId + componentKey`
- Multiple captures of the same component share annotations
- Viewer is no longer read-only — edits require explicit Save
- Sidepanel and Viewer are converging on the same mental model

### Known Gaps (Intentional)
- Sidepanel still auto-saves on capture (to be changed)
- Manual overrides UI not yet implemented
- HTML Structure editing not supported
- No annotation history / versioning

### Next Up
- Milestone 7.8: Sidepanel annotation parity
- Milestone 8: Manual overrides + capture confirmation flow


  ---

  ## Out of Scope (For Now)
  - Capture schema changes
  - Advanced component intelligence
  - Multi-project comparisons

  ---

  ## Confidence Level
  ✅ High confidence in Viewer correctness and stability
  ✅ Viewer drawer semantically aligned with Sidepanel
  ✅ Safe to proceed with screenshot thumbnails and polish work

  ---

  ## Known Gaps (Intentional)

  These are **not bugs** — they are deferred by design:

  - Screenshot thumbnails not yet rendered (7.5.2)
  - HTML structure not shown in drawer (requires new section)
  - No comments field in Viewer (read-only constraint)
  - No export from real data yet
  - No dark mode toggle
  - No bulk operations or automation
  - No Figma export

  ---

  ## Known Risks / Watchouts

  - CSS entry points differ per surface; always verify runtime tokens.
  - Viewer integration must avoid importing prototype-only assumptions.
  - Avoid "helpful refactors" during styling normalization.
  - Do not persist derived Viewer labels or groupings.
  - Keep Sidepanel stable while Viewer evolves.
  - Screenshot blob handling must be read-only and safe.


  *This STATUS file should be updated whenever a milestone slice is completed or a major decision is locked.*

  ---
  Both files are ready for copy/paste. The updates reflect:
  - 7.5.1 completed via audit with no code changes
  - Parity gaps documented and deferred appropriately
  - Screenshot display moved to 7.5.2 scope
  - Consistent wording with existing milestone style