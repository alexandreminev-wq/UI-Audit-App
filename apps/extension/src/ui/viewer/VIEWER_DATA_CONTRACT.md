# Viewer Data Contract (Current)

> This document defines the **explicit contract** between the extension’s stored data model
> and the Viewer UI.
>
> Any implementation work MUST conform to this contract unless the
> contract itself is deliberately revised.
>
> Purpose:
> - Prevent accidental semantics
> - Avoid adapter logic spreading across the UI
> - Keep Viewer behavior predictable while wiring real data

---

## 1. Scope of This Contract

This contract governs:

- What the Viewer **expects**
- What storage **actually provides**
- What is **derived vs persisted**
- What is explicitly out of scope (current MVP)

It applies to:
- `ViewerApp`
- `ProjectViewShell`
- All Viewer adapter functions (`derive*`)
- Any code reading IndexedDB for Viewer purposes

This contract does **not** define:
- Capture recording
- Storage schema evolution
- Future editing workflows

---

## 2. Source of Truth

### 2.1 Storage (Authoritative)

The following IndexedDB stores are the sources of truth:

- `projects`
- `projectSessions`
- `sessions`
- `captures`
- `drafts` (draft captures, committed on explicit Save)
- `blobs`
- `annotations` (Notes + Tags)
- `component_overrides` (identity overrides: displayName/category/type/status)

Rules:
- Capture evidence (`captures`) is immutable after creation
- Review layers are written explicitly by the user:
  - `annotations` (Notes + Tags)
  - `component_overrides` (identity overrides)
- No derived inventory groupings are written back to storage

---

### 2.2 Viewer Models (Derived)

The following Viewer concepts are **derived in memory**:

- Viewer Projects index
- Component inventory
- Style inventory
- Counts, usage metrics, grouping labels

Derived models:
- Exist only in memory
- Are recomputed on load
- Are not persisted

---

## 3. Project Contract

### 3.1 Definition

> **Viewer Project = ProjectRecord**

Projects shown in the Viewer map directly to records in the `projects` store.

There is no Viewer-only project abstraction in the current MVP.

---

### 3.2 Viewer Project Fields

| Viewer field        | Source                     | Rule |
|--------------------|----------------------------|------|
| `id`               | `ProjectRecord.id`         | Direct mapping |
| `name`             | `ProjectRecord.name`       | Direct mapping |
| `captureCount`     | Derived                    | Count of captures across linked sessions |
| `updatedAtLabel`   | Derived                    | Latest timestamp among project, sessions, or captures |

---

### 3.3 Out of Scope (Current MVP)

- Persisting derived counts or labels
- Persisting derived grouping results (components/styles inventories)

---

## 4. Component Inventory Contract

### 4.1 Definition

> A **Component** is a derived grouping of captures that share the same
> structural + semantic signature.

Components **do not exist in storage** today.

---

### 4.2 Component Grouping (MVP)

For the MVP, grouping is:

- Deterministic
- Repeatable
- Non-intelligent

#### Required signature fields:
- `tagName`
- `role` (computed if not stored)
- `accessibleName` (fallback allowed)
- Style fingerprint (small subset of properties already shown in UI)

> Two captures with the same signature MUST resolve to the same component.

No fuzzy matching, clustering heuristics, or learning in the MVP.

---

### 4.3 Viewer Component Fields

| Field             | Source   | Rule |
|------------------|----------|------|
| `id`             | Derived  | Stable hash of signature |
| `name`           | Derived  | Accessible name or fallback |
| `category`       | Derived  | Taxonomy helper (§7) |
| `type`           | Derived  | Tag/role-based |
| `status`         | Derived + Optional Override | Defaults to `"Unknown"`; can be overridden via `component_overrides` |
| `source`         | Derived  | Most common or first-seen page |
| `capturesCount`  | Derived  | Number of grouped captures |

---

### 4.4 Explicit Non-Goals (MVP)

- Canonical vs Variant detection
- User-defined components
- Persisted grouping metadata
- Smart clustering
- User-defined components

