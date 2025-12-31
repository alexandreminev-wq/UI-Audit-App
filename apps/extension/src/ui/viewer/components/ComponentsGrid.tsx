// ─────────────────────────────────────────────────────────────
// ComponentsGrid Component
// ─────────────────────────────────────────────────────────────

import { useBlobUrl } from "../hooks/useBlobUrl";

type ComponentItem = {
    id: string;
    name: string;
    category: string;
    type: string;
    status: string;
    source: string;
    capturesCount: number;
    thumbnailBlobId?: string;
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

    const statusPill = (status: string): { bg: string; fg: string; border?: string } => {
        const s = (status || "").toLowerCase();
        if (s === "canonical") return { bg: "hsl(var(--success))", fg: "hsl(var(--success-foreground))" };
        if (s === "variant") return { bg: "hsl(var(--primary))", fg: "hsl(var(--primary-foreground))" };
        if (s === "deviation") return { bg: "hsl(var(--warning))", fg: "hsl(var(--warning-foreground))" };
        if (s === "legacy") return { bg: "hsl(var(--muted))", fg: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))" };
        if (s === "experimental") return { bg: "hsl(var(--accent))", fg: "hsl(var(--accent-foreground))" };
        return { bg: "hsl(var(--muted))", fg: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))" };
    };

    const ComponentHero = ({ blobId, alt }: { blobId?: string; alt: string }) => {
        const { url } = useBlobUrl(blobId);
        return (
            <div style={{
                width: "100%",
                aspectRatio: "16 / 10",
                background: "hsl(var(--muted))",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}>
                {url ? (
                    <img
                        src={url}
                        alt={alt}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            objectPosition: "center",
                            display: "block",
                        }}
                    />
                ) : (
                    <div style={{ width: "100%", height: "100%" }} />
                )}
            </div>
        );
    };

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
        }}>
            {items.map((comp) => {
                const hasChips = visibleProps.type || visibleProps.status;
                const metaParts: string[] = [];
                if (visibleProps.captures) metaParts.push(`${comp.capturesCount} captures`);
                if (visibleProps.source) metaParts.push(comp.source);
                const hasMeta = metaParts.length > 0;
                const showStatusPill = comp.status && comp.status !== "Unreviewed";
                const pill = statusPill(comp.status);

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
                            cursor: "pointer",
                            outline: selectedId === comp.id ? "2px solid hsl(var(--border))" : "none",
                            outlineOffset: 0,
                            overflow: "hidden",
                        }}
                    >
                        {!hasAnyVisible ? (
                            <div style={{
                                fontSize: 12,
                                color: "hsl(var(--muted-foreground))",
                                padding: 12,
                            }}>
                                No visible properties selected
                            </div>
                        ) : (
                            <>
                                {/* Hero thumbnail */}
                                <div style={{ position: "relative" }}>
                                    <ComponentHero blobId={comp.thumbnailBlobId} alt={comp.name} />
                                    {visibleProps.status && showStatusPill && (
                                        <div style={{
                                            position: "absolute",
                                            top: 8,
                                            right: 8,
                                            padding: "3px 8px",
                                            borderRadius: "999px",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.03em",
                                            background: pill.bg,
                                            color: pill.fg,
                                            border: pill.border,
                                        }}>
                                            {comp.status}
                                        </div>
                                    )}
                                </div>

                                {/* Body */}
                                <div style={{ padding: 12 }}>
                                    {/* Name + Category */}
                                    {visibleProps.name && (
                                        <div style={{
                                            fontSize: 15,
                                            fontWeight: 650,
                                            color: "hsl(var(--foreground))",
                                            marginBottom: visibleProps.category ? 2 : (hasChips || hasMeta ? 8 : 0),
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}>
                                            {comp.name}
                                        </div>
                                    )}
                                    {visibleProps.category && (
                                        <div style={{
                                            fontSize: 13,
                                            color: "hsl(var(--muted-foreground))",
                                            marginBottom: hasChips || hasMeta ? 10 : 0,
                                        }}>
                                            {comp.category}
                                        </div>
                                    )}

                                    {/* Chips row (Type only; Status is shown as overlay pill) */}
                                    {hasChips && (
                                        <div style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: 6,
                                            marginBottom: hasMeta ? 10 : 0,
                                        }}>
                                            {visibleProps.type && (
                                                <span style={{
                                                    fontSize: 12,
                                                    padding: "4px 10px",
                                                    background: "hsl(var(--muted))",
                                                    color: "hsl(var(--muted-foreground))",
                                                    borderRadius: "999px",
                                                }}>
                                                    {comp.type}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Footer/meta */}
                                    {hasMeta && (
                                        <div style={{
                                            marginTop: 10,
                                            paddingTop: 10,
                                            borderTop: "1px solid hsl(var(--border))",
                                            fontSize: 12,
                                            color: "hsl(var(--muted-foreground))",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}>
                                            {metaParts.join(" • ")}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
