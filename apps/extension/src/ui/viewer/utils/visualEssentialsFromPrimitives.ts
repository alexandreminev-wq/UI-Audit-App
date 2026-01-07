import type { ViewerVisualEssentials, ViewerVisualEssentialsRow } from "../types/projectViewerTypes";

/**
 * Format a 4-sided CSS value (padding, margin, border, etc.)
 * Collapses to shorthand when possible.
 */
function format4SidedValue(top: string, right: string, bottom: string, left: string): string {
    // All sides equal
    if (top === right && right === bottom && bottom === left) {
        return top;
    }

    // Top/bottom equal and left/right equal
    if (top === bottom && right === left) {
        return `${top} ${right}`;
    }

    // All different (CSS order: top right bottom left)
    return `${top} ${right} ${bottom} ${left}`;
}

/**
 * Derive visual essentials from style primitives.
 * Returns HEX-first values (hex8 || raw) and sections: Text / Surface / Spacing / State.
 * Includes Margin and Gap.
 */
export function deriveVisualEssentialsFromPrimitives(primitives: any): ViewerVisualEssentials {
    const rows: ViewerVisualEssentialsRow[] = [];

    // Text section
    const textColor = primitives.color?.hex8 || primitives.color?.raw;
    if (textColor) {
        rows.push({ label: "Text color", value: textColor, section: "Text", hex8: primitives.color?.hex8 });
    }
    if (primitives.typography?.fontFamily) {
        rows.push({ label: "Font family", value: primitives.typography.fontFamily, section: "Text" });
    }
    if (primitives.typography?.fontSize) {
        rows.push({ label: "Font size", value: primitives.typography.fontSize, section: "Text" });
    }
    if (primitives.typography?.fontWeight) {
        rows.push({ label: "Font weight", value: String(primitives.typography.fontWeight), section: "Text" });
    }
    if (primitives.typography?.lineHeight) {
        rows.push({ label: "Line height", value: primitives.typography.lineHeight, section: "Text" });
    }

    // Surface section
    const bgColor = primitives.backgroundColor?.hex8 || primitives.backgroundColor?.raw;
    if (bgColor) {
        rows.push({ label: "Background", value: bgColor, section: "Surface", hex8: primitives.backgroundColor?.hex8 });
    }
    const hasBorder = primitives.borderWidth && Object.values(primitives.borderWidth).some((w: any) => parseFloat(String(w)) > 0);
    if (hasBorder && primitives.borderWidth) {
        const b = primitives.borderWidth;
        rows.push({
            label: "Border width",
            value: format4SidedValue(b.top, b.right, b.bottom, b.left),
            section: "Surface"
        });
    }
    // Handle border color (new format: per-side, old format: single color)
    if (hasBorder && primitives.borderColor) {
        const bc = primitives.borderColor as any;

        // Check if it's the new per-side format
        if (bc.top && bc.right && bc.bottom && bc.left) {
            const topHex = bc.top?.hex8 || bc.top?.raw;
            const rightHex = bc.right?.hex8 || bc.right?.raw;
            const bottomHex = bc.bottom?.hex8 || bc.bottom?.raw;
            const leftHex = bc.left?.hex8 || bc.left?.raw;

            if (topHex) {
                const borderColorValue = format4SidedValue(topHex, rightHex || topHex, bottomHex || topHex, leftHex || topHex);
                rows.push({ label: "Border color", value: borderColorValue, section: "Surface", hex8: bc.top?.hex8 });
            }
        } else {
            // Old format: single ColorPrimitive
            const borderColorValue = bc.hex8 || bc.raw;
            if (borderColorValue) {
                rows.push({ label: "Border color", value: borderColorValue, section: "Surface", hex8: bc.hex8 });
            }
        }
    }
    if (primitives.radius) {
        const r = primitives.radius;
        rows.push({
            label: "Radius",
            value: format4SidedValue(r.topLeft, r.topRight, r.bottomRight, r.bottomLeft),
            section: "Surface"
        });
    }
    if (primitives.shadow?.boxShadowRaw) {
        rows.push({ label: "Shadow", value: primitives.shadow.boxShadowRaw, section: "Surface" });
    }

    // Spacing section
    if (primitives.spacing) {
        const p = primitives.spacing;
        rows.push({
            label: "Padding",
            value: format4SidedValue(p.paddingTop, p.paddingRight, p.paddingBottom, p.paddingLeft),
            section: "Spacing"
        });
    }
    if (primitives.margin) {
        const m = primitives.margin;
        rows.push({
            label: "Margin",
            value: format4SidedValue(m.marginTop, m.marginRight, m.marginBottom, m.marginLeft),
            section: "Spacing"
        });
    }
    if (primitives.gap) {
        rows.push({ label: "Gap", value: `${primitives.gap.rowGap} / ${primitives.gap.columnGap}`, section: "Spacing" });
    }

    return { rows };
}
