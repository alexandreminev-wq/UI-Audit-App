# Roadmap — UI Inventory App

_Last updated: 2026-01-08_

This roadmap builds from the current state of the app toward the goal: **agency-grade design consistency reports with drift tracking**.

It uses a phased approach with explicit MVP definition and validation gates between phases.

---

## Current State (Baseline)

### What works well
- ✅ **Capture pipeline**: CDP-backed element capture with forced hover/active states
- ✅ **Evidence model**: Structured `StylePrimitives` with colors, typography, spacing, radius, shadow, border
- ✅ **Screenshot capture**: Element crops, region selection, viewport capture
- ✅ **Authenticated pages**: Works on any site the user can access (runs in their session)
- ✅ **Project/session model**: Projects contain sessions, sessions contain captures
- ✅ **Viewer**: Component and style inventories derived from captures
- ✅ **Annotations**: Notes + tags per component (shared Sidepanel ↔ Viewer)
- ✅ **Identity overrides**: Display name, category, type, status per component
- ✅ **Export**: Figma-oriented ZIP with `inventory.json` + screenshots

### What needs work (bugs / correctness)
- ⚠️ **Border color handling** in `deriveStyleInventory` treats per-side colors as single value
- ⚠️ **Token extraction** returns first token found globally, not per-property

### What's intentionally deferred (not bugs)
- ❌ Automated variant detection / visual fingerprinting
- ❌ Consistency scoring / reports
- ❌ Drift tracking
- ❌ Near-duplicate detection

---

## Phase 0: Foundation Fixes (Pre-MVP)

**Goal:** Fix correctness issues that affect current functionality.

**Status:** Required before shipping MVP.

### 0.1 Fix border color in style inventory
- `deriveStyleInventory` currently pushes `primitives.borderColor.raw` which doesn't exist (per-side format)
- Fix: Extract each side separately or collapse to shorthand when uniform

### 0.2 Property-specific token extraction
- Current `extractToken(sources)` returns first CSS var found, applied to all style records
- Fix: Pass property key to `extractToken` and return token for that specific property (e.g., `sources.backgroundColor` → token for background)

### 0.3 Viewer UI Polish
Viewer must look polished and consistent before shipping MVP.

| Task | Description |
|------|-------------|
| 0.3.1 | **Empty state redesign** — Add icon, heading, subtext, and CTA to empty projects state |
| 0.3.2 | **Header consistency** — Unify header pattern between Projects Home and Project Detail |
| 0.3.3 | **Header redesign** — Simple back arrow, divider line, pill-style tabs, download icon on export |
| 0.3.4 | **Filter active state** — Show selection count, no layout shift (avoid bold text width change) |
| 0.3.5 | **Export consolidation** — Single dropdown with export options (Figma, JSON) |
| 0.3.6 | **Search bar sizing** — Compact width, add search icon inside input |
| 0.3.7 | **Visible properties icon** — Replace text button with icon-only (tooltip on hover) |

**Exit criteria:** Viewer looks polished and consistent across all states (empty, populated, filtered).

**Estimated effort:** 1 week

### 0.4 Connect CDP tokens to Viewer
- `extractToken()` only reads from inline styles (`primitives.sources`)
- CDP extracts tokens from stylesheets and stores them in `capture.styles.tokens.used`
- Fix: Update `extractToken` to check `tokens.used` first, then fall back to inline sources
- This ensures CSS variables from MUI, design systems, and stylesheets appear in the Viewer

### 0.5 Fix CDP extraction (last-declaration-wins)
- CDP's `extractDeclarationValue` returns the **first** CSS declaration for a property
- CSS cascade requires the **last** declaration to win (e.g., `color: inherit; color: var(--token);`)
- Fix: Update `extractDeclarationValue` and `extractValueFromCssProperties` to return the last match
- This affects `authoredValue` in `capture.styles.author.properties` and token detection

### 0.6 Hide default transparent backgrounds
- Visual Essentials shows `#00000000` for all elements with no background set
- This is browser default, not a design decision — creates noise
- Fix: If background is transparent AND no token → show "—"
- If background is transparent AND has token → show "transparent" + token (intentional)

### 0.7 Fix non-inherited property extraction
- CDP scans both `matchedCSSRules` and `inheritedRuleMatches` for ALL properties
- But `background-color`, `border-*`, `padding`, `margin` do NOT inherit
- Bug: Elements show background tokens from ancestor elements (wrong)
- Fix: Only scan matched rules (not inherited) for non-inherited CSS properties

**Exit criteria:** CDP correctly captures the cascade-winning value for all properties. Non-inherited properties only show values from directly matched rules. Visual Essentials only shows meaningful background values.

**Estimated effort:** 0.5 days (total Phase 0: ~3 weeks)

---

## MVP: Manual Assessment Tool (LOCKED)

**Goal:** Enable designers to capture real UI, review components and styles with trustworthy evidence, manually assess consistency, and export a usable inventory.

This is a **human-in-the-loop audit tool**, not an automated consistency engine.

### MVP includes (all ✅ Done except Phase 0 fixes)
1. **Capture** — Guided element capture, multi-state, screenshots, style primitives
2. **Viewer** — Component/style inventories, filters, identity overrides, notes/tags
3. **Visual evidence** — HEX colors, variable provenance, per-side borders, shadow presence
4. **Manual consistency assessment** — Users assess via filters, sections, status, tags, notes
5. **Export** — Figma ZIP, JSON debug export

