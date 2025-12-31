# STATUS

  # UI Inventory MVP — Project Status

  ## Overall Status
  🟢 **Viewer + Sidepanel parity (annotations + overrides) in place**

  The app now supports:
  - Cross-surface annotations (Notes + Tags)
  - Cross-surface identity overrides (Display Name / Category / Type / Status)
  - Draft-until-save capture flow in Sidepanel
  - Viewer component cards with screenshot thumbnails

  ---

  ## What Works Today

  ### Capture (Sidepanel)
  - UI elements are captured from live pages
  - CaptureRecords written to IndexedDB
  - Captures are created as **drafts** and committed on explicit Save
  - Sidepanel enforces **one active audit tab** at a time (reduces confusion)
  - Each capture includes:
    - id
    - projectId
    - sessionId
    - element metadata
    - style primitives
    - screenshot reference
    - URL
  - Sidepanel capture confirmed working end-to-end
  - Notes + Tags editable with explicit Save / Cancel
  - Identity overrides editable with explicit Save / Cancel

  ---

  ### Viewer (Review + Curation)
  - All data derived from IndexedDB captures
  - Projects load correctly
  - Component and Style inventories populate correctly
  - Drawer shows real derived data
  - Project scoping enforced at boundary
  - Selection hygiene guarantees in place
  - Component cards show **screenshot thumbnails**
  - Notes + Tags editable with explicit Save / Cancel
  - Identity overrides editable with explicit Save / Cancel
  - Style drawer supports Preview + Copy token/value

  ---

  ## Recent Milestones
## Current Focus

**Milestone 7 — Viewer completion + parity layers**

The Viewer Details Drawer and Sidepanel details now support:
- Notes + Tags (annotations store)
- Identity overrides (component_overrides store)

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
- Screenshot thumbnails on Viewer component cards (Grid + Table)
- Manual identity overrides (name/category/type/status) shared across surfaces

### Key Architectural Decisions
- Annotations are keyed by `projectId + componentKey`
- Multiple captures of the same component share annotations
- Identity overrides are keyed by `projectId + componentKey` in `component_overrides`
- Edits require explicit Save (no implicit onBlur persistence)
- Sidepanel and Viewer are converging on the same mental model

### Known Gaps (Intentional)
- Export is not yet implemented (JSON/CSV/Figma)
- HTML Structure editing not supported
- No annotation history / versioning

### Next Up
- 7.5.3: Minor interaction polish (drawer toggle on re-select, Escape to close)
- 7.6: Viewer usability refinements (empty project UX, default sorts, filter persistence)
- Export MVP slice (define minimal export for reviewed inventory)


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

  - Screenshot thumbnails: now rendered on Viewer cards; further polish remains
  - HTML structure not shown in drawer (requires new section)
  - No annotation history / versioning
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