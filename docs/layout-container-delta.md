# Layout Container Delta: Sidepanel vs Viewer Drawer

**Date:** January 3, 2026  
**Components Compared:** `ComponentDetails.tsx` (Sidepanel) vs `DetailsDrawer.tsx` (Viewer)

This document analyzes the layout and container construction differences between the Sidepanel component details and Viewer details drawer.

---

## Container Architecture

### Sidepanel (`ComponentDetails.tsx`)

```tsx
return (
  <div className="p-4 space-y-4">
    {/* All content in a single scrollable div */}
    {/* Header */}
    {/* Identity */}
    {/* State selector */}
    {/* Preview */}
    {/* Visual Essentials */}
    {/* Notes */}
    {/* Tags */}
    
    {/* Footer: sticky at bottom */}
    <div className="sticky bottom-0 -mx-4 px-4 pt-3 ...">
      {/* Buttons */}
    </div>
  </div>
);
```

**Architecture:**
- Single root `<div>` container
- Uses Tailwind classes (`p-4 space-y-4`)
- Content scrolls naturally as part of the parent container
- No explicit flexbox layout

### Viewer Drawer (`DetailsDrawer.tsx`)

```tsx
return (
  <Dialog.Content style={{
    position: "fixed",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    // ...
  }}>
    {/* Fixed header */}
    <div style={{ flex: "0 0 auto", ... }}>
      {/* Close button */}
    </div>

    {/* Scrollable body */}
    <div style={{
      flex: "1 1 auto",
      overflowY: "auto",
      padding: "16px 24px 88px 24px", // Extra bottom padding
      // ...
    }}>
      {/* All content */}
    </div>

    {/* Sticky footer (conditionally rendered) */}
    {selectedComponent && (
      <div style={{
        position: "sticky",
        bottom: 0,
        zIndex: 10,
        // ...
      }}>
        {/* Buttons */}
      </div>
    )}
  </Dialog.Content>
);
```

**Architecture:**
- Three-section flexbox layout (header, body, footer)
- Uses inline styles with CSS variables
- Explicit overflow control on body section
- Fixed positioning at viewport level

---

## Layout Strategy Comparison

| Aspect | Sidepanel | Viewer Drawer |
|--------|-----------|---------------|
| **Root Container** | Single `<div>` | Radix UI `Dialog.Content` |
| **Layout Method** | Default flow + sticky footer | Flexbox column (3-section) |
| **Positioning** | Relative (parent controlled) | Fixed (`position: "fixed"`) |
| **Height Control** | Auto (fills parent) | `height: "100vh"` |
| **Styling** | Tailwind classes | Inline styles with CSS vars |
| **Header** | Part of scrollable content | Fixed at top (`flex: "0 0 auto"`) |
| **Body** | Natural scroll | Explicit `overflowY: "auto"` |
| **Footer** | Sticky within scrollable area | Sticky within Dialog.Content |

---

## Footer Implementation

### Sidepanel Footer

```tsx
<div
  className="sticky bottom-0 -mx-4 px-4 pt-3 border-t border-gray-200 bg-white flex gap-2"
  style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
>
  {/* Always visible when component is selected */}
  <Button variant="primary" style={{ flex: 1 }}>Save</Button>
  <Button variant="ghost">Cancel</Button>
  <Button variant="ghost">Delete</Button>
</div>
```

**Characteristics:**
- `position: sticky` within the scrollable content
- Negative margin (`-mx-4`) to extend edge-to-edge
- Uses Tailwind for borders, background, flex
- Always rendered (part of the component tree)
- Safe area inset for mobile browsers

### Viewer Drawer Footer

```tsx
{selectedComponent && (
  <div style={{
    position: "sticky",
    bottom: 0,
    left: 0,
    right: 0,
    background: "hsl(var(--background))",
    borderTop: "1px solid hsl(var(--border))",
    padding: "16px 24px",
    display: "flex",
    gap: 8,
    zIndex: 10,
  }}>
    <button style={{ flex: 1, ... }}>Save</button>
    <button style={{ ... }}>Cancel</button>
    <button style={{ ... }}>Delete</button>
  </div>
)}
```

**Characteristics:**
- `position: sticky` within the flexbox column
- Explicitly positioned (`left: 0, right: 0`)
- Inline styles with CSS variables
- Conditionally rendered (only for components, not styles)
- Explicit `zIndex: 10` for layering
- No safe area inset handling

---

## Scrolling Behavior

### Sidepanel

