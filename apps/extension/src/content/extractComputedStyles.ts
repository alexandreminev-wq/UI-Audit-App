/**
 * Extract computed styles for a given element
 * Returns only the STYLE_KEYS we care about for MVP.
 */

import { STYLE_KEYS, type StyleKey } from "./styleKeys";

export function extractComputedStyles(el: Element): Record<StyleKey, string> {
  const computed = window.getComputedStyle(el);
  const result = {} as Record<StyleKey, string>;

  for (const key of STYLE_KEYS) {
    result[key] = computed.getPropertyValue(key) || "";
  }

  return result;
}
