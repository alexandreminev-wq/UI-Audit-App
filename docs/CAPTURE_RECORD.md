# Capture Record (Schema) — v2.2

This defines what the extension stores in IndexedDB (captures store).
Viewer normalization/signatures come later and are NOT computed in the extension.

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
  timestamp: string; // ISO string (use createdAt)
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
  createdAt: string; // ISO
  conditions: CaptureConditions;

  element: ElementCore;

  styles: {
    primitives: StylePrimitives;
    // optional: rawComputed subset if you keep it; avoid giant dumps in MVP
  };

  screenshot?: CaptureScreenshotRef | null;
}
