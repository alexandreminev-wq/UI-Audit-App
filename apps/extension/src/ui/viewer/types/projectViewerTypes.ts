// ─────────────────────────────────────────────────────────────
// Project Viewer Types
// ─────────────────────────────────────────────────────────────

// Milestone 7.2.1: Viewer IA routing
export type ViewerRoute = "projects" | "project";
export type Project = { id: string; name: string; captureCount?: number; updatedAtLabel?: string }; // TEMP: UI-only mock
