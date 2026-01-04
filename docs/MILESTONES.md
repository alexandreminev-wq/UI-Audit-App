# MILESTONES

  *Last updated: 2026-01-04*

  This file is the canonical milestone plan for the **UI Inventory App**.
  Milestones are intentionally incremental, verifiable, and biased toward
  **runtime correctness over theoretical completeness**.

  ---

  ## Guiding Principles (Canon)

  - We are building **guided capture + audit of real UI usage**, not full UI reconstruction.
  - Service Worker is the **only** IndexedDB accessor.
  - UI surfaces (content script / sidepanel / viewer) communicate via message passing only.
  - Viewer computes **derived labels and groupings at runtime** — no persisted derived keys.
  - Prefer small, reversible diffs.
  - No edits to `dist/**`.

  ---

  ## Milestones 1–3 (FOUNDATION — COMPLETE)

  **Outcome**
  - Chrome Extension (MV3) scaffolded
  - Service Worker ownership of storage
  - Content script capture pipeline established
  - Basic Viewer + Sidepanel scaffolding
  - Initial data model (`CaptureRecordV2`)

  ---

  ## Milestone 4 (CAPTURE DEPTH — COMPLETE)

  **Outcome**
  - Improved capture fidelity
  - Landmark / scope context
  - Style extraction groundwork
  - Screenshot + blob handling
  - Runtime-safe message passing patterns

  ---

  ## Milestone 5 (STYLE PRIMITIVES — COMPLETE)

  **Outcome**
  - StylePrimitives extraction
  - Typography, radius, spacing, shadow evidence
  - Inline CSS variable source tracking (`var(--...)`)
  - Debug surfaces for style evidence

  ---

  ## Milestone 6 (CATEGORIZATION + NAMING — COMPLETE)

  **Outcome**
  - Classifier introduced and refined
  - Improved naming consistency
  - Category / Type groundwork
  - Sidepanel directory behavior stabilized
  - Viewer prototype explored in separate repo

  ---

  # 🟦 Milestone 7 — Style Normalization + Finish Viewer
  **Branch:** `m7-style-normalization`

  This milestone transitions the Viewer from prototype to **production-ready audit workspace** and aligns it visually, structurally, and conceptually with the
  Sidepanel.

  ---

  ## Milestone 7 — Viewer Stabilization & Completion

  ### 7.0 Guardrails & Style Normalization ✅
  - Shared theme/tokens across sidepanel + viewer
  - Consistent Tailwind entry points
  - Viewer and sidepanel aligned on styling primitives

  ---

  ### 7.1 Viewer Shell Integration ✅
  - ViewerApp split from viewer.tsx
  - ProjectViewShell introduced as page-level container
  - Stable routing between Projects → Project Viewer

  ---

  ### 7.2 Viewer Interaction Skeleton ✅
  - Components / Styles tabs
  - Grid / Table toggles
  - Toolbar UI (filters, visible properties)
  - Placeholder → real content transition

  ---

  ### 7.3 Inventory Derivation (Read-only) ✅
  - Viewer derives all data from IndexedDB captures
  - No Viewer writes
  - Adapters introduced as single source of truth

  ---

  ### 7.4 Viewer Correctness & Guardrails ✅ **(COMPLETED)**

  #### 7.4.1 Inventory Wiring
  - Real component and style inventories (no mocks)
  - Deterministic grouping and sorting

  #### 7.4.2 Style Inventory Completion
  - Style grouping by kind + value
  - Token fallback semantics ("—")
  - Runtime collision fix (styles vs inlineStyles)

  #### 7.4.3 Drawer View Models
  - Component → captures
  - Style → locations + related components
  - Drawer adapters implemented
  - ProjectViewShell derives drawer data via useMemo

  #### 7.4.4 Project Scoping Enforcement
  - ViewerApp enforces strict project scoping
  - Adapters assume pre-scoped input
  - DEV-only logging for:
    - captures loaded vs scoped
    - dropped mismatches
    - empty-after-scope regressions

  #### 7.4.5 Selection Hygiene & Drawer Safety
  - Drawer selection cleared on **projectId change only**
  - No clearing on data refresh or re-derivation
  - Stale selection detection (DEV-only)
  - Drawer safe empty states
  - No cross-project leakage or silent failures

  **Milestone 7.4 exit criteria met. Viewer is now stable and correct.**

  ---

  ## Milestone 7.5 — Viewer ↔ Sidepanel Parity

  ### 7.5.1 Drawer Content Parity ✅ **(COMPLETED VIA AUDIT)**

  **Outcome:**
  - Audit completed comparing Viewer DetailsDrawer vs Sidepanel ComponentDetails
  - **No code changes required** — existing drawer structure is semantically correct for inventory context
  - Sidepanel is for **editing single components**; Viewer is for **browsing aggregated inventory**
  - Structural differences are intentional and appropriate

  **Parity gaps identified and deferred:**
  - **Screenshot display** → 7.5.2 (requires blob handling)
  - **HTML Structure section** → deferred (requires new section + wiring)
  - **Comments field** → deferred (Viewer is read-only by design)
  - **Section ordering** → kept as-is (Viewer order is logical for inventory browsing)

  ---

  ### 7.5.2 Screenshot Thumbnails ✅
  - Render thumbnails from existing `screenshotBlobId`
  - Viewer cards (Grid + Table) show representative capture thumbnails
  - Viewer drawer already supports screenshot rendering; cards now match parity intent
  - Graceful fallback if unavailable

  ---

  ### 7.5.3 Minor Interaction Polish
  - Toggle drawer on re-select
  - Escape to close drawer
  - Small UX refinements only

  ---

  ## Milestone 7.6 — Viewer Usability Refinements (Optional)
  - Empty project UX
  - Deterministic default sorts
  - Viewer-only filter persistence

  ---
  ### 7.7 — Annotations (Notes + Tags) + Save/Delete Parity