### MVP explicitly excludes
- Automated variant detection
- Visual fingerprinting
- Consistency scoring
- Drift tracking
- Client-facing reports beyond inventory

### MVP exit criteria
A solo designer can:
1. Create an audit project
2. Capture UI elements across pages
3. Review components and styles in Viewer
4. Annotate and override identity
5. Export to Figma
6. Exit without broken or ambiguous state

---

## Phase A: Variant Detection + Consistency Report

**Theme:** "Help me understand how inconsistent my UI really is."

**Gate:** Only begin after MVP is shipped and users explicitly request variant analysis.

### A.1 Introduce `variantKey` (visual fingerprint)
- Add a bucketed style fingerprint computed from key visual properties:
  - background color (bucketed)
  - text color (bucketed)
  - border (color + width, bucketed)
  - radius (bucketed)
  - padding (bucketed)
  - font-size / font-weight
  - shadow presence
- `variantKey` is distinct from `componentKey`:
  - `componentKey` = "same element across states" (identity)
  - `variantKey` = "same visual treatment" (style fingerprint)
- Derived at runtime, not persisted

### A.2 Variant-centric UI
- Show variant counts per component type (e.g., "Buttons: 14 variants")
- Drill down to see all variants for a type
- Group captures by `variantKey`
- Show variant fingerprint as human-readable summary
- Show representative screenshot per variant
- Show "where used" (URLs / page labels) per variant

### A.3 Near-duplicate detection
- Cluster variants that differ by small deltas (e.g., radius 4px vs 6px)
- Flag as "potential consolidation opportunity"
- Show diff between near-duplicates

### A.4 Consistency Report export
- New export type (separate from Figma):
  - `consistency_report.json`: variant counts, near-duplicates, consolidation opportunities, where-used
  - Respects current Viewer filters (report on filtered subset)
- JSON first; HTML optional later

### A.5 Filter-aware Figma export
- Export only components matching current Viewer filters
- Use case: "Export only buttons" or "Export only elements from checkout pages"

**Exit criteria:** Users say "This helped me understand how inconsistent our UI is."

**Estimated effort:** 3–4 weeks

---

## Phase B: Drift Tracking

**Theme:** "Is our UI getting better or worse over time?"

**Gate:** Only begin after Phase A is validated.

### B.1 Snapshot export
- Export a snapshot file that includes:
  - Project metadata
  - Component inventory (with `componentKey` + `variantKey`)
  - Variant definitions (fingerprints)
  - Usage mapping (variant → pages)
  - Timestamp / version

### B.2 Snapshot import
- Load a previous snapshot
- Compare against current state (viewer-side)

### B.3 Drift analysis
- Detect:
  - New variants introduced
  - Variants removed
  - Style drift within variants
  - Spread changes (usage growth/shrink)

### B.4 Drift report export
- JSON (required)
- HTML (optional, later)
- CSV (optional)

**Exit criteria:** Users can compare runs and identify what changed.

**Estimated effort:** 2–3 weeks

---

## Phase C: Scale & Power Users

**Theme:** "Make it faster for large sites and repeat users."

### C.1 Page labeling / route templating
- Define patterns for dynamic URLs (e.g., `/product/:id` → "Product Page")
- Use labels in reports instead of raw URLs

### C.2 Better tag UX
- Autocomplete for existing tags
- Bulk-apply tags to filtered selection
- Tag management (rename, delete, merge)

### C.3 Saved filters
- Save filter combinations as named views
- Reuse for exports and comparisons

### C.4 Large-site workflows (optional)
- URL list / sitemap import
- Sequential capture with progress/resume

### C.5 Accessibility annotations (optional)
- Focus visibility checks
- Missing accessible names
- Contrast reporting

**Estimated effort:** Ongoing, as validated

---

## Deferred (Do Not Touch Until Demand)

| Feature | Reason |
|---------|--------|
| **Custom component groups** | Tags + filters approximate this. Build only if agencies explicitly need stable named collections. |
| **Cloud sync / hosted** | Local-first is sufficient. Hosted adds auth, storage, sharing complexity. |
| **Team collaboration** | Requires auth + conflict resolution. |
| **Automated crawling** | Reliability + trust risk. Guided capture is acceptable for 5–50 pages. |
| **Design system enforcement** | Requires formal token spec. Future upsell. |
| **Scoring / grades** | Premature abstraction. |

---

## Phase Summary

| Phase | Goal | Gate | Effort |
|-------|------|------|--------|
| **Phase 0** | Fix bugs + polish | — | 2 weeks |
| **MVP** | Manual assessment tool | Phase 0 complete | — (mostly done) |
| **Phase A** | Variant detection + report | MVP shipped, demand validated | 3–4 weeks |
| **Phase B** | Drift tracking | Phase A validated | 2–3 weeks |
| **Phase C** | Scale & polish | Any phase | Ongoing |

---

## Strategic Clarity

### What this tool IS
- A **designer-centric UI audit workspace**
- Evidence-first
- Human judgment over automation
- Local-first

### What this tool is NOT
- A design system enforcer
- A crawler
- A scoring engine
- A CI tool (yet)

---

## Open Questions

1. **Variant fingerprint properties**: Which properties should be included? Proposal: bg, text, border, radius, padding, font-size, font-weight, shadow.

2. **Near-duplicate threshold**: What delta is "near" vs "different"? (e.g., 2px radius? 1 color bucket?)

3. **Report format preference**: Do agencies prefer HTML (viewable) or JSON (processable)? Both?

4. **Drift baseline**: Should snapshots be stored in the project, or always re-imported from file?
