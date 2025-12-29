# Milestone 7.2.2e — VisiblePropertiesPopover Extraction Deliverables

## Summary

Extracted the "Visible properties" popover from ProjectViewShell into a separate VisiblePropertiesPopover component to reduce file size and improve maintainability.

**Result**: Reduced ProjectViewShell from ~1363 lines to ~1250 lines (~113 lines removed, 8% smaller)

---

## 1. Files Created

### A) components/VisiblePropertiesPopover.tsx
**Location**: `apps/extension/src/ui/viewer/components/VisiblePropertiesPopover.tsx`

Standalone Radix Popover component for toggling visible table/grid properties.

**Props**:
- `activeTab`: "components" | "styles" - Current tab to determine which checkboxes to show
- `visibleComponentProps`: Object with boolean flags for name, category, type, status, source, captures
- `visibleStyleProps`: Object with boolean flags for token, kind, source, uses
- `setVisibleComponentProps`: State setter for component props
- `setVisibleStyleProps`: State setter for style props
- `openMenu`: Current open menu state ("properties" or null)
- `setOpenMenu`: Function to control which menu is open
- `filterButtonStyle`: Style object for the trigger button

**Features**:
- Token-based inline styles
- Tab-aware: shows different checkboxes for Components vs Styles tabs
- Controlled component pattern (openMenu state)
- Radix Popover with arrow, proper positioning (bottom-end align)
- Keyboard navigation (Escape closes)
- Accessible (aria-label)

**Size**: 169 lines

---

## 2. Files Modified

### ProjectViewShell.tsx
**Location**: `apps/extension/src/ui/viewer/components/ProjectViewShell.tsx`

**Before**: ~1363 lines
**After**: ~1250 lines
**Reduction**: ~113 lines (8% smaller)

**Changes**:
1. **Removed import**:
   - Removed: `import * as Popover from "@radix-ui/react-popover";`

2. **Added import**:
   - Added: `import { VisiblePropertiesPopover } from "./VisiblePropertiesPopover";`

3. **Replaced inline popover** (lines 648-766):
   - Removed: 118 lines of Popover.Root, Popover.Trigger, Popover.Content, tab-aware checkboxes
   - Added: Single `<VisiblePropertiesPopover />` component with 8 props

**Before**:
```tsx
<Popover.Root
    open={openMenu === "properties"}
    onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "properties" : null)}
>
    <Popover.Trigger asChild>
        <button type="button" style={{ ...styles.filterButton, ... }}>
            Visible properties
        </button>
    </Popover.Trigger>
    <Popover.Portal>
        <Popover.Content sideOffset={8} side="bottom" align="end" ...>
            {/* 118 lines of checkboxes and logic */}
        </Popover.Content>
    </Popover.Portal>
</Popover.Root>
```

**After**:
```tsx
<VisiblePropertiesPopover
    activeTab={activeTab}
    visibleComponentProps={visibleComponentProps}
    visibleStyleProps={visibleStyleProps}
    setVisibleComponentProps={setVisibleComponentProps}
    setVisibleStyleProps={setVisibleStyleProps}
    openMenu={openMenu}
    setOpenMenu={setOpenMenu}
    filterButtonStyle={styles.filterButton}
/>
```

---

## 3. Build Verification

```bash
✓ Build completed successfully
✓ No TypeScript errors
✓ viewer.js: 134.97 kB (gzip: 38.53 kB)
```

**Bundle size**: Virtually unchanged (134.97 kB vs 134.55 kB before) - just code reorganization, no functionality changes.

---

## 4. Manual Test Checklist

### Prerequisites
- Load extension in Chrome
- Open viewer page
- Navigate to a project view

---

### ✅ Test 1: Visible properties popover opens
**Steps**:
1. Click "Visible properties" button
2. Verify popover appears below button (bottom-end aligned)
3. Verify arrow points to button
4. Verify "Visible properties" header visible

**Expected**: Popover opens correctly with proper positioning

---

### ✅ Test 2: Components tab shows correct checkboxes
**Steps**:
1. Ensure Components tab is active
2. Open Visible properties popover
3. Verify checkboxes shown:
   - ✓ Name
   - ✓ Category
   - ✓ Type
   - ✓ Status
   - ✓ Source
   - ✓ Captures

**Expected**: All 6 component property checkboxes visible

---

