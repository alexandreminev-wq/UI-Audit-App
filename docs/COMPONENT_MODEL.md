# COMPONENT_MODEL

*Last updated: 2025-12-25 (Europe/Madrid)*

This document defines how the UI Inventory App represents, categorizes, groups, and displays captured UI elements **for designers**.

It establishes a strict separation between:

- **Side panel** → capture validation & evidence presentation
- **Viewer** → analysis, refinement, and audit management

This is a **view-only model**:
- All categorization, grouping, and analysis is derived at runtime
- No derived keys, signatures, or scores are persisted into capture records
- Captures remain immutable evidence

---

## Why this exists

The capture pipeline produces trustworthy **evidence**:
- screenshots
- element metadata
- accessibility signals
- style primitives

Designers, however, need an **inventory**, not raw DOM output.

This model bridges:
> captured evidence → designer-readable inventory → audit insights

while remaining honest, explainable, and reversible.

---

## Canon constraints (do not break)

- Service worker is the only IndexedDB accessor
- Content script / side panel / viewer communicate via message passing only
- No edits to `dist/**`
- Derived labels and groupings are computed at runtime
- No schema changes for derived data
- Prefer explainable heuristics over opaque inference
- CSS variables are evidence, not tokens
- Token semantics are user-defined later

---

# PART 1 — SIDE PANEL MODEL (CAPTURE VALIDATION)

## Purpose of the side panel

The side panel exists to answer **one question**:

> “Did we capture the right thing, and does it look the way a designer expects?”

It is **not** an audit or management surface.

---

## Side panel responsibilities

### 1) Component identity (classification)

Each capture is mapped to:

- **functionalCategory**  
  High-level designer grouping  
  *(Actions, Forms, Navigation, Content, Feedback, Overlay, Media, Layout, Unknown)*

- **typeKey**  
  Stable internal identifier  
  *(button, link, text-input, nav, checkbox, image, etc.)*

- **displayName**  
  Human-readable name  
  - Accessible name when available  
  - Otherwise a smart fallback (“Button”, “Text input”)

- *(optional, debug only)* **confidence**  
  Indicates strength of classification signals

#### Selection precedence
1. ARIA role
2. Semantic tagName
3. Input type
4. Minimal heuristics (last resort)

> The side panel does **not** infer modules, components, or variants.

---

### 2) Designer-friendly property display (“Visual Essentials”)

The side panel shows **summarized, readable properties**, not raw JSON.

#### Visual Essentials (v1)

**Text**
- Font size
- Font weight
- Text color

**Surface**
- Background color
- Border color (if present)
- Border radius
- Shadow (present / layer count)

**Spacing**
- Padding (T / R / B / L)

**State**
- Disabled (when detectable)
- Focusable (best effort)

Rules:
- Show values exactly as detected
- Normalize formatting for readability
- Never invent values
- Display `—` when unavailable

---

### 3) Variable provenance (evidence only)

When directly detectable, the side panel may show:

Background
rgb(19, 61, 87)
↳ var(--color-primary)

Rules:
- Variables are shown only when explicitly detectable
- No stylesheet crawling or cascade reconstruction
- No token naming or interpretation
- No compliance claims

Purpose:
> “Is this value system-driven or hard-coded?”

---

### 4) Lightweight grouping (navigation only)

The side panel may group captures by:
- functionalCategory
- typeKey
- type + displayName

Purpose:
- browsing
- scanning
- sanity checking

The side panel does **not** group by:
- patterns
- signatures
- consistency
- compliance

---

## Explicitly out of scope for side panel

The side panel does **not**:
- compute pattern frequency
- detect variants
- score consistency
- recommend changes
- allow persistent edits
- manage relationships between captures

---

# PART 2 — VIEWER MODEL (AUDIT & REFINEMENT)

## Purpose of the viewer

The viewer exists for **analysis and decision-making**.

It answers:
- “What patterns exist?”
- “Where are inconsistencies?”
- “How do components relate to each other?”
- “What should we fix or document?”

---

## Viewer responsibilities

### 1) Manual refinement (user intent)

Manual actions live **only in the viewer**.

Allowed manual annotations:
- Rename capture (displayName override)
- Add notes
- Add tags
- Assign status:
  - canonical
  - variant
  - deviation
  - legacy
  - experimental
- (Optional) override category/typeKey

Manual data:
- Is stored separately from capture records
- Never mutates captured evidence
- Is scoped by project

---

### 2) Relationships & grouping

The viewer may allow users to:
- Group captures as variants
- Mark a canonical instance within a group
- Compare variants visually

These relationships are:
- user-defined
- runtime-derived
- never written back to captures

---

### 3) Pattern detection & analysis

Viewer-only analysis may include:
- frequency analysis of colors, spacing, typography
- detection of repeated values
- identification of one-offs

Principle:
> Frequency implies intention, not correctness.

---

### 4) Variable adoption analysis

The viewer may show:
- which components use CSS variables
- which variables are most used
- where values are hard-coded

Still evidence-based, not prescriptive.

---

### 5) Compliance (user-defined, later)

Only after users:
- import a design token set
- or define expected values

The viewer may then report:
- compliant
- variant
- deviation

The app never defines compliance on its own.

---

## Explicitly deferred

- Structural level scoring (Element / Module / Component)
- Framework detection heuristics
- Suggested token names
- Auto-generated design systems
- CSS stylesheet crawling
- Prescriptive recommendations

---

## Summary: responsibility split

| Concern | Side panel | Viewer |
|------|-----------|--------|
| Classification | ✅ | ✅ |
| Naming | ✅ | ✅ |
| Visual properties | ✅ | ✅ |
| Variable evidence | ✅ | ✅ |
| Manual edits | ❌ | ✅ |
| Grouping / variants | ❌ | ✅ |
| Pattern detection | ❌ | ✅ |
| Compliance | ❌ | ✅ (user-defined) |

---

## Design principle

> **Evidence first. Interpretation later. Authority stays with the user.**