**Goal:**  
Introduce component-scoped annotations (Notes + Tags) shared between Viewer and Sidepanel, with explicit Save semantics and delete parity.

#### 7.7.1 — Annotations foundation (read-only Viewer)
**Status:** ✅ Complete

- IndexedDB upgraded from v3 → v4
- Added `annotations` store keyed by `projectId:componentKey`
- Service Worker APIs:
  - `ANNOTATIONS/GET_PROJECT`
  - `ANNOTATIONS/GET_ONE`
- Viewer:
  - Identity section added (Component + Style)
  - HTML Structure section (derived, collapsible)
  - Notes (read-only)
  - Tags (read-only)
  - Annotations merged into Viewer inventory via:
    annotation.componentKey === component.id
  
#### 7.7.2 — Editable annotations + explicit save model
**Status:** ✅ Complete

##### 7.7.2a — Stability + rendering fixes
- Fixed blank DetailsDrawer caused by hook order / conditional rendering
- Ensured annotations load after project selection
- Prevented crash on missing annotation records

##### 7.7.2b — Edit + Save + Delete parity
- Notes and Tags are **always editable** (no “Edit mode”)
- Added explicit **Save / Cancel / Delete** actions
- Removed:
- Clear action
- Edit button
- Delete confirmation modal implemented
- Delete now fully functional (Viewer ↔ Service Worker ↔ IndexedDB)
- Footer actions are fixed and consistent with prototype
- Viewer behavior now mirrors Sidepanel delta semantics

**Result:**  
Viewer and Sidepanel now share the same annotation data model, lifecycle, and intent.

---

### 7.8 — Cross-surface annotation parity ✅
**Status:** ✅ Complete

- Sidepanel Notes + Tags wired to the same `annotations` store as Viewer
- Deterministic `componentKey` shared across surfaces (Viewer + Sidepanel)
- Explicit Save / Cancel semantics (no onBlur saves)
- Draft-until-save capture flow:
  - Capturing creates a persisted draft (`isDraft: true`)
  - Drafts are only committed on explicit Save
- Sidepanel UX: one active audit tab at a time to reduce confusion

---

### 7.9 — Manual Identity Overrides (Display Name / Category / Type / Status) ✅
**Status:** ✅ Complete

- Added `component_overrides` store keyed by `projectId:componentKey`
- Viewer and Sidepanel can edit identity fields with explicit Save / Cancel
- Reset supported (delete override record → revert to derived values)

---

### 7.10 — Multi-State Component Capture ✅
**Status:** ✅ Complete

**Goal:** Associate different visual states (Default, Hover, Active, Focus, Disabled, Open) of the same component and display them as a unified entry.

#### 7.10.1 — State Capture Infrastructure
- Extended capture to support buttons and links with multiple states
- CDP-based state forcing (pseudo-classes) with mouse automation fallback
- State menu UI in content script for selecting which state to capture
- Default state capture with hover-clearing logic (mouse move + delay)

#### 7.10.2 — Component Grouping by State
- Introduced stable `componentKey` generation (structural identity excluding state-dependent styles)
- Modified `buildComponentSignature` to exclude color/backgroundColor/borderColor from key
- Captures of the same component across different states share the same `componentKey`

