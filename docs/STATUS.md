# UI Inventory MVP — Status

## Milestone 1: Inspect Mode (Hover + Click Select) ✅ COMPLETE
### Done
- Hover overlay works (elementFromPoint + requestAnimationFrame)
- Click-to-select blocks page click (capture phase) and stays in hover mode
- Service worker stores audit enabled per tab (Map)
- Content script resumes hover mode after navigation via AUDIT/GET_STATE on load
- Popup syncs enabled state on mount (AUDIT/GET_STATE)
- Popup auto-closes after enabling (so first click selects)
- Popup shows last selected element after reopening (via AUDIT/GET_STATE lastSelected)

### Testing note
- After reloading the extension, refresh the target webpage tab before testing.

---

## Milestone 2: Capture (Styles + Screenshot + Persistence) ⏳ NEXT
### Plan (Option A)
1) Define capture record schema
2) Extract computed styles + bounding box on click-to-capture
3) Persist capture records to IndexedDB (no screenshots yet)
4) Add viewport screenshot + crop
