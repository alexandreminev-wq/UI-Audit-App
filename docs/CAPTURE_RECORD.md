# Capture Record (Schema) — v2.3 (Milestone 4)

This defines what the extension stores in IndexedDB (`captures` store).

Notes:

* Viewer-side analysis exists as of **Milestone 2–3** (gallery, grouping/variants, compare, export).
* Stronger normalization/signatures may come later, but are **NOT computed in the extension**.
* Any viewer-derived grouping keys/signatures are **viewer-only** and must not be persisted back into capture records.
* **Milestone 4 adds capture UX improvements** (pill/freeze) but only persists **environmental context** (landmark scope). UX state like “frozen” is **not** stored.

## Versioning

* `captureSchemaVersion: 2` — identifies capture shape
* optional `stylePrimitiveVersion: 1` — identifies primitive extraction output format

## Types (reference shape)

```ts
export type ThemeHint = "light" | "dark" | "unknown";

export type LandmarkRole =
  | "banner"
  | "navigation"
  | "main"
  | "contentinfo"
  | "complementary"
  | "generic";

/**
 * Optional capture-time context about the element’s environment.
 * Milestone 4: pragmatic landmark context (innermost wins).
 */
export interface CaptureScope {
  nearestLandmarkRole?: LandmarkRole;
}

export interface CaptureConditions {
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  visualViewportScale?: number | null; // best-effort
  browserZoom?: number | null; // best-effort + flaky

  /**
   * Optional capture-time timestamp.
   * - If present, should correspond to createdAt.
   * - Implementation note: some capture pipelines emit milliseconds (number) at assembly time,
   *   while the stored record canonicalizes createdAt as ISO.
   */
  timestamp?: number | string;

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
  r: number;
  g: number;
  b: number;
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

  // examples — keep list minimal in MVP, expand later
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

export interface CaptureRecordV2 {
  id: string;
  sessionId: string;

  captureSchemaVersion: 2;
  stylePrimitiveVersion?: 1;

  url: string;

  /**
   * Canonical capture timestamp.
   * Stored as ISO string.
   */
  createdAt: string; // ISO

  conditions: CaptureConditions;

  /**
   * Optional environmental context.
   * Milestone 4: nearest landmark role, if detected.
   */
  scope?: CaptureScope;

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
```

## Milestone 4 additions (what changed vs v2.2)

* Added optional `scope.nearestLandmarkRole` to provide lightweight page context for the captured element.
* No persistence of capture UX state:

  * “frozen”, “capturing”, pill contents, etc. are **runtime-only** and not stored.
* Viewer should treat unknown/absent `scope` fields as non-fatal and ignore them gracefully.