**Scroll Container:** Parent container (controlled by `ProjectScreen.tsx` or similar)

**Characteristics:**
- Content scrolls naturally within its parent
- Footer sticks to the bottom of the visible area
- When scrolling down, footer remains visible at bottom
- No explicit `overflow` declarations in ComponentDetails

**Body Padding:** Standard `p-4` (16px all sides)

### Viewer Drawer

**Scroll Container:** Middle section of the 3-section flexbox

```tsx
<div style={{
  flex: "1 1 auto",
  overflowY: "auto",
  overflowX: "hidden",
  padding: "16px 24px 88px 24px", // Extra 88px bottom padding
  // ...
}}>
```

**Characteristics:**
- Explicit scroll container with `overflowY: "auto"`
- Body takes all available space (`flex: "1 1 auto"`)
- Extra 88px bottom padding to prevent footer overlap (72px footer + 16px gap)
- Horizontal overflow hidden to prevent layout issues
- Self-contained scrolling (doesn't affect outer page)

---

## Header Implementation

### Sidepanel Header

```tsx
<div className="flex items-start justify-between">
  <div className="flex-1">
    <div className="flex items-center gap-2">
      <h3 className="text-gray-900">{component.name}</h3>
      {component.isDraft && <span>Unsaved</span>}
    </div>
    <p className="text-sm text-gray-500">{component.category}</p>
  </div>
  <button onClick={onClose} className="p-2 ...">
    <X className="w-4 h-4" />
  </button>
</div>
```

**Characteristics:**
- Part of scrollable content (scrolls away when user scrolls down)
- Uses Tailwind classes
- Close button integrated into content flow
- No fixed positioning

### Viewer Drawer Header

```tsx
{/* Header (fixed at top) */}
<div style={{
  flex: "0 0 auto",
  padding: "16px 24px 8px 24px",
  background: "hsl(var(--background))",
  display: "flex",
  justifyContent: "flex-end",
  borderBottom: "1px solid hsl(var(--border))",
}}>
  <Dialog.Close asChild>
    <button type="button" onClick={onClose} style={{ ... }}>
      ✕
    </button>
  </Dialog.Close>
</div>
```

**Characteristics:**
- Fixed at top using flexbox (`flex: "0 0 auto"`)
- Always visible (doesn't scroll away)
- Inline styles with CSS variables
- Only contains close button (component name is in scrollable body)
- Border at bottom to separate from content

---

## Content Organization

### Sidepanel Order
1. **Header** (name, category, close button) - Scrolls
2. **Identity fields** (display name, category, type, status)
3. **State selector** (if multi-state)
4. **Preview image**
5. **Captured From URL**
6. **HTML Structure**
7. **Visual Essentials**
8. **Notes**
9. **Tags**
10. **Footer** (Save/Cancel/Delete) - Sticky

### Viewer Drawer Order
1. **Header** (close button only) - Fixed
2. **Component name + metadata** - Scrolls
3. **Identity fields** (editable)
4. **State selector** (if multi-state)
5. **Preview image**
6. **HTML Structure** (collapsible)
7. **Notes** (editable)
8. **Tags** (editable)
9. **Source URLs** (deduplicated)
10. **Visual Essentials**
11. **Footer** (Save/Cancel/Delete) - Sticky

**Key Difference:** Viewer moves Visual Essentials to the end, after Notes/Tags/Sources.

---

## Spacing & Padding

### Sidepanel

```tsx
<div className="p-4 space-y-4">
```

- Container padding: `16px` all sides
- Vertical spacing: `16px` between sections (`space-y-4`)
- Footer negative margin: `-mx-4` to extend edge-to-edge
- Footer padding: `px-4` to re-inset content

### Viewer Drawer

```tsx
// Body section
<div style={{
  padding: "16px 24px 88px 24px",
  // ...
}}>
```

- Body padding: `16px` top, `24px` horizontal, `88px` bottom
- Explicit bottom padding to account for footer (72px) + gap (16px)
- No negative margins needed (footer is outside body)
- Section spacing: Inline `marginBottom: 24` on each section

---

## Close Button

### Sidepanel

```tsx
<button
  onClick={onClose}
  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
  title="Close"
>
  <X className="w-4 h-4" />
</button>
```

- Lucide React icon (`X`)
- Integrated into content header
- Tailwind styling

### Viewer Drawer

```tsx
<Dialog.Close asChild>
  <button
    type="button"
    onClick={onClose}
    aria-label="Close details"
    style={{
      padding: "4px 8px",
      fontSize: 14,
      background: "hsl(var(--background))",
      color: "hsl(var(--foreground))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "var(--radius)",
      cursor: "pointer",
    }}
  >
    ✕
  </button>
</Dialog.Close>
```

- Unicode character (`✕`)
- Radix UI Dialog.Close wrapper for accessibility
- Inline styles with CSS variables
- Fixed in dedicated header section
- Has `aria-label` for accessibility

---

## Accessibility

### Sidepanel
- Standard HTML structure
- Native focus management
- `title` attributes on interactive elements
- No ARIA roles or labels (relies on native semantics)

### Viewer Drawer
- Radix UI Dialog primitives (ARIA compliant)
- Visually hidden `Dialog.Title` and `Dialog.Description`
- `aria-label` on close button
- Focus trap and keyboard navigation built-in
- `Dialog.Overlay` for modal backdrop

---

## Conditional Rendering

### Sidepanel Footer
```tsx
// Always rendered (no condition)
<div className="sticky bottom-0 ...">
  <Button>Save</Button>
  <Button>Cancel</Button>
  <Button>Delete</Button>
</div>
```

**Always visible** when ComponentDetails is mounted.

### Viewer Drawer Footer
```tsx
{selectedComponent && (
  <div style={{ position: "sticky", ... }}>
    <button>Save</button>
    <button>Cancel</button>
    <button>Delete</button>
  </div>
)}
```

**Conditionally rendered** - only shown when a component is selected (not for styles).

---

## Z-Index Management

### Sidepanel
- Delete confirmation modal: `z-50`
- Footer: No explicit z-index (relies on stacking context)

### Viewer Drawer
- Dialog overlay: `zIndex: 50`
- Dialog content: `zIndex: 51`
- Footer: `zIndex: 10` (within Dialog.Content)

More explicit z-index management in Viewer.

---

## Summary: Key Differences

| Feature | Sidepanel | Viewer Drawer | Impact |
|---------|-----------|---------------|--------|
| **Layout Strategy** | Single scroll container | 3-section flexbox | 🟡 Medium - Different scroll behavior |
| **Header Position** | Scrollable | Fixed | 🟡 Medium - UX difference |
| **Footer Visibility** | Always rendered | Conditional | 🟢 Low - Logic difference |
| **Styling Approach** | Tailwind classes | Inline CSS vars | 🔴 High - Consistency issue |
| **Close Button** | In content flow | Fixed header | 🟡 Medium - UX difference |
| **Content Order** | Visual Essentials mid-page | Visual Essentials at end | 🟡 Medium - UX difference |
| **Padding** | Uniform (16px) | Asymmetric (24px sides) | 🟢 Low - Visual difference |
| **Accessibility** | Native HTML | Radix UI + ARIA | 🔴 High - A11y gap |
| **Z-Index** | Implicit | Explicit | 🟢 Low - Implementation detail |

---

## Recommendations

### Priority 1: Critical
1. **Standardize styling approach** - Both should use CSS variables consistently
   - Option A: Convert Sidepanel Tailwind → inline styles with CSS vars
   - Option B: Convert Viewer inline styles → Tailwind (harder with Dialog)
   - **Recommended: Option A** for consistency with existing Button component work

2. **Improve Sidepanel accessibility**
   - Consider wrapping in a dialog/drawer primitive
   - Add ARIA labels and roles
   - Implement proper focus management

### Priority 2: Medium
3. **Align content order**
   - Decide on canonical section order
   - Apply to both (currently Visual Essentials placement differs)

4. **Standardize header behavior**
   - Decide: Should header scroll or be fixed?
   - Current Viewer approach (fixed header) is more common in drawer patterns

5. **Unify footer approach**
   - Should footer always render or be conditional?
   - Viewer's conditional approach makes sense (only for components)

### Priority 3: Low
6. **Consistent padding/spacing**
   - Align horizontal padding (16px vs 24px)
   - Standardize section gaps

7. **Close button consistency**
   - Same icon style (Lucide vs Unicode)
   - Same positioning strategy

---

## Related Files

- `apps/extension/src/ui/sidepanel/shell/components/ComponentDetails.tsx`
- `apps/extension/src/ui/viewer/components/DetailsDrawer.tsx`
- `apps/extension/src/ui/shared/components/Button.tsx`
- `apps/extension/src/ui/theme/theme.css`

---

## Change History

- **2026-01-03**: Initial layout delta analysis (post button standardization work)


