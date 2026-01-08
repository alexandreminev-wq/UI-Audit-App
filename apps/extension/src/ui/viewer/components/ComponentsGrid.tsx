// ─────────────────────────────────────────────────────────────
// ComponentsGrid Component
// ─────────────────────────────────────────────────────────────

import { useBlobUrl } from "../hooks/useBlobUrl";
import { buildComponentSignature, hashSignature } from "../../shared/componentKey";
import type { CaptureRecordV2 } from "../../../types/capture";
import { deriveVisualEssentialsFromPrimitives } from "../utils/visualEssentialsFromPrimitives";
import { StylePropertiesTable, type StylePropertiesSection } from "../../shared/components/StylePropertiesTable";

type ComponentItem = {
    id: string;
    name: string;
    description?: string;
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
        description: boolean;
        category: boolean;
        type: boolean;
        source: boolean;
        styleEvidence: boolean;
        styleEvidenceKeys: string[];
    };
    selectedId: string | null;
    onSelect: (id: string) => void;
    rawCaptures: CaptureRecordV2[];
}

export function ComponentsGrid({
    items,
    visibleProps,
    selectedId,
    onSelect,
    rawCaptures,
}: ComponentsGridProps) {
    const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            action();
        }
    };

    const hasAnyVisible = visibleProps.description || visibleProps.category || visibleProps.type ||
                         visibleProps.source || visibleProps.styleEvidence;

    // Helper: Get representative capture for a component
    const getRepresentativeCapture = (componentId: string): CaptureRecordV2 | undefined => {
        const matchingCaptures: CaptureRecordV2[] = [];

        // Collect all captures for this component
        for (const capture of rawCaptures) {
            const sig = buildComponentSignature(capture);
            const captureKey = hashSignature(sig);
            if (captureKey === componentId) {
                matchingCaptures.push(capture);
            }
        }

        if (matchingCaptures.length === 0) return undefined;

        // Prefer default state captures
        const defaultCaptures = matchingCaptures.filter(c => c.state === "default");
        const candidates = defaultCaptures.length > 0 ? defaultCaptures : matchingCaptures;

        // Prefer captures with richer primitives (spacing, margin, gap)
        const withSpacing = candidates.filter(c => c.styles?.primitives?.spacing);
        if (withSpacing.length > 0) {
            const withMarginOrGap = withSpacing.filter(c =>
                c.styles?.primitives?.margin || c.styles?.primitives?.gap
            );
            if (withMarginOrGap.length > 0) return withMarginOrGap[0];
            return withSpacing[0];
        }

        // Fallback to first candidate
        return candidates[0];
    };

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
                padding: 12,
                background: "hsl(var(--muted))",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
            }}>
                {url ? (
                    <img
                        src={url}
                        alt={alt}
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
                        No screenshot
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 12,
        }}>
            {items.map((comp) => {
                const hasChips = visibleProps.type;
                const metaParts: string[] = [];
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
                                    {showStatusPill && (
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
                                    {/* Name + Description + Category */}
                                    <div style={{
                                        fontSize: 15,
                                        fontWeight: 650,
                                        color: "hsl(var(--foreground))",
                                        marginBottom: (visibleProps.description && comp.description) ? 2 : (visibleProps.category ? 2 : (hasChips || hasMeta ? 8 : 0)),
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}>
                                        {comp.name}
                                    </div>
                                    {visibleProps.description && comp.description && (
                                        <div style={{
                                            fontSize: 13,
                                            color: "hsl(var(--muted-foreground))",
                                            marginBottom: visibleProps.category ? 6 : (hasChips || hasMeta ? 10 : 0),
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}>
                                            {comp.description}
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

                                    {/* Style Evidence Table */}
                                    {visibleProps.styleEvidence && (() => {
                                        const capture = getRepresentativeCapture(comp.id);
                                        if (!capture) return null;

                                        // Get primitives from capture (fail gracefully if missing)
                                        const primitives = capture.styles?.primitives;
                                        if (!primitives) return null;

                                        const visualEssentials = deriveVisualEssentialsFromPrimitives(primitives, capture.styles.tokens);
                                        if (visualEssentials.rows.length === 0) return null;

                                        // Get sources and author data for variable display
                                        const sources = capture.styles?.sources ?? null;
                                        const author = capture.styles?.author ?? null;

                                        // Helper: Convert #RRGGBBAA to rgba(r,g,b,a)
                                        const hexToRgba = (hex: string): string | null => {
                                            if (!/^#[0-9A-Fa-f]{8}$/.test(hex)) return hex; // Not 8-digit hex, use as-is
                                            const r = parseInt(hex.slice(1, 3), 16);
                                            const g = parseInt(hex.slice(3, 5), 16);
                                            const b = parseInt(hex.slice(5, 7), 16);
                                            const a = parseInt(hex.slice(7, 9), 16) / 255;
                                            return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
                                        };

                                        // Helper: Get variable line for a color source
                                        const getVariableLine = (sourceKey: string): string | null => {
                                            // Check authoredValue first (same data TokenTraceValue uses)
                                            const authoredValue = (author as any)?.properties?.[sourceKey]?.authoredValue ?? null;
                                            if (authoredValue && authoredValue.includes("var(")) {
                                                return authoredValue;
                                            }

                                            // Fallback to sources.value
                                            if (sources) {
                                                const source = (sources as any)[sourceKey];
                                                if (source?.value && source.value.includes("var(")) {
                                                    return source.value;
                                                }
                                            }

                                            return null;
                                        };

                                        // Helper: Determine if row is a color row
                                        const isColorRow = (label: string): boolean => {
                                            return label === "Text color" || label === "Background" || label === "Border color";
                                        };

                                        // Helper: Get source key for color label
                                        const getSourceKey = (label: string): string | null => {
                                            if (label === "Text color") return "color";
                                            if (label === "Background") return "backgroundColor";
                                            if (label === "Border color") return "borderColor";
                                            return null;
                                        };

                                        // Filter rows based on selected style evidence keys
                                        const selectedKeysSet = new Set(visibleProps.styleEvidenceKeys);
                                        const filteredRows = visualEssentials.rows.filter(row =>
                                            selectedKeysSet.has(row.label)
                                        );

                                        // Don't show table if no rows are selected
                                        if (filteredRows.length === 0) return null;

                                        // Group filtered rows by section (matching drawer behavior)
                                        const sectionOrder = ["Text", "Surface", "Spacing", "State"] as const;
                                        const sections: StylePropertiesSection[] = [];

                                        for (const sectionName of sectionOrder) {
                                            const sectionRows = filteredRows.filter(row => row.section === sectionName);
                                            if (sectionRows.length > 0) {
                                                sections.push({
                                                    title: sectionName,
                                                    rows: sectionRows.map(row => {
                                                        // For color rows, add value node with tile + variable line
                                                        if (isColorRow(row.label)) {
                                                            const sourceKey = getSourceKey(row.label);
                                                            const variableLine = sourceKey ? getVariableLine(sourceKey) : null;
                                                            const colorValue = hexToRgba(row.value);

                                                            return {
                                                                label: row.label,
                                                                value: row.value,
                                                                valueNode: (
                                                                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                                                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                                            {/* Color tile */}
                                                                            <div style={{
                                                                                width: 12,
                                                                                height: 12,
                                                                                borderRadius: 3,
                                                                                border: "1px solid hsl(var(--border))",
                                                                                background: colorValue || row.value,
                                                                                flexShrink: 0,
                                                                            }} />
                                                                            {/* HEX value */}
                                                                            <span style={{
                                                                                fontFamily: "monospace",
                                                                                fontSize: 13,
                                                                                color: "hsl(var(--foreground))",
                                                                            }}>
                                                                                {row.value}
                                                                            </span>
                                                                        </div>
                                                                        {/* Variable line (if exists) */}
                                                                        {variableLine && (
                                                                            <div style={{
                                                                                fontSize: 11,
                                                                                color: "hsl(var(--muted-foreground))",
                                                                                fontFamily: "monospace",
                                                                            }}>
                                                                                {variableLine}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ),
                                                            };
                                                        }

                                                        // Non-color rows: use default rendering
                                                        return {
                                                            label: row.label,
                                                            value: row.value,
                                                        };
                                                    }),
                                                });
                                            }
                                        }

                                        return (
                                            <div style={{ marginTop: 12, marginBottom: hasMeta ? 0 : 0 }}>
                                                <StylePropertiesTable sections={sections} />
                                            </div>
                                        );
                                    })()}

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
