# Capture Principles — UI Inventory App

_Last updated: 2026-01-08_

This document distills the capture strategy for UI Inventory, keeping principles that apply to our use case (design consistency audits) and explicitly deferring engineering that doesn't serve the immediate goal.

---

## Core Thesis

> **A capture is an "evidence bundle" + clearly-labeled interpretation.**

Anything that pretends it can perfectly "recreate the UI" across all sites will eventually lose trust. Instead, we:
- Capture what we can observe
- Disclose what we couldn't capture
- Let humans interpret the evidence

---

## Principles We Follow (MVP)

### 1) Separate evidence from inference
- **Evidence:** computed style values, screenshots, element identity, context (URL, viewport, DPR)
- **Inference:** category classification, variant grouping, status assignment, token guesses
- These are stored separately and never conflated.

### 2) Capture context is first-class
Every capture records:
- Viewport dimensions
- Device pixel ratio
- Scroll position
- URL
- Theme hint (light/dark)
- Timestamp
- Interaction state (default/hover/active)

This enables later comparison and explains why two captures might differ.

### 3) State is first-class data
Model capture as `(element, environment, state)`:
- Pseudo-class states: hover, active (via CDP forced pseudo-classes)
- ARIA states: expanded, pressed, checked (captured in `element.intent`)
- Form state: disabled, checked (captured in `element.intent`)

We record state as metadata so consumers know what they're looking at.

### 4) Screenshot is ground truth
The screenshot is the ultimate visual evidence:
- Pixel-aligned (DPR-aware)
- Exact crop rect stored
- Used for thumbnails and visual comparison

When styles and screenshots disagree, the screenshot wins.

### 5) Let the user resolve ambiguity
When element selection is ambiguous (parent vs child, semantic vs exact):
- Offer options in capture UI (capture element, parent, semantic target, child)
- Store what the user explicitly selected
- Don't guess silently

### 6) Disclose constraints honestly
When something can't be captured reliably:
- Cross-origin iframes → can't access styles
- Closed shadow DOM → can't traverse
- Pseudo-elements (::before/::after) → not captured yet

The tool should tell the truth about what it couldn't see.

---

## What We Capture Today (MVP)

### Element identity
- Tag name, role
- ID, class list
- Accessible name (best-effort)
- Text preview
- Form context (name, placeholder) for inputs

### Computed visual evidence
Normalized into `StylePrimitives`:
- Background color (raw + RGBA + HEX8)
- Text color (raw + RGBA + HEX8)
- Border color (per-side, raw + RGBA + HEX8)
- Border width (per-side)
- Padding (per-side)
- Margin (per-side)
- Gap (row/column)
- Border radius (per-corner)
- Typography (font-family, font-size, font-weight, line-height)
- Box shadow (raw + presence + layer count)
- Opacity

### Token provenance (best-effort)
- `sources` object captures CSS variable references from inline styles
- Pattern: `var(--token-name)` → extracted for token reporting

### Screenshot evidence
- Element crop (clipped to bounding box)
- Region selection (user-drawn)
- Viewport screenshot

### Capture context
- URL
- Viewport (width, height)
- Device pixel ratio
- Theme hint
- Scroll position
- Timestamp
- Interaction state label

---

## What We Defer (Not MVP)

These are valid engineering goals but don't serve the immediate use case:

### Multi-locator identity graph
- Storing CSS selector + XPath + attribute signature + DOM fingerprint + geometry
- Useful for: re-finding elements across sessions, automated verification
- **Why deferred:** Design consistency doesn't require re-finding. We compare by visual fingerprint, not by DOM identity.

### Full CSS rule trace
- Origin trace per property (selector + stylesheet URL)
- Matched CSS rules list (like DevTools "Styles" panel)
- **Why deferred:** Nice for debugging, but variant grouping only needs computed values.

### CSS variable resolution chain
- Full var() chain from element to root
- All inherited variables
- **Why deferred:** We capture the token name if present; full chain is overkill for MVP.

### Pseudo-element capture
- `getComputedStyle(el, '::before')` / `::after`
- **Why deferred:** Often used for icons/decorations. Visible in screenshots. Add later if users request.

### Structured failure taxonomy
- `SECURITY_BOUNDARY`, `SHADOW_DOM_CLOSED`, `ASSET_UNAVAILABLE`, etc.
- **Why deferred:** We have `cdpError` string. Structured warnings are Phase C polish.

### Replayability harness
- Store enough data to reopen page, re-select element, verify via screenshot diff
- **Why deferred:** Useful for automation/verification, but not for manual audit workflow.

---

## Decision Record

| Principle | Status | Rationale |
|-----------|--------|-----------|
| Evidence vs inference separation | ✅ Implemented | Core to architecture |
| Capture context | ✅ Implemented | Stored in `conditions` |
| State as first-class | ✅ Implemented | CDP pseudo-classes + `evidence.state` |
| Screenshot as ground truth | ✅ Implemented | DPR-aware cropping |
| User resolves ambiguity | ✅ Implemented | Capture menu with parent/semantic/child |
| Disclose constraints | ⚠️ Partial | `cdpError` exists; structured taxonomy deferred |
| Multi-locator identity | ❌ Deferred | Not needed for consistency use case |
| Full rule trace | ❌ Deferred | Computed values sufficient |
| Pseudo-elements | ❌ Deferred | Visible in screenshots |
| Replayability | ❌ Deferred | Manual workflow doesn't require it |

---

## Future Considerations (Post-MVP)

If we add automation (crawling, CI integration, verification), revisit:
- Multi-locator identity for re-finding
- Replayability harness for verification
- Structured failure taxonomy for trust reporting

These become valuable when the tool runs unattended. For human-in-the-loop audits, they're overhead.

