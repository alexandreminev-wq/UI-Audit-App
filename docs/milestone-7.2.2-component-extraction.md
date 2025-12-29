# Milestone 7.2.2 — Component Extraction Deliverables

## Summary

Extracted ProjectsHome and ProjectViewShell into separate component files to reduce viewer.tsx size while maintaining identical functionality.

**Result**: Reduced viewer.tsx from ~4300 lines to 2795 lines (~1500 lines removed, 35% smaller)

---

## 1. Files Created

### A) types/projectViewerTypes.ts
**Location**: `apps/extension/src/ui/viewer/types/projectViewerTypes.ts`

Shared types for project viewer components.

**Exports**:
- `ViewerRoute`: "projects" | "project"
- `Project`: { id, name, captureCount?, updatedAtLabel? }

---

### B) mock/projectMockData.ts
**Location**: `apps/extension/src/ui/viewer/mock/projectMockData.ts`

Mock data constants (file-level to prevent re-renders).

**Exports**:
- `MOCK_COMPONENTS`: Array of 6 mock component records
- `MOCK_STYLES`: Array of 6 mock style records

**Note**: These are temporary and will be replaced with real data in later milestones.

---

### C) components/ProjectsHome.tsx
**Location**: `apps/extension/src/ui/viewer/components/ProjectsHome.tsx`

Projects landing page showing list of available projects.

**Props**:
- `projects: Project[]` - Array of projects to display
- `onSelectProject: (projectId: string) => void` - Callback when project is clicked

**Features**:
- Token-based inline styles
- Project cards with name, capture count, last updated
- Click to navigate to project view

**Size**: 95 lines

---

### D) components/ProjectViewShell.tsx
**Location**: `apps/extension/src/ui/viewer/components/ProjectViewShell.tsx`

Main project view shell with tabs, filters, grid/table layouts, and drawer.

**Props**:
- `projectName: string` - Name of the current project
- `onBack: () => void` - Callback to navigate back to projects list

**Internal State**:
- Tab selection (components/styles)
- View mode (grid/table)
- Filter states (category, type, status, source, kind, style-source)
- Visible properties toggles
- Search query
- Drawer state (open/closed, selected item)
- Menu state (which popover is open)

**Features**:
- Uses DetailsDrawer, FilterPopover, CheckboxList
- Imports MOCK_COMPONENTS and MOCK_STYLES
- All filtering, searching, and UI logic
- Keyboard navigation and accessibility

**Size**: 1363 lines

---

## 2. Files Modified

### viewer.tsx
**Location**: `apps/extension/src/ui/viewer/viewer.tsx`

**Before**: ~4300 lines
**After**: 2795 lines
**Reduction**: ~1500 lines (35% smaller)

**Changes**:
1. **Simplified imports**:
   - Removed: `useEffect`, `useMemo`, `useCallback`, `Popover`, `DetailsDrawer`, `FilterPopover`, `CheckboxList`
   - Added: `ProjectsHome`, `ProjectViewShell`, type imports from `projectViewerTypes`

2. **Removed type definitions**:
   - Moved `ViewerRoute` and `Project` to `types/projectViewerTypes.ts`

3. **Removed components**:
   - Removed `ProjectsHome` function (~83 lines)
   - Removed mock data constants (~19 lines)
   - Removed `ProjectViewShell` function (~1352 lines)

4. **Kept in viewer.tsx**:
   - Routing logic (ViewerApp)
   - URL param handling
   - Mock projects array
   - Project selection state
   - All other viewer screens (sessions, captures, compare, etc.)

---

## 3. Build Verification

```bash
✓ Build completed successfully
✓ No TypeScript errors
✓ No console warnings
✓ viewer.js: 134.55 kB (gzip: 37.98 kB)
```

**Bundle size**: Unchanged (134.55 kB vs 134.61 kB before) - just code reorganization, no functionality changes.

---

## 4. Manual Test Checklist

### Prerequisites
- Load extension in Chrome
- Open viewer page

---

### ✅ Test 1: Projects landing page loads
**Steps**:
1. Open viewer page
2. Verify projects landing page shows
3. Verify "UI Audit Tool" header
4. Verify "Projects" section
5. Verify 3 mock projects displayed:
   - "Website Redesign"
   - "Mobile App"
   - "Design System Audit"

**Expected**: Projects landing page renders correctly

---

### ✅ Test 2: Navigate to project view
**Steps**:
1. Click on "Website Redesign" project
2. Verify project view shell loads
3. Verify header shows "Website Redesign"
4. Verify back button is visible
5. Verify Components/Styles tabs
6. Verify Grid/Table view toggles
7. Verify filter buttons (Category, Type, Status, Source)

**Expected**: Project view opens with all UI elements

---

### ✅ Test 3: Back button navigates to projects list
**Steps**:
1. From project view, click back button (← arrow)
2. Verify navigation back to projects landing page
3. Verify all 3 projects still visible

**Expected**: Back navigation works

---

### ✅ Test 4: All project view functionality works
**Steps**:
1. Open "Website Redesign" project
2. Test Components tab:
   - Open Category filter, select "Actions"
   - Verify filtered results
   - Click grid item
   - Verify drawer opens