**Clarification (current state):** identity overrides exist, but they do not change grouping.
Overrides only affect the derived labels (display name/category/type/status) for a given `projectId:componentKey`.
- Smart clustering

---

## 5. Style Inventory Contract

### 5.1 Definition

> A **Style** is a derived aggregation of repeated style values across captures.

Styles are not stored explicitly; they are inferred from captured style primitives.

---

### 5.2 Style Derivation Rules (MVP)

- Use existing captured style primitives only
- Group by:
  - Property name (`kind`)
  - Property value
- Count usage across captures

---

### 5.3 Token Semantics (IMPORTANT)

- If a captured style includes a **real token reference**, display it
- If not, token MUST be `"—"` (or empty)
- Do **not** generate fake tokens
- Do **not** infer design-system intent

This avoids churn and preserves future flexibility.

---

### 5.4 Viewer Style Fields

| Field        | Source   | Rule |
|-------------|----------|------|
| `id`        | Derived  | Stable hash |
| `token`     | Derived  | Real token or `"—"` |
| `value`     | Stored   | Raw style value |
| `kind`      | Stored   | Style property name |
| `usageCount`| Derived  | Number of uses |
| `source`    | Derived  | First-seen or most common |

---

## 6. Status Semantics (MVP)

For the MVP:

- Default derived status is `"Unknown"`
- Status can be overridden via `component_overrides`

> Status automation/heuristics remain deferred; only manual overrides exist.

---

## 7. Category Taxonomy (MVP)

### Rules

- Category derivation is:
  - Deterministic
  - Shallow
  - Replaceable later

Initial mapping:
- Based on `tagName` + `role`
- Fixed lookup table
- Can be overridden via `component_overrides` (manual curation)

No ML, learning, or persistence.

---

## 8. Drawer-Derived Data (7.4.3+)

### 8.1 Overview

The DetailsDrawer shows additional derived data when a component or style is selected.
These derivations are in-memory and scoped to the active project.

All drawer data is derived from the same raw captures used for component/style inventories.

---

### 8.2 Component Drawer: Capture List

**Type:** `ViewerComponentCapture[]`

**Purpose:** Shows all individual captures that belong to the selected component.

**Derivation:**
- Filter raw captures where signature-based grouping matches the selected component ID
- Use the same signature logic from component inventory derivation (§4.2)
- Sort by sourceLabel asc, then url asc (deterministic)

**Fields:**
| Field           | Source   | Rule |
|----------------|----------|------|
| `id`           | Capture  | `capture.id` |
| `url`          | Capture  | `capture.url` or `"—"` |
| `sourceLabel`  | Derived  | Page label from URL (§6.3 helper) |
| `timestampLabel` | Placeholder | `"—"` (no timestamp in v2.2 schema) |

**Constraints:**
- Empty array if no captures found (not null)
- Must be deterministic: same component → same list in same order
- No limit on list length

---

### 8.3 Style Drawer: Location List

**Type:** `ViewerStyleLocation[]`

**Purpose:** Shows where the selected style appears, grouped by source (page).

**Derivation:**
- Find all captures that contain the selected style (kind + value match)
- Group by `(sourceLabel, url)` tuple
- Count uses per source
- Sort by uses desc, then sourceLabel asc

**Fields:**
| Field         | Source   | Rule |
|--------------|----------|------|
| `id`         | Derived  | Stable hash of `sourceLabel\|url` |
| `sourceLabel`| Derived  | Page label from URL |
| `url`        | Capture  | Full URL or `"—"` |
| `uses`       | Derived  | Count of captures at this source with this style |

**Constraints:**
- Empty array if style not found in any capture
- Must be deterministic: same inputs → same list
- No limit on list length
- Grouping key is `sourceLabel + url` (not just sourceLabel, to handle duplicate labels)

---

### 8.4 Style Drawer: Related Components

**Type:** `ViewerStyleRelatedComponent[]`

**Purpose:** Shows components that use the selected style.

**Derivation:**
- For each component in the component inventory:
  - Check if any member capture contains the selected style
  - If yes, include component in results
- Sort by component `capturesCount` desc (proxy for usage), then name asc
- Limit to **12 items** maximum

