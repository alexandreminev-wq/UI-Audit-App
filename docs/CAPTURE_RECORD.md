# Capture Record (Schema) — v2.2

This defines what the extension stores in IndexedDB (`captures` store).

Notes:
- Viewer-side analysis exists as of **Milestone 2** (gallery, naive grouping, compare, export).
- Stronger normalization/signatures may come later, but are **NOT computed in the extension** in v2.2.
- Any viewer-derived grouping keys/signatures are **viewer-only** and must not be persisted back into capture records for v2.2.

## Versioning
- `captureSchemaVersion: 2` — identifies capture shape
- optional `stylePrimitiveVersion: 1` — identifies primitive extraction output format

## Types (reference shape)

```ts
export type ThemeHint = "light" | "dark" | "unknown";

export interface CaptureConditions {
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  visualViewportScale?: number | null; // best-effort
  browserZoom?: number | null; // best-effort + flaky
  /**
   * Optional. If present, should match `createdAt`.
   * In v2.2, `createdAt` is the canonical timestamp for the capture.
   */
  timestamp?: string;
  themeHint?: ThemeHint; // best-effort
}

export interface ElementIntent {
  accessibleName?: string | null; // best-effort
  inputType?: string | null; // e.g. "text", "checkbox"...
  href?: string | null;
  disabled?: boolean | null;
  ariaDisabled?: boolean | null;
  checked?: boolean | null;
  ariaChecked?: boolean | null;
}

export interface ElementCore {
  tagName: string; // e.g. "button"
  role?: string | null; // best-effort
  // locator fields live elsewhere in your model (selector, xpath, etc.)
  intent: ElementIntent;
}

export interface Rgba {
  r: number; g: number; b: number; a: number; // 0-255, alpha 0-1
}

export interface ColorPrimitive {
  raw: string;           // computed style string as-is
  rgba?: Rgba | null;    // canonical form when parseable
}

export interface ShadowPrimitive {
  boxShadowRaw: string;  // computed style string as-is
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

  // examples — keep list minimal in MVP, expand later
  backgroundColor: ColorPrimitive;
  color: ColorPrimitive;
  borderColor?: ColorPrimitive;

  shadow: ShadowPrimitive;
}

export interface CaptureScreenshotRef {
  screenshotBlobId: string; // references blobs store
  mimeType: string;         // e.g. "image/webp"
  width: number;
  height: number;
}

export interface CaptureRecordV2 {
  id: string;
  sessionId: string;

  captureSchemaVersion: 2;
  stylePrimitiveVersion?: 1;

  url: string;
  createdAt: string; // ISO (canonical timestamp)
  conditions: CaptureConditions;

  element: ElementCore;

  styles: {
    primitives: StylePrimitives;
    // optional: rawComputed subset if you keep it; avoid giant dumps in MVP
  };

  /**
   * Optional screenshot evidence.
   * - undefined/null: no screenshot captured or stored for this capture.
   * - If screenshotBlobId exists but the blob record is missing: viewer should show "Missing blob".
   */
  screenshot?: CaptureScreenshotRef | null;
}
