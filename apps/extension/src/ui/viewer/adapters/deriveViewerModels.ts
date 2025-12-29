/**
 * Viewer Model Adapters (Milestone 7.4.x)
 *
 * Transforms IndexedDB storage schema into Viewer-friendly models.
 * See apps/extension/src/ui/viewer/SCHEMA_DELTA.md for full design.
 *
 * This is the **single source of truth** for storage → viewer transformations.
 * No wiring to runtime yet (stubs only).
 */

import type { CaptureRecordV2 } from "../../../types/capture";
import type { ProjectRecord } from "../../../background/capturesDb";
import type {
    ViewerProject,
    ViewerProjectDetail,
    ViewerComponent,
    ViewerStyle,
} from "../types/projectViewerTypes";

// ─────────────────────────────────────────────────────────────
// Storage Input Types (for adapter signatures)
// ─────────────────────────────────────────────────────────────

/**
 * Raw storage data for projects index
 */
export interface ProjectsIndexStorageData {
    projects: ProjectRecord[];
    // Future: pre-computed capture counts per project (performance optimization)
}

/**
 * Raw storage data for a single project detail view
 */
export interface ProjectDetailStorageData {
    projectId: string;
    captures: CaptureRecordV2[]; // All captures across project's linked sessions
}

// ─────────────────────────────────────────────────────────────
// Main Adapter Functions (7.4.x implementation targets)
// ─────────────────────────────────────────────────────────────

/**
 * Derive projects index for landing page (Projects list)
 *
 * TODO (7.4.x): Implement according to SCHEMA_DELTA.md §6.2
 * - For each ProjectRecord:
 *   - Copy id, name
 *   - Compute captureCount via aggregation (or from pre-computed counts)
 *   - Format updatedAt → updatedAtLabel using formatRelativeTime()
 * - Sort by updatedAt desc (most recently updated first)
 *
 * @param raw - Raw storage data (projects + optional counts)
 * @returns Array of ViewerProject for projects landing page
 */
export function deriveProjectsIndexFromStorage(
    raw: ProjectsIndexStorageData
): ViewerProject[] {
    // STUB: Return empty array (no real data yet)
    // In 7.4.x, this will compute captureCount and updatedAtLabel for each project
    return [];
}

/**
 * Derive project detail (components + styles for a specific project)
 *
 * TODO (7.4.x): Implement according to SCHEMA_DELTA.md §6.2
 * - Load all captures for the project (across linked sessions)
 * - Call deriveComponentInventory() to group captures into components
 * - Call deriveStyleInventory() to group styles into style primitives
 *
 * @param raw - Raw storage data (projectId + all captures)
 * @returns ViewerProjectDetail with components and styles
 */
export function deriveProjectDetail(
    raw: ProjectDetailStorageData
): ViewerProjectDetail {
    // STUB: Return empty arrays (no real data yet)
    // In 7.4.x, this will delegate to deriveComponentInventory and deriveStyleInventory
    return {
        components: [],
        styles: [],
    };
}

/**
 * Derive component inventory from captures (grouping + categorization)
 *
 * TODO (7.4.x): Implement according to SCHEMA_DELTA.md §5.2 + §6.2
 * Decision needed: Component grouping strategy
 * - Recommended: Group by normalized accessibleName + tagName + role (loose grouping)
 * - Alternative: Hash style primitives (tight grouping, may fragment too much)
 *
 * Steps:
 * 1. Group captures by signature (accessibleName + tagName + role)
 * 2. For each group:
 *    - id = generateComponentId(signature) // stable hash
 *    - name = element.intent.accessibleName || element.textPreview || `${tagName} (unnamed)`
 *    - category = inferCategory(element) // See SCHEMA_DELTA.md §6.3 helper
 *    - type = element.tagName.toLowerCase()
 *    - status = inferStatus(group) // "Canonical" (most common style) vs "Variant"
 *    - source = inferSource(url, scope) // See SCHEMA_DELTA.md §6.3 helper
 *    - capturesCount = group.length
 * 3. Sort by capturesCount desc (most captured first)
 *
 * @param captures - All captures for the project
 * @returns Array of ViewerComponent (deduplicated and categorized)
 */