**Fields:**
| Field         | Source   | Rule |
|--------------|----------|------|
| `componentId` | Component | From component inventory |
| `name`        | Component | From component inventory |
| `category`    | Component | From component inventory |
| `type`        | Component | From component inventory |

**Constraints:**
- Empty array if no components use this style
- Must be deterministic: same inputs → same 12 items in same order
- **Hard limit: 12 items** (UI constraint)

---

### 8.5 Drawer Derivation Requirements

All drawer derivations must:
- Be **pure functions** (same inputs → same outputs)
- Be **deterministic** (repeatable, no randomness)
- Use **only** captures scoped to the active project (see §9)
- Return **empty arrays** (not null) when no data available
- Be recomputed on selection change (no cross-selection caching in MVP)

---

## 9. Project Scoping Rules

### 9.1 Core Principle

**All viewer inventories and drawer derivations MUST be computed from captures scoped to the active project.**

The Viewer must never mix captures across different projects.

---

### 9.2 Acceptable Scoping Mechanisms

The Viewer uses **layered scoping** to determine which captures belong to a project:

#### Preferred: Direct projectId
- If `capture.projectId` is present and matches the active project ID, include the capture
- This is the canonical mechanism (added post-v2.2)

#### Fallback: Session linkage
- If `capture.projectId` is missing (backward compatibility):
  - Query `projectSessions` store to find sessions linked to the active project
  - Include captures where `capture.sessionId` matches a linked session

**Implementation note:**
The service worker message `UI/GET_PROJECT_DETAIL` handles this scoping logic and returns only captures belonging to the requested project.

---

### 9.3 Scoping Enforcement

Adapter functions (`deriveComponentInventory`, `deriveStyleInventory`, drawer derivations) receive **pre-scoped captures** as input.

Adapters must **not**:
- Query the database directly
- Perform project filtering logic
- Mix captures from multiple projects

The scoping boundary is enforced at the **message handler layer**.

---

## 10. Interoperability with CaptureRecord Schema

### 10.1 Consumed Fields

The Viewer consumes the following fields from `CaptureRecordV2`:

| Field                 | Purpose |
|----------------------|---------|
| `id`                 | Capture identity |
| `sessionId`          | Fallback project scoping |
| `projectId`          | Preferred project scoping (optional, post-v2.2) |
| `url`                | Source page derivation |
| `createdAt`          | Timestamp, representative capture selection |
| `element`            | Component identity (tagName, role, intent, textPreview) |
| `styles.primitives`  | Style inventory, visual essentials |
| `styles.primitives.sources` | Token extraction (CSS variable names) |
| `thumbnailBlobId`    | Storage | Uses `CaptureRecordV2.screenshot.screenshotBlobId` (representative capture thumbnail) |

---

### 10.2 Token Extraction Semantics

**Rule:** The Viewer extracts CSS variable tokens from `capture.styles.primitives.sources`.

- If `sources` contains a reference like `var(--color-primary)`, extract `--color-primary`
- Pattern: `/var\((--[^)]+)\)/`
- If no CSS variable found, token is `"—"` (never null, never invented)

This aligns with §5.3 (Style Inventory Token Semantics).

**Critical:**
- Do not invent tokens
- Do not infer design-system structure
- Do not generate placeholder token names

---

### 10.3 Schema Version Awareness

The Viewer must tolerate missing fields for backward compatibility:

- `projectId` may be undefined (pre-scoping captures)
- `sources` may be undefined (older captures)
- `typography`, `radius` may be undefined (optional fields)

Use `"—"` or empty arrays as fallbacks, never crash.

---

## 11. Adapter Layer Contract

### 11.1 Single Responsibility Rule

All transforms between storage → Viewer models MUST live in:

```

apps/extension/src/ui/viewer/adapters/

````

Viewer components must never:
- Read IndexedDB records directly
- Perform grouping logic inline
- Compute inventories ad hoc

---

### 11.2 Required Adapter Functions (Current)

```ts
deriveProjectsIndexFromStorage(...)
deriveProjectDetail(...)
deriveComponentInventory(...)
deriveStyleInventory(...)
deriveComponentCaptures(...)           // 7.4.3
deriveStyleLocations(...)              // 7.4.3
deriveRelatedComponentsForStyle(...)   // 7.4.3
deriveVisualEssentialsFromCapture(...) // 7.4.4
````

