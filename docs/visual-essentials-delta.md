# Visual Essentials Delta Analysis

**Date:** January 3, 2026  
**Comparison:** Sidepanel vs Viewer Visual Essentials Tables

This document analyzes the implementation differences between the Sidepanel and Viewer Visual Essentials display components to identify inconsistencies and opportunities for standardization.

---

## Data Source & Preparation

### Sidepanel
- Uses `formatVisualEssentials()` utility from `apps/extension/src/ui/sidepanel/shell/utils/formatVisualEssentials.ts`
- Returns `VisualEssentialsSection[]` with structured rows
- Processes `StylePrimitives` once during render
- Type: `VisualEssentialsRow` (no `hex8` field)

### Viewer
- Uses inline `deriveVisualEssentialsFromPrimitives()` function (lines 499-591 in `DetailsDrawer.tsx`)
- Returns `ViewerVisualEssentials` with `ViewerVisualEssentialsRow[]`
- Recomputes on every state change
- Type: `ViewerVisualEssentialsRow` (has `hex8?: string` field)

**Delta:** Different utility functions with slightly different logic, but same purpose.

---

## Color Value Display

### Sidepanel (via `formatVisualEssentials`)
```typescript
// Text color: Uses raw value
const textColor = normalizeCssValue(styles.color?.raw);

// Background: Uses raw value
const bgColor = normalizeCssValue(styles.backgroundColor?.raw);

// Border color: Uses hex8 OR raw
const topHex = bc.top?.hex8 || bc.top?.raw;
```

### Viewer (via `deriveVisualEssentialsFromPrimitives`)
```typescript
// Text color: Uses hex8 OR raw
const textColor = primitives.color?.hex8 || primitives.color?.raw;

// Background: Uses hex8 OR raw
const bgColor = primitives.backgroundColor?.hex8 || primitives.backgroundColor?.raw;

// Border color: Uses hex8 OR raw
const topHex = bc.top?.hex8 || bc.top?.raw;
```

**Delta:** Sidepanel prioritizes `raw` for text/background colors, Viewer prioritizes `hex8`. This could cause inconsistency in display format (e.g., showing OKLCH vs hex).

---

## Border Color Hex8 Metadata

### Sidepanel
- Does NOT pass `hex8` in the row data structure
- `VisualEssentialsRow` type has no `hex8` field
- Must be looked up later in `ComponentDetails.tsx` (lines 548-553):
  ```typescript
  const hex8 = prop === "color"
    ? primitives?.color?.hex8
    : prop === "backgroundColor"
      ? primitives?.backgroundColor?.hex8
      : primitives?.borderColor?.hex8;
  ```

### Viewer
- DOES pass `hex8` in the row data structure
- `ViewerVisualEssentialsRow` has `hex8?: string` field
- Directly available for `TokenTraceValue` (line 547 in `DetailsDrawer.tsx`)
- Uses fallback lookup only if `row.hex8` is not present (lines 1304-1316)

**Delta:** Viewer has more efficient data structure for color properties. Sidepanel requires additional lookups.

---

## TokenTraceValue Integration

### Sidepanel (`ComponentDetails.tsx`)
```typescript
// Manually checks if row is a color row
const isColorRow =
  row.label === "Text color" ||
  row.label === "Background" ||
  row.label === "Border color";

// Looks up hex8 from component.stylePrimitives
const hex8 = prop === "color"
  ? primitives?.color?.hex8
  : prop === "backgroundColor"
    ? primitives?.backgroundColor?.hex8
    : primitives?.borderColor?.hex8;

// Disables copy actions for ALL color rows
<TokenTraceValue
  // ...
  showCopyActions={false}
/>
```

