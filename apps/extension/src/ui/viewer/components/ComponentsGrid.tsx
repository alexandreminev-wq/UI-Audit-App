// ─────────────────────────────────────────────────────────────
// ComponentsGrid Component
// ─────────────────────────────────────────────────────────────

type ComponentItem = {
    id: string;
    name: string;
    category: string;
    type: string;
    status: string;
    source: string;
    capturesCount: number;
};

interface ComponentsGridProps {
    items: ComponentItem[];
    visibleProps: {
        name: boolean;
        category: boolean;
        type: boolean;
        status: boolean;
        source: boolean;
        captures: boolean;
    };
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export function ComponentsGrid({
    items,
    visibleProps,
    selectedId,
    onSelect,
}: ComponentsGridProps) {
    const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            action();
        }
    };

    const hasAnyVisible = visibleProps.name || visibleProps.category || visibleProps.type ||
                         visibleProps.status || visibleProps.source || visibleProps.captures;

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
        }}>
            {items.map((comp) => {
                const hasChips = visibleProps.category || visibleProps.type || visibleProps.status;
                const metaParts: string[] = [];
                if (visibleProps.captures) metaParts.push(`${comp.capturesCount} captures`);
                if (visibleProps.source) metaParts.push(comp.source);
                const hasMeta = metaParts.length > 0;

                return (
                    <div
                        key={comp.id}
                        onClick={() => onSelect(comp.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => handleKeyDown(e, () => onSelect(comp.id))}
                        aria-label={`Open details for ${comp.name}`}
                        style={{
                            border: "1px solid hsl(var(--border))",
                            background: selectedId === comp.id ? "hsl(var(--muted))" : "hsl(var(--background))",
                            borderRadius: "var(--radius)",
                            padding: 12,
                            cursor: "pointer",
                            outline: selectedId === comp.id ? "2px solid hsl(var(--border))" : "none",
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
                                {visibleProps.name && (
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
                                        {visibleProps.category && (
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
                                        {visibleProps.type && (
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
                                        {visibleProps.status && (
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
}
