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
  outerHTML?: string | null; // HTML structure for display
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
  hex8?: string | null; // Phase 4: canonical #RRGGBBAA derived from rgba (best-effort)
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

export interface MarginPrimitive {
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
}

export interface BorderWidthPrimitive {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

export interface BorderColorPrimitive {
  top: ColorPrimitive;
  right: ColorPrimitive;
  bottom: ColorPrimitive;
  left: ColorPrimitive;
}

export interface GapPrimitive {
  rowGap: string;
  columnGap: string;
}

export interface TypographyPrimitive {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
}

export interface RadiusPrimitive {
  topLeft: string;
  topRight: string;
  bottomRight: string;
  bottomLeft: string;
}

export type StyleSourceKey =
  | "backgroundColor"
  | "color"
  | "borderColor"
  | "boxShadow"
  | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft"
  | "marginTop" | "marginRight" | "marginBottom" | "marginLeft"
  | "borderTopWidth" | "borderRightWidth" | "borderBottomWidth" | "borderLeftWidth"
  | "rowGap" | "columnGap"
  | "fontFamily" | "fontSize" | "fontWeight" | "lineHeight"
  | "radiusTopLeft" | "radiusTopRight" | "radiusBottomRight" | "radiusBottomLeft";

export type StyleSources = Partial<Record<StyleSourceKey, string>>;

export interface StylePrimitives {
  spacing: SpacingPrimitive;
  margin?: MarginPrimitive; // Phase 2: full box model (optional for backward compatibility)
  borderWidth?: BorderWidthPrimitive; // Phase 2: full box model (optional)
  gap?: GapPrimitive; // Phase 2: full box model (optional)
  backgroundColor: ColorPrimitive;
  color: ColorPrimitive;
  borderColor?: BorderColorPrimitive; // Phase 2: per-side border colors
  shadow: ShadowPrimitive;
  typography?: TypographyPrimitive; // Optional for backwards compatibility
  radius?: RadiusPrimitive; // Optional for backwards compatibility
  opacity?: number | null; // Phase 1: element-level opacity (0-1), separate from color alpha
  sources?: StyleSources; // Optional for backwards compatibility (CSS variable provenance)
}

// ─────────────────────────────────────────────────────────────
// Phase 1: Authored Style Evidence (CDP-first, computed fallback)
// ─────────────────────────────────────────────────────────────

export type AuthorStylePropertyKey =
  | "color"
  | "backgroundColor"
  | "borderColor"
  | "boxShadow"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "lineHeight"
  | "opacity"
  // Phase 2: box model
  | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft"
  | "marginTop" | "marginRight" | "marginBottom" | "marginLeft"
  | "borderTopWidth" | "borderRightWidth" | "borderBottomWidth" | "borderLeftWidth"
  | "radiusTopLeft" | "radiusTopRight" | "radiusBottomRight" | "radiusBottomLeft"
  | "rowGap" | "columnGap";

export interface AuthorStyleProvenance {
  selectorText: string;
  styleSheetUrl?: string | null;
  origin?: string | null;
}

export interface AuthorStylePropertyEvidence {
  authoredValue?: string | null;
  resolvedValue?: string | null;
  provenance?: AuthorStyleProvenance[]; // trimmed to top N
}

export interface AuthorStyleEvidence {
  properties: Partial<Record<AuthorStylePropertyKey, AuthorStylePropertyEvidence>>;
}

export interface StyleEvidenceMeta {
  method: "cdp" | "computed";
  cdpError?: string;
  // When a single UI element is captured as multiple interaction states (e.g. hover/focus),
  // this labels which state produced the evidence.
  state?: "default" | "hover" | "active" | "focus" | "disabled" | "open";
  capturedAt: number; // epoch ms
}

export interface TokenUsageEvidence {
  property: AuthorStylePropertyKey;
  token: string; // --token-name
  resolvedValue?: string | null; // resolved value for this element instance (best-effort)
}

export interface TokenDefinitionEvidence {
  token: string; // --token-name
  definedValue?: string | null; // RHS of "--token: <value>" (best-effort, may include var() chains)
  selectorText: string;
  styleSheetUrl?: string | null;
  origin?: string | null;
}

export interface TokenEvidence {
  used: TokenUsageEvidence[];
  definitions?: TokenDefinitionEvidence[];
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
  projectId?: string; // Optional for backward compatibility (added post-v2.2)

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
    // Phase 1: authored styles + provenance (best-effort via CDP)
    author?: AuthorStyleEvidence;
    // Phase 1: evidence metadata for debugging/UX
    evidence?: StyleEvidenceMeta;
    // Next: normalized token usage + best-effort definition provenance
    tokens?: TokenEvidence;
  };

  screenshot?: CaptureScreenshotRef | null;

  // 7.8: Draft until Save
  isDraft?: boolean; // true = unsaved draft, false/undefined = saved capture
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
