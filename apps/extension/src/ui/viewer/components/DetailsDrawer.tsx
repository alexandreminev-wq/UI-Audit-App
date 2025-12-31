import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import type {
    ViewerComponentCapture,
    ViewerStyleLocation,
    ViewerStyleRelatedComponent,
    ViewerVisualEssentials,
} from "../types/projectViewerTypes";
import { useBlobUrl } from "../hooks/useBlobUrl";

// ─────────────────────────────────────────────────────────────
// DEV-only logging helpers (7.4.5)
// ─────────────────────────────────────────────────────────────

const isDev = import.meta?.env?.DEV ?? false;
const devWarn = (...args: unknown[]) => { if (isDev) console.warn(...args); };

// ─────────────────────────────────────────────────────────────
// Thumbnail Component (7.5.2)
// ─────────────────────────────────────────────────────────────

function CaptureThumbnail({ blobId }: { blobId?: string }) {
    const { url } = useBlobUrl(blobId);

    return (
        <div
            style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: "calc(var(--radius) - 2px)",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--muted))",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {url ? (
                <img
                    src={url}
                    alt="Capture screenshot"
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    }}
                />
            ) : (
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        background: "hsl(var(--muted))",
                    }}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ComponentDetails {
    id: string;
    name: string;
    category: string;
    type: string;
    status: string;
    source: string;
    capturesCount: number;
    notes?: string | null; // 7.6.3: aligns with Sidepanel comments field (future)
    tags?: string[];       // 7.6.4: aligns with Sidepanel tags field (future)
}

export interface StyleDetails {
    id: string;
    token: string;
    value: string;
    kind: string;
    source: string;
    usageCount: number;
}

interface DetailsDrawerProps {
    projectId: string; // 7.7.2: Required for saving annotations
    open: boolean;
    onClose: () => void;
    selectedComponent: ComponentDetails | null;
    selectedStyle: StyleDetails | null;
    // 7.4.3: Real drawer content
    componentCaptures: ViewerComponentCapture[];
    styleLocations: ViewerStyleLocation[];
    relatedComponents: ViewerStyleRelatedComponent[];
    // 7.4.4: Visual essentials
    visualEssentials: ViewerVisualEssentials;
    // 7.7.2: Callback after annotation save
    onAnnotationsChanged: () => void;
    // Callback after delete to trigger refresh
    onDeleted: () => void;
}

// ─────────────────────────────────────────────────────────────
// DetailsDrawer Component
// ─────────────────────────────────────────────────────────────

