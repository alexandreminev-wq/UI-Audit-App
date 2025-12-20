# MILESTONES

*Last updated: 2025-12-19 (Europe/Madrid)*

This file is the canonical milestone plan for the **UI Inventory App**. Milestones are scoped to keep changes incremental and verifiable, with a bias toward viewer-side analysis over extension-side complexity.

---

## Guiding principles (canon)

- We are building **guided capture + automatic grouping of what you captured**, with an **outliers-first audit workflow**.
- Designers don’t audit to see 500 buttons; they audit to find the **3 that shouldn’t exist**.
- We are **not** claiming complete UI coverage.
- **Service worker is the only IndexedDB accessor.**
- Content script / popup / viewer **use message passing only**.
- **No edits to `dist/**`**.
- Prefer **viewer-side analysis**; only persist capture-time fields that are **evidence**, not dedupe keys.
- Keep diffs **small, incremental, reversible**.
- Schema changes must be **optional** and justified.

---

## Milestone 1 — Storage + pipeline hardening ✅

**Goal:** Reliable capture → storage under MV3 constraints.

**Key validations**
- SW-only IndexedDB CRUD via message passing
- Screenshot capture pipeline stable
- Forward-compatible capture types and tolerant parsing

---

## Milestone 2 — Viewer app + naive clustering/grouping ✅

**Goal:** Move “analysis” out of extension into viewer.

**Scope**
- Sessions list + session detail
- Capture list + basic filters
- Naive grouping
- Side-by-side comparisons
- Export (JSON/CSV)

---

## Milestone 3 — Grouping upgrades + variants + export enhancements ✅

**Goal:** Make the viewer practical for real inventory work.

**Scope**
- Explainable clustering refinement
- Variants concept (families + states/props)
- Export batching/perf + UX improvements

---

## Milestone 4 — Verified Capture UX ✅

**Goal:** Capturing becomes operationally reliable on real sites.

### Slice 4.1 — Metadata pill ✅
- Tag + readable path, anchored + clamped
- Hidden during screenshot, restored correctly

### Slice 4.2 — Pragmatic landmarks ✅
- Capture `scope.nearestLandmarkRole` (banner|navigation|main|contentinfo|complementary|generic)

### Slice 4.3 — Live-value freeze + confirm save ✅
- Hold Shift to freeze target
- Confirm capture flow
- Fixes: double-capture, pill restore timing, overlay not appearing in screenshots

---

## Milestone 5 — Capture Review & Trust ⏳ (NEXT)

**Goal:** Increase user trust and reduce mistakes by adding lightweight review/undo flows around captures.

### Slice 5.1 — Undo last capture (minimal, highest value)
**Goal:** Provide immediate recovery from “oops” captures.
**Scope**
- Viewer shows a small “Recent capture” toast/banner when a new capture appears in the open session
- Actions: **Undo** (delete newest capture for that session) + **Dismiss**
- SW adds a minimal delete handler **only if needed** (prefer existing message paths)
- No schema changes
**Verification**
- Capture → toast appears
- Undo → capture removed from list/groups and stays removed after refresh
- No-capture edge case handled

### Slice 5.2 — Recent captures tray (multi-undo)
**Goal:** Make undo more robust for rapid capture runs.
**Scope**
- Viewer tray listing last ~5 captures with quick delete
- “Undo last N” / “Undo all recent”
**Verification**
- Capture 3+ items → tray shows order correctly → delete one updates state + persists

### Slice 5.3 — Optional restore (session-local, in-memory)
**Goal:** Prevent irreversible mistakes without heavier data model changes.
**Scope**
- Viewer “Recently deleted” in-memory stack + Restore within current viewer session
**Verification**
- Delete → appears in recently deleted → Restore returns capture

---

## Milestone 6 — Semantic Categorization + Audit Mode Funnel ⏳

**Goal:** Move from “technical list” to “designer language + hierarchy of pain.”

### Slice 6.1 — Local classifier + category tabs (viewer-only)
**Goal:** Make captures readable in designer terms.
**Scope**
- Viewer computes `HumanCategory` from existing fields (no schema change):
  - Actions, Inputs, Navigation, Feedback, Media (optional: Layout/Container)
