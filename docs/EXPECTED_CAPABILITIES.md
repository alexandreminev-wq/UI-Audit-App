# Expected Capabilities — UI Inventory App

_Last updated: 2026-01-08_

This document describes the expected capabilities, assuming a **local-first** product that works on **any site** (including authenticated pages), with a future path toward hosted reporting.

Capabilities are mapped to the roadmap phases (Phase 0, MVP, A, B, C).

---

## 1) Capture (Evidence Collection) — MVP

### Must-have (MVP)
- Capture UI evidence from **any webpage** the user can access, including authenticated flows.
- Capture should record:
  - element identity anchors (tag, role, best-effort accessible name/text)
  - capture context (URL, viewport, DPR, theme hint)
  - computed visual evidence (colors, typography, spacing, radius, shadow, border)
  - screenshot evidence (element crop / region / viewport)
- Support capturing multiple **interaction states** for relevant controls:
  - default, hover, active (focus/disabled/open as feasible)

### "Capture as you go" (designer-first) — MVP
- Users can start capturing immediately while navigating naturally.
- URLs are **recorded evidence**, not a required pre-defined scope.

### Nice-to-have (MVP polish)
- Region/viewport screenshots for "layout evidence" (not component grouping).
- Landmark/context labeling (header/nav/main/footer) for "where used" reporting.

---

## 2) Inventory & Grouping

### Element type grouping — MVP
- Group captured items into designer-facing buckets:
  - Buttons/Actions
  - Form controls
  - Typography/text
  - Surfaces (cards/panels/modals)
  - Navigation
  - Media

### Variant grouping (design consistency core) — Phase A
- Produce "variants" based on a stable **visual fingerprint** (style subset).
- Support:
  - exact-match variants (same fingerprint)
  - near-duplicate detection (small deltas; e.g., radius differs by 2px)
- Output the core numbers:
  - total instances per type
  - number of variants per type
  - pages per variant ("where used")

---

## 3) Reporting Outputs

### Inventory export — MVP
- Figma export (ZIP with `inventory.json` + screenshots)
- JSON debug export

### Client-ready consistency report — Phase A
- Executive summary:
  - which types are most inconsistent (highest variants/type ratio)
  - biggest consolidation opportunities (near-duplicate clusters)
- Variant tables:
  - variant fingerprint (key style properties)
  - example screenshot(s)
  - where used (URLs / page labels)

### Filter-aware exports — Phase A
- Figma export respects current Viewer filters
- Consistency report respects current Viewer filters

### Machine-readable snapshot (for drift) — Phase B
- Export a "snapshot" (JSON/ZIP) that contains:
  - components/variants (stable IDs)
  - style fingerprints
  - usage mapping (variant → pages)
  - evidence pointers (screenshots by blob id or embedded files)

---

## 4) Drift Tracking (Run-to-Run Comparison) — Phase B

### Snapshot diff
- Compare two snapshots to detect:
  - new variants introduced
  - variants removed
  - variant fingerprint changes (same cluster drifting)
  - page spread changes (variant appears on more/fewer pages)
- Provide a drift report suitable for release notes / regression triage.

---

## 5) Scale Expectations

### 5–20 pages — MVP
- Guided workflow is acceptable (designer-driven capture).
- Fast feedback in Viewer; export should complete quickly.

### Hundreds of pages — Phase C
- Requires:
  - Optional URL list import (paste list and/or sitemap ingestion)
  - a reliable run mechanism (sequential navigation, batching, progress, resume)
  - resilience to SPAs, lazy loading, and timing variability

### Dynamic URL handling (for stable reporting) — Phase C
- Many apps have unpredictable/dynamic URLs (IDs, slugs, query params).
- Reporting should support a derived, stable "page label", such as:
  - route templates (e.g., `/projects/:id/settings`)
  - user-defined names ("Checkout", "Billing")

---

## 6) Local-First Now, Hosted Later

### Local-first requirements — MVP
- All capture evidence stored locally (IndexedDB).
- Export is the primary mechanism for sharing deliverables.

### Hosted future (optional) — Deferred
- Upload snapshots/reports for collaboration.
- Auth/session handling remains easiest locally for "any site"; hosted can focus on:
  - aggregation, dashboards, diff history
  - cross-run analytics

