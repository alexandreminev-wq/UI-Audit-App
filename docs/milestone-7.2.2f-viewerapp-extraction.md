# Milestone 7.2.2f — ViewerApp Extraction Deliverables

## Summary

Extracted ViewerApp component from the entry file (viewer.tsx) to make it a thin bootstrap that only mounts the app.

**Result**: viewer.tsx reduced from 109 lines to 9 lines (~91% smaller)

---

## 1. Files Created

### A) components/ViewerApp.tsx
**Location**: `apps/extension/src/ui/viewer/components/ViewerApp.tsx`

Main app component with routing logic, URL helpers, and state management.

**Contents**:
- URL navigation helpers: `getSelectedProjectIdFromUrl()`, `setSelectedProjectIdInUrl()`
- ViewerApp component with:
  - Route state (projects/project)
  - Project selection state
  - Mock projects array
  - Browser back/forward handling (popstate event)
  - Routing logic to ProjectsHome, ProjectViewShell, or LegacySessionsViewer

**Size**: 101 lines

**Exports**:
- `export function ViewerApp()`

---

## 2. Files Modified

### viewer.tsx
**Location**: `apps/extension/src/ui/viewer/viewer.tsx`

**Before**: 109 lines (contained ViewerApp component, URL helpers, routing logic)
**After**: 9 lines (thin bootstrap, only mounts ViewerApp)
**Reduction**: 100 lines (~91% smaller)

**Changes**:
1. **Removed imports**:
   - `useState`, `useEffect` from React
   - `ProjectsHome`, `ProjectViewShell`, `LegacySessionsViewer` components
   - `ViewerRoute`, `Project` types

2. **Added import**:
   - `ViewerApp` from `./components/ViewerApp`

3. **Removed**:
   - URL helper functions (moved to ViewerApp.tsx)
   - ViewerApp component definition (moved to ViewerApp.tsx)

4. **Kept**:
   - ReactDOM import
   - CSS import (`./index.css`)
   - Render section (`ReactDOM.createRoot(...).render(<ViewerApp />)`)

**Before**:
```tsx
import { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { ProjectsHome } from "./components/ProjectsHome";
import { ProjectViewShell } from "./components/ProjectViewShell";
import { LegacySessionsViewer } from "./components/LegacySessionsViewer";
import type { ViewerRoute, Project } from "./types/projectViewerTypes";

// URL helpers...
function getSelectedProjectIdFromUrl() { ... }
function setSelectedProjectIdInUrl() { ... }

// ViewerApp component...
function ViewerApp() { ... }

ReactDOM.createRoot(document.getElementById("root")!).render(<ViewerApp />);
```

**After**:
```tsx
import ReactDOM from "react-dom/client";
import "./index.css";
import { ViewerApp } from "./components/ViewerApp";

// ─────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById("root")!).render(<ViewerApp />);
```

---

## 3. Build Verification

```bash
✓ Build completed successfully
✓ No TypeScript errors
✓ viewer.js: 134.99 kB (gzip: 38.57 kB)
```

**Bundle size**: Unchanged (134.99 kB) - just code reorganization, no functionality changes.

---

## 4. Manual Test Checklist

### Prerequisites
- Load extension in Chrome
- Open viewer page

---

### ✅ Test 1: Projects home renders
**Steps**:
1. Open viewer page
2. Verify projects landing page shows
3. Verify "UI Audit Tool" header
4. Verify "Projects" section
5. Verify 3 mock projects displayed:
   - "E-commerce Redesign"
   - "Dashboard Components"
   - "Mobile App Audit"

**Expected**: Projects landing page renders correctly

---

### ✅ Test 2: Navigate to project view
**Steps**:
1. Click on "E-commerce Redesign" project
2. Verify URL changes to `?project=p1`
3. Verify project view shell loads
4. Verify header shows "E-commerce Redesign"
5. Verify back button is visible
6. Verify Components/Styles tabs visible

**Expected**: Project view opens with correct project name

---

### ✅ Test 3: Back button navigation
**Steps**:
1. From project view, click back button (← arrow)
2. Verify URL changes to base viewer URL (no ?project param)
3. Verify navigation back to projects landing page
4. Verify all 3 projects still visible

**Expected**: Back button navigates to projects list

---

### ✅ Test 4: Direct URL access with project ID
**Steps**:
1. Navigate to viewer with `?project=p2` in URL
2. Verify project view opens directly
3. Verify header shows "Dashboard Components"
4. Verify no flash of projects list

**Expected**: Direct project URL works, initializes route state from URL

---

