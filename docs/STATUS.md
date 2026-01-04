# STATUS

  # UI Inventory MVP — Project Status

  ## Overall Status
  🟡 **Production-ready capture + Figma export; UI polish Phase 1 complete**

  The app now supports:
  - Cross-surface annotations (Notes + Tags)
  - Cross-surface identity overrides (Display Name / Category / Type / Status)
  - Draft-until-save capture flow in Sidepanel
  - Viewer component cards with screenshot thumbnails
  - **Multi-state component capture** (Default, Hover, Active, Focus, Disabled, Open)
  - **Figma export** with full inventory and screenshots
  - **Milestone 8 Phase 1 Complete:** Sidepanel fully converted to CSS variables with modern StartScreen layout

  ---

  ## What Works Today

  ### Capture (Sidepanel)
  - UI elements are captured from live pages
  - CaptureRecords written to IndexedDB
  - Captures are created as **drafts** and committed on explicit Save
  - Sidepanel enforces **one active audit tab** at a time (reduces confusion)
  - **Multi-state capture** for buttons and links:
    - Default, Hover, Active, Focus, Disabled, Open states
    - CDP-based state forcing with mouse automation fallback
    - State menu UI for selecting which state to capture
    - Multiple states grouped into single component entry
  - Each capture includes:
    - id
    - projectId
    - sessionId
    - element metadata
    - style primitives (state-specific)
    - screenshot reference
    - URL
    - state identifier (stored in styles.evidence.state)
  - Sidepanel capture confirmed working end-to-end
  - Notes + Tags editable with explicit Save / Cancel (shared across all states)
  - Identity overrides editable with explicit Save / Cancel (shared across all states)
  - State dropdown switches between captured states with live preview updates

  ---

  ### Viewer (Review + Curation)
  - All data derived from IndexedDB captures
  - Projects load correctly
  - Component and Style inventories populate correctly
  - Drawer shows real derived data
  - Project scoping enforced at boundary
  - Selection hygiene guarantees in place
  - Component cards show **screenshot thumbnails**
  - **Multi-state components** displayed with state selector
  - State switching updates screenshot, HTML, and Visual Essentials dynamically
  - Notes + Tags editable with explicit Save / Cancel
  - Identity overrides editable with explicit Save / Cancel
  - Style drawer supports Preview + Copy token/value
  - **Figma Export:**
    - "Export to Figma" button generates ZIP package
    - Exports inventory.json with full component metadata
    - Exports screenshots (WebP → PNG conversion)
    - One-click download ready for Figma plugin import

  ---

  ## Recent Milestones

**Milestone 7.11 — Figma Export** ✅ Complete
- ZIP package export from Viewer with inventory.json and screenshots
- Figma plugin for import with visual layout
- WebP → PNG conversion for compatibility

**Milestone 8 — UI Polish & Standardization** 🟡 Phase 1 Complete
- **Phase 1: CSS Variables Foundation** ✅ Complete
  - ComponentDetails fully converted to inline styles with CSS variables
  - HTML Structure section formatting matches Viewer
  - Elastic sidepanel width (360px minimum)
  - All hover/focus states using CSS variables
- **Phase 1.1: StartScreen Redesign** ✅ Complete
  - Fixed header/content/footer layout (matches Viewer pattern)
  - Modern header with "Audits" title + "Inventory" button
  - Project cards with date display and chevron icons
  - Fixed footer with "+ Create New Audit" button
  - Slide-in drawer for project creation
  - Empty state with illustration and onboarding message
  - Background: #fafafa
- **Phase 2: Button Parity** 🟡 Partial
  - Sidepanel buttons converted to shared Button component
  - Viewer button conversion pending
- **Completed:**
  - Visual Essentials delta analysis
  - Layout container delta analysis
  - Shared Button component with destructive variant
  - Incremental standardization plan (9 phases)

---

## Current Focus