#### 7.10.3 — Multi-State UI (Sidepanel)
- Grouped captures by `componentKey` into single component entries
- Added `availableStates` array to track all captured states for a component
- State dropdown selector for switching between states
- Screenshot, HTML, and Visual Essentials update when state changes
- Notes and tags shared across all states of the same component

#### 7.10.4 — Multi-State UI (Viewer)
- Viewer DetailsDrawer shows state selector dropdown
- State switching fetches and displays correct capture data
- Visual Essentials dynamically update based on selected state
- Identity fields remain stable across state changes

**Key Implementation Details:**
- `componentKey` = hash of `${tagName}|${role}|${accessibleName}` (no style properties)
- State stored in `capture.styles.evidence.state`
- Default state prioritized in sort order for display
- `UI/GET_CAPTURE` message handler added for fetching specific state captures

---

### 7.11 — Figma Export ✅
**Status:** ✅ Complete

**Goal:** Export captured inventory to Figma-importable format with screenshots and structured metadata.

#### 7.11.1 — Export Package Format
- ZIP package containing:
  - `inventory.json` — Structured component spec with visual essentials, states, sources
  - `images/*.png` — Component screenshots (one per state)
- Export initiated from Viewer "Export to Figma" button
- Uses `jszip` library for client-side ZIP generation

#### 7.11.2 — Data Structure
**inventory.json structure:**
```json
{
  "version": "1.0",
  "exportedAt": "ISO timestamp",
  "project": { "id", "name" },
  "components": [
    {
      "componentKey": "deterministic hash",
      "name": "derived display name",
      "category": "Actions | Forms | ...",
      "type": "Button | Link | ...",
      "status": "Unreviewed | Canonical | ...",
      "sources": ["url1", "url2"],
      "notes": "user annotations",
      "tags": ["tag1", "tag2"],
      "states": [
        {
          "state": "default | hover | active | ...",
          "screenshotFilename": "componentKey_state.png",
          "visualEssentials": { "Text": [...], "Surface": [...], "Spacing": [...] },
          "stylePrimitives": { raw style data },
          "htmlSnippet": "outerHTML"
        }
      ]
    }
  ]
}
```

#### 7.11.3 — Service Worker Export APIs
- `EXPORT/GET_PROJECT_DATA` — Fetch all non-draft captures + project metadata
- `EXPORT/GET_BLOB_BYTES` — Retrieve screenshot blob as byte array
- Blob transfer via Chrome messaging (ArrayBuffer → plain array conversion for structured cloning)

#### 7.11.4 — Figma Plugin Implementation
**Structure:**
- `apps/figma-plugin/` — Standalone Figma plugin directory
- `manifest.json` — Plugin metadata and entry points
- `code.ts` — Main thread (Figma API interactions)
- `ui.html` + `ui.ts` — UI thread (file handling, ZIP processing)
- `build.js` — Custom build script (esbuild + inline script injection)

**Features:**
- Drag-and-drop + file input for ZIP import
- Creates Figma frames organized by category
- Places screenshots as image fills using `figma.createImage()`
- Text nodes for metadata (name, category, type, status, sources, notes, tags)
- Visual essentials displayed as formatted text blocks
- HTML snippet included (collapsed/small text)