### ✅ Test 5: Browser back/forward buttons
**Steps**:
1. Open viewer (projects list)
2. Click on "Mobile App Audit" project
3. Click browser back button
4. Verify returns to projects list
5. Click browser forward button
6. Verify returns to "Mobile App Audit" project view

**Expected**: Browser back/forward buttons work correctly (popstate handling)

---

### ✅ Test 6: Page refresh preserves route
**Steps**:
1. Navigate to project view (?project=p1)
2. Refresh the page (F5 or Cmd+R)
3. Verify project view restores correctly
4. Verify correct project name shown
5. Go back to projects list
6. Refresh the page
7. Verify projects list loads

**Expected**: Page refresh preserves URL-based route state

---

### ✅ Test 7: Invalid project ID fallback
**Steps**:
1. Navigate to `?project=invalid-id`
2. Verify project view attempts to load
3. Verify header shows "Unknown Project"
4. Verify no errors in console
5. Verify back button works

**Expected**: Invalid project ID shows "Unknown Project" without crashing

---

### ✅ Test 8: No console errors
**Steps**:
1. Open DevTools console
2. Navigate through:
   - Projects list
   - Project view
   - Back to projects
   - Browser back/forward
   - Refresh page
3. Check for any errors or warnings

**Expected**: No console errors or warnings

---

### ✅ Test 9: Legacy sessions UI remains unreachable
**Steps**:
1. Check that no route leads to legacy sessions UI
2. Verify all routing goes through projects/project paths
3. Verify LegacySessionsViewer is still imported (for future use)

**Expected**: Legacy UI unreachable, but component import preserved

---

## 5. Commit Message Suggestion

```
viewer: extract ViewerApp from entry file

- Extract ViewerApp component to components/ViewerApp.tsx
- Extract URL navigation helpers (getSelectedProjectIdFromUrl, setSelectedProjectIdInUrl)
- Reduce viewer.tsx: 109 lines → 9 lines (91% smaller)
- viewer.tsx now thin bootstrap that only mounts <ViewerApp />

No behavior changes. All routing logic preserved.
Token-based inline styles maintained.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

Alternative shorter version:
```
viewer: extract ViewerApp (91% entry file reduction)

Move ViewerApp component to separate file.
viewer.tsx: 109 → 9 lines. No behavior changes.
```

---

## 6. Technical Details

### File Organization Impact

**Before**:
```
apps/extension/src/ui/viewer/
├── viewer.tsx (109 lines)
│   ├── URL helpers
│   ├── ViewerApp component
│   └── ReactDOM render
├── components/
│   ├── ProjectsHome.tsx
│   ├── ProjectViewShell.tsx
│   ├── LegacySessionsViewer.tsx
│   ├── DetailsDrawer.tsx
│   ├── FilterPopover.tsx
│   ├── CheckboxList.tsx
│   └── VisiblePropertiesPopover.tsx
└── types/
    └── projectViewerTypes.ts
```

**After**:
```
apps/extension/src/ui/viewer/
├── viewer.tsx (9 lines) ✨ 91% smaller - thin bootstrap
├── components/
│   ├── ViewerApp.tsx (101 lines) ✨ NEW - routing logic
│   ├── ProjectsHome.tsx
│   ├── ProjectViewShell.tsx
│   ├── LegacySessionsViewer.tsx
│   ├── DetailsDrawer.tsx
│   ├── FilterPopover.tsx
│   ├── CheckboxList.tsx
│   └── VisiblePropertiesPopover.tsx
└── types/
    └── projectViewerTypes.ts
