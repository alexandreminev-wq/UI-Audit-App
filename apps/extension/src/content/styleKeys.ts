/**
 * Computed Style Keys (MVP v1)
 *
 * Notes:
 * - Use kebab-case keys because getPropertyValue expects kebab-case.
 * - Keep this list small & stable to keep capture payload small.
 */

export const STYLE_KEYS = [
  // Typography
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-decoration-line",
  "text-align",
  "white-space",

  // Color/surface
  "color",
  "background-color",
  "opacity",

  // Spacing
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",

  // Border/shape
  "border-top-width",
  "border-top-style",
  "border-top-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",

  // Focus ring
  "outline-style",
  "outline-width",
  "outline-color",

  // Elevation
  "box-shadow",

  // Layout essentials
  "display",
  "position",
  "align-items",
  "justify-content",
  "gap",
  "z-index",
  "overflow",
  "text-overflow",
] as const;

export type StyleKey = (typeof STYLE_KEYS)[number];
