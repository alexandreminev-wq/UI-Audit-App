# Hypothesized Happy Path Flow (Designer-First)

_Last updated: 2026-01-08_

This is a plausible "happy path" workflow optimized for **design consistency** audits, compatible with the current extension + viewer architecture, and mapped to the roadmap phases.

---

## Goal

Enable a designer (or consultant) to:
- **MVP:** Capture real UI, review with evidence, manually assess consistency, export inventory.
- **Phase A:** Produce a variant-aware consistency report.
- **Phase B:** Re-run and detect drift over time.

---

## Happy Path — MVP (Manual Assessment)

### 1) Create a project (audit container)
- User opens the extension side panel.
- User creates/selects a **Project** (e.g., "Client X — Q1 Consistency Audit").
- Extension associates captures to the active project (tab-aware).

### 2) Navigate and capture (exploratory)
- User navigates the product naturally and captures as they go.
- The tool records the **current URL at capture time** as evidence.
- User optionally focuses on specific UI types:
  - buttons, form inputs, typography, surfaces/cards
- User captures relevant states:
  - default + hover + active (and optionally focus/disabled)

### 3) Review & curate in Viewer
- User opens Viewer from side panel.
- Viewer shows:
  - Components inventory (grouped by type/category)
  - Styles inventory (aggregated)
  - Visual essentials in drawers
- User performs manual curation:
  - sets status (Canonical/Variant/Deviation/Legacy/etc.)
  - adds tags and notes
  - resolves naming issues

### 4) Export inventory
- User exports **Figma ZIP** for design workflow.
- User optionally exports **JSON** for debugging or handoff.

### 5) Share + plan
- Designer/consultant shares the export with the product team.
- Team uses it to estimate consolidation scope and prioritize work.

**MVP exit:** User has a curated inventory they can export and share.

---

## Happy Path — Phase A (Variant Detection + Consistency Report)

### 6) View variant analysis
- Viewer shows variant counts per component type (e.g., "Buttons: 14 variants").
- User drills down to see all variants for a type.
- Each variant shows:
  - visual fingerprint (key styles)
  - representative screenshot
  - where used (pages)
- Near-duplicates are flagged as consolidation opportunities.

### 7) Export consistency report
- User exports **Consistency Report** (separate from Figma export):
  - JSON with variant counts, where-used, consolidation opportunities
  - Respects current Viewer filters (report on subset)
- User shares report with client/team as evidence of inconsistency.

### 8) Filter-aware Figma export
- User filters to specific category/type/source.
- User exports **Figma ZIP** with only matching components.
- Use case: "Export only buttons" or "Export only checkout page elements."

**Phase A exit:** User has a client-ready consistency report.

---

## Happy Path — Phase B (Drift Tracking)

### 9) Export baseline snapshot
- Before changes, user exports a **Snapshot** (JSON with variants + usage).
- User saves snapshot file locally.

### 10) Re-run audit
- Weeks later, user repeats capture on the same pages.
- User exports a new snapshot.

### 11) Compare snapshots
- User imports previous snapshot into Viewer.
- Viewer compares current state vs baseline.
- Drift report highlights:
  - new variants introduced
  - variants removed
  - usage spread changes
  - "high-churn" pages introducing one-off styles

### 12) Export drift report
- User exports drift report (JSON / optional HTML).
- Suitable for release notes, regression triage, or client progress updates.

**Phase B exit:** User can track consistency improvement over time.

---

## Handling Dynamic / Unpredictable URLs (Phase C)

For products with dynamic URLs (IDs, slugs, query params):
- Treat the full URL as raw evidence.
- Derive a **page label** or **route template** for reporting (e.g., `/users/:id/settings`).
- Allow users to optionally rename pages ("Dashboard", "Checkout") for client-facing deliverables.

---

## Scaling to Hundreds of Pages (Phase C)

The same happy path scales with:
- URL list import (paste list / sitemap)
- Sequential navigation runner with progress + resume
- Sampling strategy (capture key element types per page)

This is achievable extension-only; an external runner can later reduce babysitting.