export function deriveComponentInventory(
    captures: CaptureRecordV2[]
): ViewerComponent[] {
    // STUB: Return empty array (no grouping logic yet)
    // In 7.4.x, this will implement component grouping algorithm
    return [];
}

/**
 * Derive style inventory from captures (token extraction + clustering)
 *
 * TODO (7.4.x): Implement according to SCHEMA_DELTA.md §5.4 + §6.2
 * Decision needed: Token inference fallback strategy
 * - Recommended: Skip styles without CSS var tokens (conservative approach)
 * - Alternative: Cluster by raw value similarity (more inclusive)
 *
 * Steps:
 * 1. Extract all style primitives from captures.styles.primitives
 * 2. Group by token (from sources) OR raw value (fallback if no token)
 * 3. For each group:
 *    - id = generateStyleId(token || valueHash)
 *    - token = extractToken(sources) // Returns "—" if no CSS var (CONTRACT §5.3)
 *    - value = primitives[key].raw
 *    - kind = inferStyleKind(key) // "color", "spacing", etc. See SCHEMA_DELTA.md §6.3
 *    - usageCount = group.length
 *    - source = inferStyleSource(sources, url)
 * 4. Sort by usageCount desc (most used first)
 *
 * @param captures - All captures for the project
 * @returns Array of ViewerStyle (deduplicated and clustered)
 */
export function deriveStyleInventory(
    captures: CaptureRecordV2[]
): ViewerStyle[] {
    // STUB: Return empty array (no clustering logic yet)
    // In 7.4.x, this will implement style token extraction and grouping
    return [];
}

// ─────────────────────────────────────────────────────────────
// Helper Functions (7.4.x implementation targets)
// ─────────────────────────────────────────────────────────────

/**
 * Format timestamp as relative time label
 *
 * TODO (7.4.x): Implement according to SCHEMA_DELTA.md §6.3
 * Examples: "today", "yesterday", "2 days ago", "about 1 year ago"
 *
 * @param timestamp - Unix timestamp (ms since epoch)
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(timestamp: number): string {
    // STUB: Return placeholder
    return "recently"; // In 7.4.x, compute actual relative time
}

/**
 * Infer category from element metadata
 *
 * TODO (7.4.x): Implement according to SCHEMA_DELTA.md §5.5 + §6.3
 * Decision: Use fixed taxonomy initially
 * - Actions: button, a[href]
 * - Forms: input, select, textarea
 * - Navigation: nav, role="navigation"
 * - Feedback: role="alert", role="status"
 * - Media: img, video, svg
 * - Layout: default fallback
 *
 * Future (M8+): Allow user-defined categories
 *
 * @param element - Element core from capture
 * @returns Category string
 */
export function inferCategory(element: CaptureRecordV2["element"]): string {
    // STUB: Return placeholder
    return "Unknown"; // In 7.4.x, implement category inference rules
}

/**
 * Infer source label from URL and scope
 *
 * TODO (7.4.x): Implement according to SCHEMA_DELTA.md §6.3
 * Strategy: Extract page name from URL pathname
 * - "/" → "Homepage"
 * - "/dashboard" → "Dashboard"
 * - "/product/123" → "Product"
 * - Fallback: hostname
 *
 * Future (M8+): Use scope.nearestLandmarkRole for breadcrumb context
 *
 * @param url - Full URL where captured
 * @param scope - Optional scope context (landmark role)
 * @returns Source label string
 */
export function inferSource(
    url: string,
    scope?: CaptureRecordV2["scope"]
): string {
    // STUB: Return placeholder
    return "Unknown"; // In 7.4.x, implement URL → page label heuristic
}