- Session-level tabs/filters: All / Actions / Inputs / Navigation / Feedback
- Category chip/badge on capture cards + group headers
**Verification**
- Chips render across session
- Tabs filter correctly
- Older sessions load unchanged

### Slice 6.2 — Audit Mode toggle (Hierarchy of Pain)
**Goal:** Funnel to the work that matters without rewriting existing views.
**Scope**
- “Audit Mode” toggle inside session detail
- For selected category, show three buckets:
  1) Canonical candidates (most frequent groups)
  2) Pattern drifts (near matches to canonical)
  3) Outliers (“WTF”) (singletons + suspicious signals)
- Clicking an item routes into existing detail view
**Verification**
- Toggle produces stable 3-bucket layout
- Navigation works; no perf cliff on large sessions

### Slice 6.3 — Simple near-match similarity (drift ranking)
**Goal:** Make “Pattern drifts” meaningful with minimal heuristics.
**Scope**
- Similarity scoring based on:
  - normalized accessible name similarity (exact/close)
  - small subset of primitives with tolerances (padding/font/color)
- Used only to rank/stack drift groups under canonicals
**Verification**
- Drift groups appear beneath canonical with highlighted deltas

---

## Milestone 7 — Style Provenance + Token/Compliance Evidence (honest, optional) ⏳

**Goal:** Reliably detect “off-system” everywhere; extract token evidence when available at runtime, without overpromising.

**Principle:** Store/display **evidence + confidence**, not guaranteed token identity.

### Slice 7.1 — Capture minimal style evidence (optional schema; tiny property set)
**Goal:** Enable later viewer audit signals even when the page DOM is gone.
**Scope**
- For a small property set (start minimal):
  - `background-color`, `color`, `border-color`, `padding`, `box-shadow`
- Optional evidence per property:
  - computed value
  - whether the winning declaration used `var(--…)` (when discoverable)
  - var names (if present)
  - hardcoded signals: literal / inline
  - method + confidence: `directVar` (high), `mapByValue` (low), `none`
**Verification**
- Evidence present when detectable; absent otherwise
- No breakage on old sessions (optional field)

### Slice 7.2 — Viewer badges + filters for “off-system”
**Goal:** Surface violations fast.
**Scope**
- Badges: Tokenized / Variable-derived / Hardcoded / Inline / Unknown
- Filters within Audit Mode to show “Hardcoded/Inline” first
**Verification**
- Badges match stored evidence and/or viewer-derived signals

### Slice 7.3 — Rare-value anomaly flags (viewer computed)
**Goal:** Catch the “3 weird ones” with stats-first signals.
**Scope**
- Distributions per category/group (e.g., padding)
- Flag rare values as outliers
**Verification**
- “Most are 16px; these are 14px” style highlights appear

---

## Milestone 8 — Diff-centric workflow (Decision Maker Viewer) ⏳

**Goal:** Canonical vs drift stacking with highlighted deltas and fast triage.

**Scope**
- Choose canonical per group/category
- Stack drift variants under canonical
- Highlight deltas across key primitives
- Export “issue payload” (still no Jira/Linear integration)

---

## Milestone 9 — Lightweight anomaly detection (stats-first) ⏳

**Goal:** Automatic “WTF list” without AI dependency.

**Scope**
- Statistical clustering/outliers per category
- Auto-suggestions (e.g., 90% padding=16px → highlight non-16px)

---

## Milestone 10+ — Reports + integrations (optional expansion) ⏳

**Goal:** Make audit results actionable across tools.

**Scope**
- AI-generated audit summaries (LLM optional)
- One-click ticket creation (Linear/Jira)
- Figma plugin import (organized frames, not dead screenshots)

---

## Milestone 11+ — Headless auditor / crawler mode (separate product mode) ⏳

**Goal:** Automated coverage and background scanning.

**Scope**
- Navigation-following capture
- Background violation flagging
- Treated as separate complexity tier (permissions, stability, safety)

---

## Immediate execution order (recommended)

1) **Milestone 5 — Slice 5.1:** Undo last capture
2) **Milestone 6 — Slice 6.1:** Local classifier + category tabs
3) **Milestone 6 — Slice 6.2:** Audit Mode funnel
4) **Milestone 7 — Slice 7.1:** Minimal style evidence (optional schema, tiny property set)
  