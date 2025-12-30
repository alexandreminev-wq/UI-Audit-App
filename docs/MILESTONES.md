# MILESTONES

  *Last updated: 2025-12-30 (Europe/Madrid)*

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

  ## Milestone 7 — Viewer Stabilization & Completion (Current Focus)

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

  ### 7.5.2 Screenshot Thumbnails (Next)
  - Render thumbnails from existing screenshotBlobId
  - Viewer-only, read-only
  - Graceful fallback if unavailable
  - Addresses screenshot parity gap from 7.5.1 audit

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

  ## Milestone 8 — Capture Depth & Intelligence (Future)
  Out of scope for MVP stabilization:
  - Smarter component signatures
  - Token normalization
  - Hierarchies and relationships
  - Cross-session comparisons


  ## Milestone 9 — Manual Refinement Workflows

  * Bulk select
  * Bulk status/tag updates
  * Variant grouping (canonical selection)
  * Pattern marking (styles → tokens/patterns)

  ## Milestone 10 — Automated Suggestions

  * Status/category/type suggestions
  * Pattern detection that learns from manual edits

  ## Milestone 11 — Figma Export (Real)

  * Frames / boards
  * Thumbnails
  * Token + pattern mapping