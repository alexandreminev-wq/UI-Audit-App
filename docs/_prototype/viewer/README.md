# Viewer Prototype Source (Reference Only)

This directory contains the original standalone Viewer prototype source code from the `ui-audit-hub-main` project.

## ⚠️ IMPORTANT: Reference-Only Artifact

**DO NOT:**
- Import files from this directory into production code
- Modify files in this directory
- Use this as a dependency in the extension build
- Copy code directly without adaptation

**DO:**
- Refer to this code for implementation patterns
- Compare IA decisions with production implementation
- Use as a reference during Viewer development
- Consult for UX behavior and interaction patterns

## Purpose

This prototype was developed to establish the Viewer's information architecture (IA) and user experience before integrating it into the Chrome Extension. The production Viewer (`/apps/extension/src/ui/viewer/`) is being built based on this prototype but adapted for:

- Chrome Extension MV3 architecture
- IndexedDB-backed data model
- Integration with the capture pipeline
- Shared theme system (HSL tuples)
- Runtime grouping/classification logic

## Structure

The prototype is a standalone Vite + React + TypeScript application with:
- Mock data generators
- shadcn/ui component library
- Tailwind CSS styling
- Prototype-specific state management

The production implementation uses different data sources, messaging patterns, and theme tokens.

## Milestone Context

This prototype informed **Milestone 7.2 (Viewer IA)** implementation decisions, including:
- Projects landing layout
- Project workspace structure
- Tabs (Components/Styles)
- View toggles (Grid/Table)
- Filter toolbar
- Selection model
- Detail drawer
- Property visibility controls

---

**Last Updated:** 2025-12-28
**Source:** `/Users/alexminev/projects/ui-audit-hub-main/`
**Production Viewer:** `/apps/extension/src/ui/viewer/viewer.tsx`
