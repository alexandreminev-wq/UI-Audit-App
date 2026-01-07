/**
 * Shared component signature and hash logic (7.8)
 *
 * CRITICAL: This file must remain byte-for-byte identical to Viewer's logic.
 * Both Viewer and Sidepanel use this to derive deterministic componentKey
 * for annotation scoping.
 *
 * Extracted from: apps/extension/src/ui/viewer/adapters/deriveViewerModels.ts
 */

import type { CaptureRecordV2 } from "../../types/capture";

/**
 * Build component signature from capture (deterministic)
 *
 * Signature includes (VIEWER_DATA_CONTRACT.md §4.2):
 * - tagName
 * - role (or inferred fallback)
 * - accessibleName
 * - style fingerprint (subset of primitives)
 *
 * @param capture - Capture record
 * @returns Signature string for hashing
 */
export function buildComponentSignature(capture: CaptureRecordV2): string {
    const element = capture.element;

    // Core element identity (structural only - state-invariant)
    // Excludes style primitives since they vary between states (default/hover/active/etc.)
    const tagName = element.tagName.toLowerCase();

    // Region/viewport screenshot captures should never be grouped; treat each capture as unique.
    if (tagName === "region") {
        return `region|${capture.id}`;
    }

    const role = element.role || inferRoleFromTag(tagName);
    const accessibleName = element.intent?.accessibleName || element.textPreview || "";

    // For form elements (inputs, textareas, selects), include additional context
    // to differentiate between multiple similar inputs
    let formContext = "";
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
        // Use element ID if available (most specific)
        const elementId = element.id || "";
        // Use name attribute if available (common for form inputs)
        const elementName = element.attributes?.name || "";
        // Use placeholder as fallback context
        const placeholder = element.attributes?.placeholder || "";
        
        // Combine available context (prioritize id > name > placeholder)
        formContext = elementId || elementName || placeholder || "";
    }

    // Use structural identity only for grouping states of the same component
    // Visual variants (e.g., primary vs secondary button) are distinguished by accessibleName or role
    // Form elements also include formContext to differentiate similar inputs
    return formContext 
        ? `${tagName}|${role}|${accessibleName}|${formContext}`
        : `${tagName}|${role}|${accessibleName}`;
}

/**
 * Simple djb2 hash for stable component IDs
 *
 * @param str - Signature string
 * @returns Hash as hex string (e.g., "comp_a1b2c3d4")
 */
export function hashSignature(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
    }
    // Convert to unsigned 32-bit and return as hex
    return `comp_${(hash >>> 0).toString(16)}`;
}

/**
 * Derive componentKey from capture (one-shot helper)
 *
 * @param capture - Capture record
 * @returns Component key (e.g., "comp_a1b2c3d4")
 */
export function deriveComponentKey(capture: CaptureRecordV2): string {
    const signature = buildComponentSignature(capture);
    return hashSignature(signature);
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
