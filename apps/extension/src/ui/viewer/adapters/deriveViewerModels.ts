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
    // 7.4.0: Basic implementation with placeholder counts/labels
    // CONTRACT: VIEWER_DATA_CONTRACT.md §3.2
    return raw.projects.map(project => ({
        id: project.id,                    // Direct mapping (CONTRACT §3.2)
        name: project.name,                // Direct mapping (CONTRACT §3.2)
        captureCount: 0,                   // Placeholder (CONTRACT §3.2 - derived, deferred to 7.4.1)
        updatedAtLabel: "—",               // Placeholder (CONTRACT §3.2 - derived, deferred to 7.4.1)
    }));
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
    _raw: ProjectDetailStorageData
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
    // 7.4.1: Deterministic component grouping (MVP)
    // CONTRACT: VIEWER_DATA_CONTRACT.md §4

    if (captures.length === 0) {
        return [];
    }

    // Group captures by signature
    const groups = new Map<string, CaptureRecordV2[]>();

    for (const capture of captures) {
        const signature = buildComponentSignature(capture);
        const componentId = hashSignature(signature);

        if (!groups.has(componentId)) {
            groups.set(componentId, []);
        }
        groups.get(componentId)!.push(capture);
    }

    // Map groups to ViewerComponent[]
    const components: ViewerComponent[] = [];

    for (const [componentId, groupCaptures] of groups.entries()) {
        const first = groupCaptures[0];
        const element = first.element;

        // Derive name (CONTRACT §4.3)
        const name =
            element.intent?.accessibleName ||
            element.textPreview ||
            `${element.tagName.toLowerCase()}${element.role ? ` (${element.role})` : ""}`;

        // Derive category (CONTRACT §7)
        const category = inferCategory(element);

        // Derive type (CONTRACT §4.3)
        const type = element.role || element.tagName.toLowerCase();

        // Derive source (CONTRACT §4.3)
        const source = inferSource(first.url, first.scope);

        components.push({
            id: componentId,
            name,
            category,
            type,
            status: "Unknown", // CONTRACT §6 - always Unknown in 7.4.x
            source,
            capturesCount: groupCaptures.length,
        });
    }

    // Sort deterministically: capturesCount desc, then name asc (CONTRACT §4.2)
    components.sort((a, b) => {
        if (b.capturesCount !== a.capturesCount) {
            return b.capturesCount - a.capturesCount;
        }
        return a.name.localeCompare(b.name);
    });

    return components;
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
    // 7.4.2: Deterministic style grouping (MVP)
    // CONTRACT: VIEWER_DATA_CONTRACT.md §5

    if (captures.length === 0) {
        return [];
    }

    // Extract style records: { kind, value, token, sources, captureUrl }
    interface StyleRecord {
        kind: string;
        value: string;
        token: string;
        sources: CaptureRecordV2["styles"]["primitives"]["sources"];
        captureUrl: string;
    }

    const styleRecords: StyleRecord[] = [];

    for (const capture of captures) {
        const primitives = capture.styles.primitives;
        const sources = primitives.sources;

        // Colors
        if (primitives.backgroundColor) {
            styleRecords.push({
                kind: "backgroundColor",
                value: primitives.backgroundColor.raw,
                token: extractToken(sources),
                sources,
                captureUrl: capture.url,
            });
        }
        if (primitives.color) {
            styleRecords.push({
                kind: "color",
                value: primitives.color.raw,
                token: extractToken(sources),
                sources,
                captureUrl: capture.url,
            });
        }
        if (primitives.borderColor) {
            styleRecords.push({
                kind: "borderColor",
                value: primitives.borderColor.raw,
                token: extractToken(sources),
                sources,
                captureUrl: capture.url,
            });
        }

        // Spacing
        styleRecords.push({
            kind: "paddingTop",
            value: primitives.spacing.paddingTop,
            token: extractToken(sources),
            sources,
            captureUrl: capture.url,
        });
        styleRecords.push({
            kind: "paddingRight",
            value: primitives.spacing.paddingRight,
            token: extractToken(sources),
            sources,
            captureUrl: capture.url,
        });
        styleRecords.push({
            kind: "paddingBottom",
            value: primitives.spacing.paddingBottom,
            token: extractToken(sources),
            sources,
            captureUrl: capture.url,
        });
        styleRecords.push({
            kind: "paddingLeft",
            value: primitives.spacing.paddingLeft,
            token: extractToken(sources),
            sources,
            captureUrl: capture.url,
        });

        // Typography (optional fields)
        if (primitives.typography) {
            styleRecords.push({
                kind: "fontSize",
                value: primitives.typography.fontSize,
                token: extractToken(sources),
                sources,
                captureUrl: capture.url,
            });
            styleRecords.push({
                kind: "fontWeight",
                value: primitives.typography.fontWeight,
                token: extractToken(sources),
                sources,
                captureUrl: capture.url,
            });
            styleRecords.push({
                kind: "fontFamily",
                value: primitives.typography.fontFamily,
                token: extractToken(sources),
                sources,
                captureUrl: capture.url,
            });
            styleRecords.push({
                kind: "lineHeight",
                value: primitives.typography.lineHeight,
                token: extractToken(sources),
                sources,
                captureUrl: capture.url,
            });
        }

        // Shadow
        styleRecords.push({
            kind: "boxShadow",
            value: primitives.shadow.boxShadowRaw,
            token: extractToken(sources),
            sources,
            captureUrl: capture.url,
        });

        // Border radius (optional)
        if (primitives.radius) {
            styleRecords.push({
                kind: "radiusTopLeft",
                value: primitives.radius.topLeft,
                token: extractToken(sources),
                sources,
                captureUrl: capture.url,
            });
            styleRecords.push({
                kind: "radiusTopRight",
                value: primitives.radius.topRight,
                token: extractToken(sources),
                sources,
                captureUrl: capture.url,
            });
            styleRecords.push({
                kind: "radiusBottomRight",
                value: primitives.radius.bottomRight,
                token: extractToken(sources),
                sources,
                captureUrl: capture.url,
            });
            styleRecords.push({
                kind: "radiusBottomLeft",
                value: primitives.radius.bottomLeft,
                token: extractToken(sources),
                sources,
                captureUrl: capture.url,
            });
        }
    }

    // Group by kind+value
    const groups = new Map<string, StyleRecord[]>();

    for (const record of styleRecords) {
        const groupKey = `${record.kind}|${record.value}`;
        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(record);
    }

    // Map groups to ViewerStyle[]
    const styles: ViewerStyle[] = [];

    for (const [, groupRecords] of groups.entries()) {
        const first = groupRecords[0];
        const kind = inferStyleKind(first.kind as any);
        const source = inferStyleSource(first.sources, first.captureUrl);
        const styleId = generateStyleId(`${first.kind}|${first.token}|${first.value}`);

        styles.push({
            id: styleId,
            token: first.token, // CONTRACT §5.3 - real token or "—"
            value: first.value,
            kind,
            usageCount: groupRecords.length,
            source,
        });
    }

    // Sort deterministically: usageCount desc, then kind asc, then value asc (CONTRACT §5.2)
    styles.sort((a, b) => {
        if (b.usageCount !== a.usageCount) {
            return b.usageCount - a.usageCount;
        }
        if (a.kind !== b.kind) {
            return a.kind.localeCompare(b.kind);
        }
        return a.value.localeCompare(b.value);
    });

    return styles;
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
export function formatRelativeTime(_timestamp: number): string {
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
    // 7.4.1: Fixed taxonomy (CONTRACT §7)
    const tag = element.tagName.toLowerCase();
    const role = element.role?.toLowerCase();

    // Actions
    if (tag === "button" || role === "button") return "Actions";
    if (tag === "a" || role === "link") return "Actions";

    // Forms
    if (tag === "input" || tag === "select" || tag === "textarea") return "Forms";
    if (role === "textbox" || role === "combobox" || role === "checkbox" || role === "radio") return "Forms";

    // Navigation
    if (tag === "nav" || role === "navigation") return "Navigation";

    // Feedback
    if (role === "alert" || role === "status") return "Feedback";

    // Media
    if (tag === "img" || tag === "video" || tag === "svg") return "Media";
    if (role === "img") return "Media";

    // Layout (default fallback)
    return "Layout";
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
    _scope?: CaptureRecordV2["scope"]
): string {
    // 7.4.1: Extract page name from URL (CONTRACT §6.3)
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;

        // Homepage
        if (pathname === "/" || pathname === "") {
            return "Homepage";
        }

        // Extract first path segment
        const segments = pathname.split("/").filter(seg => seg.length > 0);
        if (segments.length === 0) {
            return "Homepage";
        }

        // Capitalize first segment (e.g., /dashboard → Dashboard)
        const firstSegment = segments[0];
        return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
    } catch {
        // Invalid URL, return hostname or Unknown
        return "Unknown";
    }
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
    _group: CaptureRecordV2[]
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
    // 7.4.2: Extract CSS variable token from sources (CONTRACT §5.3)
    if (!sources) {
        return "—";
    }

    // Check all source properties for CSS variable references
    for (const value of Object.values(sources)) {
        if (typeof value === "string") {
            // Match var(--token-name) pattern
            const match = value.match(/var\((--[^)]+)\)/);
            if (match) {
                return match[1]; // Return just the --token-name part
            }
        }
    }

    // No CSS variable found
    return "—";
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
    primitiveKey: string
): ViewerStyle["kind"] {
    // 7.4.2: Map primitive key to style kind (CONTRACT §6.3)
    const key = primitiveKey.toLowerCase();

    // Colors
    if (key === "backgroundcolor" || key === "color" || key === "bordercolor") {
        return "color";
    }

    // Spacing
    if (key.startsWith("padding") || key.startsWith("margin")) {
        return "spacing";
    }

    // Typography
    if (key === "fontsize" || key === "fontweight" || key === "fontfamily" || key === "lineheight") {
        return "typography";
    }

    // Shadow
    if (key === "boxshadow") {
        return "shadow";
    }

    // Border (radius)
    if (key.startsWith("radius")) {
        return "border";
    }

    return "unknown";
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
    // 7.4.2: Infer source from CSS var or URL (CONTRACT §6.3)
    // If sources has CSS var → "Design System"
    if (sources) {
        for (const value of Object.values(sources)) {
            if (typeof value === "string" && value.includes("var(--")) {
                return "Design System";
            }
        }
    }

    // Otherwise → page label from URL
    return inferSource(url);
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
export function generateComponentId(_signature: string): string {
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
    // 7.4.2: Generate stable hash for style ID
    let hash = 5381;
    for (let i = 0; i < tokenOrValue.length; i++) {
        hash = ((hash << 5) + hash) + tokenOrValue.charCodeAt(i); // hash * 33 + c
    }
    return `style_${(hash >>> 0).toString(16)}`;
}

// ─────────────────────────────────────────────────────────────
// Component Signature Helpers (7.4.1)
// ─────────────────────────────────────────────────────────────

/**
 * Build component signature from capture (deterministic)
 *
 * Signature includes (CONTRACT §4.2):
 * - tagName
 * - role (or inferred fallback)
 * - accessibleName
 * - style fingerprint (subset of primitives)
 *
 * @param capture - Capture record
 * @returns Signature string for hashing
 */
function buildComponentSignature(capture: CaptureRecordV2): string {
    const element = capture.element;
    const styles = capture.styles.primitives;

    // Core element identity
    const tagName = element.tagName.toLowerCase();
    const role = element.role || inferRoleFromTag(tagName);
    const accessibleName = element.intent?.accessibleName || element.textPreview || "";

    // Style fingerprint (stable subset)
    const bg = styles.backgroundColor?.raw || "—";
    const border = styles.borderColor?.raw || "—";
    const radius = styles.radius
        ? `${styles.radius.topLeft}|${styles.radius.topRight}|${styles.radius.bottomRight}|${styles.radius.bottomLeft}`
        : "—";
    const padding = `${styles.spacing.paddingTop}|${styles.spacing.paddingRight}|${styles.spacing.paddingBottom}|${styles.spacing.paddingLeft}`;
    const color = styles.color?.raw || "—";

    return `${tagName}|${role}|${accessibleName}|bg:${bg}|bd:${border}|br:${radius}|pd:${padding}|c:${color}`;
}

/**
 * Simple djb2 hash for stable component IDs
 *
 * @param str - Signature string
 * @returns Hash as hex string
 */
function hashSignature(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
    }
    // Convert to unsigned 32-bit and return as hex
    return `comp_${(hash >>> 0).toString(16)}`;
}

/**
 * Infer role from tag name (fallback when role is missing)
 *
 * @param tagName - HTML tag name
 * @returns Inferred role
 */
function inferRoleFromTag(tagName: string): string {
    const tag = tagName.toLowerCase();
    // Basic HTML5 implicit roles
    if (tag === "button") return "button";
    if (tag === "a") return "link";
    if (tag === "input") return "textbox"; // generic fallback
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "img") return "img";
    if (tag === "nav") return "navigation";
    if (tag === "main") return "main";
    if (tag === "header") return "banner";
    if (tag === "footer") return "contentinfo";
    if (tag === "aside") return "complementary";
    if (tag === "form") return "form";
    if (tag === "article") return "article";
    if (tag === "section") return "region";
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") return "heading";
    return "generic"; // fallback
}