**Data Model Refinements & Classification Improvements**

Recent updates:
- **Status values cleaned up**: Removed redundant "Unknown" status (use Category: Unknown instead)
- **State field restriction**: Only shows for interactive categories (Actions, Forms, Navigation)
- **Classification improvements**: Fixed categorization for paragraphs, nav elements, and navigation roles

**Milestone 8 — UI Polish & Standardization**

Phase 1 (CSS Variables Foundation) and Phase 1.1 (StartScreen Redesign) are complete. Moving to Phase 2 (Button Parity).

### Phase 1 Complete ✅
- Sidepanel ComponentDetails fully converted to CSS variables
- All colors use `hsl(var(--...))` tokens
- Inline styles with hover/focus handlers
- HTML Structure section matches Viewer formatting
- Elastic sidepanel width (360px minimum, expands to 100%)

### Phase 1.1 Complete ✅
- StartScreen redesigned with modern layout:
  - Fixed header with "Audits" + "Inventory" button
  - Scrollable content with project cards
  - Fixed footer with "Create New Audit" button
  - Slide-in drawer for project creation
  - Empty state with illustration
  - Date display on project cards
  - Background: #fafafa

### Next: Phase 2 (Button Parity)
- Convert Viewer footer buttons to shared Button component
- Convert close buttons to standardized style
- Audit remaining buttons across both UIs

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
- **Multi-state component capture (7.10):**
  - Buttons and links support Default/Hover/Active/Focus/Disabled/Open states
  - CDP-based state forcing with fallback logic
  - Component grouping by structural identity (excludes state-dependent styles)
  - State selector in both Sidepanel and Viewer
  - Shared annotations/overrides across all states
- **Figma export (7.11):**
  - ZIP package export from Viewer
  - inventory.json with structured component metadata
  - Screenshot export with WebP → PNG conversion
  - Figma plugin for import (drag-drop + file input)
  - Visual layout with frames, images, and metadata text nodes
  - Full documentation in docs/FIGMA_EXPORT.md
- **Milestone 8 Phase 1 & 1.1:**
  - ComponentDetails converted to CSS variables
  - StartScreen redesigned with fixed footer and empty state
  - Elastic sidepanel width
  - Slide-in drawer for project creation
  - Modern project cards with date display

### Key Architectural Decisions
- Annotations are keyed by `projectId + componentKey`
- Multiple captures of the same component share annotations
- Identity overrides are keyed by `projectId + componentKey` in `component_overrides`
- Edits require explicit Save (no implicit onBlur persistence)
- Sidepanel and Viewer are converging on the same mental model
- **componentKey is state-agnostic** (derived from tagName + role + accessibleName only)
- State-specific data (styles, screenshot) stored per capture
- Figma export uses plain array transfer for Chrome message passing compatibility

### Known Gaps (Intentional)
- HTML Structure editing not supported
- No annotation history / versioning
- State capture only supports buttons and links (not other interactive elements yet)
- Figma plugin requires manual installation (not published to Figma Community)
- **Styling inconsistencies between Sidepanel (Tailwind) and Viewer (CSS vars)** — being addressed in Milestone 8
- Layout differences (single scroll vs 3-section flexbox) — planned for Milestone 8 Phase 8

### Next Up
- **Milestone 8 (UI Polish):** Continue incremental standardization
  - Phase 2: Complete button parity (Viewer footer + close buttons)
  - Phases 3-9: Close button, spacing, content order, footer/header behavior, layout, accessibility
- 7.5.3: Minor interaction polish (drawer toggle on re-select, Escape to close)
- 7.6: Viewer usability refinements (empty project UX, default sorts, filter persistence)
- Expand state capture to other interactive elements (dropdowns, tabs, accordions)


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
  - No dark mode toggle
  - No bulk operations or automation
  - Figma plugin not published (requires manual installation)
  - State capture limited to buttons and links (not all interactive elements)

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