import { useEffect, useState, useMemo } from "react";
import { DetailsDrawer } from "./DetailsDrawer";
import { FilterPopover } from "./FilterPopover";
import { CheckboxList } from "./CheckboxList";
import { VisiblePropertiesPopover } from "./VisiblePropertiesPopover";
import { ComponentsGrid } from "./ComponentsGrid";
import { ComponentsTable } from "./ComponentsTable";
import { StylesGrid } from "./StylesGrid";
import { StylesTable } from "./StylesTable";
import type { ViewerComponent, ViewerStyle } from "../types/projectViewerTypes";
import type { CaptureRecordV2 } from "../../../types/capture";
import { deriveComponentCaptures, deriveStyleLocations, deriveRelatedComponentsForStyle, deriveVisualEssentialsFromCapture } from "../adapters/deriveViewerModels";

// ─────────────────────────────────────────────────────────────
// DEV-only logging helpers (7.4.5)
// ─────────────────────────────────────────────────────────────

const isDev = import.meta?.env?.DEV ?? false;
const devLog = (...args: unknown[]) => { if (isDev) console.log(...args); };
const devWarn = (...args: unknown[]) => { if (isDev) console.warn(...args); };

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ViewerUiState = {
    route: {
        activeTab: "components" | "styles";
        activeView: "grid" | "table";
    };
    popovers: {
        openMenu: null | "category" | "type" | "status" | "source" | "kind" | "style-source" | "properties";
    };
    filters: {
        searchQuery: string;
        unknownOnly: boolean;
        components: {
            categories: Set<string>;
            types: Set<string>;
            statuses: Set<string>;
            sources: Set<string>;
        };
        styles: {
            kinds: Set<string>;
            sources: Set<string>;
        };
    };
    visibleProps: {
        components: {
            name: boolean;
            category: boolean;
            type: boolean;
            status: boolean;
            source: boolean;
            captures: boolean;
        };
        styles: {
            token: boolean;
            kind: boolean;
            source: boolean;
            uses: boolean;
        };
    };
    drawer: {
        open: boolean;
        selectedComponentId: string | null;
        selectedStyleId: string | null;
    };
};

// ─────────────────────────────────────────────────────────────
// ProjectViewShell Component
// ─────────────────────────────────────────────────────────────