### Viewer (`DetailsDrawer.tsx`)
```typescript
// Same manual check for color rows
const isColorRow =
  row.label === "Text color" ||
  row.label === "Background" ||
  row.label === "Border color";

// Uses row.hex8 first, with fallback lookup
const hex8 = row.hex8 || (() => {
  const primitives: any = currentStateData.visualEssentialsTrace.primitives;
  // ... fallback logic
})();

// Disables copy actions only for Background and Border color
<TokenTraceValue
  // ...
  showCopyActions={row.label !== "Background" && row.label !== "Border color"}
/>
```

**Delta:** 
- Viewer allows copy actions for "Text color", Sidepanel does not
- Viewer has more efficient hex8 lookup due to better data structure

---

## CSS Shorthand Formatting

Both implementations have identical `format4SidedValue()` helper functions:

```typescript
function format4SidedValue(top: string, right: string, bottom: string, left: string): string {
  // All sides equal
  if (top === right && right === bottom && bottom === left) {
    return top;
  }

  // Top/bottom equal and left/right equal
  if (top === bottom && right === left) {
    return `${top} ${right}`;
  }

  // All different (CSS order: top right bottom left)
  return `${top} ${right} ${bottom} ${left}`;
}
```

Used for: border width, padding, radius, border color

**Delta:** No difference - identical implementation.

---

## Section Filtering

### Sidepanel
- Always returns all 3 sections: Text, Surface, Spacing
- Even if rows are empty
- Sections always render in `StylePropertiesTable`

### Viewer
- Filters out empty sections before rendering:
  ```typescript
  }).filter(section => section.rows.length > 0)}
  ```
- Only renders sections with content

**Delta:** Viewer is more polished by not rendering empty sections. Sidepanel may show empty section headers.

---

## Font Family Display

### Sidepanel (`formatVisualEssentials.ts`)
```typescript
const fontFamily = styles.typography.fontFamily;
if (fontFamily) {
  textRows.push({
    label: 'Font family',
    value: fontFamily, // Full font stack
    evidence: styles.sources?.fontFamily
  });
}
```

### Viewer (`deriveVisualEssentialsFromPrimitives`)
```typescript
if (primitives.typography?.fontFamily) {
  rows.push({ 
    label: "Font family", 
    value: primitives.typography.fontFamily, // Full font stack
    section: "Text" 
  });
}
```

**Delta:** Both show full font family. `StylePropertiesTable` component applies truncation + expand/collapse UI for "Font family" rows (lines 81-82, 114-127).

---

## Evidence/Source Tracking

### Sidepanel (`formatVisualEssentials.ts`)
- Includes `evidence` field in `VisualEssentialsRow` type
- Populates from `styles.sources` for all properties:
  ```typescript
  textRows.push({
    label: 'Text color',
    value: textColor,
    evidence: styles.sources?.color  // ✅ Tracked
  });
  ```

### Viewer (`deriveVisualEssentialsFromPrimitives`)
- Does NOT include any `evidence` or `sources` field
- No metadata about where values came from
- `ViewerVisualEssentialsRow` has no evidence property

**Delta:** Sidepanel tracks style provenance (though not currently displayed in UI), Viewer does not. This could be valuable for future design token tracing features.

---

## Margin Property

### Sidepanel
- Does NOT display margin property
- Not included in `formatVisualEssentials()` function

### Viewer
- Displays margin with CSS shorthand:
  ```typescript
  if (primitives.margin) {
    const m = primitives.margin;
    rows.push({ 
      label: "Margin", 
      value: format4SidedValue(m.marginTop, m.marginRight, m.marginBottom, m.marginLeft), 
      section: "Spacing" 
    });
  }
  ```

**Delta:** Viewer shows margin, Sidepanel does not. This is a feature gap.

---

## Gap Property

### Sidepanel
- Does NOT display gap property
- Not included in `formatVisualEssentials()` function

### Viewer
- Displays gap as "rowGap / columnGap":
  ```typescript
  if (primitives.gap) {
    rows.push({ 
      label: "Gap", 
      value: `${primitives.gap.rowGap} / ${primitives.gap.columnGap}`, 
      section: "Spacing" 
    });
  }
  ```

