import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import type {
    ViewerComponentCapture,
    ViewerStyleLocation,
    ViewerStyleRelatedComponent,
    ViewerVisualEssentials,
} from "../types/projectViewerTypes";
import type { AuthorStyleEvidence, StylePrimitives, TokenEvidence } from "../../../types/capture";
import { useBlobUrl } from "../hooks/useBlobUrl";
import { TokenTraceValue } from "../../shared/tokenTrace/TokenTraceValue";
import { StylePropertiesTable, type StylePropertiesSection } from "../../shared/components";
import { deriveVisualEssentialsFromPrimitives } from "../utils/visualEssentialsFromPrimitives";

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
    description?: string;
    category: string;
    type: string;
    status: string;
    source: string;
    capturesCount: number;
    notes?: string | null; // 7.6.3: aligns with Sidepanel comments field (future)
    tags?: string[];       // 7.6.4: aligns with Sidepanel tags field (future)
    overrides?: {
        displayName: string | null;
        categoryOverride: string | null;
        typeOverride: string | null;
        statusOverride: string | null;
    };
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
    // Token trace evidence (best-effort) for the same representative capture
    visualEssentialsTrace?: {
        author?: AuthorStyleEvidence;
        tokens?: TokenEvidence;
        primitives: StylePrimitives;
    } | null;
    // Phase 1: authored styles evidence for representative capture (optional)
    visualEssentialsEvidence?: {
        method: "cdp" | "computed";
        cdpError?: string;
    } | null;
    // 7.7.2: Callback after annotation save
    onAnnotationsChanged: () => void;
    // Identity overrides saved (component-scoped)
    onOverridesChanged: () => void;
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
    visualEssentialsTrace,
    visualEssentialsEvidence,
    onAnnotationsChanged,
    onOverridesChanged,
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

    const inputStyle = {
        width: "100%",
        padding: "8px 10px",
        background: "hsl(var(--background))",
        borderRadius: "var(--radius)",
        border: "1px solid hsl(var(--border))",
        fontSize: 13,
        color: "hsl(var(--foreground))",
        boxSizing: "border-box",
    } as const;

    const labelStyle = {
        fontSize: 12,
        color: "hsl(var(--muted-foreground))",
        marginBottom: 6,
        display: "block",
    } as const;

    const CATEGORY_OPTIONS = [
        "Actions",
        "Forms",
        "Navigation",
        "Content",
        "Media",
        "Feedback",
        "Layout",
        "Screenshots",
        "Data Display",
        "Unknown",
    ];

    const STATUS_OPTIONS = [
        "Unreviewed",
        "Canonical",
        "Variant",
        "Deviation",
        "Legacy",
        "Experimental",
    ];

    const TYPE_OPTIONS_BY_CATEGORY: Record<string, string[]> = {
        Actions: ["Button", "Link", "Icon Button", "Toggle Button"],
        Forms: ["Input", "Textarea", "Select", "Checkbox", "Radio", "Switch", "Slider", "Date Picker", "File Upload", "Fieldset"],
        Navigation: ["Nav Link", "Menu", "Menu Item", "Tabs", "Tab", "Breadcrumb", "Pagination", "Sidebar Item"],
        Content: ["Heading", "Paragraph", "Text", "Label", "List", "List Item", "Rich Text"],
        Media: ["Image", "Icon", "Avatar", "Video", "Illustration", "Logo"],
        Feedback: ["Alert", "Toast", "Banner", "Tooltip", "Modal", "Snackbar", "Inline Message", "Empty State"],
        Layout: ["Card", "Container", "Section", "Panel", "Divider", "Grid", "Landmark"],
        Screenshots: ["Region", "Viewport"],
        "Data Display": ["Table", "Table Row", "Table Cell", "Badge", "Chip", "Tag", "Stat", "Key Value"],
        Unknown: ["Element", "Custom Element", "Unclassified"],
    };

    const getTypeOptions = (category: string, currentType: string): string[] => {
        const base = TYPE_OPTIONS_BY_CATEGORY[category] || [];
        if (currentType && !base.includes(currentType)) {
            return [currentType, ...base];
        }
        return base.length > 0 ? base : (currentType ? [currentType] : []);
    };

    // 7.7.2: Editable annotations state
    const [draftNotes, setDraftNotes] = useState<string>("");
    const [draftTags, setDraftTags] = useState<string[]>([]);
    const [newTagInput, setNewTagInput] = useState<string>("");
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    // Identity overrides (prototype parity)
    const [draftDisplayName, setDraftDisplayName] = useState<string>("");
    const [draftDescription, setDraftDescription] = useState<string>("");
    const [draftCategory, setDraftCategory] = useState<string>("");
    const [draftType, setDraftType] = useState<string>("");
    const [draftStatus, setDraftStatus] = useState<string>("");

    // Style drawer copy feedback
    const [copiedToken, setCopiedToken] = useState<boolean>(false);
    const [copiedValue, setCopiedValue] = useState<boolean>(false);

    // 7.7.2: Initialize draft state when selectedComponent changes
    useEffect(() => {
        if (selectedComponent) {
            setDraftNotes(selectedComponent.notes || "");
            setDraftTags(selectedComponent.tags || []);
            setNewTagInput("");
            setDraftDisplayName(selectedComponent.name || "");
            setDraftDescription(selectedComponent.description || "");
            setDraftCategory(selectedComponent.category || "Unknown");
            setDraftType(selectedComponent.type || "Unclassified");
            setDraftStatus(selectedComponent.status || "Unreviewed");
        } else {
            setDraftNotes("");
            setDraftTags([]);
            setNewTagInput("");
            setDraftDisplayName("");
            setDraftDescription("");
            setDraftCategory("");
            setDraftType("");
            setDraftStatus("");
        }
    }, [selectedComponent?.id]); // Only re-init when component ID changes

    useEffect(() => {
        // Reset copy feedback when switching style selections
        setCopiedToken(false);
        setCopiedValue(false);
    }, [selectedStyle?.id]);

    // 7.7.2: Dirty tracking
    const isDirty = selectedComponent
        ? (
            draftNotes.trim() !== (selectedComponent.notes || "").trim() ||
            JSON.stringify(draftTags.sort()) !== JSON.stringify((selectedComponent.tags || []).sort()) ||
            draftDisplayName.trim() !== (selectedComponent.name || "").trim() ||
            draftDescription.trim() !== (selectedComponent.description || "").trim() ||
            draftCategory !== (selectedComponent.category || "") ||
            draftType !== (selectedComponent.type || "") ||
            draftStatus !== (selectedComponent.status || "")
        )
        : false;

    // 7.7.2: Save annotations
    const handleSave = async () => {
        if (!selectedComponent || !isDirty) return;

        setIsSaving(true);
        try {
            // Save identity overrides (component-scoped)
            const overrideResp = await chrome.runtime.sendMessage({
                type: "OVERRIDES/UPSERT",
                projectId,
                componentKey: selectedComponent.id,
                displayName: draftDisplayName.trim() === "" ? null : draftDisplayName.trim(),
                description: draftDescription.trim() === "" ? null : draftDescription.trim(),
                categoryOverride: draftCategory.trim() === "" ? null : draftCategory.trim(),
                typeOverride: draftType.trim() === "" ? null : draftType.trim(),
                statusOverride: draftStatus.trim() === "" ? null : draftStatus.trim(),
            });

            if (!overrideResp || !overrideResp.ok) {
                console.error("[DetailsDrawer] Failed to save overrides:", overrideResp?.error);
                return;
            }

            // Save annotations (notes + tags)
            const annotationResp = await chrome.runtime.sendMessage({
                type: "ANNOTATIONS/UPSERT",
                projectId,
                componentKey: selectedComponent.id,
                notes: draftNotes.trim() === "" ? null : draftNotes.trim(),
                tags: draftTags,
            });

            if (!annotationResp || !annotationResp.ok) {
                console.error("[DetailsDrawer] Failed to save annotations:", annotationResp?.error);
                return;
            }

            console.log("[DetailsDrawer] Saved overrides + annotations successfully");
            onOverridesChanged();
            onAnnotationsChanged();
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
        setDraftDisplayName(selectedComponent.name || "");
        setDraftDescription(selectedComponent.description || "");
        setDraftCategory(selectedComponent.category || "Unknown");
        setDraftType(selectedComponent.type || "Unclassified");
        setDraftStatus(selectedComponent.status || "Unreviewed");
    };

    const handleResetOverrides = async () => {
        if (!selectedComponent || !selectedComponent.overrides) return;
        try {
            const resp = await chrome.runtime.sendMessage({
                type: "OVERRIDES/DELETE",
                projectId,
                componentKey: selectedComponent.id,
            });
            if (resp && resp.ok) {
                onOverridesChanged();
            }
        } catch (err) {
            console.error("[DetailsDrawer] Failed to reset overrides:", err);
        }
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

    // State selection for multi-state components
    const [selectedState, setSelectedState] = useState(selectedComponent?.selectedState || "default");
    const [isLoadingState, setIsLoadingState] = useState(true); // Start as loading
    const [currentStateData, setCurrentStateData] = useState<{
        capture: ViewerComponentCapture | null;
        visualEssentials: ViewerVisualEssentials | null;
        visualEssentialsTrace: any | null;
    }>({
        capture: null, // Don't use props - they're wrong for multi-state
        visualEssentials: null,
        visualEssentialsTrace: null,
    });

    // Use currentStateData for display (updates when state changes)
    const screenshotBlobId = currentStateData.capture?.screenshotBlobId;
    const { url: screenshotUrl } = useBlobUrl(screenshotBlobId);

    // Update currentStateData when selectedComponent changes - fetch initial state capture
    useEffect(() => {
        if (!selectedComponent) {
            setCurrentStateData({
                capture: null,
                visualEssentials: null,
                visualEssentialsTrace: null,
            });
            setSelectedState("default");
            return;
        }

        const defaultStateCaptureEntry = selectedComponent.availableStates?.find(s => s.state === selectedComponent.selectedState);
        if (defaultStateCaptureEntry) {
            setIsLoadingState(true);
            chrome.runtime.sendMessage({ type: "UI/GET_CAPTURE", captureId: defaultStateCaptureEntry.captureId }, (resp) => {
                if (resp?.ok && resp.capture) {
                    const capture = resp.capture;
                    
                    const derivedEssentials = capture.styles?.primitives ? deriveVisualEssentialsFromPrimitives(capture.styles.primitives) : null;
                    
                    setCurrentStateData({
                        capture: {
                            id: defaultStateCaptureEntry.captureId,
                            url: capture.page?.url || capture.url || "",
                            sourceLabel: capture.page?.url || "—",
                            timestampLabel: "—",
                            screenshotBlobId: capture.screenshot?.screenshotBlobId,
                            htmlStructure: capture.element?.outerHTML || "",
                        },
                        visualEssentials: derivedEssentials,
                        visualEssentialsTrace: {
                            author: capture.styles?.author,
                            tokens: capture.styles?.tokens,
                            primitives: capture.styles?.primitives,
                        },
                    });
                    setSelectedState(selectedComponent.selectedState);
                } else {
                    devWarn("[DetailsDrawer] Failed to load default state capture:", defaultStateCaptureEntry.captureId, resp?.error);
                    // Fallback to props
                    setCurrentStateData({
                        capture: componentCaptures?.[0] || null,
                        visualEssentials: visualEssentials,
                        visualEssentialsTrace: visualEssentialsTrace,
                    });
                    setSelectedState("default");
                }
                setIsLoadingState(false);
            });
        } else {
            // No available states, use props as fallback
            setCurrentStateData({
                capture: componentCaptures?.[0] || null,
                visualEssentials: visualEssentials,
                visualEssentialsTrace: visualEssentialsTrace,
            });
            setSelectedState("default");
        }
    }, [selectedComponent]);

    const handleStateChange = async (newState: string) => {
        if (!selectedComponent) return;
        const stateEntry = selectedComponent.availableStates?.find(s => s.state === newState);
        if (!stateEntry) return;

        setIsLoadingState(true);
        try {
            const captureResp = await chrome.runtime.sendMessage({
                type: "UI/GET_CAPTURE",
                captureId: stateEntry.captureId,
            });

            if (captureResp?.ok && captureResp.capture) {
                const capture = captureResp.capture;
                const derivedEssentials = capture.styles?.primitives ? deriveVisualEssentialsFromPrimitives(capture.styles.primitives) : null;
                
                // Update local state with the new capture data for display
                setCurrentStateData({
                    capture: {
                        id: stateEntry.captureId,
                        url: capture.page?.url || capture.url || "",
                        sourceLabel: capture.page?.url || "—",
                        timestampLabel: "—",
                        screenshotBlobId: capture.screenshot?.screenshotBlobId,
                        htmlStructure: capture.element?.outerHTML || "",
                    },
                    // Recompute visual essentials from new capture's primitives
                    visualEssentials: derivedEssentials,
                    visualEssentialsTrace: {
                        author: capture.styles?.author,
                        tokens: capture.styles?.tokens,
                        primitives: capture.styles?.primitives,
                    },
                });
                setSelectedState(newState as any);
            }
        } catch (err) {
            console.error("[DetailsDrawer] Failed to load state:", err);
        } finally {
            setIsLoadingState(false);
        }
    };

    const capitalizeState = (state: string): string => {
        return state.charAt(0).toUpperCase() + state.slice(1);
    };

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

    const handleCopyToClipboard = async (text: string): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            try {
                const textarea = document.createElement("textarea");
                textarea.value = text;
                textarea.style.position = "fixed";
                textarea.style.left = "-9999px";
                document.body.appendChild(textarea);
                textarea.select();
                const ok = document.execCommand("copy");
                document.body.removeChild(textarea);
                return ok;
            } catch {
                return false;
            }
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
                        padding: "12px 16px",
                        background: "hsl(var(--background))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid hsl(var(--border))",
                        gap: "12px",
                    }}>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: 16,
                                fontWeight: 600,
                                color: "hsl(var(--foreground))",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}>
                                {selectedComponent ? selectedComponent.name : selectedStyle ? selectedStyle.token : "Details"}
                            </h2>
                            {selectedComponent && (
                                <>
                                    <span style={{
                                        fontSize: 11,
                                        padding: "2px 6px",
                                        background: "hsl(var(--muted))",
                                        color: "hsl(var(--muted-foreground))",
                                        borderRadius: "calc(var(--radius) - 2px)",
                                        flexShrink: 0,
                                    }}>
                                        {selectedComponent.status}
                                    </span>
                                </>
                            )}
                        </div>
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close details"
                                style={{
                                    padding: "8px",
                                    fontSize: 14,
                                    background: "transparent",
                                    color: "hsl(var(--muted-foreground))",
                                    border: "none",
                                    borderRadius: "var(--radius)",
                                    cursor: "pointer",
                                    flexShrink: 0,
                                    transition: "background 0.15s ease",
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "hsl(var(--muted))"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
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
                            {/* Preview section (moved to top, title removed) */}
                            <div style={{ marginBottom: 24, maxWidth: "100%" }}>
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

                            {/* Identity section */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>Identity</h3>

                                <div style={{
                                    padding: 12,
                                    background: "hsl(var(--muted))",
                                    borderRadius: "var(--radius)",
                                    border: "1px solid hsl(var(--border))",
                                    fontSize: 13,
                                }}>
                                    <div style={{ marginBottom: 12 }}>
                                        <label style={labelStyle}>Name</label>
                                        <input
                                            value={draftDisplayName}
                                            onChange={(e) => setDraftDisplayName(e.target.value)}
                                            placeholder="Name"
                                            style={inputStyle}
                                        />
                                    </div>

                                    <div style={{ marginBottom: 12 }}>
                                        <label style={labelStyle}>Description</label>
                                        <input
                                            value={draftDescription}
                                            onChange={(e) => setDraftDescription(e.target.value)}
                                            placeholder="Description"
                                            style={inputStyle}
                                        />
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                        <div>
                                            <label style={labelStyle}>Category</label>
                                            <select
                                                value={draftCategory}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setDraftCategory(v);
                                                    // best-effort: keep type valid-ish when switching category
                                                    const nextTypeOptions = getTypeOptions(v, draftType);
                                                    if (nextTypeOptions.length > 0 && !nextTypeOptions.includes(draftType)) {
                                                        setDraftType(nextTypeOptions[0]);
                                                    }
                                                }}
                                                style={inputStyle}
                                            >
                                                {CATEGORY_OPTIONS.map((c) => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Type</label>
                                            <select
                                                value={draftType}
                                                onChange={(e) => setDraftType(e.target.value)}
                                                style={inputStyle}
                                            >
                                                {getTypeOptions(draftCategory || "Unknown", draftType).map((t) => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={labelStyle}>Status</label>
                                        <select
                                            value={draftStatus}
                                            onChange={(e) => setDraftStatus(e.target.value)}
                                            style={inputStyle}
                                        >
                                            {STATUS_OPTIONS.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                            <option value="Unknown">Unknown</option>
                                        </select>
                                    </div>

                                    {/* State field - only show for interactive categories */}
                                    {selectedComponent.availableStates && selectedComponent.availableStates.length > 1 && ["Actions", "Forms", "Navigation"].includes(selectedComponent.category) ? (
                                        <div style={{ marginTop: 12 }}>
                                            <label style={labelStyle}>State</label>
                                            <select
                                                value={selectedState}
                                                onChange={(e) => handleStateChange(e.target.value)}
                                                disabled={isLoadingState}
                                                style={{
                                                    ...inputStyle,
                                                    cursor: isLoadingState ? "not-allowed" : "pointer",
                                                    opacity: isLoadingState ? 0.6 : 1,
                                                }}
                                            >
                                                {selectedComponent.availableStates.map(({state}) => (
                                                    <option key={state} value={state}>
                                                        {capitalizeState(state)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        selectedComponent.availableStates && selectedComponent.availableStates.length === 1 && ["Actions", "Forms", "Navigation"].includes(selectedComponent.category) && (
                                            <div style={{ marginTop: 12 }}>
                                                <label style={labelStyle}>State</label>
                                                <div style={{
                                                    ...inputStyle,
                                                    background: "hsl(var(--muted))",
                                                    color: "hsl(var(--muted-foreground))",
                                                }}>
                                                    {capitalizeState(selectedState)}
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
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

                            {/* Styles (formerly Visual Essentials) - moved under Identity */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Styles
                                </h3>
                                {currentStateData.visualEssentials && currentStateData.visualEssentials.rows.length === 0 ? (
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
                                    <StylePropertiesTable
                                        sections={["Text", "Surface", "Spacing", "State"].map((section) => {
                                            const sectionRows = currentStateData.visualEssentials?.rows.filter((r) => r.section === section) || [];
                                            return {
                                                title: section,
                                                rows: sectionRows.map((row) => {
                                                    const isColorRow =
                                                        row.label === "Text color" ||
                                                        row.label === "Background" ||
                                                        row.label === "Border color";

                                                    if (!isColorRow || !currentStateData.visualEssentialsTrace?.tokens) {
                                                        return {
                                                            label: row.label,
                                                            value: row.value,
                                                        };
                                                    }

                                                    const prop =
                                                        row.label === "Text color"
                                                            ? "color"
                                                            : row.label === "Background"
                                                                ? "backgroundColor"
                                                                : "borderColor";

                                                    // Use hex8 from row if available, otherwise look it up
                                                    const hex8 = row.hex8 || (() => {
                                                        const primitives: any = currentStateData.visualEssentialsTrace.primitives;
                                                        if (prop === "color") return primitives?.color?.hex8;
                                                        if (prop === "backgroundColor") return primitives?.backgroundColor?.hex8;
                                                        if (prop === "borderColor") {
                                                            // Handle new BorderColorPrimitive format
                                                            if (primitives?.borderColor?.top?.hex8) {
                                                                return primitives.borderColor.top.hex8;
                                                            }
                                                            return primitives?.borderColor?.hex8;
                                                        }
                                                        return null;
                                                    })();

                                                    const authoredValue =
                                                        (currentStateData.visualEssentialsTrace.author?.properties as any)?.[prop]?.authoredValue ?? null;

                                                    return {
                                                        label: row.label,
                                                        value: row.value,
                                                        customContent: (
                                                            <TokenTraceValue
                                                                property={prop as any}
                                                                label={row.label}
                                                                resolvedValue={row.value}
                                                                hex8={hex8 ?? null}
                                                                authoredValue={authoredValue}
                                                                tokens={currentStateData.visualEssentialsTrace.tokens ?? null}
                                                                showCopyActions={row.label !== "Background" && row.label !== "Border color"}
                                                            />
                                                        ),
                                                    };
                                                }),
                                            };
                                        }).filter(section => section.rows.length > 0)}
                                    />
                                )}
                            </div>

                            {/* HTML section */}
                            {(() => {
                                // Use current state's capture
                                const htmlStructure = currentStateData.capture?.htmlStructure;

                                return (
                                    <div style={{ marginBottom: 24 }}>
                                        <h3 style={drawerSectionTitleStyle}>HTML</h3>
                                        <div style={{
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
                                            maxHeight: 160,
                                            overflowY: "auto",
                                        }}>
                                            {htmlStructure || "No HTML available"}
                                        </div>
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

                            {/* Style preview (prototype parity) */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Preview
                                </h3>
                                {(() => {
                                    const kind = selectedStyle.kind || "unknown";
                                    const value = selectedStyle.value || "—";
                                    const isColor = kind === "color" || kind === "border";

                                    if (isColor && value && value !== "—") {
                                        return (
                                            <div style={{
                                                width: "100%",
                                                height: 96,
                                                borderRadius: "var(--radius)",
                                                border: "1px solid hsl(var(--border))",
                                                background: value,
                                            }} />
                                        );
                                    }

                                    return (
                                        <div style={{
                                            width: "100%",
                                            height: 96,
                                            borderRadius: "var(--radius)",
                                            border: "1px solid hsl(var(--border))",
                                            background: "hsl(var(--muted))",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "hsl(var(--muted-foreground))",
                                            fontFamily: "monospace",
                                            fontSize: 14,
                                            padding: 12,
                                            textAlign: "center",
                                            boxSizing: "border-box",
                                        }}>
                                            {value}
                                        </div>
                                    );
                                })()}
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
                                    onClick={async () => {
                                        const ok = await handleCopyToClipboard(selectedStyle.token || "");
                                        if (ok) {
                                            setCopiedToken(true);
                                            setTimeout(() => setCopiedToken(false), 1200);
                                        }
                                    }}
                                    disabled={!selectedStyle.token}
                                    style={{
                                        flex: 1,
                                        padding: "8px 12px",
                                        fontSize: 13,
                                        fontWeight: 500,
                                        background: !selectedStyle.token ? "hsl(var(--muted))" : "hsl(var(--background))",
                                        color: !selectedStyle.token ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "var(--radius)",
                                        cursor: !selectedStyle.token ? "not-allowed" : "pointer",
                                    }}
                                >
                                    {copiedToken ? "Copied" : "Copy token"}
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const ok = await handleCopyToClipboard(selectedStyle.value || "");
                                        if (ok) {
                                            setCopiedValue(true);
                                            setTimeout(() => setCopiedValue(false), 1200);
                                        }
                                    }}
                                    disabled={!selectedStyle.value}
                                    style={{
                                        flex: 1,
                                        padding: "8px 12px",
                                        fontSize: 13,
                                        fontWeight: 500,
                                        background: !selectedStyle.value ? "hsl(var(--muted))" : "hsl(var(--background))",
                                        color: !selectedStyle.value ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "var(--radius)",
                                        cursor: !selectedStyle.value ? "not-allowed" : "pointer",
                                    }}
                                >
                                    {copiedValue ? "Copied" : "Copy value"}
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
