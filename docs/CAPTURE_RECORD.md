# Capture Record (Schema) — v2.2

*Last updated: 2025-12-24 (Europe/Madrid)*

This defines what the extension stores in IndexedDB (`captures` store).

Notes:
- Viewer/side panel compute grouping/categorization at runtime.
- Any viewer-derived grouping keys/signatures are **view-only** and must not be persisted back into capture records in v2.2.

---

## Versioning
- `captureSchemaVersion: 2`
- optional `stylePrimitiveVersion: 1`

---

## Reference shape (TypeScript)

```ts
export type ThemeHint = "light" | "dark" | "unknown";

export interface CaptureConditions {
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  visualViewportScale?: number | null; // best-effort
  browserZoom?: number | null;         // best-effort + flaky
  timestamp?: string;                  // optional; createdAt is canonical
  themeHint?: ThemeHint;               // best-effort
}

export interface ElementIntent {
  accessibleName?: string | null;
  inputType?: string | null;
  href?: string | null;
  disabled?: boolean | null;
  ariaDisabled?: boolean | null;
  checked?: boolean | null;
  ariaChecked?: boolean | null;
}

export interface ElementCore {
  tagName: string;
  role?: string | null; // best-effort
  intent: ElementIntent;
}

export interface Rgba {
  r: number; g: number; b: number; a: number;
}

export interface ColorPrimitive {
  raw: string;
  rgba?: Rgba | null;
}

export interface ShadowPrimitive {
  boxShadowRaw: string;
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
  screenshotBlobId: string;
  mimeType: string;
  width: number;
  height: number;
}

/**
 * Canonical capture record stored in IndexedDB.
 * Projects are NOT stored on captures; projects link to sessions via projectSessions store.
 */
export interface CaptureRecordV2 {
  id: string;
  sessionId: string;

  captureSchemaVersion: 2;
  stylePrimitiveVersion?: 1;

  url: string;
  createdAt: string; // ISO timestamp (canonical)
  conditions: CaptureConditions;

  element: ElementCore;

  styles: {
    primitives: StylePrimitives;
  };

  screenshot?: CaptureScreenshotRef | null;

  // Optional / future-safe fields (ignored by reader if unknown)
  scope?: {
    nearestLandmarkRole?: "banner" | "navigation" | "main" | "contentinfo" | "complementary" | "generic";
  };
}
