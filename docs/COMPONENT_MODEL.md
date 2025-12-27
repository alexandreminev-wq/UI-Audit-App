# COMPONENT_MODEL

*Last updated: 2025-12-27*

This document defines the **canonical component model** used by the UI Audit Tool across capture, review, and export.  
It governs how captured UI elements are represented, classified, reviewed, and organized in the Viewer.

This model is **designer-oriented**, not DOM-oriented.

---

## 1. Core Concepts

### Component
A **Component** represents a captured UI element that is meaningful to designers and auditors.

A component is:
- Captured from a live UI
- Classified into a **Category** and **Type**
- Reviewed and optionally edited by the user
- Included or excluded from exports

Components are **reviewable artifacts**, not raw DOM nodes.

---

### Style (derived)
A **Style** is a deduplicated visual value (color, spacing, radius, typography, shadow) derived from one or more components.

Styles:
- Are **read-only**
- Are **grouped and deduplicated**
- Exist to support **design system auditing**
- Can be exported independently or alongside components

---

## 2. Component Data Model

### Component Fields

```ts
Component {
  id: string
  displayName: string

  category: ComponentCategory
  type: ComponentType

  status: ComponentStatus

  previewImageUrl?: string
  sourceUrl: string

  htmlSnippet?: string

  stylePrimitives?: StylePrimitives

  tags?: string[]
  notes?: string

  createdAt: timestamp
  updatedAt: timestamp
}
````

---

### Editable vs Derived Fields

| Field           | Editable | Notes                     |
| --------------- | -------- | ------------------------- |
| displayName     | ✅        | User-defined naming       |
| category        | ✅        | Correct misclassification |
| type            | ✅        | Conditional on category   |
| status          | ✅        | Review state              |
| tags            | ✅        | Freeform                  |
| notes           | ✅        | Freeform                  |
| stylePrimitives | ❌        | Derived from capture      |
| htmlSnippet     | ❌        | Reference only            |
| sourceUrl       | ❌        | Provenance                |

---

## 3. Categories & Types (Canonical)

Categories define **intent**.
Types define **shape** within that intent.

Types are **strictly conditional** on Category.

---

### 3.1 Actions

> User-initiated intent. Something happens.

**Types**

* Button
* Link
* Icon Button
* Toggle Button

---

### 3.2 Forms

> User provides or selects data.

**Types**

* Input
* Textarea
* Select
* Checkbox
* Radio
* Switch
* Slider
* Date Picker
* File Upload

---

### 3.3 Navigation

> Moves the user through information space.

**Types**

* Nav Link
* Menu
* Menu Item
* Tabs
* Tab
* Breadcrumb
* Pagination
* Sidebar Item

---

### 3.4 Content

> Displays information. No interaction required.

**Types**

* Heading
* Paragraph
* Text
* Label
* List
* List Item
* Rich Text

---

### 3.5 Media

> Visual or illustrative assets.

**Types**

* Image
* Icon
* Avatar
* Video
* Illustration
* Logo

---

### 3.6 Feedback

> System responses and state indicators.

**Types**

* Alert
* Toast
* Banner
* Tooltip
* Modal
* Snackbar
* Inline Message
* Empty State

---

### 3.7 Layout

> Structural and organizational primitives.

**Types**

* Card
* Container
* Section
* Panel
* Divider
* Grid
* Landmark

---

### 3.8 Data Display

> Structured or token-like information.

**Types**

* Table
* Table Row
* Table Cell
* Badge
* Chip
* Tag
* Stat
* Key Value

---

### 3.9 Unknown

> Captured but not confidently classified.

**Types**

* Element
* Custom Element
* Unclassified

**Rules**

* Always visible
* Never hidden by default
* Valid audit signal
* Expected to decrease during review

---

## 4. Component Status

Status reflects **review state**, not visual role.

### Allowed Status Values

* **Unreviewed** – Default after capture
* **Canonical** – Primary reference implementation
* **Variant** – Acceptable alternative
* **Deviation** – Inconsistent or problematic
* **Legacy** – Deprecated but still present
* **Experimental** – Intentional exploration

Status is **user-assigned** and **filterable**.

---

## 5. Viewer Modes (Unified)

The Viewer operates in a **single unified review mode**.

There is **no separate browse vs review mode**.

Instead:

* Filters control scope
* Selection controls export
* Editing occurs in the detail panel

---

### Viewer Capabilities

Users can:

* Browse components or styles
* Filter by Category, Type, Status, Source
* Review and correct classification
* Add tags and notes
* Inspect derived visual properties
* Select items for export
* Export the filtered view

---

## 6. Filtering & Sections

### Filter Bar

* Category
* Type (conditional on Category)
* Status
* Source
* Unknown only toggle
* Search

---

### Sectioned Inventory

* Sections by Category appear **only** when:

  * Category filter = “All Categories”
* When a specific Category or Type is selected:

  * Sections collapse into a single list/grid

---

## 7. Detail View (Right Panel)

The detail panel is the **only sidebar in the system**.

It supports:

* Identity editing (name, category, type, status)
* Source inspection
* HTML reference
* Visual Essentials (read-only)
* Notes and tags
* Delete / Save actions

Styles shown here are **informational**, not editable.

---

## 8. Export Model

Export always operates on the **current filtered view**.

Exports may include:

* Components
* Styles
* Or both

Target formats (future):

* Figma frames / boards
* JSON
* CSV

---

## 9. Design Principles

* Designers review, systems derive
* Unknown is allowed
* Human-readable over raw CSS
* Capture is automatic, meaning is curated
* Viewer is the source of truth

