# Viewer Data Contract (Phase 3 — 7.4.x)

> This document defines the **explicit contract** between the extension’s stored data model
> and the Viewer UI.
>
> Any implementation work in **Phase 3 (7.4.x)** MUST conform to this contract unless the
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
- What is **explicitly out of scope** for 7.4.x

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

The following IndexedDB v3 stores are the **only sources of truth**:

- `projects`
- `projectSessions`
- `sessions`
- `captures`
- `blobs`

Rules:
- Viewer is **read-only** in 7.4.x
- No schema migrations
- No derived data is written back to storage

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
- Are not persisted in 7.4.x

---

## 3. Project Contract

### 3.1 Definition

> **Viewer Project = ProjectRecord**

Projects shown in the Viewer map directly to records in the `projects` store.

There is no Viewer-only project abstraction in Phase 3.

---

### 3.2 Viewer Project Fields

| Viewer field        | Source                     | Rule |
|--------------------|----------------------------|------|
| `id`               | `ProjectRecord.id`         | Direct mapping |
| `name`             | `ProjectRecord.name`       | Direct mapping |
| `captureCount`     | Derived                    | Count of captures across linked sessions |
| `updatedAtLabel`   | Derived                    | Latest timestamp among project, sessions, or captures |

---

### 3.3 Out of Scope (7.4.x)

- Editing project metadata
- Creating or deleting projects
- Persisting derived counts or labels

---

## 4. Component Inventory Contract

### 4.1 Definition

> A **Component** is a derived grouping of captures that share the same
> structural + semantic signature.

Components **do not exist in storage** today.

---

### 4.2 Component Grouping (MVP)

For 7.4.1, grouping is:

- Deterministic
- Repeatable
- Non-intelligent

#### Required signature fields:
- `tagName`
- `role` (computed if not stored)
- `accessibleName` (fallback allowed)
- Style fingerprint (small subset of properties already shown in UI)

> Two captures with the same signature MUST resolve to the same component.

No fuzzy matching, clustering heuristics, or learning in 7.4.x.

---

### 4.3 Viewer Component Fields

| Field             | Source   | Rule |
|------------------|----------|------|
| `id`             | Derived  | Stable hash of signature |
| `name`           | Derived  | Accessible name or fallback |
| `category`       | Derived  | Taxonomy helper (§7) |
| `type`           | Derived  | Tag/role-based |
| `status`         | Placeholder | Always `"Unknown"` in 7.4.x |
| `source`         | Derived  | Most common or first-seen page |
| `capturesCount`  | Derived  | Number of grouped captures |

---

### 4.4 Explicit Non-Goals (7.4.x)

- Canonical vs Variant detection
- User-defined components
- Persisted grouping metadata
- Manual overrides
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

## 6. Status Semantics (Deferred)

For **all of Phase 3 (7.4.x)**:

- All components have `status = "Unknown"`
- No automatic classification
- No persistence
- No UI controls

> Status semantics are explicitly deferred to a later milestone.

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
- Not user-editable

No ML, learning, or persistence.

---

## 8. Adapter Layer Contract

### 8.1 Single Responsibility Rule

All transforms between storage → Viewer models MUST live in:

```

apps/extension/src/ui/viewer/adapters/

````

Viewer components must never:
- Read IndexedDB records directly
- Perform grouping logic inline
- Compute inventories ad hoc

---

### 8.2 Required Adapter Functions (Phase 3)

```ts
deriveProjectsIndexFromStorage(...)
deriveProjectDetail(...)
deriveComponentInventory(...)
deriveStyleInventory(...)
````

Each function must:

* Be pure
* Be deterministic
* Reference this contract in comments where behavior is constrained

---

## 9. Performance Contract

For 7.4.x:

* In-memory derivation is acceptable
* No caching required
* No memoization across reloads
* Optimize only if performance issues are observed

Persistence of derived data is a **future decision**.

---

## 10. Explicit Out of Scope (7.4.x)

The following are **not allowed** in Phase 3:

* Persisting derived inventories
* Inventing tokens
* Guessing design-system structure
* Editing components or styles
* Deleting captures
* IndexedDB schema migrations

---

## 11. Enforcement Rules

If implementation encounters missing or ambiguous data:

* Prefer `"—"` or `"Unknown"`
* Do not invent semantics
* Add TODO comments referencing this contract

---

## 12. Phase 3 Exit Criteria

Phase 3 is complete when:

* Viewer uses real projects from storage
* Component inventory is derived and rendered
* Style inventory is derived and rendered
* Drawer shows real usage and captures
* No mock data remains in the Viewer
