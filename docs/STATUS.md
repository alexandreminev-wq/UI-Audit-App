# STATUS

_Last updated: 2025-12-22 (Europe/Madrid)_

This document tracks current focus, recently completed work, key decisions, and known issues.

---

## Current focus

- **Milestone 7** (next): Viewer-side project management layered on top of existing sessions architecture

---

## Recently completed

- ✅ **Milestone 1 v2.2** (Extension capture pipeline + evidence + storage)
- ✅ **Milestone 2 v2.2** (Viewer gallery + naive clustering + compare/export + polish)
- ✅ **Milestone 3** (Explainable clustering + variant detection)
- ✅ **Milestone 4** (Verified capture UX: metadata pill, landmarks, freeze + confirm)
- ✅ **Milestone 5** (Trust loop: viewer refresh, undo last capture, non-fatal toast)
- ✅ **Milestone 6** (Designer categories: viewer-side classification into Action/Input/Navigation/Content/Media/Container/Other)

See `docs/MILESTONES.md` for detailed acceptance criteria and implementation notes.

---

## Key architecture decisions

- **Service worker owns IndexedDB**: All reads/writes go through the service worker; popup/viewer/content use message passing only
- **Viewer-side analysis**: Grouping, variants, signatures computed on demand; not persisted back to DB
- **Sessions are internal**: Session = one capture run (internal abstraction); user-facing concepts (e.g., projects) layer on top
- **Screenshot storage**: Images stored as blobs (separate from captures); allows re-encoding without rewriting capture records
- **No simulated pseudo-states**: Avoid false evidence by not forcing `:hover`/`:active` states during capture

---

## Known issues / deferred

- **Browser zoom detection**: Best-effort only; often returns `null` (acceptable per canon)
- **Large sessions**: Viewer remains usable for 200–500 captures; virtualization deferred unless needed
- **Dark mode**: Not implemented (low priority)
- **Deep linking**: Not required for current use cases