Each function must:

* Be pure
* Be deterministic
* Reference this contract in comments where behavior is constrained

---

## 12. Performance Contract

For the MVP:

* In-memory derivation is acceptable
* No caching required
* No memoization across reloads
* Optimize only if performance issues are observed

Persistence of derived data is a **future decision**.

---

## 13. Annotations (Notes + Tags) — Shared Across Surfaces

### 13.1 Purpose

Annotations provide a **shared, cross-surface layer** for user-created metadata (Notes and Tags) that applies to component groupings.

- **Shared**: Both Viewer and Sidepanel read from the same storage
- **Component-scoped**: Annotations apply to logical component groupings, not individual captures
- **Keyed by componentKey**: Uses the deterministic `ViewerComponent.id` (component signature hash)

### 13.2 AnnotationRecord Schema

```typescript
interface AnnotationRecord {
    projectId: string;      // Project scope
    componentKey: string;   // Equals ViewerComponent.id (deterministic grouping id)
    notes: string;          // User notes (default "")
    tags: string[];         // User tags (default [])
    updatedAt: number;      // Last modification timestamp (epoch ms)
}
```

### 13.3 Storage

- **Store name**: `annotations`
- **Primary key**: Compound key `${projectId}:${componentKey}`
- **Secondary index**: `by-project` on `projectId` (for bulk project queries)

### 13.4 Semantics

**Key structure:**
- `projectId`: Current project ID
- `componentKey`: Equals `ViewerComponent.id` (the deterministic hash used for component grouping)

**Data rules:**
- If no annotation record exists: `notes = ""` and `tags = []`
- Annotations are per-project, per-component
- Multiple captures with same `componentKey` share one annotation

**Cross-surface guarantee:**
- Viewer and Sidepanel MUST render identical notes/tags for a given `(projectId, componentKey)`
- Both surfaces read via Service Worker message API (single source of truth)

### 13.5 Service Worker API

**GET_PROJECT** — Fetch all annotations for a project
```typescript
Request:  { type: "ANNOTATIONS/GET_PROJECT", projectId: string }
Response: { ok: true, annotations: AnnotationRecord[] }
       | { ok: false, error: string }
```

**GET_ONE** — Fetch single annotation
```typescript
Request:  { type: "ANNOTATIONS/GET_ONE", projectId: string, componentKey: string }
Response: { ok: true, annotation: AnnotationRecord | null }
       | { ok: false, error: string }
```

**UPSERT** — Create/update annotation (explicit Save)
```typescript
Request:  { type: "ANNOTATIONS/UPSERT", projectId: string, componentKey: string, notes: string | null, tags: string[] }
Response: { ok: true }
       | { ok: false, error: string }
```

Notes:
- `notes: null` means “clear notes”
- Tags are stored as an array of strings (no global tag dictionary in MVP)

### 13.6 Non-Goals (MVP)

- Annotation history/versioning is out of scope (single-user, single-device for now)
- **No conflict resolution** (single-user, single-device for now)
- Migration of any legacy comment fields is out of scope

### 13.7 Notes

Viewer and Sidepanel write via `ANNOTATIONS/UPSERT` with explicit Save / Cancel semantics.

---

## 14. Explicit Out of Scope (MVP)

The following are **not allowed** in the MVP:

* Persisting derived inventories
* Inventing tokens
* Guessing design-system structure
* Persisting derived inventories
* Inventing tokens
* Guessing design-system structure

---

## 15. Enforcement Rules

If implementation encounters missing or ambiguous data:

* Prefer `"—"` or `"Unknown"`
* Do not invent semantics
* Add TODO comments referencing this contract

---

## 16. MVP Exit Criteria (Viewer)

The Viewer MVP baseline is met when:

* Viewer uses real projects from storage
* Component inventory is derived and rendered
* Style inventory is derived and rendered
* Drawer shows real usage and captures
* No mock data remains in the Viewer
