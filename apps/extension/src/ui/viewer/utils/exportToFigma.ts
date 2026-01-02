/**
 * Export to Figma Utility
 * 
 * Generates a ZIP package containing:
 * - inventory.json: Structured spec with components, visual essentials, and metadata
 * - images/*.png: Component screenshots
 * 
 * See docs/FIGMA_EXPORT.md for full specification
 */

import JSZip from 'jszip';
import { buildComponentSignature, hashSignature } from '../../shared/componentKey';
import type { CaptureRecordV2 } from '../../../types/capture';

// ─────────────────────────────────────────────────────────────
// Export Types
// ─────────────────────────────────────────────────────────────

export interface ExportInventory {
    version: string;
    exportedAt: string;
    project: {
        id: string;
        name: string;
    };
    components: ExportComponent[];
}

export interface ExportComponent {
    componentKey: string;
    name: string;
    category: string;
    type: string;
    status: string;
    sources: string[];
    notes: string | null;
    tags: string[];
    states: ExportComponentState[];
}

export interface ExportComponentState {
    state: "default" | "hover" | "active" | "focus" | "disabled" | "open";
    screenshotFilename: string | null;
    visualEssentials: {
        Text?: { label: string; value: string }[];
        Surface?: { label: string; value: string }[];
        Spacing?: { label: string; value: string }[];
    };
    stylePrimitives: Record<string, any>;
    htmlSnippet: string;
}

// ─────────────────────────────────────────────────────────────
// Main Export Function
// ─────────────────────────────────────────────────────────────

/**
 * Export a project to a Figma-importable ZIP package
 * 
 * @param projectId - The project to export
 * @returns Promise that resolves when ZIP is downloaded
 */