**Delta:** Viewer shows gap, Sidepanel does not. This is a feature gap for flexbox/grid layouts.

---

## State Section

### Sidepanel (`formatVisualEssentials.ts`)
- Removed in earlier work (no "State" section)
- Type definition only includes: `'Text' | 'Surface' | 'Spacing'`

### Viewer (`DetailsDrawer.tsx`)
- Creates "State" section header in filter array (line 1279)
- But no rows are ever added to it (no code pushes rows with `section: "State"`)
- Gets filtered out by `.filter(section => section.rows.length > 0)`

**Delta:** Viewer has vestigial "State" section definition but filters it out. Sidepanel doesn't define it at all. Both effectively show no state section.

---

## Summary Table

| Aspect | Sidepanel | Viewer | Impact Level |
|--------|-----------|--------|--------------|
| **Color value priority** | `raw` first | `hex8` first | 🟡 Medium - Visual inconsistency |
| **`hex8` in row data** | ❌ No | ✅ Yes | 🟢 Low - Performance only |
| **Copy actions for Text color** | ❌ Disabled | ✅ Enabled | 🟡 Medium - UX inconsistency |
| **Evidence tracking** | ✅ Yes | ❌ No | 🟢 Low - Not displayed |
| **Margin display** | ❌ No | ✅ Yes | 🟡 Medium - Feature gap |
| **Gap display** | ❌ No | ✅ Yes | 🟡 Medium - Feature gap |
| **Empty section filtering** | ❌ No | ✅ Yes | 🟢 Low - Polish only |
| **CSS shorthand** | ✅ Yes | ✅ Yes | ✅ Consistent |
| **Font family expand/collapse** | ✅ Yes | ✅ Yes | ✅ Consistent |

---

## Recommendations for Standardization

### Priority 1: High Impact
1. **Standardize color value priority** to `hex8 || raw` consistently across both
   - Update `formatVisualEssentials.ts` lines 127, 181 to prioritize hex8
   - Ensures consistent color format display

2. **Add margin & gap to Sidepanel**
   - Update `formatVisualEssentials.ts` to include margin and gap properties
   - Achieves feature parity with Viewer

3. **Unify copy action behavior** for color properties
   - Decide: Should "Text color" allow copy actions?
   - Apply same logic to both Sidepanel and Viewer

### Priority 2: Medium Impact
4. **Add `hex8` field to Sidepanel's `VisualEssentialsRow`** type
   - Eliminates need for manual lookup in `ComponentDetails.tsx`
   - Improves efficiency and consistency with Viewer

5. **Add empty section filtering to Sidepanel**
   - Filter out sections with no rows before passing to `StylePropertiesTable`
   - Improves polish and consistency with Viewer

### Priority 3: Future Enhancement
6. **Consolidate formatter functions** into single shared utility
   - Create `apps/extension/src/ui/shared/utils/formatVisualEssentials.ts`
   - Single source of truth for both Sidepanel and Viewer
   - Reduces duplication and drift

7. **Consider evidence/source display** in UI
   - Sidepanel already tracks it, Viewer doesn't
   - Could be valuable for "where did this value come from?" features
   - Might need design work for display

---

## Related Files

- `apps/extension/src/ui/sidepanel/shell/utils/formatVisualEssentials.ts` - Sidepanel formatter
- `apps/extension/src/ui/sidepanel/shell/components/ComponentDetails.tsx` - Sidepanel rendering
- `apps/extension/src/ui/viewer/components/DetailsDrawer.tsx` - Viewer formatter & rendering
- `apps/extension/src/ui/shared/components/StylePropertiesTable.tsx` - Shared table component
- `apps/extension/src/ui/shared/tokenTrace/TokenTraceValue.tsx` - Token trace display
- `apps/extension/src/types/capture.ts` - Type definitions for StylePrimitives

---

## Change History

- **2026-01-03**: Initial delta analysis documenting current state as of commit `c234439` (m9-polish-v1 branch)