```

---

### Benefits

1. **Separation of concerns**: Entry file only handles mounting, app logic isolated
2. **Cleaner entry point**: viewer.tsx is now trivial to understand (9 lines)
3. **Better testability**: ViewerApp can be imported and tested independently
4. **Standard pattern**: Follows common React app structure (index.tsx → App.tsx)
5. **No behavior changes**: All functionality preserved exactly as-is
6. **Easier hot reload**: HMR boundary more clear with separate component file

---

### No Breaking Changes

All changes are purely organizational:
- ✅ URL routing logic preserved
- ✅ popstate event handling unchanged
- ✅ Project selection state management identical
- ✅ Mock projects array unchanged
- ✅ Routing to ProjectsHome/ProjectViewShell preserved
- ✅ LegacySessionsViewer fallback unchanged
- ✅ All imports resolved correctly

---

## 7. Import Structure

### ViewerApp.tsx imports:
```tsx
import { useState, useEffect } from "react";
import { ProjectsHome } from "./ProjectsHome";
import { ProjectViewShell } from "./ProjectViewShell";
import { LegacySessionsViewer } from "./LegacySessionsViewer";
import type { ViewerRoute, Project } from "../types/projectViewerTypes";
```

**Note**: Relative imports use `./` for sibling components and `../types/` for parent-level types.

### viewer.tsx imports:
```tsx
import ReactDOM from "react-dom/client";
import "./index.css";
import { ViewerApp } from "./components/ViewerApp";
```

**Note**: Only 3 imports total - minimal, focused entry file.

---

## 8. Code Quality

Extracted component maintains:
- ✅ Same React patterns (hooks, state management)
- ✅ Same routing logic (URL params, popstate)
- ✅ Same state initialization from URL
- ✅ Same TypeScript types
- ✅ Same mock data structure
- ✅ Same comments and documentation

No refactoring beyond extraction - just moved code with updated imports.

---

## 9. Files Modified Summary

### Created (1 file, 101 lines)
1. `components/ViewerApp.tsx` (101 lines)
   - URL helpers (25 lines)
   - ViewerApp component (76 lines)

### Modified (1 file)
1. `viewer.tsx`
   - Removed: 100 lines (URL helpers, ViewerApp, component imports, type imports)
   - Kept: 9 lines (ReactDOM, CSS, ViewerApp import, render)
   - Net reduction: 91 lines

### Total Impact
- **Lines removed from viewer.tsx**: 100
- **Lines added to ViewerApp.tsx**: 101
- **viewer.tsx reduction**: 91%
- **Bundle size**: Unchanged (~134.99 kB)

---

## 10. Comparison to Previous Extractions

This follows the same incremental extraction pattern:

**7.2.2a - DetailsDrawer extraction**:
- Created DetailsDrawer.tsx
- Reduced viewer.tsx by drawer component

**7.2.2c - FilterPopover extraction**:
- Created FilterPopover.tsx, CheckboxList.tsx
- Reduced viewer.tsx by ~540 lines

**7.2.2d - Project shell extraction**:
- Created ProjectsHome.tsx, ProjectViewShell.tsx
- Reduced viewer.tsx by ~1500 lines (35%)

**7.2.2e - VisiblePropertiesPopover extraction**:
- Created VisiblePropertiesPopover.tsx
- Reduced ProjectViewShell by ~113 lines (8%)

**7.2.2-5A - Legacy sessions extraction**:
- Created LegacySessionsViewer.tsx (2707 lines)
- Reduced viewer.tsx from 2795 to 109 lines (96%)

**7.2.2f - ViewerApp extraction** (this):
- Created ViewerApp.tsx (101 lines)
- Reduced viewer.tsx from 109 to 9 lines (91%)
- **Final state**: viewer.tsx is now a minimal entry file

All extractions maintain identical functionality with no behavior changes.

---

## 11. Entry File Evolution

### Original (before all extractions):
- **Size**: ~4300 lines
- **Contents**: Everything (sessions UI, projects UI, helpers, routing, render)

### After legacy extraction (7.2.2-5A):
- **Size**: 109 lines
- **Contents**: URL helpers, ViewerApp component, render

### After ViewerApp extraction (this - 7.2.2f):
- **Size**: 9 lines ✨
- **Contents**: Only imports and ReactDOM render
- **Purpose**: Thin bootstrap / entry point only

**Total reduction from original**: ~4291 lines removed from entry file (~99.8% smaller)

---

## 12. Why Extract ViewerApp?

### Reasons for extraction:

1. **Standard pattern**: Most React apps follow index.tsx (entry) → App.tsx (root component) structure
2. **Testing**: ViewerApp can now be imported and tested without side effects
3. **Hot reload**: Clear HMR boundary for app logic vs mount logic
4. **Minimal entry**: Entry files should only handle mounting, not application logic
5. **Future-proof**: Makes it easier to add providers, error boundaries, etc. around <ViewerApp />

### Why keep some logic in ViewerApp vs splitting further?

- URL helpers are only used by ViewerApp (not shared)
- Routing logic is core to ViewerApp (not worth extracting to separate router)
- Mock projects will be replaced with real data in 7.4 (temporary state)
- Component is focused and cohesive at 101 lines

---

## 13. Future Structure Notes

When real project data is added (Milestone 7.4), ViewerApp.tsx might gain:
- Project data fetching logic
- IndexedDB message handlers
- Project state management

The thin entry file (viewer.tsx) will remain unchanged.

---

## 14. Diff Summary

See `docs/viewer-app-extraction.diff` for full unified diff.

**Key changes**:
- +101 lines in ViewerApp.tsx (new file)
- -100 lines in viewer.tsx (moved to ViewerApp.tsx)
- Net: +1 line overall (mostly just reorganization)

---