export function DetailsDrawer({
    projectId,
    open,
    onClose,
    selectedComponent,
    selectedStyle,
    componentCaptures,
    styleLocations,
    relatedComponents,
    visualEssentials,
    onAnnotationsChanged,
    onDeleted,
}: DetailsDrawerProps) {
    // Reusable drawer section title style
    const drawerSectionTitleStyle = {
        fontSize: 14,
        fontWeight: 600,
        marginTop: 0,
        marginBottom: 8,
        color: "hsl(var(--foreground))",
    } as const;

    // 7.7.2: Editable annotations state
    const [draftNotes, setDraftNotes] = useState<string>("");
    const [draftTags, setDraftTags] = useState<string[]>([]);
    const [newTagInput, setNewTagInput] = useState<string>("");
    const [isSaving, setIsSaving] = useState<boolean>(false);

    // 7.7.2: Initialize draft state when selectedComponent changes
    useEffect(() => {
        if (selectedComponent) {
            setDraftNotes(selectedComponent.notes || "");
            setDraftTags(selectedComponent.tags || []);
            setNewTagInput("");
        } else {
            setDraftNotes("");
            setDraftTags([]);
            setNewTagInput("");
        }
    }, [selectedComponent?.id]); // Only re-init when component ID changes

    // 7.7.2: Dirty tracking
    const isDirty = selectedComponent
        ? (draftNotes.trim() !== (selectedComponent.notes || "").trim() ||
           JSON.stringify(draftTags.sort()) !== JSON.stringify((selectedComponent.tags || []).sort()))
        : false;

    // 7.7.2: Save annotations
    const handleSave = async () => {
        if (!selectedComponent || !isDirty) return;

        setIsSaving(true);
        try {
            const response = await chrome.runtime.sendMessage({
                type: "ANNOTATIONS/UPSERT",
                projectId,
                componentKey: selectedComponent.id,
                notes: draftNotes.trim() === "" ? null : draftNotes.trim(),
                tags: draftTags,
            });

            if (response && response.ok) {
                // Success - trigger parent refresh for immediate UI update
                console.log("[DetailsDrawer] Saved annotations successfully");
                onAnnotationsChanged();
            } else {
                console.error("[DetailsDrawer] Failed to save annotations:", response?.error);
            }
        } catch (err) {
            console.error("[DetailsDrawer] Error saving annotations:", err);
        } finally {
            setIsSaving(false);
        }
    };

    // 7.7.2: Cancel edits
    const handleCancel = () => {
        if (!selectedComponent) return;
        setDraftNotes(selectedComponent.notes || "");
        setDraftTags(selectedComponent.tags || []);
        setNewTagInput("");
    };

    // 7.7.2: Add tag
    const handleAddTag = () => {
        const trimmed = newTagInput.trim();
        if (trimmed !== "" && !draftTags.includes(trimmed)) {
            setDraftTags([...draftTags, trimmed]);
        }
        setNewTagInput("");
    };

    // 7.7.2: Remove tag
    const handleRemoveTag = (tagToRemove: string) => {
        setDraftTags(draftTags.filter(tag => tag !== tagToRemove));
    };

    // 7.5.2: Compute representative capture and screenshot URL at TOP LEVEL (fixes Rules of Hooks)
    const representativeCapture = componentCaptures?.[0];
    const screenshotBlobId = representativeCapture?.screenshotBlobId;
    const { url: screenshotUrl } = useBlobUrl(screenshotBlobId);

    // Delete capture (matches Sidepanel delete behavior)
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const handleDelete = async () => {
        if (!selectedComponent || !representativeCapture) {
            devWarn("[DetailsDrawer] Cannot delete: no component or representative capture");
            return;
        }

        // Confirmation dialog
        const confirmed = window.confirm(
            `Delete this component?\n\nThis will remove the selected capture from the inventory. This action cannot be undone.`
        );

        if (!confirmed) return;

        setIsDeleting(true);
        try {
            // Use the representative capture's ID (same as Sidepanel delete)
            const response = await chrome.runtime.sendMessage({
                type: "UI/DELETE_CAPTURE",
                captureId: representativeCapture.id,
            });

            if (response && response.ok) {
                console.log("[DetailsDrawer] Deleted capture successfully:", representativeCapture.id);
                onClose(); // Close drawer
                onDeleted(); // Trigger parent refresh
            } else {
                console.error("[DetailsDrawer] Failed to delete capture:", response?.error);
                devWarn("[DetailsDrawer] Delete failed", { error: response?.error });
            }
        } catch (err) {
            console.error("[DetailsDrawer] Error deleting capture:", err);
            devWarn("[DetailsDrawer] Delete error", { error: err });
        } finally {
            setIsDeleting(false);
        }
    };

    // DEV-only: Warn if drawer is open with no selection
    if (open && !selectedComponent && !selectedStyle) {
        devWarn("[UI Inventory Viewer] Drawer open with no selection", {
            hasComponent: !!selectedComponent,
            hasStyle: !!selectedStyle,
        });
    }

    // 7.4.5: DEV-only warnings for empty drawer data
    if (selectedComponent && (!componentCaptures || componentCaptures.length === 0)) {
        devWarn("[UI Inventory Viewer] Drawer: selected component has zero captures", {
            componentId: selectedComponent.id,
        });
    }

    if (selectedStyle && (!styleLocations || styleLocations.length === 0) && (!relatedComponents || relatedComponents.length === 0)) {
        devWarn("[UI Inventory Viewer] Drawer: selected style has no locations/related components", {
            styleId: selectedStyle.id,
        });
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    onClose();
                } else {
                    // Already open, do nothing
                }
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "hsl(var(--foreground) / 0.08)",
                        zIndex: 50,
                    }}
                />
                <Dialog.Content
                    style={{
                        position: "fixed",
                        top: 0,
                        right: 0,
                        height: "100vh",
                        width: 420,
                        maxWidth: "90vw",
                        background: "hsl(var(--background))",
                        borderLeft: "1px solid hsl(var(--border))",
                        display: "flex",
                        flexDirection: "column",
                        overflowX: "hidden",
                        boxSizing: "border-box",
                        zIndex: 51,
                    }}
                >
                    {/* Accessibility: visually hidden title */}
                    <VisuallyHidden.Root>
                        <Dialog.Title>
                            {selectedComponent ? selectedComponent.name : selectedStyle ? selectedStyle.token : "Details"}
                        </Dialog.Title>
                    </VisuallyHidden.Root>

                    {/* Accessibility: visually hidden description */}
                    <VisuallyHidden.Root>
                        <Dialog.Description>Details panel for the selected item.</Dialog.Description>
                    </VisuallyHidden.Root>

                    {/* Header (fixed at top) */}
                    <div style={{
                        flex: "0 0 auto",
                        padding: "16px 24px 8px 24px",
                        background: "hsl(var(--background))",
                        display: "flex",
                        justifyContent: "flex-end",
                        borderBottom: "1px solid hsl(var(--border))",
                    }}>
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close details"
                                style={{
                                    padding: "4px 8px",
                                    fontSize: 14,
                                    background: "hsl(var(--background))",
                                    color: "hsl(var(--foreground))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "var(--radius)",
                                    cursor: "pointer",
                                }}
                            >
                                ✕
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* Body (scrollable content) */}
                    <div style={{
                        flex: "1 1 auto",
                        overflowY: "auto",
                        overflowX: "hidden",
                        padding: "16px 24px 88px 24px", // Extra bottom padding for sticky footer (72px footer + 16px gap)
                        maxWidth: "100%",
                        boxSizing: "border-box",
                    }}>
                    {selectedComponent && (
                        <div>
                            {/* Component header */}
                            <h2 style={{
                                fontSize: 20,
                                fontWeight: 600,
                                margin: 0,
                                marginBottom: 4,
                                color: "hsl(var(--foreground))",
                            }}>
                                {selectedComponent.name}
                            </h2>
                            <div style={{
                                fontSize: 13,
                                color: "hsl(var(--muted-foreground))",
                                marginBottom: 16,
                            }}>
                                {selectedComponent.category} • {selectedComponent.type} • {selectedComponent.status}
                            </div>

                            {/* Optional chips */}
                            <div style={{
                                display: "flex",
                                gap: 6,
                                marginBottom: 24,
                                flexWrap: "wrap",
                            }}>
                                <span style={{
                                    fontSize: 11,
                                    padding: "3px 8px",
                                    background: "hsl(var(--muted))",
                                    color: "hsl(var(--muted-foreground))",
                                    borderRadius: "calc(var(--radius) - 2px)",
                                }}>
                                    {selectedComponent.source}
                                </span>
                                <span style={{
                                    fontSize: 11,
                                    padding: "3px 8px",
                                    background: "hsl(var(--muted))",
                                    color: selectedComponent.status === "Unknown" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))",
                                    border: selectedComponent.status === "Unknown" ? "1px solid hsl(var(--destructive))" : undefined,
                                    borderRadius: "calc(var(--radius) - 2px)",
                                }}>
                                    {selectedComponent.status}
                                </span>
                            </div>

                            {/* Preview section (7.5.2: hero screenshot) */}
                            <div style={{ marginBottom: 24, maxWidth: "100%" }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Preview
                                </h3>
                                <div style={{
                                    width: "100%",
                                    maxWidth: "100%",
                                    maxHeight: 220,
                                    minHeight: 180,
                                    padding: 12,
                                    borderRadius: "var(--radius)",
                                    border: "1px solid hsl(var(--border))",
                                    background: "hsl(var(--muted))",
                                    overflow: "hidden",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxSizing: "border-box",
                                }}>
                                    {screenshotUrl ? (
                                        <img
                                            src={screenshotUrl}
                                            alt="Component screenshot"
                                            style={{
                                                width: "auto",
                                                height: "auto",
                                                maxWidth: "100%",
                                                maxHeight: "100%",
                                                display: "block",
                                                objectFit: "contain",
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            fontSize: 13,
                                            color: "hsl(var(--muted-foreground))",
                                        }}>
                                            No screenshot yet
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Identity section (7.6.1: read-only metadata) */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Identity
                                </h3>
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                    padding: 12,
                                    background: "hsl(var(--muted))",
                                    borderRadius: "var(--radius)",
                                    fontSize: 13,
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                        <span style={{ color: "hsl(var(--muted-foreground))" }}>Name</span>
                                        <span style={{ color: "hsl(var(--foreground))", fontWeight: 500, textAlign: "right" }}>
                                            {selectedComponent.name || "—"}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                        <span style={{ color: "hsl(var(--muted-foreground))" }}>Category</span>
                                        <span style={{ color: "hsl(var(--foreground))", textAlign: "right" }}>
                                            {selectedComponent.category || "—"}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                        <span style={{ color: "hsl(var(--muted-foreground))" }}>Type</span>
                                        <span style={{ color: "hsl(var(--foreground))", textAlign: "right" }}>
                                            {selectedComponent.type || "—"}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                        <span style={{ color: "hsl(var(--muted-foreground))" }}>Status</span>
                                        <span style={{
                                            color: selectedComponent.status === "Unknown" ? "hsl(var(--destructive))" : "hsl(var(--foreground))",
                                            textAlign: "right"
                                        }}>
                                            {selectedComponent.status || "—"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* HTML Structure section (7.6.2: collapsible, read-only) */}
                            {(() => {
                                // Use representative capture (same as Preview)
                                const representativeCapture = componentCaptures[0];
                                const htmlStructure = representativeCapture?.htmlStructure;

                                return (
                                    <div style={{ marginBottom: 24 }}>
                                        <details style={{ cursor: "pointer" }}>
                                            <summary style={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                                marginTop: 0,
                                                marginBottom: 8,
                                                color: "hsl(var(--foreground))",
                                                listStyle: "none",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                            }}>
                                                <span style={{
                                                    display: "inline-block",
                                                    transition: "transform 0.2s",
                                                }}>▸</span>
                                                HTML Structure
                                            </summary>
                                            <div style={{
                                                marginTop: 8,
                                                padding: 12,
                                                background: "hsl(var(--muted))",
                                                borderRadius: "var(--radius)",
                                                border: "1px solid hsl(var(--border))",
                                                fontSize: 13,
                                                fontFamily: "monospace",
                                                whiteSpace: "pre-wrap",
                                                overflowWrap: "anywhere",
                                                lineHeight: 1.5,
                                                color: htmlStructure ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                                            }}>
                                                {htmlStructure || "No HTML available"}
                                            </div>
                                        </details>
                                        <style>{`
                                            details[open] > summary > span {
                                                transform: rotate(90deg);
                                            }
                                        `}</style>
                                    </div>
                                );
                            })()}

                            {/* Notes section (7.7.2: editable) */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Notes
                                </h3>
                                <textarea
                                    value={draftNotes}
                                    onChange={(e) => setDraftNotes(e.target.value)}
                                    placeholder="Add notes for this component..."
                                    style={{
                                        width: "100%",
                                        minHeight: 100,
                                        padding: 12,
                                        background: "hsl(var(--background))",
                                        borderRadius: "var(--radius)",
                                        border: "1px solid hsl(var(--border))",
                                        fontSize: 13,
                                        color: "hsl(var(--foreground))",
                                        lineHeight: 1.5,
                                        fontFamily: "inherit",
                                        resize: "vertical",
                                    }}
                                />
                            </div>

                            {/* Tags section (7.7.2: editable) */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Tags
                                </h3>
                                {/* Existing tags */}
                                {draftTags.length > 0 ? (
                                    <div style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 8,
                                        marginBottom: 12,
                                    }}>
                                        {draftTags.map((tag, index) => (
                                            <span
                                                key={index}
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    padding: "4px 8px 4px 10px",
                                                    fontSize: 12,
                                                    background: "hsl(var(--muted))",
                                                    color: "hsl(var(--foreground))",
                                                    border: "1px solid hsl(var(--border))",
                                                    borderRadius: "calc(var(--radius) - 2px)",
                                                    lineHeight: 1.4,
                                                }}
                                            >
                                                {tag}
                                                <button
                                                    onClick={() => handleRemoveTag(tag)}
                                                    style={{
                                                        background: "none",
                                                        border: "none",
                                                        padding: 0,
                                                        cursor: "pointer",
                                                        color: "hsl(var(--muted-foreground))",
                                                        fontSize: 14,
                                                        lineHeight: 1,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                    }}
                                                    title="Remove tag"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{
                                        padding: 8,
                                        fontSize: 12,
                                        color: "hsl(var(--muted-foreground))",
                                        marginBottom: 12,
                                    }}>
                                        No tags yet.
                                    </div>
                                )}
                                {/* Add tag input */}
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input
                                        type="text"
                                        value={newTagInput}
                                        onChange={(e) => setNewTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleAddTag();
                                            }
                                        }}
                                        placeholder="Add a tag..."
                                        style={{
                                            flex: 1,
                                            padding: "6px 12px",
                                            background: "hsl(var(--background))",
                                            borderRadius: "var(--radius)",
                                            border: "1px solid hsl(var(--border))",
                                            fontSize: 13,
                                            color: "hsl(var(--foreground))",
                                        }}
                                    />
                                    <button
                                        onClick={handleAddTag}
                                        disabled={newTagInput.trim() === ""}
                                        style={{
                                            padding: "6px 16px",
                                            background: newTagInput.trim() === "" ? "hsl(var(--muted))" : "hsl(var(--primary))",
                                            color: newTagInput.trim() === "" ? "hsl(var(--muted-foreground))" : "hsl(var(--primary-foreground))",
                                            border: "none",
                                            borderRadius: "var(--radius)",
                                            fontSize: 13,
                                            fontWeight: 500,
                                            cursor: newTagInput.trim() === "" ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            {/* Source section (7.5.2b: captured from URLs) */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Source ({selectedComponent.capturesCount})
                                </h3>
                                {componentCaptures.length === 0 ? (
                                    <div style={{
                                        padding: 12,
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "var(--radius)",
                                        background: "hsl(var(--muted))",
                                        fontSize: 13,
                                        color: "hsl(var(--muted-foreground))",
                                        lineHeight: 1.5,
                                    }}>
                                        No sources found.
                                    </div>
                                ) : (
                                    <div style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                    }}>
                                        {(() => {
                                            // Dedupe by URL (7.5.2b)
                                            const seenUrls = new Set<string>();
                                            const uniqueCaptures = componentCaptures.filter((c) => {
                                                if (seenUrls.has(c.url)) return false;
                                                seenUrls.add(c.url);
                                                return true;
                                            });

                                            return uniqueCaptures.map((capture) => {
                                                // Extract hostname from URL
                                                let hostname = "Captured from";
                                                try {
                                                    if (capture.url && capture.url !== "—") {
                                                        hostname = new URL(capture.url).hostname;
                                                    }
                                                } catch {
                                                    // Keep fallback
                                                }

                                                return (
                                                    <div
                                                        key={capture.id}
                                                        style={{
                                                            padding: "8px 12px",
                                                            background: "hsl(var(--muted))",
                                                            borderRadius: "calc(var(--radius) - 2px)",
                                                            fontSize: 13,
                                                        }}
                                                    >
                                                        <div style={{
                                                            color: "hsl(var(--foreground))",
                                                            fontWeight: 500,
                                                            marginBottom: 4,
                                                        }}>
                                                            {hostname}
                                                        </div>
                                                        <div style={{
                                                            color: "hsl(var(--muted-foreground))",
                                                            fontSize: 12,
                                                            fontFamily: "monospace",
                                                            wordBreak: "break-all",
                                                            overflowWrap: "anywhere",
                                                            lineHeight: 1.4,
                                                        }}>
                                                            {capture.url}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* Visual Essentials section (7.4.4: real data) */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Visual Essentials
                                </h3>
                                {visualEssentials.rows.length === 0 ? (
                                    <div style={{
                                        padding: 12,
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "var(--radius)",
                                        background: "hsl(var(--muted))",
                                        fontSize: 13,
                                        color: "hsl(var(--muted-foreground))",
                                        lineHeight: 1.5,
                                    }}>
                                        No visual details available.
                                    </div>
                                ) : (
                                    <div style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 12,
                                    }}>
                                        {/* Group rows by section */}
                                        {["Text", "Surface", "Spacing", "State"].map((section) => {
                                            const sectionRows = visualEssentials.rows.filter((r) => r.section === section);
                                            if (sectionRows.length === 0) return null;

                                            return (
                                                <div key={section}>
                                                    {/* Section divider */}
                                                    <div style={{
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        textTransform: "uppercase",
                                                        color: "hsl(var(--muted-foreground))",
                                                        marginBottom: 6,
                                                        letterSpacing: "0.05em",
                                                    }}>
                                                        {section}
                                                    </div>
                                                    {/* Rows for this section */}
                                                    <div style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 6,
                                                    }}>
                                                        {sectionRows.map((row, idx) => (
                                                            <div
                                                                key={`${section}-${idx}`}
                                                                style={{
                                                                    display: "flex",
                                                                    justifyContent: "space-between",
                                                                    padding: 8,
                                                                    background: "hsl(var(--muted))",
                                                                    borderRadius: "calc(var(--radius) - 2px)",
                                                                    fontSize: 13,
                                                                }}
                                                            >
                                                                <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>{row.label}</span>
                                                                <span style={{ color: "hsl(var(--muted-foreground))", fontFamily: "monospace" }}>{row.value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {selectedStyle && (
                        <div>
                            {/* Style header */}
                            <h2 style={{
                                fontSize: 18,
                                fontWeight: 600,
                                fontFamily: "monospace",
                                margin: 0,
                                marginBottom: 8,
                                color: "hsl(var(--foreground))",
                            }}>
                                {selectedStyle.token}
                            </h2>
                            <div style={{
                                fontSize: 14,
                                fontFamily: "monospace",
                                color: "hsl(var(--muted-foreground))",
                                marginBottom: 16,
                                padding: "6px 10px",
                                background: "hsl(var(--muted))",
                                borderRadius: "var(--radius)",
                                display: "inline-block",
                            }}>
                                {selectedStyle.value}
                            </div>

                            {/* Meta line */}
                            <div style={{
                                fontSize: 13,
                                color: "hsl(var(--muted-foreground))",
                                marginBottom: 24,
                            }}>
                                {selectedStyle.kind} • {selectedStyle.source} • {selectedStyle.usageCount} uses
                            </div>

                            {/* Identity section (7.6.1: read-only metadata) */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Identity
                                </h3>
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                    padding: 12,
                                    background: "hsl(var(--muted))",
                                    borderRadius: "var(--radius)",
                                    fontSize: 13,
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                        <span style={{ color: "hsl(var(--muted-foreground))" }}>Token</span>
                                        <span style={{
                                            color: "hsl(var(--foreground))",
                                            fontWeight: 500,
                                            fontFamily: "monospace",
                                            textAlign: "right",
                                            wordBreak: "break-all"
                                        }}>
                                            {selectedStyle.token || "—"}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                        <span style={{ color: "hsl(var(--muted-foreground))" }}>Value</span>
                                        <span style={{
                                            color: "hsl(var(--foreground))",
                                            fontFamily: "monospace",
                                            textAlign: "right",
                                            wordBreak: "break-all"
                                        }}>
                                            {selectedStyle.value || "—"}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                        <span style={{ color: "hsl(var(--muted-foreground))" }}>Kind</span>
                                        <span style={{ color: "hsl(var(--foreground))", textAlign: "right" }}>
                                            {selectedStyle.kind || "—"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Where it appears section (7.4.3: real data) */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Where it appears
                                </h3>
                                {styleLocations.length === 0 ? (
                                    <div style={{
                                        padding: 12,
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "var(--radius)",
                                        background: "hsl(var(--muted))",
                                        fontSize: 13,
                                        color: "hsl(var(--muted-foreground))",
                                        lineHeight: 1.5,
                                    }}>
                                        No locations found.
                                    </div>
                                ) : (
                                    <div style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                    }}>
                                        {styleLocations.map((location) => (
                                            <div
                                                key={location.id}
                                                style={{
                                                    display: "flex",
                                                    gap: 12,
                                                    padding: "8px 12px",
                                                    background: "hsl(var(--muted))",
                                                    borderRadius: "calc(var(--radius) - 2px)",
                                                    fontSize: 13,
                                                }}
                                            >
                                                <CaptureThumbnail blobId={location.screenshotBlobId} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                        marginBottom: 4,
                                                    }}>
                                                        <span style={{
                                                            color: "hsl(var(--foreground))",
                                                            fontWeight: 500,
                                                        }}>
                                                            {location.sourceLabel}
                                                        </span>
                                                        <span style={{
                                                            fontSize: 11,
                                                            padding: "2px 6px",
                                                            background: "hsl(var(--background))",
                                                            color: "hsl(var(--muted-foreground))",
                                                            borderRadius: "calc(var(--radius) - 2px)",
                                                            border: "1px solid hsl(var(--border))",
                                                        }}>
                                                            {location.uses} uses
                                                        </span>
                                                    </div>
                                                    <div style={{
                                                        color: "hsl(var(--muted-foreground))",
                                                        fontSize: 12,
                                                        fontFamily: "monospace",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}>
                                                        {location.url}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Related components section (7.4.3: real data) */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Related components
                                </h3>
                                {relatedComponents.length === 0 ? (
                                    <div style={{
                                        padding: 12,
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "var(--radius)",
                                        background: "hsl(var(--muted))",
                                        fontSize: 13,
                                        color: "hsl(var(--muted-foreground))",
                                        lineHeight: 1.5,
                                    }}>
                                        No related components found.
                                    </div>
                                ) : (
                                    <div style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 6,
                                    }}>
                                        {relatedComponents.map((component) => (
                                            <span
                                                key={component.componentId}
                                                style={{
                                                    fontSize: 12,
                                                    padding: "4px 10px",
                                                    background: "hsl(var(--muted))",
                                                    color: "hsl(var(--foreground))",
                                                    borderRadius: "calc(var(--radius) - 2px)",
                                                    border: "1px solid hsl(var(--border))",
                                                }}
                                                title={`${component.category} • ${component.type}`}
                                            >
                                                {component.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Actions row */}
                            <div style={{
                                display: "flex",
                                gap: 8,
                                paddingTop: 12,
                                borderTop: "1px solid hsl(var(--border))",
                            }}>
                                <button
                                    type="button"
                                    style={{
                                        flex: 1,
                                        padding: "8px 12px",
                                        fontSize: 13,
                                        fontWeight: 500,
                                        background: "hsl(var(--background))",
                                        color: "hsl(var(--foreground))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "var(--radius)",
                                        cursor: "pointer",
                                    }}
                                >
                                    Copy token
                                </button>
                                <button
                                    type="button"
                                    style={{
                                        flex: 1,
                                        padding: "8px 12px",
                                        fontSize: 13,
                                        fontWeight: 500,
                                        background: "hsl(var(--background))",
                                        color: "hsl(var(--foreground))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "var(--radius)",
                                        cursor: "pointer",
                                    }}
                                >
                                    Copy value
                                </button>
                            </div>
                        </div>
                    )}

                    {!selectedComponent && !selectedStyle && (
                        <div style={{
                            fontSize: 14,
                            color: "hsl(var(--muted-foreground))",
                            textAlign: "center",
                            marginTop: 48,
                        }}>
                            No item selected.
                        </div>
                    )}
                    </div>

                    {/* Sticky footer with actions (only shown when component is selected) */}
                    {selectedComponent && (
                        <div style={{
                            position: "sticky",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: "hsl(var(--background))",
                            borderTop: "1px solid hsl(var(--border))",
                            padding: "16px 24px",
                            display: "flex",
                            gap: 8,
                            zIndex: 10,
                        }}>
                            <button
                                onClick={handleSave}
                                disabled={!isDirty || isSaving}
                                style={{
                                    flex: 1,
                                    padding: "10px 16px",
                                    background: (!isDirty || isSaving) ? "hsl(var(--muted))" : "hsl(var(--primary))",
                                    color: (!isDirty || isSaving) ? "hsl(var(--muted-foreground))" : "hsl(var(--primary-foreground))",
                                    border: "none",
                                    borderRadius: "var(--radius)",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: (!isDirty || isSaving) ? "not-allowed" : "pointer",
                                }}
                            >
                                {isSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={!isDirty}
                                style={{
                                    padding: "10px 16px",
                                    background: "hsl(var(--background))",
                                    color: !isDirty ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "var(--radius)",
                                    fontSize: 14,
                                    fontWeight: 500,
                                    cursor: !isDirty ? "not-allowed" : "pointer",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                type="button"
                                style={{
                                    padding: "10px 16px",
                                    background: "hsl(var(--background))",
                                    color: isDeleting ? "hsl(var(--muted-foreground))" : "hsl(var(--destructive))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "var(--radius)",
                                    fontSize: 14,
                                    fontWeight: 500,
                                    cursor: isDeleting ? "not-allowed" : "pointer",
                                }}
                            >
                                {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