export function ProjectViewShell({
    projectId,
    projectName,
    components,
    componentsLoading,
    componentsError,
    styleItems,
    rawCaptures,
    onBack,
    onAnnotationsChanged,
    onOverridesChanged,
    onDeleted,
}: {
    projectId: string;
    projectName: string;
    components: ViewerComponent[];
    componentsLoading: boolean;
    componentsError: string | null;
    styleItems: ViewerStyle[];
    rawCaptures: CaptureRecordV2[];
    onBack: () => void;
    onAnnotationsChanged: () => void; // 7.7.2: Callback after annotation save
    onOverridesChanged: () => void; // Identity overrides callback
    onDeleted: () => void; // 7.7.2: Callback after capture delete
}) {
    // 7.4.5: Stable project identifier (for effect dependencies)
    const activeProjectKey = projectId;

    // Filter state (NOT moved to ui state - still separate Sets)
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
    const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
    const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
    const [selectedKinds, setSelectedKinds] = useState<Set<string>>(new Set());
    const [selectedStyleSources, setSelectedStyleSources] = useState<Set<string>>(new Set());

    // ─────────────────────────────────────────────────────────────
    // Grouped UI state
    // ─────────────────────────────────────────────────────────────
    const [ui, setUi] = useState<ViewerUiState>({
        route: {
            activeTab: "components",
            activeView: "grid",
        },
        popovers: {
            openMenu: null,
        },
        filters: {
            searchQuery: "",
            unknownOnly: false,
            components: {
                categories: new Set(),
                types: new Set(),
                statuses: new Set(),
                sources: new Set(),
            },
            styles: {
                kinds: new Set(),
                sources: new Set(),
            },
        },
        visibleProps: {
            components: {
                name: true,
                category: true,
                type: true,
                status: true,
                source: true,
                captures: true,
            },
            styles: {
                token: true,
                kind: true,
                source: true,
                uses: true,
            },
        },
        drawer: {
            open: false,
            selectedComponentId: null,
            selectedStyleId: null,
        },
    });

    // Derive available filter options from datasets (7.4.1: use real components)
    const uniqueCategories = useMemo(() =>
        Array.from(new Set(components.map(c => c.category))).sort(),
        [components]
    );
    const uniqueTypes = useMemo(() =>
        Array.from(new Set(components.map(c => c.type))).sort(),
        [components]
    );
    const uniqueStatuses = useMemo(() =>
        Array.from(new Set(components.map(c => c.status))).sort(),
        [components]
    );
    const uniqueSources = useMemo(() =>
        Array.from(new Set(components.map(c => c.source))).sort(),
        [components]
    );
    const uniqueKinds = useMemo(() =>
        Array.from(new Set(styleItems.map(s => s.kind))).sort(),
        [styleItems]
    );
    const uniqueStyleSources = useMemo(() =>
        Array.from(new Set(styleItems.map(s => s.source))).sort(),
        [styleItems]
    );

    // Filtered datasets (7.4.1: use real components)
    const filteredComponents = useMemo(() => {
        let result = components;

        // Apply category filter
        if (selectedCategories.size > 0) {
            result = result.filter(c => selectedCategories.has(c.category));
        }

        // Apply type filter
        if (selectedTypes.size > 0) {
            result = result.filter(c => selectedTypes.has(c.type));
        }

        // Apply status filter
        if (selectedStatuses.size > 0) {
            result = result.filter(c => selectedStatuses.has(c.status));
        }

        // Apply source filter
        if (selectedSources.size > 0) {
            result = result.filter(c => selectedSources.has(c.source));
        }

        // Apply unknownOnly filter (Components tab only)
        if (ui.filters.unknownOnly) {
            result = result.filter(c => c.status === "Unknown");
        }

        // Apply search filter
        if (ui.filters.searchQuery.trim()) {
            const query = ui.filters.searchQuery.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(query) ||
                c.category.toLowerCase().includes(query) ||
                c.type.toLowerCase().includes(query) ||
                c.status.toLowerCase().includes(query) ||
                c.source.toLowerCase().includes(query)
            );
        }

        return result;
    }, [components, selectedCategories, selectedTypes, selectedStatuses, selectedSources, ui.filters.unknownOnly, ui.filters.searchQuery]);

    // Filtered datasets (7.4.2: use real styleItems)
    const filteredStyles = useMemo(() => {
        let result = styleItems;

        // Apply kind filter
        if (selectedKinds.size > 0) {
            result = result.filter(s => selectedKinds.has(s.kind));
        }

        // Apply source filter
        if (selectedStyleSources.size > 0) {
            result = result.filter(s => selectedStyleSources.has(s.source));
        }

        // Apply search filter
        if (ui.filters.searchQuery.trim()) {
            const query = ui.filters.searchQuery.toLowerCase();
            result = result.filter(s =>
                s.token.toLowerCase().includes(query) ||
                s.value.toLowerCase().includes(query) ||
                s.kind.toLowerCase().includes(query) ||
                s.source.toLowerCase().includes(query)
            );
        }

        return result;
    }, [styleItems, selectedKinds, selectedStyleSources, ui.filters.searchQuery]);

    const hasComponents = filteredComponents.length > 0;
    const hasStyles = filteredStyles.length > 0;

    // Selected item lookup (7.4.1+7.4.2: use real data)
    const selectedComponent = ui.drawer.selectedComponentId ? components.find(c => c.id === ui.drawer.selectedComponentId) : null;
    const selectedStyle = ui.drawer.selectedStyleId ? styleItems.find(s => s.id === ui.drawer.selectedStyleId) : null;

    // 7.4.3: Derive drawer data based on selection
    const drawerComponentCaptures = useMemo(() => {
        if (!ui.drawer.selectedComponentId || rawCaptures.length === 0) {
            return [];
        }
        return deriveComponentCaptures(ui.drawer.selectedComponentId, rawCaptures);
    }, [ui.drawer.selectedComponentId, rawCaptures]);

    const drawerStyleLocations = useMemo(() => {
        if (!ui.drawer.selectedStyleId || rawCaptures.length === 0) {
            return [];
        }
        return deriveStyleLocations(ui.drawer.selectedStyleId, rawCaptures, styleItems);
    }, [ui.drawer.selectedStyleId, rawCaptures, styleItems]);

    const drawerRelatedComponents = useMemo(() => {
        if (!ui.drawer.selectedStyleId || rawCaptures.length === 0) {
            return [];
        }
        return deriveRelatedComponentsForStyle(ui.drawer.selectedStyleId, rawCaptures, components, styleItems);
    }, [ui.drawer.selectedStyleId, rawCaptures, components, styleItems]);

    // 7.4.4: Derive visual essentials from representative capture
    const drawerVisualEssentials = useMemo(() => {
        if (!ui.drawer.selectedComponentId || drawerComponentCaptures.length === 0) {
            return deriveVisualEssentialsFromCapture(undefined);
        }
        // Find representative capture: prefer most recent by createdAt
        const representativeCapture = rawCaptures
            .filter((c) => drawerComponentCaptures.some((dc) => dc.id === c.id))
            .sort((a, b) => b.createdAt - a.createdAt)[0];

        return deriveVisualEssentialsFromCapture(representativeCapture);
    }, [ui.drawer.selectedComponentId, drawerComponentCaptures, rawCaptures]);

    const drawerVisualEssentialsEvidence = useMemo(() => {
        if (!ui.drawer.selectedComponentId || drawerComponentCaptures.length === 0) {
            return null;
        }
        const representativeCapture = rawCaptures
            .filter((c) => drawerComponentCaptures.some((dc) => dc.id === c.id))
            .sort((a, b) => b.createdAt - a.createdAt)[0];
        const evidence = (representativeCapture as any)?.styles?.evidence;
        if (!evidence || (evidence.method !== "cdp" && evidence.method !== "computed")) return null;
        return {
            method: evidence.method as "cdp" | "computed",
            cdpError: typeof evidence.cdpError === "string" ? evidence.cdpError : undefined,
        };
    }, [ui.drawer.selectedComponentId, drawerComponentCaptures, rawCaptures]);

    // Click handlers for opening drawer
    const handleComponentClick = (id: string) => {
        setUi(prev => ({
            ...prev,
            drawer: {
                open: true,
                selectedComponentId: id,
                selectedStyleId: null,
            }
        }));
    };

    const handleStyleClick = (id: string) => {
        setUi(prev => ({
            ...prev,
            drawer: {
                open: true,
                selectedComponentId: null,
                selectedStyleId: id,
            }
        }));
    };

    const handleCloseDrawer = () => {
        setUi(prev => ({
            ...prev,
            drawer: {
                open: false,
                selectedComponentId: null,
                selectedStyleId: null,
            }
        }));
    };

    // 7.4.5: Clear drawer selection when project changes
    useEffect(() => {
        setUi(prev => {
            // Only clear if drawer is open or has selected ids
            const needsClearing = prev.drawer.open || prev.drawer.selectedComponentId !== null || prev.drawer.selectedStyleId !== null;

            if (needsClearing) {
                devLog("[UI Inventory Viewer] Cleared drawer selection on project change", {
                    projectId,
                    projectName,
                    hadOpenDrawer: prev.drawer.open,
                    clearedComponentId: prev.drawer.selectedComponentId || undefined,
                    clearedStyleId: prev.drawer.selectedStyleId || undefined,
                });

                return {
                    ...prev,
                    drawer: {
                        open: false,
                        selectedComponentId: null,
                        selectedStyleId: null,
                    }
                };
            }

            return prev;
        });
    }, [activeProjectKey]);

    // 7.4.5: Stale selection guards (DEV-only warnings in effect)
    useEffect(() => {
        // Warn if selected component ID exists but lookup failed
        if (ui.drawer.selectedComponentId && !selectedComponent) {
            devWarn("[UI Inventory Viewer] Stale component selection (not found in inventory)", {
                projectId,
                projectName,
                selectedComponentId: ui.drawer.selectedComponentId,
                componentsCount: components.length,
            });
        }

        // Warn if selected style ID exists but lookup failed
        if (ui.drawer.selectedStyleId && !selectedStyle) {
            devWarn("[UI Inventory Viewer] Stale style selection (not found in inventory)", {
                projectId,
                projectName,
                selectedStyleId: ui.drawer.selectedStyleId,
                stylesCount: styleItems.length,
            });
        }

        // Warn if drawer is open with no selection
        if (ui.drawer.open && !ui.drawer.selectedComponentId && !ui.drawer.selectedStyleId) {
            devWarn("[UI Inventory Viewer] Drawer open with no selection", {
                projectId,
                projectName,
            });
        }
    }, [
        ui.drawer.selectedComponentId,
        ui.drawer.selectedStyleId,
        ui.drawer.open,
        selectedComponent,
        selectedStyle,
        components.length,
        styleItems.length,
        projectId,
        projectName,
    ]);

    // Close popovers when major UI context changes
    useEffect(() => {
        setUi(prev => ({ ...prev, popovers: { ...prev.popovers, openMenu: null } }));
    }, [ui.route.activeTab]);

    useEffect(() => {
        setUi(prev => ({ ...prev, popovers: { ...prev.popovers, openMenu: null } }));
    }, [ui.route.activeView]);

    useEffect(() => {
        if (ui.drawer.open) {
            setUi(prev => ({ ...prev, popovers: { ...prev.popovers, openMenu: null } }));
        }
    }, [ui.drawer.open]);

    // Style map for header and toolbar (reduces inline clutter)
    const inlineStyles = {
        header: {
            padding: "16px 24px",
            borderBottom: "1px solid hsl(var(--border))",
            background: "hsl(var(--background))",
            position: "sticky",
            top: 0,
            zIndex: 10,
        },
        topRow: {
            display: "flex",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
            rowGap: 12,
        },
        topLeftGroup: {
            display: "flex",
            alignItems: "center",
            gap: 16,
            minWidth: 280,
            flex: "2 1 360px",
        },
        topSearchGroup: {
            display: "flex",
            alignItems: "center",
            gap: 12,
            flex: "3 1 420px",
            minWidth: 260,
            maxWidth: 720,
            width: "100%",
        },
        backButton: {
            padding: "6px 12px",
            fontSize: 14,
            background: "hsl(var(--muted))",
            color: "hsl(var(--foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            cursor: "pointer",
            flexShrink: 0,
        },
        projectTitleContainer: {
            minWidth: 0,
        },
        projectTitle: {
            fontSize: 20,
            fontWeight: 600,
            margin: 0,
            color: "hsl(var(--foreground))",
        },
        projectMeta: {
            fontSize: 13,
            color: "hsl(var(--muted-foreground))",
            marginTop: 2,
        },
        searchInput: {
            padding: "6px 12px",
            fontSize: 14,
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            background: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
            flex: 1,
            minWidth: 180,
        },
        exportButton: {
            padding: "6px 16px",
            fontSize: 14,
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            cursor: "pointer",
            fontWeight: 500,
            flexShrink: 0,
        },
        secondRow: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            rowGap: 12,
            marginTop: 12,
        },
        segmentedContainer: {
            display: "inline-flex",
            padding: 2,
            background: "hsl(var(--muted))",
            borderRadius: "var(--radius)",
            flex: "0 0 auto",
        },
        segmentedButtonBase: {
            padding: "6px 16px",
            fontSize: 14,
            border: "none",
            borderRadius: "calc(var(--radius) - 2px)",
            cursor: "pointer",
        },
        segmentedButtonView: {
            padding: "6px 12px",
            fontSize: 14,
            border: "none",
            borderRadius: "calc(var(--radius) - 2px)",
            cursor: "pointer",
        },
        filterRow: {
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            rowGap: 8,
            marginTop: 12,
        },
        filterGroupLeft: {
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            rowGap: 8,
        },
        filterButton: {
            padding: "4px 10px",
            fontSize: 13,
            background: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            cursor: "pointer",
        },
        filterSeparator: {
            width: 1,
            height: 20,
            background: "hsl(var(--border))",
            margin: "0 4px",
        },
        utilityButtonBase: {
            padding: "4px 10px",
            fontSize: 13,
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            cursor: "pointer",
        },
        filterSpacer: {
            flex: 1,
        },
        filterGroupRight: {
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            rowGap: 8,
        },
    } satisfies Record<string, React.CSSProperties>;

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Header */}
            <div style={inlineStyles.header}>
                {/* Top row: Back button + Project info on left, Search + Export on right */}
                <div style={inlineStyles.topRow}>
                    {/* Left side: Back button + Project info */}
                    <div style={inlineStyles.topLeftGroup}>
                        <button type="button" onClick={onBack} style={inlineStyles.backButton}>
                            ← Back
                        </button>
                        <div style={inlineStyles.projectTitleContainer}>
                            <h1 style={inlineStyles.projectTitle}>
                                {projectName}
                            </h1>
                            <div style={inlineStyles.projectMeta}>
                                6 captures • 30 unique styles
                            </div>
                        </div>
                    </div>

                    {/* Right side: Search + Export */}
                    <div style={inlineStyles.topSearchGroup}>
                        <input
                            type="text"
                            placeholder="Search components and styles"
                            value={ui.filters.searchQuery}
                            onChange={(e) => setUi(prev => ({ ...prev, filters: { ...prev.filters, searchQuery: e.target.value } }))}
                            style={inlineStyles.searchInput}
                        />
                        <button type="button" style={inlineStyles.exportButton}>
                            Export
                        </button>
                    </div>
                </div>

                {/* Second row: Tab selector (Components/Styles) + View toggle (Grid/Table) */}
                <div style={inlineStyles.secondRow}>
                    {/* Left: Components/Styles tabs */}
                    <div style={inlineStyles.segmentedContainer}>
                        <button
                            type="button"
                            onClick={() => setUi(prev => ({ ...prev, route: { ...prev.route, activeTab: "components" } }))}
                            style={{
                                ...inlineStyles.segmentedButtonBase,
                                background: ui.route.activeTab === "components" ? "hsl(var(--background))" : "transparent",
                                color: ui.route.activeTab === "components" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                                fontWeight: ui.route.activeTab === "components" ? 600 : 500,
                            }}
                        >
                            Components
                        </button>
                        <button
                            type="button"
                            onClick={() => setUi(prev => ({ ...prev, route: { ...prev.route, activeTab: "styles" } }))}
                            style={{
                                ...inlineStyles.segmentedButtonBase,
                                background: ui.route.activeTab === "styles" ? "hsl(var(--background))" : "transparent",
                                color: ui.route.activeTab === "styles" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                                fontWeight: ui.route.activeTab === "styles" ? 600 : 500,
                            }}
                        >
                            Styles
                        </button>
                    </div>

                    {/* Right: Grid/Table view toggle */}
                    <div style={inlineStyles.segmentedContainer}>
                        <button
                            type="button"
                            onClick={() => setUi(prev => ({ ...prev, route: { ...prev.route, activeView: "grid" } }))}
                            style={{
                                ...inlineStyles.segmentedButtonView,
                                background: ui.route.activeView === "grid" ? "hsl(var(--background))" : "transparent",
                                color: ui.route.activeView === "grid" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                                fontWeight: ui.route.activeView === "grid" ? 600 : 500,
                            }}
                        >
                            Grid
                        </button>
                        <button
                            type="button"
                            onClick={() => setUi(prev => ({ ...prev, route: { ...prev.route, activeView: "table" } }))}
                            style={{
                                ...inlineStyles.segmentedButtonView,
                                background: ui.route.activeView === "table" ? "hsl(var(--background))" : "transparent",
                                color: ui.route.activeView === "table" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                                fontWeight: ui.route.activeView === "table" ? 600 : 500,
                            }}
                        >
                            Table
                        </button>
                    </div>
                </div>

                {/* Third row: Filters toolbar (visual only) */}
                <div style={inlineStyles.filterRow}>
                    <div style={inlineStyles.filterGroupLeft}>
                        {/* Components tab filters */}
                        {ui.route.activeTab === "components" && (
                            <>
                                {/* Category filter */}
                                <FilterPopover
                                    open={ui.popovers.openMenu === "category"}
                                    onOpenChange={(nextOpen) => setUi(prev => ({ ...prev, popovers: { ...prev.popovers, openMenu: nextOpen ? "category" : null } }))}
                                    ariaLabel="Category filter"
                                    trigger={
                                        <button type="button"
                                            style={{
                                                ...inlineStyles.filterButton,
                                                ...(ui.popovers.openMenu === "category" ? {
                                                    background: "hsl(var(--muted))",
                                                    fontWeight: 600,
                                                } : {}),
                                            }}
                                        >
                                            Category ▾
                                        </button>
                                    }
                                >
                                    <CheckboxList
                                        title="Category"
                                        options={uniqueCategories}
                                        selected={selectedCategories}
                                        onChange={setSelectedCategories}
                                    />
                                </FilterPopover>

                        {/* Type filter */}
                        <FilterPopover
                            open={ui.popovers.openMenu === "type"}
                            onOpenChange={(nextOpen) => setUi(prev => ({ ...prev, popovers: { ...prev.popovers, openMenu: nextOpen ? "type" : null } }))}
                            ariaLabel="Type filter"
                            trigger={
                                <button type="button"
                                    style={{
                                        ...inlineStyles.filterButton,
                                        ...(ui.popovers.openMenu === "type" ? {
                                            background: "hsl(var(--muted))",
                                            fontWeight: 600,
                                        } : {}),
                                    }}
                                >
                                    Type ▾
                                </button>
                            }
                        >
                            <CheckboxList
                                title="Type"
                                options={uniqueTypes}
                                selected={selectedTypes}
                                onChange={setSelectedTypes}
                            />
                        </FilterPopover>

                        {/* Status filter */}
                        <FilterPopover
                            open={ui.popovers.openMenu === "status"}
                            onOpenChange={(nextOpen) => setUi(prev => ({ ...prev, popovers: { ...prev.popovers, openMenu: nextOpen ? "status" : null } }))}
                            ariaLabel="Status filter"
                            trigger={
                                <button type="button"
                                    style={{
                                        ...inlineStyles.filterButton,
                                        ...(ui.popovers.openMenu === "status" ? {
                                            background: "hsl(var(--muted))",
                                            fontWeight: 600,
                                        } : {}),
                                    }}
                                >
                                    Status ▾
                                </button>
                            }
                        >
                            <CheckboxList
                                title="Status"
                                options={uniqueStatuses}
                                selected={selectedStatuses}
                                onChange={setSelectedStatuses}
                            />
                        </FilterPopover>

                        {/* Source filter */}
                        <FilterPopover
                            open={ui.popovers.openMenu === "source"}
                            onOpenChange={(nextOpen) => setUi(prev => ({ ...prev, popovers: { ...prev.popovers, openMenu: nextOpen ? "source" : null } }))}
                            ariaLabel="Source filter"
                            trigger={
                                <button type="button"
                                    style={{
                                        ...inlineStyles.filterButton,
                                        ...(ui.popovers.openMenu === "source" ? {
                                            background: "hsl(var(--muted))",
                                            fontWeight: 600,
                                        } : {}),
                                    }}
                                >
                                    Source ▾
                                </button>
                            }
                        >
                            <CheckboxList
                                title="Source"
                                options={uniqueSources}
                                selected={selectedSources}
                                onChange={setSelectedSources}
                            />
                        </FilterPopover>

                                <div style={inlineStyles.filterSeparator} />
                                <button
                                    type="button"
                                    onClick={() => setUi(prev => ({ ...prev, filters: { ...prev.filters, unknownOnly: !prev.filters.unknownOnly } }))}
                                    style={{
                                        ...inlineStyles.utilityButtonBase,
                                        background: ui.filters.unknownOnly ? "hsl(var(--primary))" : "hsl(var(--background))",
                                        color: ui.filters.unknownOnly ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                                        fontWeight: ui.filters.unknownOnly ? 600 : 500,
                                    }}
                                >
                                    Unknown only
                                </button>
                            </>
                        )}

                        {/* Styles tab filters */}
                        {ui.route.activeTab === "styles" && (
                            <>
                                {/* Kind filter */}
                                <FilterPopover
                                    open={ui.popovers.openMenu === "kind"}
                                    onOpenChange={(nextOpen) => setUi(prev => ({ ...prev, popovers: { ...prev.popovers, openMenu: nextOpen ? "kind" : null } }))}
                                    ariaLabel="Kind filter"
                                    trigger={
                                        <button type="button"
                                            style={{
                                                ...inlineStyles.filterButton,
                                                ...(ui.popovers.openMenu === "kind" ? {
                                                    background: "hsl(var(--muted))",
                                                    fontWeight: 600,
                                                } : {}),
                                            }}
                                        >
                                            Kind ▾
                                        </button>
                                    }
                                >
                                    <CheckboxList
                                        title="Kind"
                                        options={uniqueKinds}
                                        selected={selectedKinds}
                                        onChange={setSelectedKinds}
                                    />
                                </FilterPopover>

                                {/* Source filter for Styles tab */}
                                <FilterPopover
                                    open={ui.popovers.openMenu === "style-source"}
                                    onOpenChange={(nextOpen) => setUi(prev => ({ ...prev, popovers: { ...prev.popovers, openMenu: nextOpen ? "style-source" : null } }))}
                                    ariaLabel="Style source filter"
                                    trigger={
                                        <button type="button"
                                            style={{
                                                ...inlineStyles.filterButton,
                                                ...(ui.popovers.openMenu === "style-source" ? {
                                                    background: "hsl(var(--muted))",
                                                    fontWeight: 600,
                                                } : {}),
                                            }}
                                        >
                                            Source ▾
                                        </button>
                                    }
                                >
                                    <CheckboxList
                                        title="Source"
                                        options={uniqueStyleSources}
                                        selected={selectedStyleSources}
                                        onChange={setSelectedStyleSources}
                                    />
                                </FilterPopover>
                            </>
                        )}
                    </div>
                    <div style={inlineStyles.filterSpacer} />
                    <div style={inlineStyles.filterGroupRight}>
                        <VisiblePropertiesPopover
                            activeTab={ui.route.activeTab}
                            visibleComponentProps={ui.visibleProps.components}
                            visibleStyleProps={ui.visibleProps.styles}
                            setVisibleComponentProps={(value) => setUi(prev => ({
                                ...prev,
                                visibleProps: {
                                    ...prev.visibleProps,
                                    components: typeof value === 'function' ? value(prev.visibleProps.components) : value
                                }
                            }))}
                            setVisibleStyleProps={(value) => setUi(prev => ({
                                ...prev,
                                visibleProps: {
                                    ...prev.visibleProps,
                                    styles: typeof value === 'function' ? value(prev.visibleProps.styles) : value
                                }
                            }))}
                            openMenu={ui.popovers.openMenu}
                            setOpenMenu={(menu) => setUi(prev => ({ ...prev, popovers: { ...prev.popovers, openMenu: menu } }))}
                            filterButtonStyle={inlineStyles.filterButton}
                        />
                    </div>
                </div>
            </div>

            {/* Body: Four distinct placeholder layouts based on activeTab/activeView */}
            <div style={{
                flex: 1,
                padding: 24,
                overflowY: "auto",
            }}>
                {/* unknownOnly filter indicator */}
                {ui.filters.unknownOnly && (
                    <div style={{
                        fontSize: 12,
                        color: "hsl(var(--muted-foreground))",
                        marginBottom: 12,
                    }}>
                        Filter: Unknown only
                    </div>
                )}

                {/* Empty state: Components */}
                {ui.route.activeTab === "components" && !hasComponents && (
                    <div style={{
                        border: "1px dashed hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        padding: 16,
                        background: "hsl(var(--background))",
                        textAlign: "center",
                    }}>
                        <div style={{
                            fontWeight: 600,
                            color: "hsl(var(--foreground))",
                            marginBottom: 4,
                        }}>
                            No components captured yet
                        </div>
                        <div style={{
                            fontSize: 13,
                            color: "hsl(var(--muted-foreground))",
                        }}>
                            Capture UI elements in the sidepanel to see them here.
                        </div>
                    </div>
                )}

                {/* Empty state: Styles */}
                {ui.route.activeTab === "styles" && !hasStyles && (
                    <div style={{
                        border: "1px dashed hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        padding: 16,
                        background: "hsl(var(--background))",
                        textAlign: "center",
                    }}>
                        <div style={{
                            fontWeight: 600,
                            color: "hsl(var(--foreground))",
                            marginBottom: 4,
                        }}>
                            No styles captured yet
                        </div>
                        <div style={{
                            fontSize: 13,
                            color: "hsl(var(--muted-foreground))",
                        }}>
                            Captured styles will appear here once available.
                        </div>
                    </div>
                )}

                {/* Components Loading State (7.4.1) */}
                {ui.route.activeTab === "components" && componentsLoading && (
                    <div style={{
                        padding: "3rem",
                        textAlign: "center",
                        color: "hsl(var(--muted-foreground))",
                    }}>
                        Loading components...
                    </div>
                )}

                {/* Components Error State (7.4.1) */}
                {ui.route.activeTab === "components" && !componentsLoading && componentsError && (
                    <div style={{
                        padding: "3rem",
                        textAlign: "center",
                    }}>
                        <div style={{ color: "hsl(var(--destructive))", marginBottom: "0.5rem" }}>
                            Failed to load components
                        </div>
                        <div style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.875rem" }}>
                            {componentsError}
                        </div>
                    </div>
                )}

                {/* Components Empty State (7.4.1) */}
                {ui.route.activeTab === "components" && !componentsLoading && !componentsError && !hasComponents && (
                    <div style={{
                        padding: "3rem",
                        textAlign: "center",
                        color: "hsl(var(--muted-foreground))",
                    }}>
                        No components found. Capture some UI elements to get started.
                    </div>
                )}

                {/* Layout 1: Components / Grid */}
                {ui.route.activeTab === "components" && !componentsLoading && !componentsError && hasComponents && ui.route.activeView === "grid" && (
                    <ComponentsGrid
                        items={filteredComponents}
                        visibleProps={ui.visibleProps.components}
                        selectedId={ui.drawer.selectedComponentId}
                        onSelect={handleComponentClick}
                    />
                )}

                {/* Layout 2: Components / Table */}
                {ui.route.activeTab === "components" && !componentsLoading && !componentsError && hasComponents && ui.route.activeView === "table" && (
                    <ComponentsTable
                        items={filteredComponents}
                        visibleProps={ui.visibleProps.components}
                        selectedId={ui.drawer.selectedComponentId}
                        onSelect={handleComponentClick}
                    />
                )}

                {/* Styles Loading State (7.4.2 - reuses component loading state) */}
                {ui.route.activeTab === "styles" && componentsLoading && (
                    <div style={{
                        padding: "3rem",
                        textAlign: "center",
                        color: "hsl(var(--muted-foreground))",
                    }}>
                        Loading styles...
                    </div>
                )}

                {/* Styles Error State (7.4.2 - reuses component error state) */}
                {ui.route.activeTab === "styles" && !componentsLoading && componentsError && (
                    <div style={{
                        padding: "3rem",
                        textAlign: "center",
                    }}>
                        <div style={{ color: "hsl(var(--destructive))", marginBottom: "0.5rem" }}>
                            Failed to load styles
                        </div>
                        <div style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.875rem" }}>
                            {componentsError}
                        </div>
                    </div>
                )}

                {/* Styles Empty State (7.4.2) */}
                {ui.route.activeTab === "styles" && !componentsLoading && !componentsError && !hasStyles && (
                    <div style={{
                        padding: "3rem",
                        textAlign: "center",
                        color: "hsl(var(--muted-foreground))",
                    }}>
                        No styles found. Capture some UI elements to get started.
                    </div>
                )}

                {/* Layout 3: Styles / Grid */}
                {ui.route.activeTab === "styles" && !componentsLoading && !componentsError && hasStyles && ui.route.activeView === "grid" && (
                    <StylesGrid
                        items={filteredStyles}
                        visibleProps={ui.visibleProps.styles}
                        selectedId={ui.drawer.selectedStyleId}
                        onSelect={handleStyleClick}
                    />
                )}

                {/* Layout 4: Styles / Table */}
                {ui.route.activeTab === "styles" && !componentsLoading && !componentsError && hasStyles && ui.route.activeView === "table" && (
                    <StylesTable
                        items={filteredStyles}
                        visibleProps={ui.visibleProps.styles}
                        selectedId={ui.drawer.selectedStyleId}
                        onSelect={handleStyleClick}
                    />
                )}
            </div>


            {/* Drawer with DetailsDrawer component */}
            <DetailsDrawer
                projectId={projectId}
                open={ui.drawer.open}
                onClose={handleCloseDrawer}
                selectedComponent={selectedComponent || null}
                selectedStyle={selectedStyle || null}
                componentCaptures={drawerComponentCaptures}
                styleLocations={drawerStyleLocations}
                relatedComponents={drawerRelatedComponents}
                visualEssentials={drawerVisualEssentials}
                visualEssentialsEvidence={drawerVisualEssentialsEvidence}
                onAnnotationsChanged={onAnnotationsChanged}
                onOverridesChanged={onOverridesChanged}
                onDeleted={onDeleted}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main Viewer Component
// ─────────────────────────────────────────────────────────────

