# Use Cases — UI Inventory App

_Last updated: 2026-01-08_

This document summarizes the primary use cases for the UI Inventory App, with **design consistency** as the first-version focus, and secondary applicability to agencies (accessibility/design system consultants).

---

## Core Users

### Designers (in-house product teams)
- Need fast visibility into **what UI exists** today across key pages.
- Need evidence to scope **design system consolidation** work.
- Need a repeatable process to track **drift** as product evolves.

### Agencies / consultants (design systems, accessibility, UX audit)
- Need a client-ready deliverable that inventories UI elements and quantifies inconsistency.
- Need a workflow that works on **any site**, including **authenticated apps**, without access to source code.
- Need exports that support handoff to client teams for technical evaluation.

---

## Primary Use Cases

### 1) Design consistency inventory (snapshot) — MVP + Phase A
- Capture UI across a set of pages (guided, as-you-go).
- Group elements by type (Buttons, Inputs, Typography, Surfaces/Cards, Navigation, etc.).
- **MVP:** Manual assessment via filters, tags, status, notes.
- **Phase A:** Identify and quantify **variants** (visual fingerprinting).
- Produce a report suitable for planning and estimation.

### 2) Variant drift tracking (ongoing) — Phase B
- Run the same audit repeatedly over time (weekly, per release, pre/post redesign).
- Compare "snapshot A" vs "snapshot B" to detect:
  - new variants introduced
  - variants removed
  - usage spread changes (a variant appears on more pages)
  - style changes within an existing variant (fingerprint drift)

### 3) Agency deliverable for scoping + technical evaluation — MVP + Phase A
- **MVP:** Produce an inventory package (Figma ZIP + JSON) with evidence.
- **Phase A:** Produce a consistency report that:
  - communicates scope ("we found 14 primary button variants across 9 pages")
  - prioritizes highest-impact inconsistencies
  - provides evidence (screenshots + style essentials) for engineering review

### 4) Cross-page consistency map — Phase A
- For each variant, show where it appears:
  - per page / URL
  - per area/landmark context (header/nav/main/footer) when available

---

## Secondary / Later Use Cases (Not First Wedge)

### Automated crawling at scale — Phase C (optional)
- Hundreds of pages with minimal babysitting.
- URL list / sitemap import with sequential capture and progress/resume.

### Accessibility-focused reporting — Phase C (optional)
- While not the first-version focus, the same capture inventory can support:
  - focus indicator presence checks
  - accessible-name completeness checks
  - contrast checks (if computed foreground/background can be derived reliably)

