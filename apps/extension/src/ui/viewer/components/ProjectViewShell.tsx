import { useEffect, useState, useMemo } from "react";
import { DetailsDrawer } from "./DetailsDrawer";
import { FilterPopover } from "./FilterPopover";
import { CheckboxList } from "./CheckboxList";
import { VisiblePropertiesPopover } from "./VisiblePropertiesPopover";
import { MOCK_COMPONENTS, MOCK_STYLES } from "../mock/projectMockData";

// ─────────────────────────────────────────────────────────────
// ProjectViewShell Component
// ─────────────────────────────────────────────────────────────

export function ProjectViewShell({
    projectName,
    onBack,
}: {
    projectName: string;
    onBack: () => void;
}) {
    const [activeTab, setActiveTab] = useState<"components" | "styles">("components");
    const [activeView, setActiveView] = useState<"grid" | "table">("grid");
    const [unknownOnly, setUnknownOnly] = useState(false);

    // Drawer state (IA-only)
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
    const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);

    // Unified menu/popover state (IA-only)
    const [openMenu, setOpenMenu] = useState<null | "category" | "type" | "status" | "source" | "kind" | "style-source" | "properties">(null);

    // Visible properties state: split per tab
    const [visibleComponentProps, setVisibleComponentProps] = useState({
        name: true,
        category: true,
        type: true,
        status: true,
        source: true,
        captures: true,
    });
    const [visibleStyleProps, setVisibleStyleProps] = useState({
        token: true,
        kind: true,
        source: true,
        uses: true,
    });

    // Filter state
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
    const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
    const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
    const [selectedKinds, setSelectedKinds] = useState<Set<string>>(new Set());
    const [selectedStyleSources, setSelectedStyleSources] = useState<Set<string>>(new Set());

    // Search state
    const [searchQuery, setSearchQuery] = useState("");

    // Derive available filter options from datasets (stable deps)
    const uniqueCategories = useMemo(() =>
        Array.from(new Set(MOCK_COMPONENTS.map(c => c.category))).sort(),
        []
    );
    const uniqueTypes = useMemo(() =>
        Array.from(new Set(MOCK_COMPONENTS.map(c => c.type))).sort(),
        []
    );
    const uniqueStatuses = useMemo(() =>
        Array.from(new Set(MOCK_COMPONENTS.map(c => c.status))).sort(),
        []
    );
    const uniqueSources = useMemo(() =>
        Array.from(new Set(MOCK_COMPONENTS.map(c => c.source))).sort(),
        []
    );
    const uniqueKinds = useMemo(() =>
        Array.from(new Set(MOCK_STYLES.map(s => s.kind))).sort(),
        []
    );
    const uniqueStyleSources = useMemo(() =>
        Array.from(new Set(MOCK_STYLES.map(s => s.source))).sort(),
        []
    );

    // Filtered datasets
    const filteredComponents = useMemo(() => {
        let result = MOCK_COMPONENTS;

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
        if (unknownOnly) {
            result = result.filter(c => c.status === "Unknown");
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(query) ||
                c.category.toLowerCase().includes(query) ||
                c.type.toLowerCase().includes(query) ||
                c.status.toLowerCase().includes(query) ||
                c.source.toLowerCase().includes(query)
            );
        }

        return result;
    }, [selectedCategories, selectedTypes, selectedStatuses, selectedSources, unknownOnly, searchQuery]);

    const filteredStyles = useMemo(() => {
        let result = MOCK_STYLES;

        // Apply kind filter
        if (selectedKinds.size > 0) {
            result = result.filter(s => selectedKinds.has(s.kind));
        }

        // Apply source filter
        if (selectedStyleSources.size > 0) {
            result = result.filter(s => selectedStyleSources.has(s.source));
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.token.toLowerCase().includes(query) ||
                s.value.toLowerCase().includes(query) ||
                s.kind.toLowerCase().includes(query) ||
                s.source.toLowerCase().includes(query)
            );
        }

        return result;
    }, [selectedKinds, selectedStyleSources, searchQuery]);

    const hasComponents = filteredComponents.length > 0;
    const hasStyles = filteredStyles.length > 0;

    // Selected item lookup (IA-only)
    const selectedComponent = selectedComponentId ? MOCK_COMPONENTS.find(c => c.id === selectedComponentId) : null;
    const selectedStyle = selectedStyleId ? MOCK_STYLES.find(s => s.id === selectedStyleId) : null;

    // Click handlers for opening drawer
    const handleComponentClick = (id: string) => {
        setSelectedComponentId(id);
        setSelectedStyleId(null);
        setDrawerOpen(true);
    };

    const handleStyleClick = (id: string) => {
        setSelectedStyleId(id);
        setSelectedComponentId(null);
        setDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setDrawerOpen(false);
        setSelectedComponentId(null);
        setSelectedStyleId(null);
    };

    // Keyboard navigation helper for clickable divs
    const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            action();
        }
    };

    // Close popovers when major UI context changes
    useEffect(() => {
        setOpenMenu(null);
    }, [activeTab]);

    useEffect(() => {
        setOpenMenu(null);
    }, [activeView]);

    useEffect(() => {
        if (drawerOpen) {
            setOpenMenu(null);
        }
    }, [drawerOpen]);

    // Style map for header and toolbar (reduces inline clutter)
    const styles = {
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
            <div style={styles.header}>
                {/* Top row: Back button + Project info on left, Search + Export on right */}
                <div style={styles.topRow}>
                    {/* Left side: Back button + Project info */}
                    <div style={styles.topLeftGroup}>
                        <button type="button" onClick={onBack} style={styles.backButton}>
                            ← Back
                        </button>
                        <div style={styles.projectTitleContainer}>
                            <h1 style={styles.projectTitle}>
                                {projectName}
                            </h1>
                            <div style={styles.projectMeta}>
                                6 captures • 30 unique styles
                            </div>
                        </div>
                    </div>

                    {/* Right side: Search + Export */}
                    <div style={styles.topSearchGroup}>
                        <input
                            type="text"
                            placeholder="Search components and styles"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={styles.searchInput}
                        />
                        <button type="button" style={styles.exportButton}>
                            Export
                        </button>
                    </div>
                </div>

                {/* Second row: Tab selector (Components/Styles) + View toggle (Grid/Table) */}
                <div style={styles.secondRow}>
                    {/* Left: Components/Styles tabs */}
                    <div style={styles.segmentedContainer}>
                        <button
                            type="button"
                            onClick={() => setActiveTab("components")}
                            style={{
                                ...styles.segmentedButtonBase,
                                background: activeTab === "components" ? "hsl(var(--background))" : "transparent",
                                color: activeTab === "components" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                                fontWeight: activeTab === "components" ? 600 : 500,
                            }}
                        >
                            Components
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("styles")}
                            style={{
                                ...styles.segmentedButtonBase,
                                background: activeTab === "styles" ? "hsl(var(--background))" : "transparent",
                                color: activeTab === "styles" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                                fontWeight: activeTab === "styles" ? 600 : 500,
                            }}
                        >
                            Styles
                        </button>
                    </div>

                    {/* Right: Grid/Table view toggle */}
                    <div style={styles.segmentedContainer}>
                        <button
                            type="button"
                            onClick={() => setActiveView("grid")}
                            style={{
                                ...styles.segmentedButtonView,
                                background: activeView === "grid" ? "hsl(var(--background))" : "transparent",
                                color: activeView === "grid" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                                fontWeight: activeView === "grid" ? 600 : 500,
                            }}
                        >
                            Grid
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveView("table")}
                            style={{
                                ...styles.segmentedButtonView,
                                background: activeView === "table" ? "hsl(var(--background))" : "transparent",
                                color: activeView === "table" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                                fontWeight: activeView === "table" ? 600 : 500,
                            }}
                        >
                            Table
                        </button>
                    </div>
                </div>

                {/* Third row: Filters toolbar (visual only) */}
                <div style={styles.filterRow}>
                    <div style={styles.filterGroupLeft}>
                        {/* Components tab filters */}
                        {activeTab === "components" && (
                            <>
                                {/* Category filter */}
                                <FilterPopover
                                    open={openMenu === "category"}
                                    onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "category" : null)}
                                    ariaLabel="Category filter"
                                    trigger={
                                        <button type="button"
                                            style={{
                                                ...styles.filterButton,
                                                ...(openMenu === "category" ? {
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
                            open={openMenu === "type"}
                            onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "type" : null)}
                            ariaLabel="Type filter"
                            trigger={
                                <button type="button"
                                    style={{
                                        ...styles.filterButton,
                                        ...(openMenu === "type" ? {
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
                            open={openMenu === "status"}
                            onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "status" : null)}
                            ariaLabel="Status filter"
                            trigger={
                                <button type="button"
                                    style={{
                                        ...styles.filterButton,
                                        ...(openMenu === "status" ? {
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
                            open={openMenu === "source"}
                            onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "source" : null)}
                            ariaLabel="Source filter"
                            trigger={
                                <button type="button"
                                    style={{
                                        ...styles.filterButton,
                                        ...(openMenu === "source" ? {
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

                                <div style={styles.filterSeparator} />
                                <button
                                    type="button"
                                    onClick={() => setUnknownOnly(!unknownOnly)}
                                    style={{
                                        ...styles.utilityButtonBase,
                                        background: unknownOnly ? "hsl(var(--primary))" : "hsl(var(--background))",
                                        color: unknownOnly ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                                        fontWeight: unknownOnly ? 600 : 500,
                                    }}
                                >
                                    Unknown only
                                </button>
                            </>
                        )}

                        {/* Styles tab filters */}
                        {activeTab === "styles" && (
                            <>
                                {/* Kind filter */}
                                <FilterPopover
                                    open={openMenu === "kind"}
                                    onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "kind" : null)}
                                    ariaLabel="Kind filter"
                                    trigger={
                                        <button type="button"
                                            style={{
                                                ...styles.filterButton,
                                                ...(openMenu === "kind" ? {
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
                                    open={openMenu === "style-source"}
                                    onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "style-source" : null)}
                                    ariaLabel="Style source filter"
                                    trigger={
                                        <button type="button"
                                            style={{
                                                ...styles.filterButton,
                                                ...(openMenu === "style-source" ? {
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
                    <div style={styles.filterSpacer} />
                    <div style={styles.filterGroupRight}>
                        <VisiblePropertiesPopover
                            activeTab={activeTab}
                            visibleComponentProps={visibleComponentProps}
                            visibleStyleProps={visibleStyleProps}
                            setVisibleComponentProps={setVisibleComponentProps}
                            setVisibleStyleProps={setVisibleStyleProps}
                            openMenu={openMenu}
                            setOpenMenu={setOpenMenu}
                            filterButtonStyle={styles.filterButton}
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
                {unknownOnly && (
                    <div style={{
                        fontSize: 12,
                        color: "hsl(var(--muted-foreground))",
                        marginBottom: 12,
                    }}>
                        Filter: Unknown only
                    </div>
                )}

                {/* Empty state: Components */}
                {activeTab === "components" && !hasComponents && (
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
                {activeTab === "styles" && !hasStyles && (
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

                {/* Layout 1: Components / Grid */}
                {activeTab === "components" && hasComponents && activeView === "grid" && (() => {
                    const hasAnyVisible = visibleComponentProps.name || visibleComponentProps.category || visibleComponentProps.type ||
                                        visibleComponentProps.status || visibleComponentProps.source || visibleComponentProps.captures;

                    return (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                            gap: 12,
                        }}>
                            {filteredComponents.map((comp) => {
                                const hasChips = visibleComponentProps.category || visibleComponentProps.type || visibleComponentProps.status;
                                const metaParts: string[] = [];
                                if (visibleComponentProps.captures) metaParts.push(`${comp.capturesCount} captures`);
                                if (visibleComponentProps.source) metaParts.push(comp.source);
                                const hasMeta = metaParts.length > 0;

                                return (
                                    <div
                                        key={comp.id}
                                        onClick={() => handleComponentClick(comp.id)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => handleKeyDown(e, () => handleComponentClick(comp.id))}
                                        aria-label={`Open details for ${comp.name}`}
                                        style={{
                                            border: "1px solid hsl(var(--border))",
                                            background: selectedComponentId === comp.id ? "hsl(var(--muted))" : "hsl(var(--background))",
                                            borderRadius: "var(--radius)",
                                            padding: 12,
                                            cursor: "pointer",
                                            outline: selectedComponentId === comp.id ? "2px solid hsl(var(--border))" : "none",
                                            outlineOffset: 0,
                                        }}
                                    >
                                        {!hasAnyVisible ? (
                                            <div style={{
                                                fontSize: 12,
                                                color: "hsl(var(--muted-foreground))",
                                            }}>
                                                No visible properties selected
                                            </div>
                                        ) : (
                                            <>
                                                {/* Title row */}
                                                {visibleComponentProps.name && (
                                                    <div style={{
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        color: "hsl(var(--foreground))",
                                                        marginBottom: hasChips || hasMeta ? 8 : 0,
                                                    }}>
                                                        {comp.name}
                                                    </div>
                                                )}

                                                {/* Chips row */}
                                                {hasChips && (
                                                    <div style={{
                                                        display: "flex",
                                                        flexWrap: "wrap",
                                                        gap: 4,
                                                        marginBottom: hasMeta ? 8 : 0,
                                                    }}>
                                                        {visibleComponentProps.category && (
                                                            <span style={{
                                                                fontSize: 11,
                                                                padding: "2px 6px",
                                                                background: "hsl(var(--muted))",
                                                                color: "hsl(var(--muted-foreground))",
                                                                borderRadius: "calc(var(--radius) - 2px)",
                                                            }}>
                                                                {comp.category}
                                                            </span>
                                                        )}
                                                        {visibleComponentProps.type && (
                                                            <span style={{
                                                                fontSize: 11,
                                                                padding: "2px 6px",
                                                                background: "hsl(var(--muted))",
                                                                color: "hsl(var(--muted-foreground))",
                                                                borderRadius: "calc(var(--radius) - 2px)",
                                                            }}>
                                                                {comp.type}
                                                            </span>
                                                        )}
                                                        {visibleComponentProps.status && (
                                                            <span style={{
                                                                fontSize: 11,
                                                                padding: "2px 6px",
                                                                background: "hsl(var(--muted))",
                                                                color: comp.status === "Unknown" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))",
                                                                border: comp.status === "Unknown" ? "1px solid hsl(var(--destructive))" : undefined,
                                                                borderRadius: "calc(var(--radius) - 2px)",
                                                            }}>
                                                                {comp.status}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Meta row */}
                                                {hasMeta && (
                                                    <div style={{
                                                        fontSize: 12,
                                                        color: "hsl(var(--muted-foreground))",
                                                    }}>
                                                        {metaParts.join(" • ")}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}

                {/* Layout 2: Components / Table */}
                {activeTab === "components" && hasComponents && activeView === "table" && (() => {
                    // Column definitions for Components table
                    const componentColumns = [
                        {
                            key: "name",
                            label: "Name",
                            visible: visibleComponentProps.name,
                            width: "2fr",
                            render: (comp: typeof MOCK_COMPONENTS[0]) => (
                                <span style={{ fontWeight: 500 }}>{comp.name}</span>
                            ),
                        },
                        {
                            key: "category",
                            label: "Category",
                            visible: visibleComponentProps.category,
                            width: "1fr",
                            render: (comp: typeof MOCK_COMPONENTS[0]) => (
                                <span style={{ color: "hsl(var(--muted-foreground))" }}>{comp.category}</span>
                            ),
                        },
                        {
                            key: "type",
                            label: "Type",
                            visible: visibleComponentProps.type,
                            width: "80px",
                            render: (comp: typeof MOCK_COMPONENTS[0]) => (
                                <span style={{
                                    fontFamily: "monospace",
                                    fontSize: 12,
                                    color: "hsl(var(--muted-foreground))",
                                }}>
                                    {comp.type}
                                </span>
                            ),
                        },
                        {
                            key: "status",
                            label: "Status",
                            visible: visibleComponentProps.status,
                            width: "100px",
                            render: (comp: typeof MOCK_COMPONENTS[0]) => (
                                <span style={{
                                    fontSize: 11,
                                    padding: "2px 6px",
                                    background: "hsl(var(--muted))",
                                    color: comp.status === "Unknown" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))",
                                    border: comp.status === "Unknown" ? "1px solid hsl(var(--destructive))" : undefined,
                                    borderRadius: "calc(var(--radius) - 2px)",
                                }}>
                                    {comp.status}
                                </span>
                            ),
                        },
                        {
                            key: "source",
                            label: "Source",
                            visible: visibleComponentProps.source,
                            width: "1fr",
                            render: (comp: typeof MOCK_COMPONENTS[0]) => (
                                <span style={{ color: "hsl(var(--muted-foreground))" }}>{comp.source}</span>
                            ),
                        },
                        {
                            key: "captures",
                            label: "Captures",
                            visible: visibleComponentProps.captures,
                            width: "80px",
                            render: (comp: typeof MOCK_COMPONENTS[0]) => (
                                <span style={{ color: "hsl(var(--muted-foreground))" }}>{comp.capturesCount}</span>
                            ),
                        },
                    ];

                    const visibleComponentColumns = componentColumns.filter(c => c.visible);

                    // Compute grid template columns based on visible columns
                    const gridTemplateColumns = visibleComponentColumns.map(col => col.width ?? "1fr").join(" ");

                    return (
                        <div style={{
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                            overflow: "hidden",
                            background: "hsl(var(--background))",
                        }}>
                            {visibleComponentColumns.length === 0 ? (
                                // Empty state when no columns selected
                                <div style={{
                                    padding: 48,
                                    textAlign: "center",
                                }}>
                                    <div style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "hsl(var(--foreground))",
                                        marginBottom: 8,
                                    }}>
                                        No columns selected
                                    </div>
                                    <div style={{
                                        fontSize: 13,
                                        color: "hsl(var(--muted-foreground))",
                                    }}>
                                        Use Visible properties to choose which columns to show.
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Header row */}
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns,
                                        gap: 12,
                                        padding: "8px 12px",
                                        borderBottom: "1px solid hsl(var(--border))",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "hsl(var(--muted-foreground))",
                                    }}>
                                        {visibleComponentColumns.map((col) => (
                                            <div key={col.key}>{col.label}</div>
                                        ))}
                                    </div>
                                    {/* Data rows */}
                                    {filteredComponents.map((comp, idx) => (
                                        <div
                                            key={comp.id}
                                            onClick={() => handleComponentClick(comp.id)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => handleKeyDown(e, () => handleComponentClick(comp.id))}
                                            aria-label={`Open details for ${comp.name}`}
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns,
                                                gap: 12,
                                                padding: "12px",
                                                borderBottom: idx === filteredComponents.length - 1 ? "none" : "1px solid hsl(var(--border))",
                                                fontSize: 14,
                                                color: "hsl(var(--foreground))",
                                                background: selectedComponentId === comp.id ? "hsl(var(--muted))" : "transparent",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {visibleComponentColumns.map((col) => (
                                                <div key={col.key}>{col.render(comp)}</div>
                                            ))}
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    );
                })()}

                {/* Layout 3: Styles / Grid */}
                {activeTab === "styles" && hasStyles && activeView === "grid" && (() => {
                    const hasAnyVisible = visibleStyleProps.token || visibleStyleProps.kind || visibleStyleProps.source || visibleStyleProps.uses;

                    return (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                            gap: 12,
                        }}>
                            {filteredStyles.map((style) => {
                                const hasKindChip = visibleStyleProps.kind;
                                const metaParts: string[] = [];
                                if (visibleStyleProps.uses) metaParts.push(`${style.usageCount} uses`);
                                if (visibleStyleProps.source) metaParts.push(style.source);
                                const hasMeta = metaParts.length > 0;

                                return (
                                    <div
                                        key={style.id}
                                        onClick={() => handleStyleClick(style.id)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => handleKeyDown(e, () => handleStyleClick(style.id))}
                                        aria-label={`Open details for ${style.token}`}
                                        style={{
                                            border: "1px solid hsl(var(--border))",
                                            background: selectedStyleId === style.id ? "hsl(var(--muted))" : "hsl(var(--background))",
                                            borderRadius: "var(--radius)",
                                            padding: 12,
                                            cursor: "pointer",
                                            outline: selectedStyleId === style.id ? "2px solid hsl(var(--border))" : "none",
                                            outlineOffset: 0,
                                        }}
                                    >
                                        {!hasAnyVisible ? (
                                            <div style={{
                                                fontSize: 12,
                                                color: "hsl(var(--muted-foreground))",
                                            }}>
                                                No visible properties selected
                                            </div>
                                        ) : (
                                            <>
                                                {/* Token (name) */}
                                                {visibleStyleProps.token && (
                                                    <div style={{
                                                        fontSize: 13,
                                                        fontFamily: "monospace",
                                                        fontWeight: 600,
                                                        color: "hsl(var(--foreground))",
                                                        marginBottom: 6,
                                                    }}>
                                                        {style.token}
                                                    </div>
                                                )}

                                                {/* Value (always shown for context, not controlled by visibleStyleProps) */}
                                                <div style={{
                                                    fontSize: 14,
                                                    fontFamily: "monospace",
                                                    color: "hsl(var(--muted-foreground))",
                                                    marginBottom: hasKindChip || hasMeta ? 8 : 0,
                                                    padding: "4px 6px",
                                                    background: "hsl(var(--muted))",
                                                    borderRadius: "calc(var(--radius) - 2px)",
                                                }}>
                                                    {style.value}
                                                </div>

                                                {/* Kind chip + meta row */}
                                                {(hasKindChip || hasMeta) && (
                                                    <div style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        fontSize: 12,
                                                        color: "hsl(var(--muted-foreground))",
                                                    }}>
                                                        {visibleStyleProps.kind && (
                                                            <span style={{
                                                                fontSize: 11,
                                                                padding: "2px 6px",
                                                                background: "hsl(var(--muted))",
                                                                borderRadius: "calc(var(--radius) - 2px)",
                                                            }}>
                                                                {style.kind}
                                                            </span>
                                                        )}
                                                        {hasMeta && <span>{metaParts.join(" • ")}</span>}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}

                {/* Layout 4: Styles / Table */}
                {activeTab === "styles" && hasStyles && activeView === "table" && (() => {
                    // Column definitions for Styles table (only toggles that apply)
                    const styleColumns = [
                        {
                            key: "token",
                            label: "Token",
                            visible: visibleStyleProps.token,
                            width: "2fr",
                            render: (style: typeof MOCK_STYLES[0]) => (
                                <span style={{
                                    fontFamily: "monospace",
                                    fontSize: 13,
                                    fontWeight: 500,
                                }}>{style.token}</span>
                            ),
                        },
                        {
                            key: "kind",
                            label: "Kind",
                            visible: visibleStyleProps.kind,
                            width: "1fr",
                            render: (style: typeof MOCK_STYLES[0]) => (
                                <span style={{
                                    fontSize: 11,
                                    padding: "2px 6px",
                                    background: "hsl(var(--muted))",
                                    color: "hsl(var(--muted-foreground))",
                                    borderRadius: "calc(var(--radius) - 2px)",
                                }}>{style.kind}</span>
                            ),
                        },
                        {
                            key: "source",
                            label: "Source",
                            visible: visibleStyleProps.source,
                            width: "1fr",
                            render: (style: typeof MOCK_STYLES[0]) => (
                                <span style={{ color: "hsl(var(--muted-foreground))" }}>{style.source}</span>
                            ),
                        },
                        {
                            key: "uses",
                            label: "Uses",
                            visible: visibleStyleProps.uses,
                            width: "80px",
                            render: (style: typeof MOCK_STYLES[0]) => (
                                <span style={{ color: "hsl(var(--muted-foreground))" }}>{style.usageCount}</span>
                            ),
                        },
                    ];

                    const visibleStyleColumns = styleColumns.filter(c => c.visible);
                    const gridTemplateColumns = visibleStyleColumns.map(col => col.width ?? "1fr").join(" ");

                    return (
                        <div style={{
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                            overflow: "hidden",
                            background: "hsl(var(--background))",
                        }}>
                            {visibleStyleColumns.length === 0 ? (
                                <div style={{
                                    padding: 24,
                                    textAlign: "center",
                                }}>
                                    <div style={{
                                        fontSize: 14,
                                        fontWeight: 500,
                                        color: "hsl(var(--foreground))",
                                        marginBottom: 4,
                                    }}>
                                        No columns selected
                                    </div>
                                    <div style={{
                                        fontSize: 13,
                                        color: "hsl(var(--muted-foreground))",
                                    }}>
                                        Use Visible properties to choose which columns to show.
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Header row */}
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns,
                                        gap: 12,
                                        padding: "8px 12px",
                                        borderBottom: "1px solid hsl(var(--border))",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "hsl(var(--muted-foreground))",
                                    }}>
                                        {visibleStyleColumns.map(col => (
                                            <div key={col.key}>{col.label}</div>
                                        ))}
                                    </div>

                                    {/* Data rows */}
                                    {filteredStyles.map((style, idx) => (
                                        <div
                                            key={style.id}
                                            onClick={() => handleStyleClick(style.id)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => handleKeyDown(e, () => handleStyleClick(style.id))}
                                            aria-label={`Open details for ${style.token}`}
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns,
                                                gap: 12,
                                                padding: "12px",
                                                borderBottom: idx === filteredStyles.length - 1 ? "none" : "1px solid hsl(var(--border))",
                                                fontSize: 14,
                                                color: "hsl(var(--foreground))",
                                                background: selectedStyleId === style.id ? "hsl(var(--muted))" : "transparent",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {visibleStyleColumns.map(col => (
                                                <div key={col.key}>{col.render(style)}</div>
                                            ))}
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    );
                })()}
            </div>


            {/* Drawer with DetailsDrawer component */}
            <DetailsDrawer
                open={drawerOpen}
                onClose={handleCloseDrawer}
                selectedComponent={selectedComponent || null}
                selectedStyle={selectedStyle || null}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main Viewer Component
// ─────────────────────────────────────────────────────────────

