# Project Context — UI Inventory App (MVP)

## What this project is
A Chrome Manifest V3 extension (with a future web viewer) that lets product designers run a guided UI audit on a live website or web app and generates a grouped visual inventory of UI elements (buttons, inputs, text, etc.).

Target users:
- General product designers
- Contractors, agencies, small in-house teams
- Legacy / messy SaaS products

This is an MVP focused on speed, clarity, and explainable output.

---

## Current status (IMPORTANT)
### Milestone 0 — COMPLETE
- Chrome extension scaffold works
- Vite + React + TypeScript
- Manifest V3
- Popup UI renders correctly
- Popup → Service Worker → Content Script messaging works
- Build outputs correct files in `apps/extension/dist`
- `popup.html` lives at project root (`apps/extension/popup.html`)
- `popup.html` imports `/src/ui/popup/popup.tsx`
- `dist/` is ignored by git
- Project is committed and tagged as `milestone-0`

---

## Tech stack (locked for MVP)
- Package manager: npm (workspaces)
- Chrome Extension: Manifest V3
- Language: TypeScript
- UI: React (Vite)
- Storage (for now): local / IndexedDB
- No backend yet
- No auth yet

---

## Extension architecture (do not break)
- Popup UI: user controls only
- Service Worker: orchestration, screenshots, persistence
- Content Script: DOM inspection, highlighting, style extraction

Rules:
- Content scripts do NOT call DOM-unsafe Chrome APIs
- Service worker does NOT touch the DOM
- All communication via `chrome.runtime.sendMessage`

---

## Coding style & working rules
- Small, incremental changes only
- No refactors unless explicitly requested
- Avoid “magic” abstractions
- Prefer explainable, debuggable logic
- If a change affects build config, manifest, or messaging → explain first

---

## Explicit non-goals (MVP)
- No automatic crawling
- No framework-specific component detection
- No AI redesigns
- No design system scoring
- No Figma reconstruction yet

---

## Next milestone
Milestone 1: Hover highlighter + click-to-select element
- Visual overlay on hover
- Click selects target
- No screenshots yet
- No persistence yet

---

## How I want help
- Act like a careful engineering partner
- Be explicit about tradeoffs
- Stop and ask if something is ambiguous
- Protect the existing scaffold at all costs