### ✅ Test 3: Styles tab shows correct checkboxes
**Steps**:
1. Switch to Styles tab
2. Open Visible properties popover
3. Verify checkboxes shown:
   - ✓ Token
   - ✓ Kind
   - ✓ Source
   - ✓ Uses

**Expected**: All 4 style property checkboxes visible

---

### ✅ Test 4: Checkboxes toggle correctly
**Steps**:
1. Open Visible properties (Components tab)
2. Uncheck "Category"
3. Verify Category column disappears from grid/table
4. Check "Category" again
5. Verify Category column reappears
6. Switch to Styles tab
7. Uncheck "Kind"
8. Verify Kind column disappears
9. Check "Kind" again
10. Verify Kind column reappears

**Expected**: All checkboxes control column visibility correctly

---

### ✅ Test 5: Popover closes on Escape
**Steps**:
1. Open Visible properties popover
2. Press Escape key
3. Verify popover closes

**Expected**: Escape key closes popover

---

### ✅ Test 6: Popover closes on outside click
**Steps**:
1. Open Visible properties popover
2. Click anywhere outside the popover
3. Verify popover closes

**Expected**: Outside click closes popover

---

### ✅ Test 7: Button shows active state when open
**Steps**:
1. Open Visible properties popover
2. Verify button has gray background and bold text
3. Close popover
4. Verify button returns to normal state

**Expected**: Button visual state changes when popover is open

---

### ✅ Test 8: Only one menu open at a time
**Steps**:
1. Open "Category" filter
2. Verify Category popover is open
3. Open "Visible properties" popover
4. Verify Visible properties popover is open
5. Verify Category popover is closed

**Expected**: Opening one menu closes others (controlled by openMenu state)

---

### ✅ Test 9: No console errors
**Steps**:
1. Open DevTools console
2. Navigate through:
   - Open/close Visible properties popover
   - Toggle checkboxes
   - Switch between tabs
   - Toggle columns on/off
3. Check for any errors or warnings

**Expected**: No console errors or warnings

---

## 5. Commit Message Suggestion

```
refactor(viewer): extract VisiblePropertiesPopover component

- Extract Visible properties popover from ProjectViewShell
- Create VisiblePropertiesPopover.tsx (169 lines)
- Reduce ProjectViewShell: ~1363 lines → ~1250 lines (~113 lines, 8% smaller)
- Remove Popover import from ProjectViewShell (now handled in child component)

Tab-aware checkboxes preserved. No behavior changes.
All functionality identical with token-based inline styles.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

Alternative shorter version:
```
refactor(viewer): extract VisiblePropertiesPopover (reduce 8% file size)