/**
 * Infer status from component group
 *
 * TODO (7.4.x): Implement according to SCHEMA_DELTA.md §5.3
 * Decision needed: Auto-cluster vs manual marking
 * - Recommended: "Canonical" = most common style in group, "Variant" = deviations
 * - Alternative: First captured = Canonical, rest = Variant
 * - Default: "Unknown" for ungrouped
 *
 * @param group - Array of captures in same component group
 * @returns Status classification
 */
export function inferStatus(
    group: CaptureRecordV2[]
): "Canonical" | "Variant" | "Unknown" {
    // STUB: Return placeholder
    return "Unknown"; // In 7.4.x, implement clustering-based status inference
}

/**
 * Extract CSS variable token from style sources
 *
 * TODO (7.4.x): Implement according to SCHEMA_DELTA.md §6.3
 * Strategy: Find first CSS variable reference in sources
 * - sources.backgroundColor = "var(--color-primary)" → "--color-primary"
 * - sources.spacing = "var(--spacing-md)" → "--spacing-md"
 * - No CSS var → return "—"
 *
 * CONTRACT: VIEWER_DATA_CONTRACT.md §5.3
 * - If no real token reference exists, token MUST be "—"
 * - Do NOT return null, undefined, or empty string
 *
 * @param sources - Style sources object from primitives
 * @returns CSS variable name (without "var()") or "—" if no token
 */
export function extractToken(
    sources?: CaptureRecordV2["styles"]["primitives"]["sources"]
): string {
    // STUB: Return "—" (no extraction yet)
    // CONTRACT: Must return "—" when no token found (VIEWER_DATA_CONTRACT.md §5.3)
    return "—"; // In 7.4.x, implement CSS var extraction, fallback to "—"
}

/**
 * Infer style kind from primitive key
 *
 * TODO (7.4.x): Implement according to SCHEMA_DELTA.md §6.3
 * Mapping:
 * - backgroundColor, color, borderColor → "color"
 * - spacing → "spacing"
 * - typography → "typography"
 * - shadow → "shadow"
 * - radius → "border"
 *
 * @param primitiveKey - Key from StylePrimitives type
 * @returns Style kind classification
 */
export function inferStyleKind(
    primitiveKey: keyof CaptureRecordV2["styles"]["primitives"]
): ViewerStyle["kind"] {
    // STUB: Return placeholder
    return "unknown"; // In 7.4.x, implement primitive key → kind mapping
}

/**
 * Infer style source label from sources and URL
 *
 * TODO (7.4.x): Implement heuristic
 * Strategy:
 * - If sources has CSS var → "Design System" or "Theme"
 * - Otherwise → page label from URL (same as inferSource)
 *
 * @param sources - Style sources object
 * @param url - Full URL where captured
 * @returns Source label string
 */
export function inferStyleSource(
    sources: CaptureRecordV2["styles"]["primitives"]["sources"] | undefined,
    url: string
): string {
    // STUB: Return placeholder
    return "Unknown"; // In 7.4.x, implement source inference
}

/**
 * Generate stable component ID from signature
 *
 * TODO (7.4.x): Implement stable hashing
 * Strategy: Hash(normalized accessibleName + tagName + role)
 * - Use deterministic hash (not random) for stable IDs across runs
 *
 * @param signature - Component grouping signature
 * @returns Stable component ID
 */
export function generateComponentId(signature: string): string {
    // STUB: Return placeholder
    return `component-stub-${Date.now()}`; // In 7.4.x, implement stable hash
}

/**
 * Generate stable style ID from token or value
 *
 * TODO (7.4.x): Implement stable hashing
 * Strategy: Hash(token || valueHash)
 * - Prefer token if available (CSS var name)
 * - Fallback to value hash for non-tokenized styles
 *
 * @param tokenOrValue - Token name or raw value
 * @returns Stable style ID
 */
export function generateStyleId(tokenOrValue: string): string {
    // STUB: Return placeholder
    return `style-stub-${Date.now()}`; // In 7.4.x, implement stable hash
}
