# MILESTONES

*Last updated: 2025-12-27 (Europe/Madrid)*

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

This milestone transitions the Viewer from prototype to **production-ready audit workspace** and aligns it visually, structurally, and conceptually with the Sidepanel.

---

## 7.0 Guardrails & Styling Foundation (COMPLETE)

**Goal**  
Unify styling across Sidepanel and Viewer using **Option C**:
shared theme primitives without refactoring component libraries.

**Non-Negotiable Rules**

- A single shared theme file defines semantic tokens (HSL tuples).
- No derived/grouping keys are persisted.
- No edits to `dist/**`.
- Sidepanel imports `shell/index.css` (effective CSS entry today).
- Runtime tokens must resolve to shared theme values.
- Changes must be incremental and reversible.

**Deliverables (Achieved)**

- `apps/extension/src/ui/theme/theme.css`
  - HSL tuple semantic tokens
  - `:root` + `.dark` definitions
  - Includes Sidepanel extras (charts, inputs, switches)
- Sidepanel wired so:
  - Layouts preserved
  - Legacy OKLCH tokens neutralized
  - Runtime verification via `getComputedStyle`
- CSS entry chain understood and documented

**Acceptance Check**
```js
getComputedStyle(document.documentElement)
  .getPropertyValue("--foreground")
````

Returns HSL tuple (not OKLCH).

---

## 7.1 Viewer Shell Integration

**Goal**
Bring the Viewer into the extension repo with a **stable, Sidepanel-consistent visual foundation**.

**Scope**

* Import Viewer shell into:

  ```
  apps/extension/src/ui/viewer/**
  ```
* Remove Viewer-local theme/token systems.
* Consume shared `theme.css`.
* Normalize **design primitives only**:

  * Typography scale
  * Spacing
  * Radii
  * Shadows
  * Color tokens
* Normalize layout primitives:

  * Header
  * Filter bar
  * List / grid container
  * Details drawer
* Ensure CSP-safe setup:

  * No external font imports
  * System font stack only

**Explicit Non-Goals**

* No feature parity
* No data wiring
* No component library refactors

**Deliverable**

* Viewer renders inside the extension
* Viewer visually feels like the same product as Sidepanel
* Viewer UI is stable enough to build IA + data on top

---

## 7.2 Viewer IA — Components + Styles (Single Mode)

**Goal**
Implement the unified Viewer IA that combines browsing and review into one workspace.

**IA Structure**

* Tabs:

  * Components
  * Styles
* Filter bar:

  * Category (All Categories supports sectioned inventory)
  * Type (conditional on Category)
  * Status (Unreviewed / Canonical / Variant / Deviation / Legacy / Experimental)
  * Source
  * Unknown-only toggle
  * Search
* Details drawer:

  * Components: editable (name, category, type, status, tags, notes)
  * Styles: read-only (variable, value, usage list)

**Deliverable**

* Viewer behavior matches shell/prototype expectations
* IA is locked before export or automation work

---

## 7.3 Export (Filtered View)

**Goal**
Export exactly what the user is looking at.

**Rules**

* Export respects current filters and active tab.
* Output is deterministic:

  * Stable sorting
  * Schema versioned
* Export format v1:

  * JSON
  * Image references by ID (no blobs inline yet)

**Deliverable**

* Export produces predictable, reproducible output
* Export reflects Viewer state, not raw dataset

---

## 7.4 Data Model Alignment (Sidepanel ↔ Viewer)

**Goal**
Ensure Viewer consumes the same concepts Sidepanel produces.

**Confirm Support For**

* Classifier output + manual overrides
* Style primitives + evidence sources
* Status, tags, notes

**Key Rule**

* Viewer computes grouping and labels at runtime only.
* No derived fields persisted.

**Deliverable**

* One canonical mapping:

  ```
  CaptureRecordV2 → ViewerItem
  CaptureRecordV2 → StyleIndex
  ```
* No mock or static Viewer data remains

---

## 7.5 Quality Bar

**Goal**
Make Milestone 7 shippable as a cohesive experience.

**Checklist**

* Viewer flows documented in TESTING.md
* Known limitations documented (no overclaims)
* Performance sanity check (large capture sets)
* Developer ergonomics acceptable

**Deliverable**

* Milestone 7 is stable, honest, and demo-ready

---

# After Milestone 7 (Next Logical Steps)

## Milestone 8 — Manual Refinement Workflows

* Bulk select
* Bulk status/tag updates
* Variant grouping (canonical selection)
* Pattern marking (styles → tokens/patterns)

## Milestone 9 — Automated Suggestions

* Status/category/type suggestions
* Pattern detection that learns from manual edits

## Milestone 10 — Figma Export (Real)

* Frames / boards
* Thumbnails
* Token + pattern mapping