3. Test Styles tab:
   - Switch to Styles tab
   - Open Kind filter, select "color"
   - Verify filtered results
   - Click table row
   - Verify drawer opens
4. Test view toggles:
   - Switch between Grid and Table views
   - Verify both render correctly

**Expected**: All filters, tabs, views, and drawer work identically to before extraction

---

### ✅ Test 5: URL routing still works
**Steps**:
1. Navigate to project view
2. Check URL contains `?route=project&projectId=...`
3. Refresh page
4. Verify project view restores correctly
5. Click back
6. Verify URL changes to `?route=projects`
7. Refresh page
8. Verify projects landing page loads

**Expected**: URL routing preserved

---

### ✅ Test 6: No console errors
**Steps**:
1. Open DevTools console
2. Navigate through:
   - Projects list
   - Project view
   - Different tabs
   - Different views
   - Open/close drawer
   - Open/close filters
3. Check for any errors or warnings

**Expected**: No console errors or warnings

---

## 5. Commit Message Suggestion

```
refactor(viewer): extract Project viewer components to reduce file size

- Extract ProjectsHome into components/ProjectsHome.tsx
- Extract ProjectViewShell into components/ProjectViewShell.tsx
- Extract mock data into mock/projectMockData.ts
- Extract types into types/projectViewerTypes.ts
- Reduce viewer.tsx: ~4300 lines → 2795 lines (~1500 lines, 35% smaller)

No behavior changes. Routing logic remains in viewer.tsx.
All functionality preserved with token-based inline styles.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

Alternative shorter version:
```
refactor(viewer): extract Project components (reduce 35% file size)

Move ProjectsHome and ProjectViewShell to separate files.
viewer.tsx: 4300 → 2795 lines. No behavior changes.
```

---

## 6. Technical Details

### File Organization

**Before**:
```
apps/extension/src/ui/viewer/
├── viewer.tsx (~4300 lines)
├── components/
│   ├── DetailsDrawer.tsx
│   ├── FilterPopover.tsx
│   └── CheckboxList.tsx
└── index.css
```

**After**:
```
apps/extension/src/ui/viewer/
├── viewer.tsx (2795 lines) ✨ 35% smaller
├── components/
│   ├── DetailsDrawer.tsx
│   ├── FilterPopover.tsx
│   ├── CheckboxList.tsx
│   ├── ProjectsHome.tsx ✨ NEW
│   └── ProjectViewShell.tsx ✨ NEW
├── types/
│   └── projectViewerTypes.ts ✨ NEW
├── mock/
│   └── projectMockData.ts ✨ NEW
└── index.css
```

---

### Benefits

1. **Maintainability**: viewer.tsx is now 35% smaller and easier to navigate
2. **Separation of concerns**: Project viewer logic isolated from routing logic
3. **Reusability**: ProjectsHome and ProjectViewShell can be tested independently
4. **Type safety**: Shared types in dedicated file
5. **No behavior changes**: All functionality preserved exactly as-is

---

### No Breaking Changes

All changes are purely refactoring:
- ✅ Routing logic preserved in viewer.tsx
- ✅ URL param handling unchanged
- ✅ All project view functionality identical
- ✅ Token-based inline styles preserved
- ✅ Filter logic unchanged
- ✅ Mock data behavior unchanged (file-level constants)
- ✅ Drawer, tabs, views all work the same

---

## 7. Files Modified Summary

### Created (4 files, ~1450 lines)
1. `types/projectViewerTypes.ts` (7 lines)
2. `mock/projectMockData.ts` (24 lines)
3. `components/ProjectsHome.tsx` (95 lines)
4. `components/ProjectViewShell.tsx` (1363 lines)

### Modified (1 file)
1. `viewer.tsx`
   - Removed: ~1500 lines
   - Added: imports and type references
   - Net reduction: ~1490 lines

### Total Impact
- **Lines removed**: ~1500
- **Lines added**: ~1490 (in new files)
- **viewer.tsx reduction**: 35%
- **Bundle size**: Unchanged (134.55 kB)

---

## 8. Remaining in viewer.tsx

viewer.tsx still contains:
- ViewerApp component (routing logic)
- URL param handling
- Mock projects array
- Session and capture-related types
- Session list, capture list, compare screens
- All other viewer functionality

**This is correct** - routing logic should remain in the main viewer file while individual screens are extracted to components.

---

## 9. Future Improvements (Optional)

If more viewer screens are added in the future, consider:

1. Extract session list screen to `components/SessionsView.tsx`
2. Extract capture list screen to `components/CapturesView.tsx`
3. Extract compare screen to `components/CompareView.tsx`
4. Create `hooks/` folder for shared logic (e.g., `useUrlParams.ts`)

These are NOT required now but could further reduce viewer.tsx size.

---

## 10. Code Quality

All extracted code maintains:
- ✅ Token-based inline styles (no Tailwind)
- ✅ Minimal props (only what's needed)
- ✅ File-level constants for mock data (no re-renders)
- ✅ Same React patterns (hooks, state, memo)
- ✅ Same accessibility features
- ✅ Same TypeScript types

No refactoring beyond extraction - just moved code with necessary imports.
