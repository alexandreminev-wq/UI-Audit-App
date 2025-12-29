// ─────────────────────────────────────────────────────────────
// Project Viewer Types
// ─────────────────────────────────────────────────────────────

// Milestone 7.2.1: Viewer IA routing
export type ViewerRoute = "projects" | "project";

// ─────────────────────────────────────────────────────────────
// Milestone 7.4.x: Viewer data models (derived from storage)
// ─────────────────────────────────────────────────────────────

/**
 * Project in projects index (landing page)
 * Derived from ProjectRecord + aggregated capture counts
 */
export interface ViewerProject {
    id: string;                    // From ProjectRecord.id
    name: string;                  // From ProjectRecord.name
    captureCount: number;          // Derived: count all captures across linked sessions
    updatedAtLabel: string;        // Derived: format ProjectRecord.updatedAt as relative time
}

/**
 * Component in project detail view
 * Derived from grouped CaptureRecordV2 instances
 */
export interface ViewerComponent {
    id: string;                    // Grouping key (to be defined in adapter)
    name: string;                  // Inferred from element.intent.accessibleName or textPreview
    category: string;              // Inferred from element role/tagName
    type: string;                  // From element.tagName (lowercase)
    status: "Canonical" | "Variant" | "Unknown"; // Inferred from clustering
    source: string;                // Inferred from url or scope
    capturesCount: number;         // Count of captures in this component group
}

/**
 * Style primitive in project detail view
 * Derived from grouped style primitives across captures
 */
export interface ViewerStyle {
    id: string;                    // Grouping key (token or value hash)
    token: string;                 // Extracted from sources (CSS var name) or empty
    value: string;                 // From primitives[key].raw
    kind: "color" | "spacing" | "typography" | "shadow" | "border" | "unknown";
    usageCount: number;            // Count of captures using this style
    source: string;                // Inferred from sources context or url
}

/**
 * Project detail (components + styles for a specific project)
 */
export interface ViewerProjectDetail {
    components: ViewerComponent[];
    styles: ViewerStyle[];
}

// Legacy type alias for backward compatibility (to be removed in 7.4.x)
export type Project = ViewerProject;
