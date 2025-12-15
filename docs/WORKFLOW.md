# Workflow

## Build / test loop
1) npm run build
2) chrome://extensions -> Reload extension
3) Refresh the target webpage tab
4) Test

## Popup behavior
- Popup closes when you click the page (expected).

## Claude working rules
- Small incremental diffs only
- Stop after planning unless explicitly told “apply changes”
- Do not run build unless explicitly requested
- Never edit apps/**/dist/**