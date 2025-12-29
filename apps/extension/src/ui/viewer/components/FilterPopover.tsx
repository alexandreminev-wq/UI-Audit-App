import * as Popover from "@radix-ui/react-popover";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface FilterPopoverProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ariaLabel: string;
    align?: "start" | "center" | "end";
    side?: "bottom" | "top" | "left" | "right";
    trigger: React.ReactNode;
    children: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────
// FilterPopover Component
// ─────────────────────────────────────────────────────────────

export function FilterPopover({
    open,
    onOpenChange,
    ariaLabel,
    align = "start",
    side = "bottom",
    trigger,
    children,
}: FilterPopoverProps) {
    return (
        <Popover.Root open={open} onOpenChange={onOpenChange}>
            <Popover.Trigger asChild>
                {trigger}
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    sideOffset={8}
                    side={side}
                    align={align}
                    collisionPadding={8}
                    onEscapeKeyDown={() => onOpenChange(false)}
                    aria-label={ariaLabel}
                    style={{
                        width: 220,
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
                    {children}
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
