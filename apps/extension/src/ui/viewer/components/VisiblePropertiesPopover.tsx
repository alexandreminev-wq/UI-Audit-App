import * as Popover from "@radix-ui/react-popover";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface VisiblePropertiesPopoverProps {
    activeTab: "components" | "styles";
    visibleComponentProps: {
        description: boolean;
        category: boolean;
        type: boolean;
        source: boolean;
        styleEvidence: boolean;
        styleEvidenceKeys: string[];
    };
    visibleStyleProps: {
        token: boolean;
        kind: boolean;
        source: boolean;
        uses: boolean;
    };
    setVisibleComponentProps: React.Dispatch<React.SetStateAction<typeof visibleComponentProps>>;
    setVisibleStyleProps: React.Dispatch<React.SetStateAction<typeof visibleStyleProps>>;
    openMenu: null | "category" | "type" | "status" | "source" | "kind" | "style-source" | "properties";
    setOpenMenu: (menu: null | "category" | "type" | "status" | "source" | "kind" | "style-source" | "properties") => void;
    filterButtonStyle: React.CSSProperties;
    allStyleEvidenceKeys: readonly string[];
}

// ─────────────────────────────────────────────────────────────
// VisiblePropertiesPopover Component
// ─────────────────────────────────────────────────────────────

export function VisiblePropertiesPopover({
    activeTab,
    visibleComponentProps,
    visibleStyleProps,
    setVisibleComponentProps,
    setVisibleStyleProps,
    openMenu,
    setOpenMenu,
    filterButtonStyle,
    allStyleEvidenceKeys,
}: VisiblePropertiesPopoverProps) {
    const componentsProperties = [
        { key: "description", label: "Description" },
        { key: "category", label: "Category" },
        { key: "type", label: "Type" },
        { key: "source", label: "Source" },
        { key: "styleEvidence", label: "Style evidence" },
    ] as const;

    const stylesProperties = [
        { key: "token", label: "Token" },
        { key: "kind", label: "Kind" },
        { key: "source", label: "Source" },
        { key: "uses", label: "Uses" },
    ] as const;

    const handleStyleKeyToggle = (key: string, checked: boolean) => {
        setVisibleComponentProps(prev => {
            const current = new Set(prev.styleEvidenceKeys);
            if (checked) {
                current.add(key);
            } else {
                current.delete(key);
            }
            return { ...prev, styleEvidenceKeys: Array.from(current) };
        });
    };

    const handleSelectAllStyleKeys = () => {
        setVisibleComponentProps(prev => ({
            ...prev,
            styleEvidenceKeys: Array.from(allStyleEvidenceKeys),
        }));
    };

    const handleClearStyleKeys = () => {
        setVisibleComponentProps(prev => ({
            ...prev,
            styleEvidenceKeys: [],
        }));
    };

    return (
        <Popover.Root
            open={openMenu === "properties"}
            onOpenChange={(nextOpen) => setOpenMenu(nextOpen ? "properties" : null)}
        >
            <Popover.Trigger asChild>
                <button type="button"
                    style={{
                        ...filterButtonStyle,
                        ...(openMenu === "properties" ? {
                            background: "hsl(var(--muted))",
                            fontWeight: 600,
                        } : {}),
                    }}
                >
                    Visible properties
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    sideOffset={8}
                    side="bottom"
                    align="end"
                    collisionPadding={8}
                    onEscapeKeyDown={() => setOpenMenu(null)}
                    aria-label="Visible properties"
                    style={{
                        width: 240,
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        boxShadow: "0 8px 24px hsl(var(--foreground) / 0.08)",
                        padding: 12,
                        zIndex: 100,
                    }}
                >
                    <Popover.Arrow
                        style={{
                            fill: "hsl(var(--border))",
                        }}
                    />
                    <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "hsl(var(--foreground))",
                        marginBottom: 8,
                    }}>
                        Visible properties
                    </div>

                    {/* Tab-aware checkboxes */}
                    {activeTab === "components" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {componentsProperties.map(({ key, label }) => (
                                <label
                                    key={key}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "4px 4px",
                                        cursor: "pointer",
                                        fontSize: 14,
                                        color: "hsl(var(--foreground))",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={visibleComponentProps[key]}
                                        onChange={(e) => setVisibleComponentProps(prev => ({ ...prev, [key]: e.target.checked }))}
                                        style={{ cursor: "pointer" }}
                                    />
                                    {label}
                                </label>
                            ))}

                            {/* Style evidence keys sub-section */}
                            {visibleComponentProps.styleEvidence && (
                                <div style={{
                                    marginTop: 8,
                                    marginLeft: 24,
                                    paddingLeft: 12,
                                    borderLeft: "2px solid hsl(var(--border))",
                                }}>
                                    {/* Controls row */}
                                    <div style={{
                                        display: "flex",
                                        gap: 8,
                                        marginBottom: 8,
                                        fontSize: 12,
                                    }}>
                                        <button
                                            type="button"
                                            onClick={handleSelectAllStyleKeys}
                                            style={{
                                                padding: "2px 8px",
                                                fontSize: 11,
                                                background: "hsl(var(--muted))",
                                                border: "1px solid hsl(var(--border))",
                                                borderRadius: "4px",
                                                cursor: "pointer",
                                                color: "hsl(var(--foreground))",
                                            }}
                                        >
                                            Select all
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleClearStyleKeys}
                                            style={{
                                                padding: "2px 8px",
                                                fontSize: 11,
                                                background: "hsl(var(--muted))",
                                                border: "1px solid hsl(var(--border))",
                                                borderRadius: "4px",
                                                cursor: "pointer",
                                                color: "hsl(var(--foreground))",
                                            }}
                                        >
                                            Clear
                                        </button>
                                    </div>

                                    {/* Individual style key checkboxes */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        {allStyleEvidenceKeys.map((key) => (
                                            <label
                                                key={key}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    padding: "2px 4px",
                                                    cursor: "pointer",
                                                    fontSize: 13,
                                                    color: "hsl(var(--muted-foreground))",
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={visibleComponentProps.styleEvidenceKeys.includes(key)}
                                                    onChange={(e) => handleStyleKeyToggle(key, e.target.checked)}
                                                    style={{ cursor: "pointer" }}
                                                />
                                                {key}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "styles" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {stylesProperties.map(({ key, label }) => (
                                <label
                                    key={key}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "4px 4px",
                                        cursor: "pointer",
                                        fontSize: 14,
                                        color: "hsl(var(--foreground))",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={visibleStyleProps[key]}
                                        onChange={(e) => setVisibleStyleProps(prev => ({ ...prev, [key]: e.target.checked }))}
                                        style={{ cursor: "pointer" }}
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                    )}
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
