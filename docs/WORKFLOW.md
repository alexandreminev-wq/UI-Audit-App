# Workflow

_Last updated: 2025-12-25 (Europe/Madrid)_

This repo contains:
- **Chrome extension (MV3)**: content script + service worker + side panel UI
- **Viewer**: packaged web app built into the extension output as `viewer.html`

### Side panel vs viewer responsibilities

- **Side panel**: Capture validation only
  - Toggle capture mode (per-tab)
  - Review what you just captured
  - Quick delete if needed
  - Launch viewer for deeper work

- **Viewer**: Refinement, grouping, and audit management
  - Browse all captures across projects/sessions
  - Group and compare variants
  - Export for design system audits
  - Manual refinement and analysis

---

## Build / test loop (extension + side panel + viewer)

1) Build
- Run your normal build command (example; use your repo’s standard):
  - `pnpm -w build` or `npm run build`
- Confirm build outputs include:
  - `sidepanel.html`
  - `viewer.html`
  in the extension build output

2) Reload extension
- Open `chrome://extensions`
- Enable Developer Mode
- Click **Reload** on the extension

3) Refresh target webpage tab
- Refresh the page where you’ll capture (content script must reload)

4) Open side panel
- Click extension icon (opens side panel if configured)
- Select project → toggle capture → capture elements

5) Viewer smoke test
- From side panel Start Screen click **Open Viewer**
- Confirm viewer loads sessions and captures

### Per-tab capture sync (critical)

**Key behavior:**
- Capture enablement is **per-tab** (does not follow you across tabs)
- Side panel must re-sync when switching tabs to reflect the active tab's state

**Manual verification:**
1. Enable capture in Tab A → confirm hover/capture works
2. Switch to Tab B → side panel reflects Tab B state (toggle likely off)
3. Switch back to Tab A → Tab A state is preserved (toggle still on)

---

## Debugging tips

### Side panel has no sender.tab
- Side panel messages often have no `sender.tab`
- Content script must send `UI/REGISTER_ACTIVE_TAB`
- SW resolves tab id via last registered active tab fallback

### Blob bytes over messaging
- Do not send ArrayBuffers through MV3 messaging for this project
- Use `number[]` (byte array) and reconstruct in UI:
  - `Uint8Array(number[]) → Blob → objectURL`
- Use SW message:
  - `AUDIT/GET_BLOB { blobId }`

### When something “doesn’t update”
- Confirm you reloaded the extension
- Confirm you refreshed the target webpage tab
- Confirm content script logged “loaded” on that page

---

## Collaboration loop (me + ChatGPT + Claude Code)

- ChatGPT plans steps + writes prompts for Claude Code
- Claude Code applies changes in-place and returns a unified diff
- We review diffs before proceeding

Guardrails:
- Smallest possible diffs
- Avoid schema/message additions unless required
- Never edit `dist/**` by hand
- Commit frequently (checkpoint commits)