export async function exportProject(projectId: string): Promise<void> {
    try {
        // Step 1: Fetch project data from Service Worker
        const projectData = await fetchProjectData(projectId);
        
        if (!projectData) {
            throw new Error("Failed to fetch project data");
        }

        // Step 2: Group captures by componentKey
        const componentGroups = groupCapturesByComponentKey(projectData.captures);

        // Step 3: Fetch annotations for all components
        const annotations = await fetchAnnotations(projectId);

        // Step 4: Build inventory.json structure
        const inventory: ExportInventory = {
            version: "1.0",
            exportedAt: new Date().toISOString(),
            project: {
                id: projectData.project.id,
                name: projectData.project.name,
            },
            components: [],
        };

        // Step 5: Build component specs
        const imagesToFetch: { filename: string; blobId: string }[] = [];

        for (const [componentKey, captures] of componentGroups.entries()) {
            // Sort by state priority
            const sortedCaptures = sortCapturesByState(captures);
            const primaryCapture = sortedCaptures[0];

            // Get annotations for this component
            const componentAnnotations = annotations.get(`${projectId}:${componentKey}`);

            // Build states array
            const states: ExportComponentState[] = [];

            for (const capture of sortedCaptures) {
                const state = (capture.styles?.evidence as any)?.state || "default";
                const screenshotBlobId = capture.screenshot?.screenshotBlobId;
                let screenshotFilename: string | null = null;

                if (screenshotBlobId) {
                    screenshotFilename = `${componentKey}_${state}.png`;
                    imagesToFetch.push({ filename: screenshotFilename, blobId: screenshotBlobId });
                }

                // Build visual essentials
                const visualEssentials = buildVisualEssentials(capture);

                states.push({
                    state: state as any,
                    screenshotFilename,
                    visualEssentials,
                    stylePrimitives: capture.styles?.primitives || {},
                    htmlSnippet: capture.element?.outerHTML || "",
                });
            }

            // Derive component metadata
            const element = primaryCapture.element;
            const name = element.intent?.accessibleName || element.textPreview || 
                `${element.tagName.toLowerCase()}${element.role ? ` (${element.role})` : ""}`;

            // Collect unique sources
            const sources = Array.from(new Set(captures.map(c => c.page?.url || c.url || "Unknown")));

            inventory.components.push({
                componentKey,
                name,
                category: inferCategory(element),
                type: element.role || element.tagName.toLowerCase(),
                status: "Unreviewed",
                sources,
                notes: componentAnnotations?.notes || null,
                tags: componentAnnotations?.tags || [],
                states,
            });
        }

        // Step 6: Sort components by name
        inventory.components.sort((a, b) => a.name.localeCompare(b.name));

        // Step 7: Fetch all screenshot blobs
        const imageData = await fetchBlobBytes(imagesToFetch);

        // Step 8: Generate ZIP
        const zip = new JSZip();

        // Add inventory.json
        zip.file("inventory.json", JSON.stringify(inventory, null, 2));

        // Add images
        const imagesFolder = zip.folder("images");
        if (imagesFolder) {
            for (const [filename, bytes] of imageData.entries()) {
                imagesFolder.file(filename, bytes);
            }
        }

        // Step 9: Generate and download
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `${projectData.project.name.replace(/[^a-z0-9]/gi, '_')}_inventory.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`[Export] Successfully exported ${inventory.components.length} components`);
    } catch (err) {
        console.error("[Export] Failed to export project:", err);
        throw err;
    }
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

interface ProjectData {
    project: { id: string; name: string };
    captures: CaptureRecordV2[];
}

async function fetchProjectData(projectId: string): Promise<ProjectData | null> {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { type: "EXPORT/GET_PROJECT_DATA", projectId },
            (response) => {
                if (response?.ok) {
                    resolve(response.data);
                } else {
                    console.error("[Export] Failed to fetch project data:", response?.error);
                    resolve(null);
                }
            }
        );
    });
}

interface AnnotationsData {
    notes: string;
    tags: string[];
}

async function fetchAnnotations(projectId: string): Promise<Map<string, AnnotationsData>> {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { type: "ANNOTATIONS/GET_PROJECT", projectId },
            (response) => {
                if (response?.ok && Array.isArray(response.annotations)) {
                    const map = new Map<string, AnnotationsData>();
                    for (const ann of response.annotations) {
                        const key = `${ann.projectId}:${ann.componentKey}`;
                        map.set(key, {
                            notes: ann.notes || "",
                            tags: ann.tags || [],
                        });
                    }
                    resolve(map);
                } else {
                    resolve(new Map());
                }
            }
        );
    });
}

function groupCapturesByComponentKey(captures: CaptureRecordV2[]): Map<string, CaptureRecordV2[]> {
    const groups = new Map<string, CaptureRecordV2[]>();

    for (const capture of captures) {
        const signature = buildComponentSignature(capture);
        const componentKey = hashSignature(signature);

        if (!groups.has(componentKey)) {
            groups.set(componentKey, []);
        }
        groups.get(componentKey)!.push(capture);
    }

    return groups;
}

function sortCapturesByState(captures: CaptureRecordV2[]): CaptureRecordV2[] {
    const stateOrder = ["default", "hover", "active", "focus", "disabled", "open"];
    return [...captures].sort((a, b) => {
        const aState = (a.styles?.evidence as any)?.state || "default";
        const bState = (b.styles?.evidence as any)?.state || "default";
        return stateOrder.indexOf(aState) - stateOrder.indexOf(bState);
    });
}

function buildVisualEssentials(capture: CaptureRecordV2): ExportComponentState["visualEssentials"] {
    const primitives = capture.styles?.primitives;
    if (!primitives) return {};

    const result: ExportComponentState["visualEssentials"] = {};

    // Text section
    const text: { label: string; value: string }[] = [];
    if (primitives.color?.hex8) {
        text.push({ label: "Text color", value: primitives.color.hex8 });
    }
    if (primitives.typography?.fontFamily) {
        text.push({ label: "Font family", value: primitives.typography.fontFamily });
    }
    if (primitives.typography?.fontSize) {
        text.push({ label: "Font size", value: primitives.typography.fontSize });
    }
    if (primitives.typography?.fontWeight) {
        text.push({ label: "Font weight", value: String(primitives.typography.fontWeight) });
    }
    if (primitives.typography?.lineHeight) {
        text.push({ label: "Line height", value: primitives.typography.lineHeight });
    }
    if (text.length > 0) result.Text = text;

    // Surface section
    const surface: { label: string; value: string }[] = [];
    if (primitives.backgroundColor?.hex8) {
        surface.push({ label: "Background", value: primitives.backgroundColor.hex8 });
    }
    const hasBorder = primitives.borderWidth && Object.values(primitives.borderWidth).some((w: any) => parseFloat(String(w)) > 0);
    if (hasBorder && primitives.borderColor?.hex8) {
        surface.push({ label: "Border color", value: primitives.borderColor.hex8 });
    }
    if (hasBorder && primitives.borderWidth) {
        const b = primitives.borderWidth;
        surface.push({ label: "Border width", value: `${b.top} / ${b.right} / ${b.bottom} / ${b.left}` });
    }
    if (primitives.radius) {
        const r = primitives.radius;
        surface.push({ label: "Radius", value: `${r.topLeft} / ${r.topRight} / ${r.bottomRight} / ${r.bottomLeft}` });
    }
    if (primitives.shadow?.boxShadowRaw) {
        surface.push({ label: "Shadow", value: primitives.shadow.boxShadowRaw });
    }
    if (surface.length > 0) result.Surface = surface;

    // Spacing section
    const spacing: { label: string; value: string }[] = [];
    if (primitives.spacing) {
        const p = primitives.spacing;
        spacing.push({ label: "Padding", value: `${p.paddingTop} / ${p.paddingRight} / ${p.paddingBottom} / ${p.paddingLeft}` });
    }
    if (primitives.margin) {
        const m = primitives.margin;
        spacing.push({ label: "Margin", value: `${m.marginTop} / ${m.marginRight} / ${m.marginBottom} / ${m.marginLeft}` });
    }
    if (primitives.gap) {
        spacing.push({ label: "Gap", value: `${primitives.gap.rowGap} / ${primitives.gap.columnGap}` });
    }
    if (spacing.length > 0) result.Spacing = spacing;

    return result;
}

function inferCategory(element: any): string {
    const role = element.role?.toLowerCase() || "";
    const tag = element.tagName?.toLowerCase() || "";

    if (role === "button" || tag === "button") return "Actions";
    if (role === "link" || tag === "a") return "Actions";
    if (role === "textbox" || role === "searchbox" || tag === "input" || tag === "textarea") return "Forms";
    if (role === "navigation" || tag === "nav") return "Navigation";
    if (role === "img" || tag === "img") return "Media";
    if (role === "heading" || /^h[1-6]$/.test(tag)) return "Content";
    
    return "Unknown";
}

async function fetchBlobBytes(images: { filename: string; blobId: string }[]): Promise<Map<string, Uint8Array>> {
    const result = new Map<string, Uint8Array>();

    // Batch fetch (10 at a time for performance)
    const batchSize = 10;
    for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        const promises = batch.map(async ({ filename, blobId }) => {
            try {
                const bytes = await fetchSingleBlobBytes(blobId);
                if (bytes) {
                    result.set(filename, bytes);
                }
            } catch (err) {
                console.warn(`[Export] Failed to fetch blob ${blobId}:`, err);
            }
        });
        await Promise.all(promises);
    }

    return result;
}

async function fetchSingleBlobBytes(blobId: string): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { type: "EXPORT/GET_BLOB_BYTES", blobId },
            async (response) => {
                if (response?.ok && response.bytes) {
                    // Response.bytes is a plain array from Service Worker
                    const uint8 = new Uint8Array(response.bytes);
                    
                    // Check if we need to convert from WebP to PNG for Figma compatibility
                    const mimeType = response.mimeType || '';
                    if (mimeType === 'image/webp') {
                        try {
                            const pngBytes = await convertWebPToPNG(uint8);
                            resolve(pngBytes);
                        } catch (err) {
                            console.error(`[Export] Failed to convert WebP to PNG for ${blobId}:`, err);
                            resolve(null);
                        }
                    } else {
                        // Already PNG or JPEG
                        resolve(uint8);
                    }
                } else {
                    console.error(`[Export] Failed to fetch blob bytes for ${blobId}:`, response?.error);
                    resolve(null);
                }
            }
        );
    });
}

/**
 * Convert WebP image bytes to PNG using Canvas API
 */
async function convertWebPToPNG(webpBytes: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        // Create blob from bytes
        const blob = new Blob([webpBytes], { type: 'image/webp' });
        const url = URL.createObjectURL(blob);
        
        // Load image
        const img = new Image();
        img.onload = () => {
            try {
                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw image to canvas
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                
                // Convert to PNG blob
                canvas.toBlob((pngBlob) => {
                    if (!pngBlob) {
                        reject(new Error('Failed to convert to PNG blob'));
                        return;
                    }
                    
                    // Convert blob to Uint8Array
                    pngBlob.arrayBuffer().then(arrayBuffer => {
                        resolve(new Uint8Array(arrayBuffer));
                        URL.revokeObjectURL(url);
                    }).catch(reject);
                }, 'image/png');
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load WebP image'));
        };
        img.src = url;
    });
}

