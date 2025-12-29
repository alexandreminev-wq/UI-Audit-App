// ─────────────────────────────────────────────────────────────
// StylesTable Component
// ─────────────────────────────────────────────────────────────

type StyleItem = {
    id: string;
    token: string;
    value: string;
    kind: string;
    usageCount: number;
    source: string;
};

interface StylesTableProps {
    items: StyleItem[];
    visibleProps: {
        token: boolean;
        kind: boolean;
        source: boolean;
        uses: boolean;
    };
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export function StylesTable({
    items,
    visibleProps,
    selectedId,
    onSelect,
}: StylesTableProps) {
    const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            action();
        }
    };

    // Column definitions for Styles table (only toggles that apply)
    const styleColumns = [
        {
            key: "token",
            label: "Token",
            visible: visibleProps.token,
            width: "2fr",
            render: (style: StyleItem) => (
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
            visible: visibleProps.kind,
            width: "1fr",
            render: (style: StyleItem) => (
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
            visible: visibleProps.source,
            width: "1fr",
            render: (style: StyleItem) => (
                <span style={{ color: "hsl(var(--muted-foreground))" }}>{style.source}</span>
            ),
        },
        {
            key: "uses",
            label: "Uses",
            visible: visibleProps.uses,
            width: "80px",
            render: (style: StyleItem) => (
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
                    {items.map((style, idx) => (
                        <div
                            key={style.id}
                            onClick={() => onSelect(style.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => handleKeyDown(e, () => onSelect(style.id))}
                            aria-label={`Open details for ${style.token}`}
                            style={{
                                display: "grid",
                                gridTemplateColumns,
                                gap: 12,
                                padding: "12px",
                                borderBottom: idx === items.length - 1 ? "none" : "1px solid hsl(var(--border))",
                                fontSize: 14,
                                color: "hsl(var(--foreground))",
                                background: selectedId === style.id ? "hsl(var(--muted))" : "transparent",
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
}
