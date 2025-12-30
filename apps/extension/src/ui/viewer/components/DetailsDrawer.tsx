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
}

// ─────────────────────────────────────────────────────────────
// DetailsDrawer Component
// ─────────────────────────────────────────────────────────────

export function DetailsDrawer({
    open,
    onClose,
    selectedComponent,
    selectedStyle,
    componentCaptures,
    styleLocations,
    relatedComponents,
    visualEssentials,
}: DetailsDrawerProps) {
    // Reusable drawer section title style
    const drawerSectionTitleStyle = {
        fontSize: 14,
        fontWeight: 600,
        marginTop: 0,
        marginBottom: 8,
        color: "hsl(var(--foreground))",
    } as const;

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
                        padding: "16px 24px 24px 24px",
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
                            {(() => {
                                // Choose representative capture (first item)
                                const representativeCapture = componentCaptures[0];
                                const { url: screenshotUrl } = useBlobUrl(representativeCapture?.screenshotBlobId);

                                return (
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
                                );
                            })()}

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
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    style={{
                                        flex: 1,
                                        padding: "8px 12px",
                                        fontSize: 13,
                                        fontWeight: 500,
                                        background: "hsl(var(--background))",
                                        color: "hsl(var(--destructive))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "var(--radius)",
                                        cursor: "pointer",
                                    }}
                                >
                                    Delete
                                </button>
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

                            {/* Usage section */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Usage
                                </h3>
                                <p style={{
                                    fontSize: 14,
                                    color: "hsl(var(--muted-foreground))",
                                    margin: 0,
                                    lineHeight: 1.5,
                                }}>
                                    Placeholder: This style is used {selectedStyle.usageCount} times across the application. Usage context, patterns, and guidelines will appear here.
                                </p>
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
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
