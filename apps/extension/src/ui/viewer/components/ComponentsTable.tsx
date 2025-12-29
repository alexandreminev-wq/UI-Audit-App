// ─────────────────────────────────────────────────────────────
// ComponentsTable Component
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

interface ComponentsTableProps {
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

export function ComponentsTable({
    items,
    visibleProps,
    selectedId,
    onSelect,
}: ComponentsTableProps) {
    const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            action();
        }
    };

    // Column definitions for Components table
    const componentColumns = [
        {
            key: "name",
            label: "Name",
            visible: visibleProps.name,
            width: "2fr",
            render: (comp: ComponentItem) => (
                <span style={{ fontWeight: 500 }}>{comp.name}</span>
            ),
        },
        {
            key: "category",
            label: "Category",
            visible: visibleProps.category,
            width: "1fr",
            render: (comp: ComponentItem) => (
                <span style={{ color: "hsl(var(--muted-foreground))" }}>{comp.category}</span>
            ),
        },
        {
            key: "type",
            label: "Type",
            visible: visibleProps.type,
            width: "80px",
            render: (comp: ComponentItem) => (
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
            visible: visibleProps.status,
            width: "100px",
            render: (comp: ComponentItem) => (
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
            visible: visibleProps.source,
            width: "1fr",
            render: (comp: ComponentItem) => (
                <span style={{ color: "hsl(var(--muted-foreground))" }}>{comp.source}</span>
            ),
        },
        {
            key: "captures",
            label: "Captures",
            visible: visibleProps.captures,
            width: "80px",
            render: (comp: ComponentItem) => (
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
                    {items.map((comp, idx) => (
                        <div
                            key={comp.id}
                            onClick={() => onSelect(comp.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => handleKeyDown(e, () => onSelect(comp.id))}
                            aria-label={`Open details for ${comp.name}`}
                            style={{
                                display: "grid",
                                gridTemplateColumns,
                                gap: 12,
                                padding: "12px",
                                borderBottom: idx === items.length - 1 ? "none" : "1px solid hsl(var(--border))",
                                fontSize: 14,
                                color: "hsl(var(--foreground))",
                                background: selectedId === comp.id ? "hsl(var(--muted))" : "transparent",
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
}
