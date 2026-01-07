// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CheckboxOption {
    value: string;
    label: string;
}

export type CheckboxItem =
    | { type: "header"; label: string }
    | { type: "option"; value: string; label: string };

interface CheckboxListProps {
    title: string;
    options: string[] | CheckboxOption[] | CheckboxItem[];
    selected: Set<string>;
    onChange: (next: Set<string>) => void;
}

// ─────────────────────────────────────────────────────────────
// CheckboxList Component
// ─────────────────────────────────────────────────────────────

export function CheckboxList({
    title,
    options,
    selected,
    onChange,
}: CheckboxListProps) {
    // Normalize options to CheckboxItem[] format
    const normalizedItems: CheckboxItem[] = options.map((opt, idx) => {
        if (typeof opt === 'string') {
            return { type: "option", value: opt, label: opt };
        } else if ('type' in opt) {
            return opt; // Already a CheckboxItem
        } else {
            return { type: "option", value: opt.value, label: opt.label };
        }
    });

    const handleToggle = (value: string, checked: boolean) => {
        const newSet = new Set(selected);
        if (checked) {
            newSet.add(value);
        } else {
            newSet.delete(value);
        }
        onChange(newSet);
    };

    const handleClear = () => {
        onChange(new Set());
    };

    return (
        <>
            {/* Title */}
            <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: "hsl(var(--foreground))",
                marginBottom: 4,
            }}>
                {title}
            </div>

            {/* Helper text */}
            <div style={{
                fontSize: 11,
                color: "hsl(var(--muted-foreground))",
                marginBottom: 8,
            }}>
                No selection = All
            </div>

            {/* Checkbox options */}
            <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginBottom: 12,
            }}>
                {normalizedItems.map((item, idx) => {
                    if (item.type === "header") {
                        return (
                            <div
                                key={`header-${idx}`}
                                style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "hsl(var(--muted-foreground))",
                                    marginTop: idx > 0 ? 8 : 0,
                                    marginBottom: 4,
                                }}
                            >
                                {item.label}
                            </div>
                        );
                    } else {
                        return (
                            <label
                                key={item.value}
                                title={item.value}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    cursor: "pointer",
                                    fontSize: 14,
                                    color: "hsl(var(--foreground))",
                                    paddingLeft: 8,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(item.value)}
                                    onChange={(e) => handleToggle(item.value, e.target.checked)}
                                    style={{ cursor: "pointer" }}
                                />
                                {item.label}
                            </label>
                        );
                    }
                })}
            </div>

            {/* Footer actions */}
            <div style={{
                borderTop: "1px solid hsl(var(--border))",
                paddingTop: 8,
            }}>
                <button
                    type="button"
                    onClick={handleClear}
                    style={{
                        width: "100%",
                        padding: "4px 8px",
                        fontSize: 12,
                        background: "hsl(var(--background))",
                        color: "hsl(var(--foreground))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        cursor: "pointer",
                    }}
                >
                    Clear
                </button>
            </div>
        </>
    );
}
