// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface CheckboxListProps {
    title: string;
    options: string[];
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
    const handleToggle = (option: string, checked: boolean) => {
        const newSet = new Set(selected);
        if (checked) {
            newSet.add(option);
        } else {
            newSet.delete(option);
        }
        onChange(newSet);
    };

    const handleClear = () => {
        onChange(new Set());
    };

    const handleSelectAll = () => {
        onChange(new Set(options));
    };

    return (
        <>
            {/* Title */}
            <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: "hsl(var(--foreground))",
                marginBottom: 8,
            }}>
                {title}
            </div>

            {/* Checkbox options */}
            <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginBottom: 12,
            }}>
                {options.map((option) => (
                    <label
                        key={option}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                            fontSize: 14,
                            color: "hsl(var(--foreground))",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={selected.has(option)}
                            onChange={(e) => handleToggle(option, e.target.checked)}
                            style={{ cursor: "pointer" }}
                        />
                        {option}
                    </label>
                ))}
            </div>

            {/* Footer actions */}
            <div style={{
                display: "flex",
                gap: 8,
                borderTop: "1px solid hsl(var(--border))",
                paddingTop: 8,
            }}>
                <button
                    type="button"
                    onClick={handleClear}
                    style={{
                        flex: 1,
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
                <button
                    type="button"
                    onClick={handleSelectAll}
                    style={{
                        flex: 1,
                        padding: "4px 8px",
                        fontSize: 12,
                        background: "hsl(var(--background))",
                        color: "hsl(var(--foreground))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        cursor: "pointer",
                    }}
                >
                    Select all
                </button>
            </div>
        </>
    );
}
