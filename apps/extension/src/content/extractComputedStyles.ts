/**
 * Extract computed styles for a given element
 * Returns only the STYLE_KEYS we care about for MVP.
 */

import { STYLE_KEYS, type StyleKey } from "./styleKeys";
import type { StylePrimitives, Rgba, ColorPrimitive, ShadowPrimitive, SpacingPrimitive, TypographyPrimitive, RadiusPrimitive, StyleSources, StyleSourceKey } from "../types/capture";

export function extractComputedStyles(el: Element): Record<StyleKey, string> {
  const computed = window.getComputedStyle(el);
  const result = {} as Record<StyleKey, string>;

  for (const key of STYLE_KEYS) {
    result[key] = computed.getPropertyValue(key) || "";
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// v2.2 Style Primitives
// ─────────────────────────────────────────────────────────────

/**
 * Parse color string to RGBA canonical form
 * Handles: rgb(), rgba(), transparent, named colors (via canvas trick)
 * Returns null if unparseable
 */
function parseColorToRgba(colorStr: string): Rgba | null {
  if (!colorStr || colorStr === "none") {
    return null;
  }

  // Handle transparent explicitly
  if (colorStr === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Try rgb()/rgba() regex
  const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  // Fallback: use canvas to parse named colors, hex, etc.
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = colorStr;
    const computed = ctx.fillStyle;

    // Try parsing the computed fillStyle
    const hexMatch = computed.match(/^#([a-f0-9]{6})$/i);
    if (hexMatch) {
      const hex = hexMatch[1];
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: 1,
      };
    }

    // If canvas returned rgb/rgba, parse it
    const canvasRgbaMatch = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (canvasRgbaMatch) {
      return {
        r: parseInt(canvasRgbaMatch[1], 10),
        g: parseInt(canvasRgbaMatch[2], 10),
        b: parseInt(canvasRgbaMatch[3], 10),
        a: canvasRgbaMatch[4] ? parseFloat(canvasRgbaMatch[4]) : 1,
      };
    }
  } catch {
    // Canvas trick failed
  }

  return null;
}

/**
 * Extract spacing primitive (padding per-side)
 */
function extractSpacing(computed: CSSStyleDeclaration): SpacingPrimitive {
  return {
    paddingTop: computed.getPropertyValue("padding-top") || "0px",
    paddingRight: computed.getPropertyValue("padding-right") || "0px",
    paddingBottom: computed.getPropertyValue("padding-bottom") || "0px",
    paddingLeft: computed.getPropertyValue("padding-left") || "0px",
  };
}

/**
 * Extract color primitive (raw + canonical RGBA)
 */
function extractColor(computed: CSSStyleDeclaration, property: string): ColorPrimitive {
  const raw = computed.getPropertyValue(property) || "transparent";
  const rgba = parseColorToRgba(raw);

  return { raw, rgba };
}

/**
 * Extract shadow primitive (raw + presence + layer count)
 */
function extractShadow(computed: CSSStyleDeclaration): ShadowPrimitive {
  const boxShadowRaw = computed.getPropertyValue("box-shadow") || "none";

  const shadowPresence = boxShadowRaw === "none" || boxShadowRaw === "" ? "none" : "some";

  // Best-effort layer count: count commas outside parentheses
  let shadowLayerCount: number | null = null;
  if (shadowPresence === "some") {
    try {
      // Simple heuristic: split by comma and count
      const layers = boxShadowRaw.split(",").filter((s) => s.trim().length > 0);
      shadowLayerCount = layers.length;
    } catch {
      shadowLayerCount = null;
    }
  }

  return {
    boxShadowRaw,
    shadowPresence,
    shadowLayerCount,
  };
}

/**
 * Extract typography primitive (font properties)
 */
function extractTypography(computed: CSSStyleDeclaration): TypographyPrimitive {
  return {
    fontFamily: (computed.getPropertyValue("font-family") || "").trim(),
    fontSize: (computed.getPropertyValue("font-size") || "").trim(),
    fontWeight: (computed.getPropertyValue("font-weight") || "").trim(),
    lineHeight: (computed.getPropertyValue("line-height") || "").trim(),
  };
}

/**
 * Extract radius primitive (border-radius per-corner)
 */
function extractRadius(computed: CSSStyleDeclaration): RadiusPrimitive {
  return {
    topLeft: (computed.getPropertyValue("border-top-left-radius") || "").trim(),
    topRight: (computed.getPropertyValue("border-top-right-radius") || "").trim(),
    bottomRight: (computed.getPropertyValue("border-bottom-right-radius") || "").trim(),
    bottomLeft: (computed.getPropertyValue("border-bottom-left-radius") || "").trim(),
  };
}

/**
 * Extract inline style sources that use CSS variables
 * Returns only properties with var(--...) references
 */
function extractInlineStyleSources(el: Element): StyleSources | undefined {
  if (!(el instanceof HTMLElement)) return undefined;
  const s = el.style;
  if (!s) return undefined;

  const sources: StyleSources = {};

  // Helper to set only when value exists and includes var(--)
  const setIfVar = (key: StyleSourceKey, cssProp: string) => {
    const v = (s.getPropertyValue(cssProp) || "").trim();
    const hasVar = /\bvar\(\s*--/i.test(v);
    if (v && hasVar) sources[key] = v;
  };

  setIfVar("backgroundColor", "background-color");
  setIfVar("color", "color");
  setIfVar("borderColor", "border-color");
  setIfVar("boxShadow", "box-shadow");

  setIfVar("paddingTop", "padding-top");
  setIfVar("paddingRight", "padding-right");
  setIfVar("paddingBottom", "padding-bottom");
  setIfVar("paddingLeft", "padding-left");

  setIfVar("fontFamily", "font-family");
  setIfVar("fontSize", "font-size");
  setIfVar("fontWeight", "font-weight");
  setIfVar("lineHeight", "line-height");

  setIfVar("radiusTopLeft", "border-top-left-radius");
  setIfVar("radiusTopRight", "border-top-right-radius");
  setIfVar("radiusBottomRight", "border-bottom-right-radius");
  setIfVar("radiusBottomLeft", "border-bottom-left-radius");

  return Object.keys(sources).length ? sources : undefined;
}

/**
 * Extract structured style primitives (v2.2)
 * Returns raw + canonical forms for colors, spacing, shadows, typography, radius, sources
 */
export function extractStylePrimitives(el: Element): StylePrimitives {
  const computed = window.getComputedStyle(el);
  const sources = extractInlineStyleSources(el);

  return {
    spacing: extractSpacing(computed),
    backgroundColor: extractColor(computed, "background-color"),
    color: extractColor(computed, "color"),
    borderColor: extractColor(computed, "border-color"),
    shadow: extractShadow(computed),
    typography: extractTypography(computed),
    radius: extractRadius(computed),
    sources,
  };
}