Move Visible properties popover to separate component.
ProjectViewShell: 1363 → 1250 lines. No behavior changes.
```

---

## 6. Technical Details

### File Organization Impact

**Before**:
```
apps/extension/src/ui/viewer/components/
├── ProjectViewShell.tsx (~1363 lines)
├── DetailsDrawer.tsx
├── FilterPopover.tsx
└── CheckboxList.tsx
```

**After**:
```
apps/extension/src/ui/viewer/components/
├── ProjectViewShell.tsx (~1250 lines) ✨ 8% smaller
├── DetailsDrawer.tsx
├── FilterPopover.tsx
├── CheckboxList.tsx
└── VisiblePropertiesPopover.tsx ✨ NEW
```

---

### Benefits

1. **Maintainability**: ProjectViewShell is now 8% smaller and easier to navigate
2. **Separation of concerns**: Visible properties logic isolated
3. **Reusability**: VisiblePropertiesPopover can be tested independently
4. **Type safety**: Props interface ensures correct usage
5. **No behavior changes**: All functionality preserved exactly as-is
6. **Cleaner imports**: ProjectViewShell no longer needs Radix Popover import

---

### No Breaking Changes

All changes are purely refactoring:
- ✅ Tab-aware checkbox logic preserved
- ✅ Controlled openMenu pattern unchanged
- ✅ Token-based inline styles preserved
- ✅ Keyboard navigation (Escape) unchanged
- ✅ Accessibility (aria-label) preserved
- ✅ Visual styling identical
- ✅ State management pattern unchanged

---

## 7. Props Design

### Why separate visibleComponentProps and visibleStyleProps?

The component uses **tab-aware state management**:
- Components tab needs: name, category, type, status, source, captures
- Styles tab needs: token, kind, source, uses

Instead of a single props object with conditional logic, we use:
- `visibleComponentProps` - active when `activeTab === "components"`
- `visibleStyleProps` - active when `activeTab === "styles"`

This keeps the parent component's state clear and prevents conflicts.

### Why filterButtonStyle prop?

The trigger button needs to match the styling of other filter buttons in the toolbar. Passing `styles.filterButton` from the parent ensures visual consistency without duplicating style definitions.

---

## 8. Code Quality

Extracted component maintains:
- ✅ Token-based inline styles (no Tailwind)
- ✅ Minimal props (only what's needed)
- ✅ Same React patterns (controlled component, state management)
- ✅ Same accessibility features (aria-label, keyboard navigation)
- ✅ Same TypeScript types (strict prop interface)
- ✅ Same Radix UI patterns (Portal, Arrow, collision detection)

No refactoring beyond extraction - just moved code with necessary props.

---

## 9. Files Modified Summary

### Created (1 file, 169 lines)
1. `components/VisiblePropertiesPopover.tsx` (169 lines)

### Modified (1 file)
1. `components/ProjectViewShell.tsx`
   - Removed: ~118 lines (inline popover)
   - Removed: Popover import
   - Added: VisiblePropertiesPopover import + component usage
   - Net reduction: ~113 lines

### Total Impact
- **Lines removed**: ~118 (inline popover)
- **Lines added**: ~169 (new file)
- **ProjectViewShell reduction**: 8%
- **Bundle size**: Unchanged (~134.97 kB)

---

## 10. Comparison to Other Extractions

This extraction follows the same pattern as previous milestone work:

**7.2.2c - FilterPopover extraction**:
- Created FilterPopover.tsx (64 lines)
- Created CheckboxList.tsx (123 lines)
- Reduced viewer.tsx by ~540 lines

**7.2.2d - Project shell extraction**:
- Created ProjectsHome.tsx (95 lines)
- Created ProjectViewShell.tsx (1363 lines)
- Reduced viewer.tsx by ~1500 lines (35%)

**7.2.2e - VisiblePropertiesPopover extraction** (this):
- Created VisiblePropertiesPopover.tsx (169 lines)
- Reduced ProjectViewShell by ~113 lines (8%)

All extractions maintain identical functionality with no behavior changes.

---

## 11. Future Improvements (Optional)

If more popovers are added in the future, consider:

1. Create a shared `ViewOptionsPopover` pattern for similar UI (like FilterPopover)
2. Extract other inline popovers from ProjectViewShell
3. Consider a `useVisibleProperties` hook if logic becomes more complex

These are NOT required now but could further reduce duplication.

---

## 12. Architectural Notes

### Why extract this specific popover?

1. **Size**: 118 lines of inline JSX is substantial
2. **Complexity**: Tab-aware logic with conditional rendering
3. **Self-contained**: Clear props interface, no complex dependencies
4. **Reusability**: Could be used in other views with similar needs

### Why keep other popovers inline?

Category, Type, Status, Source, Kind, Style-Source filters use the **FilterPopover + CheckboxList** pattern, which already extracts the common logic. The Visible properties popover is different because:
- Tab-aware (shows different checkboxes per tab)
- Different state shape (boolean object vs Set<string>)
- Different styling (wider popover, no Clear/Select all buttons)

---

## 13. Testing Notes

### Key scenarios to verify:

1. **Tab switching**: Popover content changes when switching tabs
2. **State persistence**: Unchecked properties stay unchecked when switching tabs and back
3. **Column visibility**: Toggling checkboxes immediately shows/hides columns
4. **Menu coordination**: Opening this popover closes other popovers
5. **Keyboard**: Escape closes, tab navigation works
6. **Accessibility**: Screen readers can access checkbox labels

All scenarios should work identically to before extraction.

---

## 14. Line Count Verification

**Before extraction**:
```bash
# ProjectViewShell.tsx had inline popover at lines 648-766 (118 lines)
# Total file: ~1363 lines
```

**After extraction**:
```bash
# ProjectViewShell.tsx: ~1250 lines
# VisiblePropertiesPopover.tsx: 169 lines
# Net change: +169 -118 = +51 lines total (but -113 in ProjectViewShell)
```

The goal is **file size reduction in ProjectViewShell**, not total line reduction across the codebase.

---
