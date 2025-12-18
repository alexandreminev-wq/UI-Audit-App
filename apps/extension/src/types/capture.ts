/**
 * Capture Record Schema
 * Created when user click-to-captures an element
 */

import type { StyleKey } from "../content/styleKeys";

// ─────────────────────────────────────────────────────────────
// Legacy v1 Schema (backward compatibility)
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// v2.2 Schema (Milestone 1)
// ─────────────────────────────────────────────────────────────

export type ThemeHint = "light" | "dark" | "unknown";

export interface CaptureConditions {
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  visualViewportScale?: number | null; // best-effort
  browserZoom?: number | null; // best-effort, flaky, expect null
  timestamp: number; // ms since epoch (matches createdAt for consistency)
  themeHint?: ThemeHint; // best-effort
}

export interface ElementIntent {
  accessibleName?: string | null; // best-effort
  inputType?: string | null; // e.g. "text", "checkbox"
  href?: string | null;
  disabled?: boolean | null;
  ariaDisabled?: boolean | null;
  checked?: boolean | null;
  ariaChecked?: boolean | null;
}

export interface ElementCore {
  tagName: string;
  role?: string | null; // best-effort
  // locator fields (existing compatibility)
  id?: string | null;
  classList?: string[];
  textPreview?: string;
  // intent anchors (v2.2)
  intent: ElementIntent;
}

export interface Rgba {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

export interface ColorPrimitive {
  raw: string; // computed style string as-is
  rgba?: Rgba | null; // canonical form when parseable
}

export interface ShadowPrimitive {
  boxShadowRaw: string; // computed style string as-is
  shadowPresence: "none" | "some";
  shadowLayerCount?: number | null;
}

export interface SpacingPrimitive {
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
}

export interface StylePrimitives {
  spacing: SpacingPrimitive;
  backgroundColor: ColorPrimitive;
  color: ColorPrimitive;
  borderColor?: ColorPrimitive;
  shadow: ShadowPrimitive;
}

export interface CaptureScreenshotRef {
  screenshotBlobId: string; // references blobs store
  mimeType: string; // e.g. "image/webp"
  width: number;
  height: number;
}

/**
 * Landmark role types (Milestone 4)
 */
export type LandmarkRole =
  | "banner"
  | "navigation"
  | "main"
  | "contentinfo"
  | "complementary"
  | "generic";

export interface CaptureScope {
  nearestLandmarkRole?: LandmarkRole; // Milestone 4: landmark context
}

export interface CaptureRecordV2 {
  id: string;
  sessionId: string;

  captureSchemaVersion: 2;
  stylePrimitiveVersion?: 1;

  url: string;
  createdAt: number; // ms since epoch (backward compatible)

  conditions: CaptureConditions;

  scope?: CaptureScope; // Milestone 4: optional scope context

  element: ElementCore;

  // Keep boundingBox for cropping (existing compatibility)
  boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };

  styles: {
    primitives: StylePrimitives;
    // optional: rawComputed subset if needed for debugging
    computed?: Record<StyleKey, string>;
  };

  screenshot?: CaptureScreenshotRef | null;
}

// ─────────────────────────────────────────────────────────────
// Session Schema (v2.2)
// ─────────────────────────────────────────────────────────────

export interface SessionRecord {
  id: string; // "session_<timestamp>_<random>"
  createdAt: number; // ms since epoch
  startUrl: string;
  userAgent?: string;
  pagesVisited?: string[]; // optional breadcrumb
}

// ─────────────────────────────────────────────────────────────
// Blob Schema (v2.2)
// ─────────────────────────────────────────────────────────────

export interface BlobRecord {
  id: string; // "blob_<timestamp>_<random>"
  createdAt: number; // ms since epoch
  mimeType: string; // e.g. "image/webp", "image/jpeg"
  width: number;
  height: number;
  blob: Blob;
}

// ─────────────────────────────────────────────────────────────
// ID Generators
// ─────────────────────────────────────────────────────────────

/**
 * Helper to generate stable capture ID
 */
export function generateCaptureId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `cap_${timestamp}_${random}`;
}

/**
 * Helper to generate stable session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `session_${timestamp}_${random}`;
}

/**
 * Helper to generate stable blob ID
 */
export function generateBlobId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `blob_${timestamp}_${random}`;
}
