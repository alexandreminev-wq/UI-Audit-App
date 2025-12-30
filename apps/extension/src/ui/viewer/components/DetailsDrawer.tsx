import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import type {
    ViewerComponentCapture,
    ViewerStyleLocation,
    ViewerStyleRelatedComponent,
    ViewerVisualEssentials,
} from "../types/projectViewerTypes";

// ─────────────────────────────────────────────────────────────
// DEV-only logging helpers (7.4.5)
// ─────────────────────────────────────────────────────────────

const isDev = import.meta?.env?.DEV ?? false;
const devWarn = (...args: unknown[]) => { if (isDev) console.warn(...args); };

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
                        padding: 24,
                        overflowY: "auto",
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

                    {/* Close button - sticky container to keep visible during scroll */}
                    <div style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                        background: "hsl(var(--background))",
                        paddingTop: 0,
                        paddingBottom: 8,
                        display: "flex",
                        justifyContent: "flex-end",
                        marginBottom: 8,
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

                    {/* Drawer content */}
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

                            {/* Overview section */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Overview
                                </h3>
                                <p style={{
                                    fontSize: 14,
                                    color: "hsl(var(--muted-foreground))",
                                    margin: 0,
                                    lineHeight: 1.5,
                                }}>
                                    Placeholder: Component overview and description will appear here. This would include details about the component's purpose, usage guidelines, and any relevant design system documentation.
                                </p>
                            </div>

                            {/* Captures section (7.4.3: real data) */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={drawerSectionTitleStyle}>
                                    Captures ({selectedComponent.capturesCount})
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
                                        No captures found.
                                    </div>
                                ) : (
                                    <div style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                    }}>
                                        {componentCaptures.map((capture) => (
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
                                                    {capture.sourceLabel}
                                                </div>
                                                <div style={{
                                                    color: "hsl(var(--muted-foreground))",
                                                    fontSize: 12,
                                                    fontFamily: "monospace",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}>
                                                    {capture.url}
                                                </div>
                                            </div>
                                        ))}
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
                                                    padding: "8px 12px",
                                                    background: "hsl(var(--muted))",
                                                    borderRadius: "calc(var(--radius) - 2px)",
                                                    fontSize: 13,
                                                }}
                                            >
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
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
