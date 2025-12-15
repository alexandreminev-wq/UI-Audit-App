/**
 * Capture Record Schema (MVP v1)
 * Created when user click-to-captures an element
 */

import type { StyleKey } from "../content/styleKeys";

export interface CaptureRecord {
  id: string; // "cap_<timestamp>_<random>"
  createdAt: number; // ms since epoch
  url: string;

  element: {
    tagName: string;
    id?: string | null;
    classList: string[];
    role: string | null;
    textPreview: string;

    attributes: {
      ariaLabel?: string;
      ariaLabelledBy?: string;
      ariaExpanded?: string;
      ariaChecked?: string;
      ariaSelected?: string;
      ariaDisabled?: string;
      ariaCurrent?: string;
    };
  };

  boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };

  viewport: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    devicePixelRatio: number;
  };

  styles: {
    computed: Record<StyleKey, string>;
  };
}

/**
 * Helper to generate stable capture ID
 */
export function generateCaptureId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `cap_${timestamp}_${random}`;
}
