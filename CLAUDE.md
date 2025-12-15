# Claude Code — Project Instructions
(UI Inventory MVP)

## Project summary
You are assisting on a **UI Inventory MVP**: a Chrome Manifest V3 extension + simple viewer that lets product designers run a guided UI audit on a live website or web app and generates a grouped visual inventory of UI elements.

This is an MVP for **general product designers** (contractors, agencies, small in-house teams) working with legacy or messy products.

The goal is **speed, clarity, and explainable output**, not perfect technical accuracy.

---

## Working style (IMPORTANT)
- Make **small, incremental changes only**
- Never refactor unrelated code
- Never introduce new dependencies without explaining why
- Prefer clarity over cleverness
- Avoid “magic” or overly abstract solutions
- If a change affects multiple files, explain the sequence clearly

⚠️ If a proposed change:
- touches build tooling
- modifies the Vite config
- changes the manifest
- affects message passing between extension contexts

→ **STOP and explain the change before writing code**

---

## Tech constraints (locked for MVP)
- Package manager: **npm**
- Chrome Extension: **Manifest V3**
- Language: **TypeScript**
- UI: **React (Vite)**
- Storage (MVP): **IndexedDB (local-first)**
- No backend or auth in MVP
- No automatic crawling
- No framework-specific component detection

---

## Extension architecture (do not break this)
### Contexts
- **Popup UI** → user controls (start/stop audit, capture)
- **Service worker** → orchestration + screenshots + storage
- **Content script** → DOM inspection, highlighting, style extraction

Rules:
- Content scripts **never** access Chrome APIs that aren’t allowed
- Service worker **never** touches the DOM
- Popup **never** directly inspects the page

All communication happens via `chrome.runtime.sendMessage`.

---

## MVP capture philosophy
- Capture is **guided and manual**
- User navigates flows themselves
- We record:
  - element bounding box
  - computed styles
  - screenshot crop
  - page URL context
- Grouping is **heuristic and explainable**
- Approximation is acceptable and expected

---

## Data integrity rules
Every captured element must have:
- a stable `id`
- a `category`
- a `boundingBox`
- a `styles` object
- a `signature.exactKey`
- a cropped screenshot

If any of these are missing, treat it as a bug.

---

## Grouping rules (do not over-engineer)
- Use style signatures (exact + near)
- Bucket sizes, radii, padding for stability
- Never introduce ML or AI grouping in MVP
- Always allow inspection of why two elements are grouped

---

## UX principles
- Visual-first output beats perfect data
- Show counts, variants, and locations
- “Good enough” consistency detection is acceptable
- Favor transparency over confidence

---

## What NOT to do
- ❌ Don’t add full-app crawling
- ❌ Don’t auto-detect React/Vue components
- ❌ Don’t rebuild UI into editable Figma layers
- ❌ Don’t add design system compliance scoring
- ❌ Don’t add AI redesign suggestions

If asked to do any of the above, push back politely and explain why it’s out of scope.

---

## When unsure
If:
- the requirement is ambiguous
- the change could break the extension build
- the change introduces new architectural complexity

→ Ask a clarifying question **before** writing code.

---

## Definition of “done” for a task
A task is done when:
- The extension still loads in Chrome
- No existing capture or messaging behavior breaks
- The change is easy to explain to a product designer
- The solution aligns with MVP goals

---

## Tone
- Be pragmatic
- Be cautious
- Be explicit about tradeoffs
- Act like a helpful engineering partner, not an autonomous agent

---

## Short reminder
This is an MVP built **to learn**, not to be perfect.
Favor shipping, inspecting real usage, and iterating.

## Current focus (Milestone 1 override)
- Only hover highlight + click-to-select
- Stay in hover mode after selection
- No screenshots, no persistence, no IndexedDB work yet
- Do not implement capture/grouping rules until Milestone 2+

---

## Generated files rule (VERY IMPORTANT)
- NEVER edit files in apps/**/dist/** (build output is minified and auto-generated).
- Always make changes in apps/extension/src/** instead.
- If you need to verify output, describe what to look for in dist, but do not modify it.
- Do not reformat files unless explicitly asked. Keep existing style.
- Prefer minimal diffs: change only the lines required for the feature.

---

## Testing notes
- After reloading the extension, refresh the target webpage tab before testing (content scripts won’t exist on already-open pages).

## Workflow rule
- Always stop after planning unless I explicitly say “apply the changes”.
- Do not run build commands unless I explicitly ask.

---

## Source of truth for progress
- Read docs/STATUS.md for “what’s done” and “what’s next”.
- Do not treat CLAUDE.md as a changelog.