**Key Technical Solutions:**
- WebP → PNG conversion (Figma doesn't support WebP)
- Canvas API used for image format conversion
- Inline script bundling (Figma data URL CSP restrictions)
- Error handling for unsupported image formats with fallback UI

#### 7.11.5 — Documentation
- Created `docs/FIGMA_EXPORT.md` with full specification
- Documents export format, plugin usage, and architecture

**Outcome:**  
Full round-trip workflow: Capture → Review → Export → Import to Figma for design system audits.


---

## Milestone 8 — UI Polish & Standardization 🎨
**Branch:** `m9-polish-v1`  
**Status:** 🟡 In Progress (Phase 1 Complete, Phase 2 Partial)

**Goal:** Standardize styling, layout, and component libraries across Sidepanel and Viewer for consistency and maintainability.

### 8.0 — Foundation Analysis ✅
**Status:** ✅ Complete

- Completed delta analysis of Visual Essentials tables (Sidepanel vs Viewer)
- Completed delta analysis of layout containers and structure
- Documented styling inconsistencies (Tailwind vs CSS variables)
- Created prioritized incremental plan (Phase 1-9)

### 8.1 — Phase 1: CSS Variables Foundation ✅
**Status:** ✅ Complete

**Goal:** Convert Sidepanel from Tailwind to inline styles with CSS variables

**Completed:**
- [x] Convert ComponentDetails container styles
- [x] Convert section headers and labels
- [x] Convert form inputs (identity fields)
- [x] Convert borders and backgrounds
- [x] Convert spacing utilities
- [x] All inline styles using CSS variables
- [x] Consistent hover/focus handlers
- [x] Elastic sidepanel width (360px minimum, 100% width)
- [x] HTML Structure section formatting matches Viewer (collapsible details)

**Outcome:** Both UIs use same styling system (CSS variables)

### 8.1.1 — StartScreen Redesign ✅
**Status:** ✅ Complete

**Goal:** Modernize StartScreen with fixed footer, empty state, and slide-in drawer

**Completed:**
- [x] Fixed header/content/footer layout architecture (matches Viewer pattern)
- [x] Header: "Audits" title + "Inventory" button (ghost variant, white bg, grid icon)
- [x] Project cards: Date display (last modified), chevron icons, enhanced hover states
- [x] Fixed footer: "+ Create New Audit" button (dark theme)
- [x] Slide-in drawer: Bottom drawer with backdrop, smooth animation, Enter/Escape handlers
- [x] Empty state: Illustration card + "Your audit is one step away" messaging
- [x] Background color: #fafafa
- [x] No separator line between header and content
- [x] Added createdAt/updatedAt to Project interface

**Outcome:** Professional, modern StartScreen with intuitive onboarding UX

### 8.2 — Phase 2: Button Parity 🔄
**Status:** 🟡 Partial (Sidepanel done)

**Tasks:**
- [x] Add destructive variant to Button component
- [x] Convert Sidepanel footer buttons to shared Button component
- [x] Convert Sidepanel delete confirmation modal buttons
- [ ] Convert Viewer footer buttons to shared Button component
- [ ] Convert Viewer close button
- [ ] Standardize Sidepanel close button
- [ ] Audit and convert remaining buttons (popovers, modals)

**Outcome:** All buttons use shared Button component with consistent behavior

### 8.3 — Phase 3: Close Button Consistency
**Status:** ⏳ Not Started

**Tasks:**
- [ ] Decide: Lucide X icon or Unicode ✕
- [ ] Standardize button style (ghost variant + icon)
- [ ] Align positioning and padding
- [ ] Ensure proper aria-labels

### 8.4 — Phase 4: Spacing & Padding Polish
**Status:** ⏳ Not Started

**Tasks:**
- [ ] Standardize container padding (16px or 24px horizontal)
- [ ] Align section gaps (16px vs 24px)
- [ ] Standardize footer padding
- [ ] Align header padding
- [ ] Ensure consistent spacing around inputs

### 8.5 — Phase 5: Content Order Alignment
**Status:** ⏳ Not Started

**Tasks:**
- [ ] Decide canonical section order
- [ ] Reorder Sidepanel sections to match
- [ ] Update scroll-to and focus logic
- [ ] Test tab order and keyboard navigation

### 8.6 — Phase 6: Footer Behavior
**Status:** ⏳ Not Started

**Tasks:**
- [ ] Decide: Always render or conditional
- [ ] Implement chosen strategy in both UIs
- [ ] Update logic depending on footer presence
- [ ] Test save/cancel/delete flows

### 8.7 — Phase 7: Header Behavior
**Status:** ⏳ Not Started

**Tasks:**
- [ ] Decide: Fixed header or scrollable
- [ ] Implement chosen strategy
- [ ] Update close button positioning
- [ ] Test scroll behavior and focus

### 8.8 — Phase 8: Layout Architecture
**Status:** ⏳ Not Started

**Tasks:**
- [ ] Convert Sidepanel to 3-section flexbox (if needed)
- [ ] Update body padding for footer height
- [ ] Test scroll behavior thoroughly
- [ ] Test on different viewport sizes

### 8.9 — Phase 9: Accessibility Improvements
**Status:** ⏳ Not Started

**Tasks:**
- [ ] Add ARIA labels to Sidepanel sections
- [ ] Consider Radix Dialog/Sheet primitive
- [ ] Add visually-hidden headings
- [ ] Test keyboard navigation
- [ ] Test with screen reader
- [ ] Ensure proper focus management

**Milestone 8 Timeline:** 12-18 hours estimated

---

## Milestone 9 — Capture Depth & Intelligence (Future)
Out of scope for current stabilization:
- Smarter component signatures
- Token normalization
- Hierarchies and relationships
- Cross-session comparisons

---

## Milestone 10 — Manual Refinement Workflows (Future)

* Bulk select
* Bulk status/tag updates
* Variant grouping (canonical selection)
* Pattern marking (styles → tokens/patterns)

## Milestone 11 — Automated Suggestions (Future)

* Status/category/type suggestions
* Pattern detection that learns from manual edits