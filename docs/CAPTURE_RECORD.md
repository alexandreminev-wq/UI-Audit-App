# CAPTURE_RECORD

*Last updated: 2025-12-31*

This document defines the **Capture Record** schema used by the UI Audit Tool.

A Capture Record represents a **single piece of evidence** collected from a real webpage.
It is immutable after creation and serves as the foundation for all higher-level review,
classification, and export workflows.

**Draft captures (MVP behavior):**
- The Sidepanel capture flow creates a persisted **draft** first.
- Drafts are committed into the saved captures set only on explicit user Save.
- Draft state is represented by a capture-level flag (e.g. `isDraft`) and/or a separate drafts store.

---

## 1. Purpose of the Capture Record

The Capture Record exists to store **trustworthy, replayable evidence** of UI elements as they
exist on a real page at a moment in time.

It is intentionally:
- Low-level
- DOM-adjacent
- Immutable
- Independent of design interpretation

All meaningful interpretation (component naming, categorization, status, grouping)
happens later and is **not persisted here**.

Instead, user edits live in separate “review layer” stores keyed by `projectId:componentKey`:
- `annotations`: Notes + Tags
- `component_overrides`: Display Name / Category / Type / Status

This preserves the capture record as immutable evidence while still allowing designer curation.

---

## 2. High-Level Structure

```ts
CaptureRecord {
  id: string
  sessionId: string
  projectId?: string

  createdAt: timestamp

  page: PageContext
  element: ElementContext

  styles: CaptureStyles

  screenshot: ScreenshotRef
}
````

---

## 3. Identity & Context

### PageContext

```ts
PageContext {
  url: string
  title?: string
}
```

* Represents the page where the element was captured
* Used for provenance and linking back to source

---

### ElementContext

```ts
ElementContext {
  tagName: string
  attributes?: Record<string, string>
  accessibleName?: string

  outerHTML?: string

  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}
```

Notes:

* This is **not** a full DOM snapshot
* Stored only to support:

  * debugging
  * classification
  * audit traceability

---

## 4. Style Capture (Visual Evidence)

### CaptureStyles

```ts
CaptureStyles {
  computed?: Record<string, string>
  primitives?: StylePrimitives
}
```

* `computed` is an optional raw dump for debugging
* `primitives` is the canonical, normalized representation used by the Viewer

---

## 5. StylePrimitives (Visual Essentials)

StylePrimitives are **derived at capture time** and stored as structured evidence.

They represent *what the browser resolved*, not what designers intended.

```ts
StylePrimitives {
  spacing: SpacingPrimitive

  margin?: MarginPrimitive
  borderWidth?: BorderWidthPrimitive
  gap?: GapPrimitive

  backgroundColor: ColorPrimitive
  color: ColorPrimitive
  borderColor?: ColorPrimitive

  shadow: ShadowPrimitive

  typography?: TypographyPrimitive
  radius?: RadiusPrimitive

  opacity?: number | null

  sources?: StyleSources
}
```

---

### SpacingPrimitive

```ts
SpacingPrimitive {
  paddingTop: string
  paddingRight: string
  paddingBottom: string
  paddingLeft: string
}
```

---

### ColorPrimitive

```ts
ColorPrimitive {
  raw: string
  rgba?: {
    r: number
    g: number
    b: number
    a: number
  } | null
}
```

---

### ShadowPrimitive

```ts
ShadowPrimitive {
  boxShadowRaw: string
  shadowPresence: "none" | "some"
  shadowLayerCount?: number | null
}
```

---

### TypographyPrimitive

```ts
TypographyPrimitive {
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
}
```

---

### RadiusPrimitive

```ts
RadiusPrimitive {
  topLeft: string
  topRight: string
  bottomRight: string
  bottomLeft: string
}
```

---

### StyleSources (CSS Variable Provenance)

StyleSources capture **inline CSS variable usage only** at capture time.

```ts
StyleSources = Partial<Record<StyleSourceKey, string>>
```

```ts
StyleSourceKey =
  | "backgroundColor"
  | "color"
  | "borderColor"
  | "boxShadow"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "lineHeight"
  | "radiusTopLeft"
  | "radiusTopRight"
  | "radiusBottomRight"
  | "radiusBottomLeft"
```

Notes:

* Only captures `var(--*)` references found in **inline styles**
* Stylesheet-level variable resolution is deferred to future analysis
* Absence of sources ≠ hardcoded value

---

## 6. Screenshot Reference

```ts
ScreenshotRef {
  screenshotBlobId: string
}
```

* Screenshot bytes are stored separately
* Capture record stores only the reference
* Viewer retrieves screenshot data via Service Worker

---

## 7. What Capture Records Do *Not* Contain

Capture Records intentionally **do not store**:

* Component names
* Categories or Types
* Status (Canonical, Variant, etc.)
* Tags or notes
* Grouping or relationships
* Pattern detection or deduplication
* Token mappings or compliance judgments

These belong to the **Viewer review layer**, not capture.

---

## 8. Immutability Rules

* Capture Records are **append-only**
* Editing a component never mutates the underlying capture
* Re-capturing an element creates a new record
* Deletion removes the record but does not rewrite history

---

## 9. Relationship to the Viewer

In the Viewer:

* Capture Records are transformed into **Components**
* Classification and naming are derived or user-corrected
* Styles are deduplicated and aggregated across records
* Review status and export decisions live outside capture

The Capture Record remains the **source of truth for evidence**.

---

## 10. Design Principles

* Capture reality, not intent
* Preserve evidence
* Defer meaning
* Avoid premature normalization
* Support future re-analysis
