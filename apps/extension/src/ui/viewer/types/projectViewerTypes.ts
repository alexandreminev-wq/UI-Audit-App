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
    name: string;                  // Inferred from element.intent.accessibleName or textPreview (NO state suffix)
    category: string;              // Inferred from element role/tagName
    type: string;                  // From element.tagName (lowercase)
    status: "Unreviewed" | "Canonical" | "Variant" | "Deviation" | "Legacy" | "Experimental";
    source: string;                // Inferred from url or scope
    capturesCount: number;         // Count of captures in this component group
    notes?: string | null;         // 7.6.3: aligns with Sidepanel comments field (future)
    tags?: string[];               // 7.6.4: aligns with Sidepanel tags field (future)
    thumbnailBlobId?: string;      // Representative screenshot blob (for cards)

    // Multi-state support
    availableStates?: Array<{
        state: "default" | "hover" | "active" | "focus" | "disabled" | "open";
        captureId: string;
        screenshotBlobId?: string;
    }>;
    selectedState?: "default" | "hover" | "active" | "focus" | "disabled" | "open";

    // Component-scoped identity overrides (persisted separately from captures)
    overrides?: {
        displayName: string | null;
        categoryOverride: string | null;
        typeOverride: string | null;
        statusOverride: string | null;
    };
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

// ─────────────────────────────────────────────────────────────
// Milestone 7.4.3: Drawer-focused view models
// ─────────────────────────────────────────────────────────────

/**
 * Component capture item (for drawer)
 * Minimal metadata about a capture that belongs to a component
 */
export interface ViewerComponentCapture {
    id: string;                    // Capture id
    url: string;                   // Full URL or "—"
    sourceLabel: string;           // Derived page label
    timestampLabel: string;        // Placeholder "—" for now
    screenshotBlobId?: string;     // Optional screenshot blob reference (7.5.2)
    htmlStructure?: string;        // Optional HTML structure snippet (7.6.2)
}

/**
 * Style location item (for drawer "Where it appears")
 * Shows where a style appears, grouped by source
 */
export interface ViewerStyleLocation {
    id: string;                    // Stable identifier
    sourceLabel: string;           // Page label
    url: string;                   // Full URL or "—"
    uses: number;                  // Occurrences on that page/source
    screenshotBlobId?: string;     // Optional screenshot from representative capture (7.5.2)
}

/**
 * Style related component (for drawer)
 * Minimal component info for styles drawer
 */
export interface ViewerStyleRelatedComponent {
    componentId: string;           // Component id
    name: string;                  // Component name
    category: string;              // Component category
    type: string;                  // Component type
}

// ─────────────────────────────────────────────────────────────
// Milestone 7.4.4: Visual Essentials (derived from capture primitives)
// ─────────────────────────────────────────────────────────────

/**
 * Visual Essentials row (read-only property display)
 */
export interface ViewerVisualEssentialsRow {
    section: "Text" | "Surface" | "Spacing" | "State";
    label: string;
    value: string;
    hex8?: string | null; // Optional hex8 value for colors
}

/**
 * Visual Essentials table (derived from a representative capture)
 */
export interface ViewerVisualEssentials {
    rows: ViewerVisualEssentialsRow[];
    derivedFromCaptureId: string | null;
}
