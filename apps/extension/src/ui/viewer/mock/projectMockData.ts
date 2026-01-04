// ─────────────────────────────────────────────────────────────
// Mock Data (file-level constants to prevent re-renders)
// ─────────────────────────────────────────────────────────────

// TEMP: Mock data for IA-only layouts (will be replaced with real data in later milestones)
export const MOCK_COMPONENTS = [
    { id: "c1", name: "Primary Button", category: "Actions", type: "button", status: "Canonical", source: "Homepage", capturesCount: 12 },
    { id: "c2", name: "Search Input", category: "Forms", type: "input", status: "Variant", source: "Dashboard", capturesCount: 8 },
    { id: "c3", name: "Card Header", category: "Layout", type: "div", status: "Canonical", source: "Product Page", capturesCount: 5 },
    { id: "c4", name: "Alert Banner", category: "Feedback", type: "div", status: "Unreviewed", source: "Checkout", capturesCount: 3 },
    { id: "c5", name: "Navigation Link", category: "Navigation", type: "a", status: "Variant", source: "Header", capturesCount: 15 },
    { id: "c6", name: "Checkbox", category: "Forms", type: "input", status: "Canonical", source: "Settings", capturesCount: 7 },
];

export const MOCK_STYLES = [
    { id: "s1", token: "--color-primary", value: "217 91% 60%", kind: "color", usageCount: 47, source: "Design System" },
    { id: "s2", token: "--spacing-md", value: "16px", kind: "spacing", usageCount: 132, source: "Layout Grid" },
    { id: "s3", token: "--font-heading", value: "Inter, sans-serif", kind: "typography", usageCount: 23, source: "Theme" },
    { id: "s4", token: "--shadow-sm", value: "0 1px 2px rgba(0,0,0,0.05)", kind: "shadow", usageCount: 18, source: "Cards" },
    { id: "s5", token: "--radius-base", value: "8px", kind: "border", usageCount: 91, source: "Components" },
    { id: "s6", token: "--color-error", value: "0 84% 60%", kind: "color", usageCount: 12, source: "Validation" },
];
