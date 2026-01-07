# ARCHITECTURE

  *Last updated: 2026-01-07*

This document describes the high-level architecture of the **UI Audit Tool** Chrome extension and Viewer.

The system is intentionally split into **three layers**:
1. Capture (Extension Runtime)
2. Storage & Messaging (Service Worker)
3. Review & Export (Viewer UI)

Each layer has strict responsibilities and boundaries.

---

## 1. Architectural Principles

### Canon Rules
- **Service Worker is the only IndexedDB accessor**
- **All UIs communicate via message passing**
- **No derived meaning is persisted in capture records**
- **Viewer performs classification, grouping, and review**
- **Capture stores evidence, not interpretation**

---

### Design Goals
- Preserve trustworthy UI evidence
- Enable designer-led interpretation
- Avoid schema churn
- Support incremental enrichment
- Keep capture lightweight and deterministic

---

## 2. High-Level System Overview

```

┌───────────────┐
│  Web Page UI  │
└──────┬────────┘
│
▼
┌────────────────────────┐
│ Content Script (MV3)   │
│ - Element inspection  │
│ - Style extraction    │
│ - Screenshot capture  │
└──────┬─────────────────┘
│ message passing
▼
┌────────────────────────┐
│ Service Worker         │
│ - IndexedDB access     │
│ - Session / project   │
│ - Blob storage        │
│ - Broadcast events    │
└──────┬─────────────────┘
│ message passing
▼
┌────────────────────────┐
│ Viewer UI              │
│ - Review & curation    │
│ - Classification       │
│ - Visual Essentials    │
│ - Filtering & export   │
└────────────────────────┘

```

---

## 3. Capture Layer (Extension Runtime)

### Components
- Content Script
- Screenshot utilities

### Responsibilities
- Identify the DOM element being captured
- Provide in-page capture interactivity (hover highlight, click-to-capture, right-click menu, keyboard fallback)
- Extract **computed visual evidence**
- Normalize values into `StylePrimitives`
- Define capture geometry (element bounding box, region drag box, or viewport box)
- Send capture payload to Service Worker

### Explicit Non-Responsibilities
- Naming components
- Categorization
- Pattern detection
- Token resolution
- Compliance judgments

Capture is **mechanical and repeatable**.

---

## 4. Storage & Messaging Layer (Service Worker)

### Responsibilities
- Sole owner of IndexedDB
- Persist Capture Records
- Persist draft captures (draft-until-save)
- Manage sessions and projects
- Store and retrieve screenshot blobs
- Perform screenshot capture + cropping via CDP/offscreen processing (best-effort)
- Persist review layers:
  - Annotations (Notes + Tags)
  - Component identity overrides (Display Name / Category / Type / Status)
- Fan out UI events (e.g. capture saved)
 - Maintain audit routing state (single active audit tab)
 - Persist active project ↔ tab routing in session storage for Service Worker restarts

### IndexedDB Stores
- `captures`
- `drafts`
- `sessions`
- `projects`
- `projectSessions`
- `blobs`
- `annotations`
- `component_overrides`

### Message-Based API
- `AUDIT/CAPTURE`
- `AUDIT/CAPTURE_REGION` (region drag + viewport screenshots)
- `AUDIT/CHECK_DUPLICATE` (duplicate detection before capture)
- `AUDIT/GET_BLOB`
- `AUDIT/GET_ROUTING_STATE`
- `AUDIT/CLAIM_TAB`
- `UI/GET_PROJECT_CAPTURES`
- `UI/DELETE_CAPTURE`
- `UI/CAPTURE_SAVED`
- `ANNOTATIONS/*`
- `OVERRIDES/*`
- `DRAFTS/*`
- Project/session management messages

### Non-Responsibilities
- Interpretation of capture data
- Classification logic
- UI state

The Service Worker is a **data broker**, not a domain engine.

**Note:** classification/grouping remain UI concerns, but the Service Worker persists the
user’s review edits (annotations and overrides) as separate stores keyed by `projectId:componentKey`.

---

## 5. Viewer UI Layer

The Viewer is a **review and export environment**, not a capture surface.

It operates on **derived representations** of Capture Records.

---

### 5.1 Component Review Model

Capture Records are transformed into **Components** at runtime:

- Classification (Category, Type)
- Display name generation
- Status assignment
- Notes and tags
- Visual Essentials rendering

These transformations:
- Are computed or user-edited
- Are not written back into capture records
- Exist only in the Viewer state

User edits are persisted as **layered records**:
- `annotations` store: Notes + Tags (shared with Sidepanel)
- `component_overrides` store: Display Name / Category / Type / Status (shared with Sidepanel)

---

### 5.2 Styles Inventory Model

Styles are:
- Derived by aggregating `StylePrimitives`
- Grouped by visual value
- Linked back to components
- Presented read-only

No style editing occurs in the Viewer.

---

### 5.3 Filtering & Sections

- Filter bar controls the dataset view
- Category sections appear **only** when viewing “All Categories”
- Selecting a Category or Type flattens the inventory
- Export operates on the **current filtered view**

---

## 6. Detail Panel (Inspector)

The right-hand detail panel is the **only sidebar** in the system.

It supports:
- Component identity editing
- Status updates
- Tagging and notes
- Visual Essentials inspection
- Source and HTML reference

The panel never mutates capture evidence.

---

## 6.1 Sidepanel (Capture Cockpit) Gating

The Sidepanel is tab-aware and enforces a **single active audit tab**:
- If opened on a non-owner tab, it shows an inactive state and offers a “claim tab” action.
- Claiming a tab disables capture on the previous active tab via the Service Worker.

---

## 7. Export Architecture

Export is:
- Viewer-driven
- Filter-scoped
- Explicitly user-triggered

Export payloads may include:
- Components
- Styles
- Or both

Export formats are pluggable:
- Figma
- JSON
- CSV

---

## 8. Data Flow Guarantees

- Capture → Store → Review is one-way
- Review never mutates capture evidence
- Re-analysis is always possible
- Future enrichment can be layered without re-capture

---

## 9. What This Architecture Enables

- Designer-led audits
- Incremental sophistication (patterns, tokens, compliance)
- Safe schema evolution
- Clear debugging boundaries
- Scalable Viewer complexity

---

## 10. What This Architecture Avoids

- Overloaded capture records
- “Smart” service worker logic
- Premature token systems
- Hidden derived state
- Irreversible transformations

---

## 11. Summary

This architecture deliberately separates:
- **Reality (Capture)**
- **Evidence (Storage)**
- **Meaning (Viewer)**

This separation is what allows the UI Audit Tool to scale from simple inventories
to deep design system audits without rewriting its foundations.
