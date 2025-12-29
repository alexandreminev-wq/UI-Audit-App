// ─────────────────────────────────────────────────────────────
// StylesGrid Component
// ─────────────────────────────────────────────────────────────

type StyleItem = {
    id: string;
    token: string;
    value: string;
    kind: string;
    usageCount: number;
    source: string;
};

interface StylesGridProps {
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

export function StylesGrid({
    items,
    visibleProps,
    selectedId,
    onSelect,
}: StylesGridProps) {
    const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            action();
        }
    };

    const hasAnyVisible = visibleProps.token || visibleProps.kind || visibleProps.source || visibleProps.uses;

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 12,
        }}>
            {items.map((style) => {
                const hasKindChip = visibleProps.kind;
                const metaParts: string[] = [];
                if (visibleProps.uses) metaParts.push(`${style.usageCount} uses`);
                if (visibleProps.source) metaParts.push(style.source);
                const hasMeta = metaParts.length > 0;

                return (
                    <div
                        key={style.id}
                        onClick={() => onSelect(style.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => handleKeyDown(e, () => onSelect(style.id))}
                        aria-label={`Open details for ${style.token}`}
                        style={{
                            border: "1px solid hsl(var(--border))",
                            background: selectedId === style.id ? "hsl(var(--muted))" : "hsl(var(--background))",
                            borderRadius: "var(--radius)",
                            padding: 12,
                            cursor: "pointer",
                            outline: selectedId === style.id ? "2px solid hsl(var(--border))" : "none",
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
                                {visibleProps.token && (
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
                                        {visibleProps.kind && (
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
}
