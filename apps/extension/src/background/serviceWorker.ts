import {
    saveCapture,
    listRecentCaptures,
    listRecentCapturesByHost,
    clearAllCaptures,
    deleteCapture,
    saveSession,
    getSession,
    listSessions,
    saveBlob,
    getBlob,
    getCapture,
    listCapturesBySession,
    createProject,
    listProjects,
    linkSessionToProject,
    listProjectSessionsByProject,
    listSessionIdsForProject,
    listCapturesBySessionIds,
    getProjectCaptureCount,
    getAnnotation,
    listAnnotationsForProject,
    upsertAnnotation,
    deleteAnnotation,
    getComponentOverride,
    listComponentOverridesForProject,
    upsertComponentOverride,
    deleteComponentOverride,
    listDraftCapturesForProject,
    listSavedCapturesForProject,
    commitDraftCapture,
    deleteProjectCascade,
    getAllProjectTags,
    incrementTagUsage,
    decrementTagUsage,
    deleteProjectTag,
    getComponentsWithTag,
} from "./capturesDb";
import type {
    SessionRecord,
    CaptureRecordV2,
    BlobRecord,
    StylePrimitives,
    AuthorStyleEvidence,
    AuthorStylePropertyKey,
    AuthorStyleProvenance,
    TokenEvidence,
} from "../types/capture";
import { generateSessionId, generateBlobId, generateCaptureId } from "../types/capture";
import { deriveComponentKey } from "../ui/shared/componentKey";

const auditEnabledByTab = new Map<number, boolean>();
const lastSelectedByTab = new Map<number, any>();
const activeSessionIdByTab = new Map<number, string>();
const activeProjectByTabId = new Map<number, string>();
let lastActiveAuditTabId: number | null = null;
let activeAuditTabId: number | null = null; // 7.8.1: One-tab-at-a-time capture ownership
let currentProjectId: string | null = null;
let currentAuditEnabled: boolean = false;

// Phase 1 (CDP): track which tab(s) we attached the debugger to, so we can detach on suspend.
const cdpAttachedTabs = new Set<number>();

// Track offscreen document state
let offscreenDocumentCreated = false;

// ─────────────────────────────────────────────────────────────
// Phase 1: CDP helpers (authored + resolved styles)
// ─────────────────────────────────────────────────────────────

type HitTestPoint = { x: number; y: number };

type TargetBox = {
    left: number; // viewport coords
    top: number; // viewport coords
    width: number;
    height: number;
    scrollX: number; // page scroll at capture time
    scrollY: number;
};

const AUTHOR_PROP_MAP: Record<AuthorStylePropertyKey, string> = {
    color: "color",
    backgroundColor: "background-color",
    borderColor: "border-color",
    boxShadow: "box-shadow",
    fontFamily: "font-family",
    fontSize: "font-size",
    fontWeight: "font-weight",
    lineHeight: "line-height",
    opacity: "opacity",
    paddingTop: "padding-top",
    paddingRight: "padding-right",
    paddingBottom: "padding-bottom",
    paddingLeft: "padding-left",
    marginTop: "margin-top",
    marginRight: "margin-right",
    marginBottom: "margin-bottom",
    marginLeft: "margin-left",
    borderTopWidth: "border-top-width",
    borderRightWidth: "border-right-width",
    borderBottomWidth: "border-bottom-width",
    borderLeftWidth: "border-left-width",
    radiusTopLeft: "border-top-left-radius",
    radiusTopRight: "border-top-right-radius",
    radiusBottomRight: "border-bottom-right-radius",
    radiusBottomLeft: "border-bottom-left-radius",
    rowGap: "row-gap",
    columnGap: "column-gap",
};

const AUTHOR_PROP_SHORTHAND_FALLBACKS: Partial<Record<AuthorStylePropertyKey, string[]>> = {
    paddingTop: ["padding"],
    paddingRight: ["padding"],
    paddingBottom: ["padding"],
    paddingLeft: ["padding"],
    marginTop: ["margin"],
    marginRight: ["margin"],
    marginBottom: ["margin"],
    marginLeft: ["margin"],
    borderTopWidth: ["border-width", "border"],
    borderRightWidth: ["border-width", "border"],
    borderBottomWidth: ["border-width", "border"],
    borderLeftWidth: ["border-width", "border"],
    radiusTopLeft: ["border-radius"],
    radiusTopRight: ["border-radius"],
    radiusBottomRight: ["border-radius"],
    radiusBottomLeft: ["border-radius"],
    rowGap: ["gap"],
    columnGap: ["gap"],
    // Shorthand fallbacks for background and border colors
    backgroundColor: ["background"],
    borderColor: ["border"],
};

/**
 * CSS properties that inherit from parent elements.
 * Only these should scan inherited rules for authored values.
 */
const INHERITED_PROPERTIES: Set<AuthorStylePropertyKey> = new Set([
    'color',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
]);

// DEV-only logging (best-effort heuristic)
const isDevBuild = (() => {
    try {
        const v = chrome.runtime.getManifest()?.version ?? "";
        return typeof v === "string" && v.startsWith("0.");
    } catch {
        return false;
    }
})();
const devLog = (...args: any[]) => { if (isDevBuild) console.log(...args); };

function normalizeWhitespace(value: string): string {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeRgbLike(value: string | null | undefined): string | null {
    if (!value) return null;
    return normalizeWhitespace(value).replace(/\s*,\s*/g, ", ");
}

function colorsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
    const na = normalizeRgbLike(a);
    const nb = normalizeRgbLike(b);
    if (!na || !nb) return false;
    return na.toLowerCase() === nb.toLowerCase();
}

function clampInt(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(n)));
}

function rgbaToHex8(r: number, g: number, b: number, a: number): string {
    const rr = clampInt(r, 0, 255).toString(16).padStart(2, "0");
    const gg = clampInt(g, 0, 255).toString(16).padStart(2, "0");
    const bb = clampInt(b, 0, 255).toString(16).padStart(2, "0");
    const aa = clampInt(a * 255, 0, 255).toString(16).padStart(2, "0");
    return `#${(rr + gg + bb + aa).toUpperCase()}`;
}

function parseRgbOrRgba(raw: string | null | undefined): { rgba: Rgba; hex8: string } | null {
    const v = String(raw ?? "").trim();
    if (!v) return null;
    const m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
    if (!m) return null;
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    const a = m[4] !== undefined ? Number(m[4]) : 1;
    if (![r, g, b, a].every((x) => Number.isFinite(x))) return null;
    const rgba = { r: clampInt(r, 0, 255), g: clampInt(g, 0, 255), b: clampInt(b, 0, 255), a: Math.max(0, Math.min(1, a)) };
    return { rgba, hex8: rgbaToHex8(rgba.r, rgba.g, rgba.b, rgba.a) };
}

function derivePrimitivesFromCdpComputedMap(computed: Record<string, string>): StylePrimitives {
    const get = (name: string) => (typeof computed[name] === "string" ? computed[name] : "");

    const colorRaw = get("color") || "inherit";
    const bgRaw = get("background-color") || "transparent";
    
    // Extract border colors per side (not shorthand)
    const borderTopRaw = get("border-top-color") || "transparent";
    const borderRightRaw = get("border-right-color") || "transparent";
    const borderBottomRaw = get("border-bottom-color") || "transparent";
    const borderLeftRaw = get("border-left-color") || "transparent";

    const parsedColor = parseRgbOrRgba(colorRaw);
    const parsedBg = parseRgbOrRgba(bgRaw);
    const parsedBorderTop = parseRgbOrRgba(borderTopRaw);
    const parsedBorderRight = parseRgbOrRgba(borderRightRaw);
    const parsedBorderBottom = parseRgbOrRgba(borderBottomRaw);
    const parsedBorderLeft = parseRgbOrRgba(borderLeftRaw);

    const boxShadowRaw = get("box-shadow") || "none";
    const shadowPresence = !boxShadowRaw || boxShadowRaw === "none" ? "none" : "some";
    const shadowLayerCount =
        shadowPresence === "none"
            ? null
            : (() => {
                  let depth = 0;
                  let count = 1;
                  for (const ch of boxShadowRaw) {
                      if (ch === "(") depth++;
                      else if (ch === ")") depth = Math.max(0, depth - 1);
                      else if (ch === "," && depth === 0) count++;
                  }
                  return count;
              })();

    const opacityStr = get("opacity");
    const opacity = opacityStr ? Number(opacityStr) : null;

    return {
        spacing: {
            paddingTop: get("padding-top") || "0px",
            paddingRight: get("padding-right") || "0px",
            paddingBottom: get("padding-bottom") || "0px",
            paddingLeft: get("padding-left") || "0px",
        },
        margin: {
            marginTop: get("margin-top") || "0px",
            marginRight: get("margin-right") || "0px",
            marginBottom: get("margin-bottom") || "0px",
            marginLeft: get("margin-left") || "0px",
        },
        borderWidth: {
            top: get("border-top-width") || "0px",
            right: get("border-right-width") || "0px",
            bottom: get("border-bottom-width") || "0px",
            left: get("border-left-width") || "0px",
        },
        gap: {
            rowGap: get("row-gap") || get("gap") || "normal",
            columnGap: get("column-gap") || get("gap") || "normal",
        },
        backgroundColor: {
            raw: bgRaw,
            rgba: parsedBg ? parsedBg.rgba : null,
            hex8: parsedBg ? parsedBg.hex8 : null,
        },
        color: {
            raw: colorRaw,
            rgba: parsedColor ? parsedColor.rgba : null,
            hex8: parsedColor ? parsedColor.hex8 : null,
        },
        borderColor: {
            top: {
                raw: borderTopRaw,
                rgba: parsedBorderTop ? parsedBorderTop.rgba : null,
                hex8: parsedBorderTop ? parsedBorderTop.hex8 : null,
            },
            right: {
                raw: borderRightRaw,
                rgba: parsedBorderRight ? parsedBorderRight.rgba : null,
                hex8: parsedBorderRight ? parsedBorderRight.hex8 : null,
            },
            bottom: {
                raw: borderBottomRaw,
                rgba: parsedBorderBottom ? parsedBorderBottom.rgba : null,
                hex8: parsedBorderBottom ? parsedBorderBottom.hex8 : null,
            },
            left: {
                raw: borderLeftRaw,
                rgba: parsedBorderLeft ? parsedBorderLeft.rgba : null,
                hex8: parsedBorderLeft ? parsedBorderLeft.hex8 : null,
            },
        },
        shadow: {
            boxShadowRaw,
            shadowPresence: shadowPresence as any,
            shadowLayerCount,
        },
        typography: {
            fontFamily: get("font-family") || "",
            fontSize: get("font-size") || "",
            fontWeight: get("font-weight") || "",
            lineHeight: get("line-height") || "",
        },
        radius: {
            topLeft: get("border-top-left-radius") || "",
            topRight: get("border-top-right-radius") || "",
            bottomRight: get("border-bottom-right-radius") || "",
            bottomLeft: get("border-bottom-left-radius") || "",
        },
        opacity: Number.isFinite(opacity as any) ? opacity : null,
    };
}

function extractDeclarationValue(cssText: string, propertyName: string): string | null {
    // Best-effort parse of "prop: value;" from rule style.cssText
    // Returns the LAST declaration (CSS cascade winner)
    if (!cssText) return null;
    const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|;)\\s*${escaped}\\s*:\\s*([^;]+)`, "gi");

    // Find ALL matches and take the LAST one
    let lastMatch: string | null = null;
    let match: RegExpExecArray | null;
    while ((match = re.exec(cssText)) !== null) {
        lastMatch = normalizeWhitespace(match[1]);
    }
    return lastMatch;
}

function extractValueFromCssProperties(cssProperties: any, propertyName: string): string | null {
    // Returns the LAST matching property (CSS cascade winner)
    const list: any[] = Array.isArray(cssProperties) ? cssProperties : [];
    let lastValue: string | null = null;

    for (const p of list) {
        if (!p || typeof p.name !== "string") continue;
        if (p.name.toLowerCase() === propertyName.toLowerCase()) {
            const v = typeof p.value === "string" ? p.value : "";
            lastValue = normalizeWhitespace(v);
            // Don't return early - continue to find the LAST match
        }
    }
    return lastValue;
}
function extractVarTokensFromValue(value: string): string[] {
    const tokens = new Set<string>();
    // Extract every var(--token ...) occurrence, including nested fallbacks like:
    // var(--a, var(--b))  -> should yield ["--a","--b"]
    const re = /var\(\s*(--[A-Za-z0-9_-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(value)) !== null) {
        const t = m[1];
        if (t && t.startsWith("--")) tokens.add(t);
    }
    return Array.from(tokens);
}

function extractCustomPropDefinitions(cssText: string): string[] {
    // Best-effort extract of custom property names defined in cssText: "--foo: ..."
    const found = new Set<string>();
    const re = /(?:^|;)\s*(--[A-Za-z0-9_-]+)\s*:/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cssText)) !== null) {
        found.add(m[1]);
    }
    return Array.from(found);
}

function pickTopProvenance(list: AuthorStyleProvenance[], max = 5): AuthorStyleProvenance[] {
    return list.slice(0, max);
}

async function sendMessageToTabFrame(
    tabId: number,
    frameId: number | undefined,
    message: any
): Promise<any> {
    return await new Promise((resolve, reject) => {
        try {
            if (typeof frameId === "number") {
                chrome.tabs.sendMessage(tabId, message, { frameId }, (resp) => {
                    const err = chrome.runtime.lastError;
                    if (err) return reject(new Error(err.message));
                    resolve(resp);
                });
            } else {
                chrome.tabs.sendMessage(tabId, message, (resp) => {
                    const err = chrome.runtime.lastError;
                    if (err) return reject(new Error(err.message));
                    resolve(resp);
                });
            }
        } catch (e) {
            reject(e);
        }
    });
}

async function sendCdpCommand<T = any>(tabId: number, method: string, params?: any): Promise<T> {
    return await chrome.debugger.sendCommand({ tabId }, method as any, params);
}

async function resolveNodeIdByPoints(tabId: number, points: HitTestPoint[]): Promise<number | null> {
    // Try multiple points, returning the first successful nodeId.
    for (const p of points) {
        try {
            const resp: any = await sendCdpCommand(tabId, "DOM.getNodeForLocation", {
                x: p.x,
                y: p.y,
                includeUserAgentShadowDOM: true,
                ignorePointerEventsNone: true,
            });
            const nodeId = resp?.nodeId;
            if (typeof nodeId === "number" && nodeId > 0) {
                return nodeId;
            }
        } catch {
            // ignore and continue
        }
    }
    return null;
}

function bboxFromQuad(quad: number[]): { left: number; top: number; right: number; bottom: number } | null {
    if (!Array.isArray(quad) || quad.length < 8) return null;
    const xs = [quad[0], quad[2], quad[4], quad[6]];
    const ys = [quad[1], quad[3], quad[5], quad[7]];
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom)) return null;
    return { left, top, right, bottom };
}

function iou(a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }): number {
    const interLeft = Math.max(a.left, b.left);
    const interTop = Math.max(a.top, b.top);
    const interRight = Math.min(a.right, b.right);
    const interBottom = Math.min(a.bottom, b.bottom);
    const interW = Math.max(0, interRight - interLeft);
    const interH = Math.max(0, interBottom - interTop);
    const interArea = interW * interH;
    const areaA = Math.max(0, a.right - a.left) * Math.max(0, a.bottom - a.top);
    const areaB = Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
    const union = areaA + areaB - interArea;
    if (union <= 0) return 0;
    return interArea / union;
}

async function resolveNodeIdByScoring(
    tabId: number,
    points: HitTestPoint[],
    target: TargetBox
): Promise<number | null> {
    // Collect candidate nodeIds from points
    const candidates = new Set<number>();
    for (const p of points) {
        try {
            const resp: any = await sendCdpCommand(tabId, "DOM.getNodeForLocation", {
                x: p.x,
                y: p.y,
                includeUserAgentShadowDOM: true,
                ignorePointerEventsNone: true,
            });
            if (typeof resp?.nodeId === "number") candidates.add(resp.nodeId);
        } catch {
            // ignore
        }
    }
    if (candidates.size === 0) return null;

    const targetPage = {
        left: target.left + target.scrollX,
        top: target.top + target.scrollY,
        right: target.left + target.scrollX + target.width,
        bottom: target.top + target.scrollY + target.height,
    };

    let bestNodeId: number | null = null;
    let bestScore = -1;
    let bestDepth = -1;

    for (const nodeId of candidates) {
        try {
            const box: any = await sendCdpCommand(tabId, "DOM.getBoxModel", { nodeId });
            const quad = box?.model?.border;
            const bb = bboxFromQuad(quad);
            if (!bb) continue;

            // Score: IoU with slight penalty for big area mismatch
            const scoreIou = iou(bb, targetPage);
            const areaA = Math.max(0, bb.right - bb.left) * Math.max(0, bb.bottom - bb.top);
            const areaT = Math.max(1, target.width * target.height);
            const ratio = areaA / areaT;

            // Discard extreme outliers early (likely overlay/backdrop or distant parent)
            if (ratio > 25 || ratio < 0.02) {
                continue;
            }

            const areaPenalty = ratio > 1 ? Math.min(0.3, (ratio - 1) * 0.05) : Math.min(0.2, (1 / Math.max(ratio, 0.01) - 1) * 0.05);
            let score = scoreIou - areaPenalty;

            // Prefer pointer-events != none
            try {
                const computed: any = await sendCdpCommand(tabId, "CSS.getComputedStyleForNode", { nodeId });
                const entries: any[] = Array.isArray(computed?.computedStyle) ? computed.computedStyle : [];
                const pe = entries.find((e) => e?.name === "pointer-events")?.value;
                if (typeof pe === "string" && pe.trim() === "none") {
                    score -= 0.15;
                }
            } catch {
                // ignore
            }

            // Tie-break: prefer deeper nodes (more specific control)
            let depth = 0;
            try {
                let currentId: number | null = nodeId;
                for (let i = 0; i < 25 && currentId; i++) {
                    const desc: any = await sendCdpCommand(tabId, "DOM.describeNode", { nodeId: currentId });
                    const parentId = desc?.node?.parentId;
                    if (typeof parentId !== "number" || parentId <= 0) break;
                    depth++;
                    currentId = parentId;
                }
            } catch {
                depth = 0;
            }

            if (score > bestScore || (Math.abs(score - bestScore) < 0.01 && depth > bestDepth)) {
                bestScore = score;
                bestNodeId = nodeId;
                bestDepth = depth;
            }
        } catch {
            // ignore
        }
    }

    devLog("[UI Inventory][CDP] node scoring", {
        candidates: candidates.size,
        bestScore,
        bestDepth,
        bestNodeId,
    });

    // Confidence threshold: if we can't confidently match, fall back to marker resolver.
    if (bestScore < 0.2) {
        return null;
    }

    return bestNodeId;
}

async function collectAuthorStylesForCapture(
    tabId: number,
    points: HitTestPoint[],
    targetBox?: TargetBox,
    options?: {
        captureUrl?: string; // Used to find the correct frame for marker resolution (best-effort)
        markerId?: string; // If provided, resolve node via marker instead of hit-test points
        forcedPseudoClasses?: Array<"hover" | "active" | "focus">;
        applyFocus?: boolean;
        setAttributes?: Record<string, string | null>; // null => remove attribute
        disableTransitions?: boolean; // best-effort: set transition/animation none on the target while capturing
        mouseMoveTo?: { x: number; y: number }; // best-effort: move pointer to ensure real :hover is on/off
        settleMs?: number; // best-effort: wait after forcing state before reading styles
        screenshot?: {
            boundingBox: { left: number; top: number; width: number; height: number };
            devicePixelRatio: number;
        };
    }
): Promise<{
    author: AuthorStyleEvidence;
    evidenceMethod: "cdp";
    provenanceMap: Map<string, { url?: string; origin?: string }>;
    tokens?: TokenEvidence;
    computedStyles?: Record<string, string>;
    screenshot?: CaptureRecordV2["screenshot"] | null;
}>{
    // Collect stylesheet headers (id -> {url, origin}) while CSS is enabled.
    const provenanceMap = new Map<string, { url?: string; origin?: string }>();
    const contextByFrameId = new Map<string, number>();

    const onEvent = (source: chrome.debugger.Debuggee, method: string, params?: any) => {
        if (source.tabId !== tabId) return;
        if (method === "CSS.styleSheetAdded") {
            const header = params?.header;
            const styleSheetId = header?.styleSheetId;
            if (typeof styleSheetId === "string") {
                provenanceMap.set(styleSheetId, {
                    url: header?.sourceURL,
                    origin: header?.origin,
                });
            }
        }
        if (method === "Runtime.executionContextCreated") {
            const ctx = params?.context;
            const aux = ctx?.auxData;
            const frameId = aux?.frameId;
            const isDefault = aux?.isDefault;
            const id = ctx?.id;
            if (typeof frameId === "string" && isDefault === true && typeof id === "number") {
                contextByFrameId.set(frameId, id);
            }
        }
    };

    chrome.debugger.onEvent.addListener(onEvent);

    // State/mutation cleanup needs these in finally scope
    let nodeId: number | null = null;
    const prevAttrs = new Map<string, string | null>();

    try {
        await chrome.debugger.attach({ tabId }, "1.3");
        cdpAttachedTabs.add(tabId);

        // Enable domains (also triggers styleSheetAdded events)
        await sendCdpCommand(tabId, "Page.enable");
        await sendCdpCommand(tabId, "Runtime.enable");
        await sendCdpCommand(tabId, "DOM.enable");
        await sendCdpCommand(tabId, "CSS.enable");

        // Ensure document is available
        await sendCdpCommand(tabId, "DOM.getDocument", { depth: 1, pierce: true });

        // Resolve nodeId via marker (frame-aware) or via hit-test points (scoring)

        const markerId = options?.markerId;
        if (markerId && typeof markerId === "string" && markerId.trim() !== "") {
            devLog("[UI Inventory][CDP] resolving via marker", { tabId, markerId, captureUrl: options?.captureUrl });
            // Best-effort: map captureUrl -> frameId using Page.getFrameTree
            const captureUrl = options?.captureUrl;
            let targetFrameId: string | null = null;
            try {
                const frameTreeResp: any = await sendCdpCommand(tabId, "Page.getFrameTree");
                const root = frameTreeResp?.frameTree;

                const findFrameIdByUrl = (node: any): string | null => {
                    if (!node) return null;
                    const frame = node.frame;
                    if (frame && typeof frame.url === "string" && typeof frame.id === "string") {
                        if (captureUrl && frame.url === captureUrl) {
                            return frame.id;
                        }
                    }
                    const children = Array.isArray(node.childFrames) ? node.childFrames : [];
                    for (const child of children) {
                        const found = findFrameIdByUrl(child);
                        if (found) return found;
                    }
                    return null;
                };

                targetFrameId = findFrameIdByUrl(root);
            } catch {
                targetFrameId = null;
            }

            // Pick an execution context
            const contextId = (targetFrameId && contextByFrameId.get(targetFrameId))
                ? contextByFrameId.get(targetFrameId)!
                : (() => {
                    // Fall back to any default context
                    const first = contextByFrameId.values().next().value;
                    return typeof first === "number" ? first : null;
                })();

            if (!contextId) {
                throw new Error("No CDP execution context available for marker resolution");
            }
            devLog("[UI Inventory][CDP] marker context selected", { targetFrameId, contextId });

            const expr = `document.querySelector('[data-uiinv-target=\"${markerId.replace(/\"/g, "\\\\\"")}\"]')`;
            const evalResp: any = await sendCdpCommand(tabId, "Runtime.evaluate", {
                expression: expr,
                contextId,
                returnByValue: false,
                awaitPromise: false,
            });

            const objectId = evalResp?.result?.objectId;
            if (!objectId) {
                throw new Error("Marker element not found in target frame");
            }

            const reqNodeResp: any = await sendCdpCommand(tabId, "DOM.requestNode", { objectId });
            const resolvedNodeId = reqNodeResp?.nodeId;
            if (typeof resolvedNodeId !== "number" || resolvedNodeId <= 0) {
                throw new Error("Failed to request nodeId from marker element");
            }
            nodeId = resolvedNodeId;
        } else {
            nodeId = targetBox
                ? await resolveNodeIdByScoring(tabId, points, targetBox)
                : await resolveNodeIdByPoints(tabId, points);
        }

        if (!nodeId) {
            throw new Error("Failed to resolve nodeId from hit-test points");
        }

        // Optional: apply state forcing/mutations BEFORE reading styles and capturing screenshot
        const forced = options?.forcedPseudoClasses?.length ? options.forcedPseudoClasses : null;
        const willFocus = options?.applyFocus === true;
        const setAttrs = options?.setAttributes ?? null;
        const disableTransitions = options?.disableTransitions === true;
        const mouseMoveTo = options?.mouseMoveTo;

        try {
            if (mouseMoveTo && Number.isFinite(mouseMoveTo.x) && Number.isFinite(mouseMoveTo.y)) {
                try {
                    await sendCdpCommand(tabId, "Input.dispatchMouseEvent", {
                        type: "mouseMoved",
                        x: Math.round(mouseMoveTo.x),
                        y: Math.round(mouseMoveTo.y),
                        buttons: 0,
                    });
                } catch {
                    // ignore
                }
            }
            if (setAttrs || disableTransitions) {
                try {
                    const desc: any = await sendCdpCommand(tabId, "DOM.describeNode", { nodeId });
                    const attrs: any[] = Array.isArray(desc?.node?.attributes) ? desc.node.attributes : [];
                    const attrMap = new Map<string, string>();
                    for (let i = 0; i + 1 < attrs.length; i += 2) {
                        attrMap.set(String(attrs[i] ?? ""), String(attrs[i + 1] ?? ""));
                    }
                    if (disableTransitions) {
                        const prevStyle = attrMap.has("style") ? attrMap.get("style")! : null;
                        // Only capture previous style once (in case other branches also touch it)
                        if (!prevAttrs.has("style")) {
                            prevAttrs.set("style", prevStyle);
                        }
                        const base = (prevStyle ?? "").trim();
                        const nextStyle = `${base}${base && !base.endsWith(";") ? ";" : ""}transition:none !important;animation:none !important;`;
                        await sendCdpCommand(tabId, "DOM.setAttributeValue", { nodeId, name: "style", value: nextStyle });
                    }
                    for (const [k, v] of Object.entries(setAttrs)) {
                        prevAttrs.set(k, attrMap.has(k) ? attrMap.get(k)! : null);
                        if (v === null) {
                            await sendCdpCommand(tabId, "DOM.removeAttribute", { nodeId, name: k });
                        } else {
                            await sendCdpCommand(tabId, "DOM.setAttributeValue", { nodeId, name: k, value: v });
                        }
                    }
                } catch {
                    // ignore mutation failures
                }
            }
            if (willFocus) {
                try {
                    await sendCdpCommand(tabId, "DOM.focus", { nodeId });
                } catch {
                    // ignore
                }
            }
            if (forced) {
                try {
                    await sendCdpCommand(tabId, "CSS.forcePseudoState", { nodeId, forcedPseudoClasses: forced });
                } catch {
                    // ignore
                }
            }
        } catch {
            // ignore
        }

        // Best-effort settle delay to allow style recalc/paint after pseudo forcing
        const settleMs = options?.settleMs;
        if (typeof settleMs === "number" && Number.isFinite(settleMs) && settleMs > 0) {
            await new Promise<void>(resolve => setTimeout(resolve, Math.min(250, Math.round(settleMs))));
        }

        // Capture screenshot while state forcing is applied (best-effort)
        const screenshot = options?.screenshot
            ? await captureScreenshot(tabId, options.screenshot.boundingBox, options.screenshot.devicePixelRatio)
            : null;

        const matchedResp: any = await sendCdpCommand(tabId, "CSS.getMatchedStylesForNode", { nodeId });
        const computedResp: any = await sendCdpCommand(tabId, "CSS.getComputedStyleForNode", { nodeId });

        const matchedCSSRules = Array.isArray(matchedResp?.matchedCSSRules) ? matchedResp.matchedCSSRules : [];
        const inherited = Array.isArray(matchedResp?.inherited) ? matchedResp.inherited : [];
        const inlineStyle = matchedResp?.inlineStyle;
        const attributesStyle = matchedResp?.attributesStyle;
        const inheritedRuleMatches: any[] = inherited.flatMap((b: any) =>
            Array.isArray(b?.matchedCSSRules) ? b.matchedCSSRules : []
        );
        const allRuleMatches: any[] = [...matchedCSSRules, ...inheritedRuleMatches];
        const computedStyle = Array.isArray(computedResp?.computedStyle) ? computedResp.computedStyle : [];
        const computedMap = new Map<string, string>();
        for (const entry of computedStyle) {
            if (entry && typeof entry.name === "string") {
                computedMap.set(entry.name, String(entry.value ?? ""));
            }
        }
        const computedStyles: Record<string, string> = {};
        for (const [k, v] of computedMap.entries()) computedStyles[k] = v;

        const properties: AuthorStyleEvidence["properties"] = {};
        const tokensUsed: TokenEvidence["used"] = [];
        const tokensUsedSet = new Set<string>();

        // For each property, scan matched + inherited rules and capture authored + provenance list.
        // IMPORTANT: prefer matched rules over inherited, so we don't accidentally pick inherited `color`
        // when the element has an overriding declaration (e.g. `color: var(--a, var(--b))`).
        for (const [key, cssProp] of Object.entries(AUTHOR_PROP_MAP) as Array<[AuthorStylePropertyKey, string]>) {
            const provList: AuthorStyleProvenance[] = [];
            let authoredValue: string | null = null;

            const scan = (rules: any[]) => {
                for (let idx = rules.length - 1; idx >= 0; idx--) {
                    const ruleMatch = rules[idx];
                    const rule = ruleMatch?.rule;
                    const selectorText = rule?.selectorList?.text;
                    const styleSheetId = rule?.styleSheetId;
                    const origin = rule?.origin;
                    const cssText = rule?.style?.cssText;
                    const cssProperties = rule?.style?.cssProperties;

                    let declVal = extractDeclarationValue(String(cssText ?? ""), cssProp);
                    if (declVal === null) {
                        const fallbacks = AUTHOR_PROP_SHORTHAND_FALLBACKS[key] ?? [];
                        for (const fb of fallbacks) {
                            declVal = extractDeclarationValue(String(cssText ?? ""), fb);
                            if (declVal !== null) break;
                        }
                    }
                    // Fallback: use structured cssProperties (more reliable than cssText)
                    if (declVal === null) {
                        declVal = extractValueFromCssProperties(cssProperties, cssProp);
                        if (declVal === null) {
                            const fallbacks = AUTHOR_PROP_SHORTHAND_FALLBACKS[key] ?? [];
                            for (const fb of fallbacks) {
                                declVal = extractValueFromCssProperties(cssProperties, fb);
                                if (declVal !== null) break;
                            }
                        }
                    }

                    if (declVal !== null) {
                        const header = typeof styleSheetId === "string" ? provenanceMap.get(styleSheetId) : undefined;
                        provList.push({
                            selectorText: typeof selectorText === "string" ? selectorText : "(unknown selector)",
                            styleSheetUrl: header?.url ?? null,
                            origin: (header?.origin ?? origin ?? null) as any,
                        });
                        if (authoredValue === null) authoredValue = declVal;
                        if (provList.length >= 5) return;
                    }
                }
            };

            // Prefer matched rules (element-specific), then inherited.
            scan(matchedCSSRules);

            // Only scan inherited rules for properties that actually inherit
            if (authoredValue === null && INHERITED_PROPERTIES.has(key)) {
                scan(inheritedRuleMatches);
            }

            const resolvedValue = normalizeWhitespace(computedMap.get(cssProp) ?? "");

            // Only store if we have any signal at all
            if (authoredValue !== null || resolvedValue) {
                properties[key] = {
                    authoredValue,
                    resolvedValue: resolvedValue || null,
                    provenance: provList.length ? pickTopProvenance(provList, 5) : undefined,
                };

                // Token usage extraction (authoredValue only)
                if (authoredValue) {
                    const tokens = extractVarTokensFromValue(authoredValue);
                    for (const token of tokens) {
                        const usageKey = `${key}|${token}`;
                        if (tokensUsedSet.has(usageKey)) continue;
                        tokensUsedSet.add(usageKey);
                        tokensUsed.push({
                            property: key,
                            token,
                            resolvedValue: resolvedValue || null,
                        });
                    }
                }
            }
        }

        // Best-effort token definition provenance: scan matched + inherited rules for "--token:" declarations
        const definitions: NonNullable<TokenEvidence["definitions"]> = [];
        if (tokensUsed.length > 0) {
            const want = new Set(tokensUsed.map((t) => t.token));
            const seenDef = new Set<string>(); // token|selector|url

            for (const ruleMatch of allRuleMatches) {
                const rule = ruleMatch?.rule;
                const selectorText = rule?.selectorList?.text;
                const styleSheetId = rule?.styleSheetId;
                const origin = rule?.origin;
                const cssText = String(rule?.style?.cssText ?? "");
                if (!cssText) continue;

                // Prefer structured cssProperties for custom property definitions
                const definedTokens = (() => {
                    const fromProps = Array.isArray(rule?.style?.cssProperties)
                        ? rule.style.cssProperties
                              .filter((p: any) => typeof p?.name === "string" && p.name.startsWith("--"))
                              .map((p: any) => p.name)
                        : [];
                    if (fromProps.length) return Array.from(new Set(fromProps));
                    return extractCustomPropDefinitions(cssText);
                })();
                if (definedTokens.length === 0) continue;

                const header = typeof styleSheetId === "string" ? provenanceMap.get(styleSheetId) : undefined;
                const url = header?.url ?? null;
                const sel = typeof selectorText === "string" ? selectorText : "(unknown selector)";
                const org = (header?.origin ?? origin ?? null) as any;

                for (const token of definedTokens) {
                    if (!want.has(token)) continue;
                    const key = `${token}|${sel}|${url ?? ""}`;
                    if (seenDef.has(key)) continue;
                    seenDef.add(key);
                    const definedValue =
                        extractValueFromCssProperties(rule?.style?.cssProperties, token) ??
                        extractDeclarationValue(cssText, token);
                    definitions.push({
                        token,
                        definedValue: definedValue ?? null,
                        selectorText: sel,
                        styleSheetUrl: url,
                        origin: org,
                    });
                    if (definitions.length >= 50) break; // cap payload
                }
                if (definitions.length >= 50) break;
            }
        }

        const tokens: TokenEvidence | undefined = (tokensUsed.length || definitions.length)
            ? {
                used: tokensUsed,
                definitions: definitions.length ? definitions : undefined,
            }
            : undefined;

        return { author: { properties }, evidenceMethod: "cdp", provenanceMap, tokens, computedStyles, screenshot };
    } finally {
        chrome.debugger.onEvent.removeListener(onEvent);
        // Clear forced pseudo state and restore attributes (best-effort)
        try {
            // nodeId is defined in the outer scope of this function; guard on presence
            if (typeof nodeId === "number" && nodeId > 0) {
                if (options?.forcedPseudoClasses?.length) {
                    try {
                        await sendCdpCommand(tabId, "CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
                    } catch {
                        // ignore
                    }
                }
                if (prevAttrs.size > 0) {
                    for (const [k, prev] of prevAttrs.entries()) {
                        try {
                            if (prev === null) {
                                await sendCdpCommand(tabId, "DOM.removeAttribute", { nodeId, name: k });
                            } else {
                                await sendCdpCommand(tabId, "DOM.setAttributeValue", { nodeId, name: k, value: prev });
                            }
                        } catch {
                            // ignore
                        }
                    }
                }
            }
        } catch {
            // ignore
        }
        try {
            await chrome.debugger.detach({ tabId });
        } catch {
            // ignore
        } finally {
            cdpAttachedTabs.delete(tabId);
        }
    }
}

/**
 * Bug 1 fix: Create default StylePrimitives placeholder
 */
function makeDefaultPrimitives(): StylePrimitives {
    return {
        spacing: {
            paddingTop: "0px",
            paddingRight: "0px",
            paddingBottom: "0px",
            paddingLeft: "0px",
        },
        backgroundColor: { raw: "transparent", rgba: null },
        color: { raw: "inherit", rgba: null },
        borderColor: { raw: "transparent", rgba: null },
        shadow: { boxShadowRaw: "none", shadowPresence: "none", shadowLayerCount: null },
    };
}

/**
 * Persistence key generator for enabled state
 */
const enabledKey = (tabId: number) => `uiinv_enabled_${tabId}`;

/**
 * Persist enabled state to chrome.storage.session
 */
async function setEnabledPersisted(tabId: number, enabled: boolean): Promise<void> {
    const key = enabledKey(tabId);
    try {
        await chrome.storage.session.set({ [key]: enabled });
        console.log("[UI Inventory] Persisted enabled for tab", tabId, ":", enabled);
    } catch (err) {
        console.warn("[UI Inventory] Failed to persist enabled:", err);
    }
}

/**
 * Persistence key generator for active project (7.8 fix)
 */
const activeProjectKey = (tabId: number) => `uiinv_activeproject_${tabId}`;

/**
 * Persist active project for tab to chrome.storage.session (7.8 fix)
 * This survives service worker restarts
 */
async function setActiveProjectPersisted(tabId: number, projectId: string | null): Promise<void> {
    const key = activeProjectKey(tabId);
    try {
        if (projectId === null) {
            await chrome.storage.session.remove(key);
            console.log("[UI Inventory] Cleared active project for tab", tabId);
        } else {
            await chrome.storage.session.set({ [key]: projectId });
            console.log("[UI Inventory] Persisted active project for tab", tabId, ":", projectId);
        }
    } catch (err) {
        console.warn("[UI Inventory] Failed to persist active project:", err);
    }
}

/**
 * Get active project for tab from chrome.storage.session (7.8 fix)
 * Used to rehydrate after service worker restart
 */
async function getActiveProjectPersisted(tabId: number): Promise<string | null> {
    const key = activeProjectKey(tabId);
    try {
        const result = await chrome.storage.session.get(key);
        const projectId = result[key] || null;
        if (projectId) {
            console.log("[UI Inventory] Rehydrated active project for tab", tabId, ":", projectId);
        }
        return projectId;
    } catch (err) {
        console.warn("[UI Inventory] Failed to get active project from storage:", err);
        return null;
    }
}

/**
 * Persistence key for lastActiveAuditTabId (7.8 fix)
 */
const lastActiveAuditTabIdKey = () => "uiinv_last_active_audit_tab_id";

/**
 * Persist lastActiveAuditTabId to chrome.storage.session (7.8 fix)
 * This survives service worker restarts
 */
async function setLastActiveAuditTabIdPersisted(tabId: number): Promise<void> {
    const key = lastActiveAuditTabIdKey();
    try {
        await chrome.storage.session.set({ [key]: tabId });
        console.log("[UI Inventory] Persisted lastActiveAuditTabId:", tabId);
    } catch (err) {
        console.warn("[UI Inventory] Failed to persist lastActiveAuditTabId:", err);
    }
}

/**
 * Get lastActiveAuditTabId from chrome.storage.session (7.8 fix)
 * Used to rehydrate after service worker restart
 */
async function getLastActiveAuditTabIdPersisted(): Promise<number | null> {
    const key = lastActiveAuditTabIdKey();
    try {
        const result = await chrome.storage.session.get(key);
        const tabId = result[key] || null;
        if (tabId !== null) {
            console.log("[UI Inventory] Rehydrated lastActiveAuditTabId:", tabId);
        }
        return tabId;
    } catch (err) {
        console.warn("[UI Inventory] Failed to get lastActiveAuditTabId from storage:", err);
        return null;
    }
}

/**
 * Persistence key for activeAuditTabId (7.8.1: one-tab-at-a-time capture)
 */
const activeAuditTabIdKey = () => "uiinv_active_audit_tab_id";

/**
 * Persist activeAuditTabId to chrome.storage.session (7.8.1)
 * This tracks which tab currently "owns" capture mode
 */
async function setActiveAuditTabIdPersisted(tabId: number | null): Promise<void> {
    const key = activeAuditTabIdKey();
    try {
        if (tabId === null) {
            await chrome.storage.session.remove(key);
            console.log("[UI Inventory] Cleared activeAuditTabId");
        } else {
            await chrome.storage.session.set({ [key]: tabId });
            console.log("[UI Inventory] Persisted activeAuditTabId:", tabId);
        }
    } catch (err) {
        console.warn("[UI Inventory] Failed to persist activeAuditTabId:", err);
    }
}

/**
 * Get activeAuditTabId from chrome.storage.session (7.8.1)
 * Used to determine which tab owns capture mode
 */
async function getActiveAuditTabIdPersisted(): Promise<number | null> {
    const key = activeAuditTabIdKey();
    try {
        const result = await chrome.storage.session.get(key);
        const tabId = result[key] || null;
        if (tabId !== null) {
            console.log("[UI Inventory] Rehydrated activeAuditTabId:", tabId);
        }
        return tabId;
    } catch (err) {
        console.warn("[UI Inventory] Failed to get activeAuditTabId from storage:", err);
        return null;
    }
}

/**
 * Retrieve enabled state from chrome.storage.session
 */
async function getEnabledPersisted(tabId: number): Promise<boolean | null> {
    const key = enabledKey(tabId);
    try {
        const result = await chrome.storage.session.get(key);
        const value = result[key];
        return typeof value === "boolean" ? value : null;
    } catch (err) {
        console.warn("[UI Inventory] Failed to retrieve enabled:", err);
        return null;
    }
}

/**
 * Bug 4 fix: Persist sessionId to chrome.storage.session
 */
async function persistSessionIdForTab(tabId: number, sessionId: string): Promise<void> {
    const key = `uiinv_session_${tabId}`;
    try {
        await chrome.storage.session.set({ [key]: sessionId });
        console.log("[UI Inventory] Persisted sessionId for tab", tabId, ":", sessionId);
    } catch (err) {
        console.warn("[UI Inventory] Failed to persist sessionId:", err);
    }
}

/**
 * Bug 4 fix: Retrieve sessionId from chrome.storage.session
 */
async function retrieveSessionIdForTab(tabId: number): Promise<string | null> {
    const key = `uiinv_session_${tabId}`;
    try {
        const result = await chrome.storage.session.get(key);
        const value = result[key];
        return (typeof value === "string" ? value : null);
    } catch (err) {
        console.warn("[UI Inventory] Failed to retrieve sessionId:", err);
        return null;
    }
}

/**
 * Bug 4 fix: Clear sessionId from chrome.storage.session
 */
async function clearSessionIdForTab(tabId: number): Promise<void> {
    const key = `uiinv_session_${tabId}`;
    try {
        await chrome.storage.session.remove(key);
        console.log("[UI Inventory] Cleared sessionId for tab", tabId);
    } catch (err) {
        console.warn("[UI Inventory] Failed to clear sessionId:", err);
    }
}

/**
 * Tab routing fix: Resolve tabId from sender or message
 * Does NOT guess with lastFocusedWindow - returns null if not explicitly provided
 */
function resolveTabId(msg: any, sender: chrome.runtime.MessageSender): number | null {
    // First check sender.tab.id (from content script)
    if (sender.tab?.id && typeof sender.tab.id === "number") {
        return sender.tab.id;
    }
    // Then check explicit tabId from popup
    if (typeof msg?.tabId === "number") {
        return msg.tabId;
    }
    // Finally fallback to last active audit tab (for side panel)
    if (lastActiveAuditTabId !== null) {
        return lastActiveAuditTabId;
    }
    // Do not guess - return null
    return null;
}

/**
 * 7.8.x: One-tab-at-a-time enforcement helper
 * Turns off audit mode for a specific tab and clears its session pointer.
 */
async function disableAuditForTab(tabId: number, reason: string): Promise<void> {
    try {
        auditEnabledByTab.set(tabId, false);
        await setEnabledPersisted(tabId, false);

        // Clear session pointer for this tab when audit is disabled
        await clearSessionIdForTab(tabId);
        activeSessionIdByTab.delete(tabId);

        // Best-effort: tell content script to stop capture/highlight mode
        chrome.tabs.sendMessage(tabId, { type: "AUDIT/TOGGLE", enabled: false }, () => {
            const err = chrome.runtime.lastError;
            if (err) {
                console.warn("[UI Inventory] disableAuditForTab sendMessage failed:", err.message);
            }
        });

        console.log("[UI Inventory] Disabled audit for tab", tabId, "reason:", reason);
    } catch (err) {
        console.warn("[UI Inventory] Failed to disable audit for tab", tabId, "reason:", reason, "err:", err);
    }
}

/**
 * Ensure offscreen document exists (create once, reuse)
 */
async function ensureOffscreenDocument(): Promise<void> {
    if (offscreenDocumentCreated) {
        return;
    }

    try {
        // Check if offscreen document already exists
        const has = await chrome.offscreen.hasDocument();
        if (has) {
            offscreenDocumentCreated = true;
            return;
        }

        // Create offscreen document
        await chrome.offscreen.createDocument({
            url: "offscreen.html",
            reasons: ["BLOBS" as chrome.offscreen.Reason],
            justification: "Process and encode screenshot images using OffscreenCanvas",
        });

        offscreenDocumentCreated = true;
        console.log("[UI Inventory] Created offscreen document");
    } catch (err) {
        console.error("[UI Inventory] Failed to create offscreen document:", err);
        throw err;
    }
}

/**
 * Capture screenshot of element and store as blob
 * Returns screenshot reference or null on error
 */
async function captureScreenshot(
    tabId: number,
    boundingBox: { left: number; top: number; width: number; height: number },
    devicePixelRatio: number
): Promise<{ screenshotBlobId: string; mimeType: string; width: number; height: number } | null> {
    try {
        // Get tab to retrieve windowId
        const tab = await chrome.tabs.get(tabId);
        const windowId = tab.windowId;

        // Capture visible tab with proper windowId
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
            format: "png",
        });

        // Ensure offscreen document exists
        await ensureOffscreenDocument();

        // Send crop/encode request to offscreen document
        const response: any = await chrome.runtime.sendMessage({
            type: "OFFSCREEN/CROP_ENCODE",
            dataUrl,
            cropRectCssPx: boundingBox,
            devicePixelRatio,
            mimeType: "image/webp",
            quality: 0.8,
            maxDim: 1200,
        });

        console.log("[UI Inventory] Offscreen response:", response?.ok ? "ok" : "error",
            "arrayBuffer length:", response?.arrayBuffer?.length || 0);

        if (!response.ok || !response.arrayBuffer) {
            console.error("[UI Inventory] Screenshot crop/encode failed:", response.error);
            return null;
        }

        // Convert Array back to Uint8Array, then to Blob
        // (ArrayBuffers don't survive chrome.runtime.sendMessage, so offscreen sends Array)
        const uint8Array = new Uint8Array(response.arrayBuffer);
        const blob = new Blob([uint8Array], { type: response.mimeType });
        console.log("[UI Inventory] Created blob from byte array, blob.size:", blob.size);

        // Create blob record
        const blobId = generateBlobId();
        const blobRecord: BlobRecord = {
            id: blobId,
            createdAt: Date.now(),
            mimeType: response.mimeType,
            width: response.width,
            height: response.height,
            blob,
        };

        // Save blob to IndexedDB
        await saveBlob(blobRecord);

        console.log("[UI Inventory] Screenshot saved:", blobId, `${response.width}x${response.height}`);

        return {
            screenshotBlobId: blobId,
            mimeType: response.mimeType,
            width: response.width,
            height: response.height,
        };
    } catch (err) {
        console.error("[UI Inventory] Screenshot capture failed:", err);
        return null;
    }
}

/**
 * Ensure a session exists for the given tab
 * Creates a new session if one doesn't exist
 * Returns the sessionId
 */
async function ensureSession(tabId: number): Promise<string> {
    // Check if we already have an active session for this tab
    const existingSessionId = activeSessionIdByTab.get(tabId);
    if (existingSessionId) {
        return existingSessionId;
    }

    // Create a new session
    const sessionId = generateSessionId();

    // Get current tab info
    let startUrl = "about:blank";
    let userAgent: string | undefined = undefined;

    try {
        const tab = await chrome.tabs.get(tabId);
        startUrl = tab.url || startUrl;

        // userAgent is available in service worker context
        if (typeof navigator !== "undefined" && navigator.userAgent) {
            userAgent = navigator.userAgent;
        }
    } catch (err) {
        console.warn("[UI Inventory] Could not get tab info for session:", err);
    }

    const session: SessionRecord = {
        id: sessionId,
        createdAt: Date.now(),
        startUrl,
        userAgent,
        pagesVisited: [startUrl],
    };

    // Persist session to IndexedDB
    await saveSession(session);

    // Track in memory
    activeSessionIdByTab.set(tabId, sessionId);

    // Bug 4 fix: Persist to chrome.storage.session for SW restart recovery
    await persistSessionIdForTab(tabId, sessionId);

    console.log("[UI Inventory] Created session:", sessionId, "for tab:", tabId);

    return sessionId;
}

/**
 * Track page navigation during audit (update session.pagesVisited)
 */
async function trackPageVisit(tabId: number, url: string): Promise<void> {
    const sessionId = activeSessionIdByTab.get(tabId);
    if (!sessionId) {
        return; // No active session for this tab
    }

    try {
        const session = await getSession(sessionId);
        if (!session) {
            console.warn("[UI Inventory] Session not found:", sessionId);
            return;
        }

        // Add URL to pagesVisited if not already present
        const pagesVisited = session.pagesVisited || [];
        if (!pagesVisited.includes(url)) {
            pagesVisited.push(url);
            session.pagesVisited = pagesVisited;

            // Persist updated session
            await saveSession(session);
            console.log("[UI Inventory] Tracked page visit:", url, "in session:", sessionId);
        }
    } catch (err) {
        console.warn("[UI Inventory] Failed to track page visit:", err);
    }
}

chrome.runtime.onInstalled.addListener(() => {
    console.log("[UI Inventory] Service worker installed");
});

// Configure side panel to open on extension icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.warn("[UI Inventory] sidePanel behavior setup failed:", err));

// Track page navigation during audit sessions
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // Only track if audit is enabled and URL changed
    if (!auditEnabledByTab.get(tabId)) {
        return;
    }

    if (changeInfo.url) {
        trackPageVisit(tabId, changeInfo.url);
    }
});

// Clean up per-tab project mapping when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    activeProjectByTabId.delete(tabId);
    console.log("[UI Inventory] Cleared active project for closed tab:", tabId);
});

// ─────────────────────────────────────────────────────────────
// Keyboard Commands (Cmd/Ctrl + Shift + U to toggle capture)
// ─────────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
    console.log("[UI Inventory] Command received:", command);
    
    if (command === "toggle-capture") {
        (async () => {
            try {
                // Get the active tab
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.id) {
                    console.warn("[UI Inventory] No active tab found for command");
                    return;
                }

                const tabId = tab.id;

                // Get current state
                const currentState = auditEnabledByTab.get(tabId) ?? currentAuditEnabled;
                const newState = !currentState;

                console.log("[UI Inventory] Toggling capture via command:", { tabId, currentState, newState });

                // Update state
                auditEnabledByTab.set(tabId, newState);
                currentAuditEnabled = newState;
                await setEnabledPersisted(tabId, newState);

                // Send message to content script
                chrome.tabs.sendMessage(
                    tabId,
                    { type: "AUDIT/TOGGLE", enabled: newState },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn("[UI Inventory] Failed to send toggle to content script:", chrome.runtime.lastError);
                        } else {
                            console.log("[UI Inventory] Toggle command sent successfully:", response);
                        }
                    }
                );

                // Broadcast state change to all extension pages (sidepanel, viewer)
                chrome.runtime.sendMessage(
                    { type: "UI/AUDIT_STATE_CHANGED", tabId, enabled: newState },
                    () => void chrome.runtime.lastError
                );
            } catch (err) {
                console.error("[UI Inventory] Error handling toggle-capture command:", err);
            }
        })();
    }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("[UI Inventory] SW got message:", msg, "from", sender);

    if (msg?.type === "AUDIT/TOGGLE") {
        // Relay toggle message to content script
        (async () => {
            const tabId = resolveTabId(msg, sender);
            if (!tabId) {
                console.warn("[UI Inventory] TOGGLE: No tab ID resolved");
                sendResponse({ ok: false, error: "No tab ID" });
                return;
            }

            // Store state for this tab
            const enabled = Boolean(msg.enabled);

            // 7.8.x: Enforce single-owner audit tab. If a new tab is enabling capture,
            // disable capture in the previous owner tab first.
            if (enabled && activeAuditTabId !== null && activeAuditTabId !== tabId) {
                await disableAuditForTab(activeAuditTabId, "owner_switched_via_toggle");
            }

            auditEnabledByTab.set(tabId, enabled);
            currentAuditEnabled = enabled;
            await setEnabledPersisted(tabId, enabled);

            // 7.8.1: Set/clear activeAuditTabId (one-tab-at-a-time ownership)
            if (enabled) {
                activeAuditTabId = tabId;
                await setActiveAuditTabIdPersisted(tabId);
                console.log("[UI Inventory] Set activeAuditTabId to:", tabId);
            } else if (activeAuditTabId === tabId) {
                // Only clear if this tab was the active one
                activeAuditTabId = null;
                await setActiveAuditTabIdPersisted(null);
                console.log("[UI Inventory] Cleared activeAuditTabId");
            }

            // Create session when audit mode is enabled
            if (enabled) {
                await ensureSession(tabId);
            } else {
                // Clear sessionId from storage when audit is disabled
                await clearSessionIdForTab(tabId);
                activeSessionIdByTab.delete(tabId);
                // Note: We keep session in IndexedDB for historical record
            }

            chrome.tabs.sendMessage(tabId, { type: "AUDIT/TOGGLE", enabled }, () => {
                const err = chrome.runtime.lastError;
                if (err) {
                    console.warn("[UI Inventory] Toggle sendMessage error:", err.message);
                    sendResponse({ ok: false, error: err.message });
                } else {
                    sendResponse({ ok: true });
                }
            });
        })();

        return true; // async response
    }

    if (msg?.type === "AUDIT/GET_STATE") {
        (async () => {
            const tabId = resolveTabId(msg, sender);
            if (!tabId) {
                sendResponse({ ok: false, error: "No tab ID" });
                return;
            }

            // Priority order: Map → persisted storage → currentAuditEnabled → content script
            const stored = auditEnabledByTab.get(tabId);
            let enabled = (typeof stored === "boolean") ? stored : currentAuditEnabled;

            // Try persisted storage
            const persisted = await getEnabledPersisted(tabId);
            if (persisted !== null) {
                enabled = persisted;
            }

            // Optionally ask content script for authoritative state
            try {
                const response: any = await new Promise((resolve) => {
                    chrome.tabs.sendMessage(tabId, { type: "AUDIT/GET_ENABLED" }, (resp) => {
                        // If sendMessage fails (no content script), resolve with null
                        if (chrome.runtime.lastError) {
                            resolve(null);
                        } else {
                            resolve(resp);
                        }
                    });
                });

                if (response?.ok && typeof response.enabled === "boolean") {
                    enabled = response.enabled;
                    // Rehydrate SW state from content script
                    auditEnabledByTab.set(tabId, enabled);
                    await setEnabledPersisted(tabId, enabled);
                    console.log("[UI Inventory] GET_STATE rehydrated from content script:", enabled);

                    // If enabled, also rehydrate sessionId from chrome.storage.session
                    if (enabled) {
                        const persistedSessionId = await retrieveSessionIdForTab(tabId);
                        if (persistedSessionId) {
                            activeSessionIdByTab.set(tabId, persistedSessionId);
                            console.log("[UI Inventory] GET_STATE rehydrated sessionId:", persistedSessionId);
                        }
                    }
                }
            } catch (err) {
                // Fall back to current enabled value if query fails
                console.warn("[UI Inventory] Failed to query content script state:", err);
            }

            const lastSelected = lastSelectedByTab.get(tabId) || null;
            sendResponse({ type: "AUDIT/STATE", enabled, lastSelected });
            console.log("[UI Inventory] GET_STATE resolved tabId:", tabId, "enabled:", enabled);

        })();

        return true; // async response
    }

    // 7.8.1: Get active audit tab ID (for Sidepanel one-tab-at-a-time UI)
    // DEPRECATED: Use AUDIT/GET_ROUTING_STATE instead
    if (msg?.type === "AUDIT/GET_ACTIVE_TAB_ID") {
        sendResponse({ ok: true, activeTabId: activeAuditTabId });
        return false; // synchronous response
    }

    // 7.8.1: Get routing state (read-only API for Sidepanel)
    if (msg?.type === "AUDIT/GET_ROUTING_STATE") {
        (async () => {
            // Rehydrate activeAuditTabId if needed
            let tabId = activeAuditTabId;
            if (tabId === null) {
                tabId = await getActiveAuditTabIdPersisted();
                if (tabId !== null) {
                    activeAuditTabId = tabId;
                    console.log("[UI Inventory] AUDIT/GET_ROUTING_STATE rehydrated activeAuditTabId:", tabId);
                }
            }
            sendResponse({ ok: true, activeAuditTabId: tabId });
        })();
        return true; // async response
    }

    // 7.8.x: Explicitly claim audit ownership for a tab (Sidepanel activation flow).
    // This does NOT enable capture by itself; it only sets the owner tab for the UI.
    if (msg?.type === "AUDIT/CLAIM_TAB") {
        (async () => {
            const tabId = resolveTabId(msg, sender);
            if (!tabId) {
                sendResponse({ ok: false, error: "No tab ID" });
                return;
            }

            const previous = activeAuditTabId;

            // If switching owners, ensure capture is disabled in the previous owner tab.
            if (previous !== null && previous !== tabId) {
                await disableAuditForTab(previous, "owner_switched_via_claim");
            }

            activeAuditTabId = tabId;
            lastActiveAuditTabId = tabId;
            await setActiveAuditTabIdPersisted(tabId);
            await setLastActiveAuditTabIdPersisted(tabId);

            // Best-effort: let all UIs know routing ownership changed
            chrome.runtime.sendMessage({ type: "UI/AUDIT_OWNER_CHANGED", activeAuditTabId: tabId }, () => void chrome.runtime.lastError);

            sendResponse({ ok: true, activeAuditTabId: tabId, previousActiveAuditTabId: previous });
        })();
        return true; // async response
    }

    // M9: Check if element has already been captured (duplicate detection)
    if (msg?.type === "AUDIT/CHECK_DUPLICATE") {
        (async () => {
            const { tagName, role, accessibleName, requestedState, elementId, elementName, placeholder } = msg;
            
            if (!tagName) {
                sendResponse({ ok: false, error: "tagName is required" });
                return;
            }

            try {
                // Derive componentKey using shared utility
                const mockCapture = {
                    element: {
                        tagName: tagName.toLowerCase(),
                        role: role || null,
                        intent: accessibleName ? { accessibleName } : undefined,
                        textPreview: accessibleName || "",
                        id: elementId || null,
                        attributes: {
                            name: elementName || undefined,
                            placeholder: placeholder || undefined,
                        }
                    }
                } as CaptureRecordV2;
                
                const componentKey = deriveComponentKey(mockCapture);
                // Also compute what the key would be if v2 records do NOT include attributes (current capture pipeline)
                const mockCaptureNoAttrs = {
                    element: {
                        tagName: tagName.toLowerCase(),
                        role: role || null,
                        intent: accessibleName ? { accessibleName } : undefined,
                        textPreview: accessibleName || "",
                        id: elementId || null,
                    }
                } as any as CaptureRecordV2;
                const componentKeyNoAttrs = deriveComponentKey(mockCaptureNoAttrs);
                
                // Get current project's captures
                const tabId = resolveTabId(msg, sender);
                if (!tabId) {
                    sendResponse({ ok: false, error: "No tab ID" });
                    return;
                }
                
                // Rehydrate active project after SW restart (mirror AUDIT/CAPTURE behavior)
                let projectId = activeProjectByTabId.get(tabId);
                if (!projectId) {
                    projectId = await getActiveProjectPersisted(tabId);
                    if (projectId) {
                        activeProjectByTabId.set(tabId, projectId);
                        console.log("[UI Inventory] AUDIT/CHECK_DUPLICATE: Rehydrated active project for tab", tabId, ":", projectId);
                    }
                }
                if (!projectId) {
                    // No project mapped, treat as not duplicate
                    sendResponse({ ok: true, isDuplicate: false, componentKey });
                    return;
                }
                
                // Get all session IDs for this project
                const sessionIds = await listSessionIdsForProject(projectId);
                
                // Get all captures for these sessions
                const allCaptures = await listCapturesBySessionIds(sessionIds);
                
                // Filter to captures with matching componentKey
                const matchingCaptures = allCaptures.filter(capture => {
                    // Backward compat: older v2 captures didn't persist element.attributes.
                    // For form elements, attempt to extract name/placeholder from outerHTML for matching.
                    const isForm = ["input", "textarea", "select"].includes(String((capture as any)?.element?.tagName ?? "").toLowerCase());
                    const hasAttrs = !!(capture as any)?.element?.attributes;
                    let normalized: CaptureRecordV2 = capture;
                    if (isForm && !hasAttrs && typeof (capture as any)?.element?.outerHTML === "string") {
                        const html = String((capture as any).element.outerHTML);
                        const mName = html.match(/\sname=\"([^\"]*)\"/i);
                        const mPh = html.match(/\splaceholder=\"([^\"]*)\"/i);
                        const attrs = {
                            name: mName ? mName[1] : undefined,
                            placeholder: mPh ? mPh[1] : undefined,
                        };
                        normalized = {
                            ...(capture as any),
                            element: {
                                ...(capture as any).element,
                                attributes: attrs,
                            },
                        } as CaptureRecordV2;
                    }
                    const captureKey = deriveComponentKey(normalized);
                    return captureKey === componentKey;
                });
                const matchingNoAttrs = allCaptures.filter(capture => {
                    const captureKey = deriveComponentKey(capture);
                    return captureKey === componentKeyNoAttrs;
                });
                
                // Check if requested state already exists
                const requestedStateNormalized = (requestedState || "default").toLowerCase();
                const existingStates = matchingCaptures.map(c => 
                    (c.styles?.evidence?.state || "default").toLowerCase()
                );
                
                const isDuplicate = existingStates.includes(requestedStateNormalized);
                
                console.log("[UI Inventory] Duplicate check:", {
                    componentKey,
                    requestedState: requestedStateNormalized,
                    existingStates,
                    matchingCaptureCount: matchingCaptures.length,
                    isDuplicate
                });
                
                sendResponse({ 
                    ok: true, 
                    isDuplicate,
                    componentKey,
                    existingStates,
                    matchingCaptureCount: matchingCaptures.length
                });
            } catch (err) {
                console.error("[UI Inventory] AUDIT/CHECK_DUPLICATE error:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();
        return true; // async response
    }

    if (msg?.type === "AUDIT/ELEMENT_SELECTED") {
        const tabId = sender.tab?.id;
        if (tabId) {
            lastSelectedByTab.set(tabId, msg);
            console.log("[UI Inventory] Stored element selection for tab", tabId, msg);
        }
        sendResponse({ ok: true });
        return true;
    }

    if (msg?.type === "AUDIT/CAPTURE") {
        (async () => {
            const tabId = sender.tab?.id;
            if (!tabId) {
                sendResponse({ ok: false, error: "No tab ID" });
                return;
            }

            // Ensure session exists for this tab
            const sessionId = await ensureSession(tabId);

            // 7.8 fix: Get active project for this tab (rehydrate from storage if missing)
            let projectId = activeProjectByTabId.get(tabId);

            if (!projectId) {
                // Rehydrate from chrome.storage.session (survives SW restarts)
                projectId = await getActiveProjectPersisted(tabId);
                if (projectId) {
                    // Restore to in-memory map
                    activeProjectByTabId.set(tabId, projectId);
                    console.log("[UI Inventory] AUDIT/CAPTURE: Rehydrated active project for tab", tabId, ":", projectId);
                } else {
                    console.warn("[UI Inventory] AUDIT/CAPTURE: No active project for tab", tabId, "- capture will not be associated with a project");
                }
            }

            // Link session to active project if one is set for this tab (non-fatal)
            if (projectId) {
                try {
                    await linkSessionToProject(projectId, sessionId);
                } catch (err) {
                    console.warn("[UI Inventory] Failed to link session to project (non-fatal):", err);
                }
            }

            // Transform incoming record to v2.2 structure
            const recordV1 = msg.record;

            // Build v2.2 element.intent from v1 element structure
            const intent = recordV1.element?.intent || {
                accessibleName: recordV1.element?.attributes?.ariaLabel || null,
                inputType: null,
                href: null,
                disabled: null,
                ariaDisabled: recordV1.element?.attributes?.ariaDisabled ? recordV1.element.attributes.ariaDisabled === "true" : null,
                checked: null,
                ariaChecked: recordV1.element?.attributes?.ariaChecked ? recordV1.element.attributes.ariaChecked === "true" : null,
            };

            // Extract devicePixelRatio for screenshot capture
            const devicePixelRatio = recordV1.conditions?.devicePixelRatio || recordV1.viewport?.devicePixelRatio || 1;

            // Capture mode (used by button-state popover in content script)
            const captureMode: string | undefined = msg?.captureOptions?.mode;
            const forcedPseudoClasses: Array<"hover" | "active"> | null =
                captureMode === "force_hover" ? ["hover"] :
                captureMode === "force_active" ? ["active"] :
                null;
            const centerX = Number(recordV1?.boundingBox?.left || 0) + Number(recordV1?.boundingBox?.width || 0) / 2;
            const centerY = Number(recordV1?.boundingBox?.top || 0) + Number(recordV1?.boundingBox?.height || 0) / 2;
            const mouseMoveTo =
                captureMode === "default" ? { x: 1, y: 1 } :
                (captureMode === "force_hover" || captureMode === "force_active") ? { x: centerX, y: centerY } :
                undefined;
            const disableTransitions = !!forcedPseudoClasses;
            const settleMs = disableTransitions ? 60 : 0;
            const evidenceState: "default" | "hover" | "active" =
                forcedPseudoClasses?.includes("hover") ? "hover" :
                forcedPseudoClasses?.includes("active") ? "active" :
                "default";

            let screenshot: CaptureRecordV2["screenshot"] | null = null;

            // Phase 1: best-effort authored+resolved styles via CDP (CDP-first, computed fallback)
            let author: AuthorStyleEvidence | undefined;
            let tokens: TokenEvidence | undefined;
            let evidenceMethod: "cdp" | "computed" = "computed";
            let cdpError: string | undefined;
            let computedStylesFromCdp: Record<string, string> | undefined;
            try {
                const senderFrameId = typeof sender.frameId === "number" ? sender.frameId : undefined;
                const points: HitTestPoint[] = Array.isArray(recordV1?.__uiinv_cdp?.hitTestPoints)
                    ? recordV1.__uiinv_cdp.hitTestPoints
                          .filter((p: any) => p && typeof p.x === "number" && typeof p.y === "number")
                          .slice(0, 8)
                    : [];

                const targetBox: TargetBox = {
                    left: Number(recordV1?.boundingBox?.left || 0),
                    top: Number(recordV1?.boundingBox?.top || 0),
                    width: Number(recordV1?.boundingBox?.width || 0),
                    height: Number(recordV1?.boundingBox?.height || 0),
                    scrollX: Number(recordV1?.viewport?.scrollX || 0),
                    scrollY: Number(recordV1?.viewport?.scrollY || 0),
                };

                const captureUrl = typeof recordV1?.url === "string" ? recordV1.url : undefined;
                const tagNameLower = String(recordV1?.element?.tagName ?? "").toLowerCase();
                const roleLower = String(recordV1?.element?.role ?? "").toLowerCase();
                const isStatefulCandidate =
                    ["button", "a", "input", "select", "textarea"].includes(tagNameLower) ||
                    ["button", "link", "textbox", "combobox", "checkbox", "radio", "switch"].includes(roleLower);
                const preferMarker =
                    isStatefulCandidate || (typeof senderFrameId === "number" && senderFrameId !== 0);

                const tryCollect = async (markerId?: string) => {
                    return await collectAuthorStylesForCapture(tabId, points, targetBox, {
                        captureUrl,
                        markerId,
                        forcedPseudoClasses: forcedPseudoClasses ?? undefined,
                        disableTransitions,
                        mouseMoveTo,
                        settleMs,
                        screenshot: {
                            boundingBox: recordV1.boundingBox,
                            devicePixelRatio,
                        },
                    });
                };

                // For iframe captures, prefer marker-based resolution (coords may be frame-relative).
                if (preferMarker) {
                    const markerId = `uiinv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                    try {
                        await sendMessageToTabFrame(tabId, senderFrameId, { type: "AUDIT/MARK_TARGET", markerId });
                        const collected = await tryCollect(markerId);
                        author = collected.author;
                        tokens = collected.tokens;
                        computedStylesFromCdp = collected.computedStyles;
                        screenshot = collected.screenshot ?? null;
                        evidenceMethod = "cdp";
                    } finally {
                        try {
                            await sendMessageToTabFrame(tabId, senderFrameId, { type: "AUDIT/UNMARK_TARGET", markerId });
                        } catch {
                            // ignore
                        }
                    }
                } else if (points.length > 0) {
                    // Main-frame: scoring resolver first, then marker fallback if needed.
                    try {
                        const collected = await tryCollect(undefined);
                        author = collected.author;
                        tokens = collected.tokens;
                        computedStylesFromCdp = collected.computedStyles;
                        screenshot = collected.screenshot ?? null;
                        evidenceMethod = "cdp";

                        // Sanity check: if CDP resolved node's computed color doesn't match content-script computed color,
                        // we likely hit an overlay/backdrop. Fall back to marker resolution to target the clicked node.
                        const primitiveColorRaw = recordV1?.styles?.primitives?.color?.raw ?? null;
                        const cdpColorResolved = author?.properties?.color?.resolvedValue ?? null;
                        const shouldRunSanityCheck = !forcedPseudoClasses && !mouseMoveTo && captureMode !== "default";
                        const mismatch = !!(shouldRunSanityCheck && primitiveColorRaw && cdpColorResolved && !colorsMatch(primitiveColorRaw, cdpColorResolved));

                        if (mismatch) {
                            const markerId = `uiinv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                            try {
                                await sendMessageToTabFrame(tabId, senderFrameId, { type: "AUDIT/MARK_TARGET", markerId });
                                const recollected = await tryCollect(markerId);
                                author = recollected.author;
                                tokens = recollected.tokens;
                                computedStylesFromCdp = recollected.computedStyles;
                                screenshot = recollected.screenshot ?? null;
                                evidenceMethod = "cdp";

                            } finally {
                                try {
                                    await sendMessageToTabFrame(tabId, senderFrameId, { type: "AUDIT/UNMARK_TARGET", markerId });
                                } catch {
                                    // ignore
                                }
                            }
                        }
                    } catch (primaryErr) {
                        const markerId = `uiinv_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                        try {
                            await sendMessageToTabFrame(tabId, senderFrameId, { type: "AUDIT/MARK_TARGET", markerId });
                            const collected = await tryCollect(markerId);
                            author = collected.author;
                            tokens = collected.tokens;
                            computedStylesFromCdp = collected.computedStyles;
                            screenshot = collected.screenshot ?? null;
                            evidenceMethod = "cdp";
                        } finally {
                            try {
                                await sendMessageToTabFrame(tabId, senderFrameId, { type: "AUDIT/UNMARK_TARGET", markerId });
                            } catch {
                                // ignore
                            }
                        }
                        // Preserve original error for debugging if marker also fails
                        if (evidenceMethod !== "cdp") {
                            throw primaryErr;
                        }
                    }
                }

            } catch (err) {
                cdpError = String(err);
                evidenceMethod = "computed";

            }

            // If CDP screenshot wasn't available, fall back to a normal tab screenshot.
            if (!screenshot) {
                try {
                    screenshot = await captureScreenshot(tabId, recordV1.boundingBox, devicePixelRatio);
                } catch {
                    screenshot = null;
                }
            }

            const recordV2: CaptureRecordV2 = {
                id: recordV1.id,
                sessionId,
                projectId, // Include projectId (may be undefined if no active project)
                captureSchemaVersion: 2,
                stylePrimitiveVersion: 1,

                url: recordV1.url,
                createdAt: recordV1.createdAt,

                // Display name defaults to capitalized tagName, description from best available text
                displayName: recordV1.element.tagName.charAt(0).toUpperCase() + recordV1.element.tagName.slice(1).toLowerCase(),
                description: (
                    intent.accessibleName ||
                    recordV1.element.textPreview ||
                    (recordV1.element as any).textContent ||
                    (recordV1.element as any).innerText ||
                    (recordV1.element as any).text ||
                    recordV1.element.attributes?.ariaLabel ||
                    undefined
                ),

                // Use conditions from content script if available, otherwise construct minimal
                conditions: recordV1.conditions || {
                    viewport: {
                        width: recordV1.viewport?.width || 0,
                        height: recordV1.viewport?.height || 0,
                    },
                    devicePixelRatio: recordV1.viewport?.devicePixelRatio || 1,
                    visualViewportScale: null,
                    browserZoom: null,
                    timestamp: recordV1.createdAt,
                    themeHint: "unknown",
                },

                // Milestone 4: preserve scope if provided (backward compatible)
                scope: recordV1.scope ?? undefined,

                element: {
                    tagName: recordV1.element.tagName,
                    role: recordV1.element.role || null,
                    id: recordV1.element.id || null,
                    classList: recordV1.element.classList,
                    textPreview: recordV1.element.textPreview,
                    outerHTML: recordV1.element.outerHTML || null, // Preserve outerHTML from content script
                    // Preserve attributes for formContext + duplicate detection
                    attributes: (recordV1.element as any).attributes || undefined,
                    intent,
                },

                boundingBox: recordV1.boundingBox,

                styles: {
                    // Use primitives from content script if available, otherwise use placeholders
                    primitives: (evidenceMethod === "cdp" && computedStylesFromCdp)
                        ? derivePrimitivesFromCdpComputedMap(computedStylesFromCdp)
                        : (recordV1.styles?.primitives || makeDefaultPrimitives()),
                    computed: recordV1.styles?.computed,
                    author,
                    evidence: {
                        method: evidenceMethod,
                        cdpError,
                        capturedAt: Date.now(),
                        state: evidenceState,
                    },
                    tokens,
                },

                screenshot: screenshot || null,

                // 7.8: All new captures are drafts until explicitly saved
                isDraft: true,
            };

            lastSelectedByTab.set(tabId, recordV2);
            console.log("[UI Inventory] Stored capture record for tab", tabId, "session", sessionId, recordV2);

            // Persist to IndexedDB with error handling
            try {
                await saveCapture(recordV2);
                // Debug log to verify projectId is saved
                console.log("[UI Inventory] Saved capture to IndexedDB:", {
                    captureId: recordV2.id,
                    projectId: recordV2.projectId || "(none)",
                    sessionId: recordV2.sessionId,
                });
            } catch (err) {
                console.error("[UI Inventory] Failed to save capture to IndexedDB:", err);
            }

            // Broadcast to any open UIs (popup, devtools, etc.)
            chrome.runtime.sendMessage(
                { type: "AUDIT/CAPTURED", record: recordV2, tabId },
                () => {
                    void chrome.runtime.lastError;
                }
            );

            // Broadcast capture saved event for side panel auto-refresh
            if (projectId) {
                chrome.runtime.sendMessage(
                    { type: "UI/CAPTURE_SAVED", projectId, captureId: recordV2.id },
                    () => {
                        void chrome.runtime.lastError;
                    }
                );
            }

            sendResponse({ ok: true });
        })();

        return true; // async response
    }

    if (msg?.type === "AUDIT/CAPTURE_REGION") {
        (async () => {
            const tabId = sender.tab?.id;
            if (!tabId) {
                sendResponse({ ok: false, error: "No tab ID" });
                return;
            }

            const boundingBox = msg.boundingBox;
            const devicePixelRatio = typeof msg.devicePixelRatio === "number" && Number.isFinite(msg.devicePixelRatio)
                ? msg.devicePixelRatio
                : 1;
            const kind: "region" | "viewport" = msg.kind === "viewport" ? "viewport" : "region";

            if (
                !boundingBox ||
                typeof boundingBox.left !== "number" ||
                typeof boundingBox.top !== "number" ||
                typeof boundingBox.width !== "number" ||
                typeof boundingBox.height !== "number"
            ) {
                sendResponse({ ok: false, error: "Invalid boundingBox" });
                return;
            }

            // Ensure session exists for this tab
            const sessionId = await ensureSession(tabId);

            // Get active project for this tab (rehydrate from storage if missing)
            let projectId = activeProjectByTabId.get(tabId);
            if (!projectId) {
                projectId = await getActiveProjectPersisted(tabId);
                if (projectId) {
                    activeProjectByTabId.set(tabId, projectId);
                    console.log("[UI Inventory] AUDIT/CAPTURE_REGION: Rehydrated active project for tab", tabId, ":", projectId);
                }
            }
            // Fallback: if we still don't have a per-tab mapping, use the current project (best-effort)
            if (!projectId && typeof currentProjectId === "string" && currentProjectId) {
                projectId = currentProjectId;
                activeProjectByTabId.set(tabId, projectId);
            }

            // Link session to active project if available (non-fatal)
            if (projectId) {
                try {
                    await linkSessionToProject(projectId, sessionId);
                } catch (err) {
                    console.warn("[UI Inventory] Failed to link session to project (non-fatal):", err);
                }
            }

            const createdAt = Date.now();
            const captureId = generateCaptureId();
            const url: string = typeof msg.url === "string" && msg.url ? msg.url : (await chrome.tabs.get(tabId)).url || "about:blank";
            const viewportWidth = Number(msg?.viewport?.width || 0);
            const viewportHeight = Number(msg?.viewport?.height || 0);

            // Screenshot (crop visible tab)
            let screenshot: CaptureRecordV2["screenshot"] | null = null;
            try {
                screenshot = await captureScreenshot(tabId, boundingBox, devicePixelRatio);
            } catch {
                screenshot = null;
            }

            const displayName = kind === "viewport" ? "Viewport" : "Region";

            const recordV2: CaptureRecordV2 = {
                id: captureId,
                sessionId,
                projectId,
                captureSchemaVersion: 2,
                stylePrimitiveVersion: 1,
                url,
                createdAt,
                displayName,
                description: undefined,
                conditions: {
                    viewport: { width: viewportWidth, height: viewportHeight },
                    devicePixelRatio,
                    visualViewportScale: null,
                    browserZoom: null,
                    timestamp: createdAt,
                    themeHint: "unknown",
                },
                element: {
                    tagName: "region",
                    role: null,
                    id: null,
                    classList: [],
                    textPreview: "",
                    outerHTML: null,
                    intent: { accessibleName: displayName },
                },
                boundingBox: {
                    left: Number(boundingBox.left),
                    top: Number(boundingBox.top),
                    width: Number(boundingBox.width),
                    height: Number(boundingBox.height),
                },
                styles: {
                    primitives: makeDefaultPrimitives(),
                    evidence: {
                        method: "computed",
                        cdpError: undefined,
                        capturedAt: Date.now(),
                        state: "default",
                    },
                },
                screenshot: screenshot || null,
                isDraft: true,
            };

            try {
                await saveCapture(recordV2);
            } catch (err) {
                console.error("[UI Inventory] Failed to save region capture to IndexedDB:", err);
            }

            chrome.runtime.sendMessage(
                { type: "AUDIT/CAPTURED", record: recordV2, tabId },
                () => void chrome.runtime.lastError
            );

            if (projectId) {
                chrome.runtime.sendMessage(
                    { type: "UI/CAPTURE_SAVED", projectId, captureId: recordV2.id },
                    () => void chrome.runtime.lastError
                );
            }

            sendResponse({ ok: true, captureId: recordV2.id, projectId: recordV2.projectId || null });
        })();

        return true;
    }

    if (msg?.type === "AUDIT/CAPTURED") {
        sendResponse({ ok: true });
        return true;
    }

    if (msg?.type === "AUDIT/LIST_CAPTURES") {
        (async () => {
            const limit = msg.limit ?? 10;
            let records;

            // Determine which captures to fetch
            if (msg.host) {
                // Explicit host provided
                records = await listRecentCapturesByHost(msg.host, limit);
            } else if (msg.scope === "site") {
                // "This site" mode - get hostname from tabId (no query)
                const tabId = resolveTabId(msg, sender);
                if (tabId) {
                    try {
                        const tab = await chrome.tabs.get(tabId);
                        if (tab.url) {
                            const hostname = new URL(tab.url).hostname;
                            records = await listRecentCapturesByHost(hostname, limit);
                            console.log("[UI Inventory] LIST_CAPTURES for site:", hostname);
                        } else {
                            records = await listRecentCaptures(limit);
                        }
                    } catch (err) {
                        console.warn("[UI Inventory] Failed to get tab hostname:", err);
                        records = await listRecentCaptures(limit);
                    }
                } else {
                    records = await listRecentCaptures(limit);
                }
            } else {
                // "All" mode or no scope specified
                records = await listRecentCaptures(limit);
            }

            sendResponse({ ok: true, records });
        })();
        return true; // async response
    }

    if (msg?.type === "AUDIT/CLEAR_CAPTURES") {
        (async () => {
            try {
                await clearAllCaptures();
                sendResponse({ ok: true });
            } catch (err) {
                sendResponse({ ok: false, error: String(err) });
            }
        })();
        return true; // async response
    }

    if (msg?.type === "AUDIT/CAPTURE_REQUEST") {
        (async () => {
            const tabId = resolveTabId(msg, sender);
            if (!tabId) {
                console.warn("[UI Inventory] CAPTURE_REQUEST: No tab ID resolved");
                sendResponse({ ok: false, error: "No tab ID" });
                return;
            }

            chrome.tabs.sendMessage(tabId, { type: "AUDIT/PING" }, () => {
                // Ignore runtime.lastError (happens if content script isn't injected on that page)
                const err = chrome.runtime.lastError;
                if (err) {
                    console.warn("[UI Inventory] Ping sendMessage error:", err.message);
                }
                sendResponse({ ok: true });
            });
        })();

        return true; // async response
    }

    if (msg?.type === "AUDIT/GET_BLOB") {
        (async () => {
            const blobId = msg.blobId;
            console.log("[UI Inventory] GET_BLOB request for:", blobId);

            // Validate blobId
            if (!blobId || typeof blobId !== "string" || blobId.trim() === "") {
                console.warn("[UI Inventory] GET_BLOB: Invalid blobId");
                sendResponse({ ok: false, error: "Invalid blobId" });
                return;
            }

            // Fetch blob from IndexedDB
            const blobRecord = await getBlob(blobId);
            console.log("[UI Inventory] GET_BLOB: Retrieved blobRecord:", blobRecord ? "found" : "not found");

            if (!blobRecord || !blobRecord.blob) {
                console.warn("[UI Inventory] GET_BLOB: Blob not found for id:", blobId);
                sendResponse({ ok: false, error: "Blob not found" });
                return;
            }

            // Convert Blob to Array for message passing
            // (ArrayBuffers don't survive chrome.runtime.sendMessage, so we send Array)
            const arrayBuffer = await blobRecord.blob.arrayBuffer();
            const byteArray = Array.from(new Uint8Array(arrayBuffer));
            console.log("[UI Inventory] GET_BLOB: Sending blob, size:", byteArray.length, "bytes");

            sendResponse({
                ok: true,
                blobId,
                mimeType: blobRecord.mimeType,
                width: blobRecord.width,
                height: blobRecord.height,
                arrayBuffer: byteArray, // Send as Array, not ArrayBuffer
            });
        })();

        return true; // async response
    }

    // ─────────────────────────────────────────────────────────────
    // Milestone 2: Viewer message handlers
    // ─────────────────────────────────────────────────────────────

    if (msg?.type === "VIEWER/LIST_SESSIONS") {
        (async () => {
            const limit = msg.limit || 50;
            console.log("[UI Inventory] VIEWER/LIST_SESSIONS request, limit:", limit);

            const sessions = await listSessions(limit);
            sendResponse({ ok: true, sessions });
        })();

        return true; // async response
    }

    if (msg?.type === "VIEWER/GET_SESSION") {
        (async () => {
            const sessionId = msg.sessionId;
            console.log("[UI Inventory] VIEWER/GET_SESSION request for:", sessionId);

            if (!sessionId || typeof sessionId !== "string") {
                sendResponse({ ok: false, error: "Invalid sessionId" });
                return;
            }

            const session = await getSession(sessionId);
            if (!session) {
                sendResponse({ ok: false, error: "Session not found" });
                return;
            }

            sendResponse({ ok: true, session });
        })();

        return true; // async response
    }

    if (msg?.type === "VIEWER/LIST_CAPTURES") {
        (async () => {
            const sessionId = msg.sessionId;
            const limit = msg.limit || 200;
            console.log("[UI Inventory] VIEWER/LIST_CAPTURES request for session:", sessionId, "limit:", limit);

            if (!sessionId || typeof sessionId !== "string") {
                sendResponse({ ok: false, error: "Invalid sessionId" });
                return;
            }

            const captures = await listCapturesBySession(sessionId, limit);

            // Transform to lightweight list items
            const listItems = captures.map((capture) => {
                // Convert createdAt to epoch ms
                let createdAtMs: number | null = null;
                if (typeof capture.createdAt === "string") {
                    createdAtMs = Date.parse(capture.createdAt);
                    if (isNaN(createdAtMs)) createdAtMs = null;
                } else if (typeof capture.createdAt === "number") {
                    createdAtMs = capture.createdAt;
                } else if ((capture as any).conditions?.timestamp) {
                    createdAtMs = Date.parse((capture as any).conditions.timestamp);
                    if (isNaN(createdAtMs)) createdAtMs = null;
                }

                const primitives = (capture as any).styles?.primitives;

                return {
                    id: capture.id,
                    sessionId: (capture as any).sessionId || capture.id.split("-")[0], // fallback for old records
                    createdAt: createdAtMs,
                    url: capture.url ?? (capture as any).page?.url ?? "",
                    tagName: capture.element?.tagName || null,
                    role: capture.element?.role || null,
                    accessibleName: (capture.element as any)?.intent?.accessibleName || null,
                    screenshot: (capture as any).screenshot || null,
                    primitivesSummary: primitives
                        ? {
                            paddingTop: primitives.spacing?.paddingTop,
                            paddingRight: primitives.spacing?.paddingRight,
                            paddingBottom: primitives.spacing?.paddingBottom,
                            paddingLeft: primitives.spacing?.paddingLeft,
                            backgroundColorRgba: primitives.backgroundColor?.rgba ?? null,
                            borderColorRgba: primitives.borderColor?.rgba ?? null,
                            colorRgba: primitives.color?.rgba ?? null,
                            shadowPresence: primitives.shadow?.shadowPresence,
                            shadowLayerCount: primitives.shadow?.shadowLayerCount,
                        }
                        : undefined,
                };

            });

            sendResponse({ ok: true, captures: listItems });
        })();

        return true; // async response
    }

    if (msg?.type === "VIEWER/GET_CAPTURE") {
        (async () => {
            const captureId = msg.captureId;
            console.log("[UI Inventory] VIEWER/GET_CAPTURE request for:", captureId);

            if (!captureId || typeof captureId !== "string") {
                sendResponse({ ok: false, error: "Invalid captureId" });
                return;
            }

            const capture = await getCapture(captureId);
            if (!capture) {
                sendResponse({ ok: false, error: "Capture not found" });
                return;
            }

            sendResponse({ ok: true, capture });
        })();

        return true; // async response
    }

    if (msg?.type === "VIEWER/DELETE_CAPTURE") {
        (async () => {
            const captureId = msg.captureId;
            console.log("[UI Inventory] VIEWER/DELETE_CAPTURE request for:", captureId);

            if (!captureId || typeof captureId !== "string") {
                sendResponse({ ok: false, error: "Invalid captureId" });
                return;
            }

            try {
                await deleteCapture(captureId);
                sendResponse({ ok: true });
            } catch (err) {
                console.error("[UI Inventory] Failed to delete capture:", err);
                sendResponse({ ok: false, error: "Failed to delete capture" });
            }
        })();

        return true; // async response
    }

    // ─────────────────────────────────────────────────────────────
    // Milestone 6.1: Projects message handlers
    // ─────────────────────────────────────────────────────────────

    if (msg?.type === "UI/LIST_PROJECTS") {
        (async () => {
            try {
                const projects = await listProjects();
                sendResponse({ ok: true, projects });
            } catch (err) {
                console.error("[UI Inventory] Failed to list projects:", err);
                sendResponse({ ok: false, error: "Failed to list projects" });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "UI/DELETE_PROJECT") {
        (async () => {
            try {
                const projectId = msg.projectId;
                if (!projectId || typeof projectId !== "string") {
                    sendResponse({ ok: false, error: "projectId is required" });
                    return;
                }

                await deleteProjectCascade(projectId);

                // Best-effort: clear any active project mappings pointing to this project
                for (const [tabId, activeProjectId] of activeProjectByTabId.entries()) {
                    if (activeProjectId === projectId) {
                        activeProjectByTabId.delete(tabId);
                        await setActiveProjectPersisted(tabId, null);
                    }
                }

                if (currentProjectId === projectId) {
                    currentProjectId = null;
                }

                sendResponse({ ok: true });
            } catch (err) {
                console.error("[UI Inventory] Failed to delete project:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "UI/CREATE_PROJECT") {
        (async () => {
            const name = msg.name;

            // Validate name
            if (!name || typeof name !== "string" || name.trim() === "") {
                sendResponse({ ok: false, error: "Project name is required" });
                return;
            }

            try {
                const project = await createProject(name);
                sendResponse({ ok: true, project });
            } catch (err) {
                console.error("[UI Inventory] Failed to create project:", err);
                sendResponse({ ok: false, error: "Failed to create project" });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "UI/REGISTER_ACTIVE_TAB") {
        (async () => {
            if (typeof sender.tab?.id === "number") {
                const tabId = sender.tab.id;
                lastActiveAuditTabId = tabId;

                // 7.8 fix: Persist lastActiveAuditTabId for SW restart resilience
                await setLastActiveAuditTabIdPersisted(tabId);

                // 7.8.1: Set activeAuditTabId if none exists and audit is enabled
                // (first tab with audit enabled wins)
                // Also restore as active if this tab was previously the active audit tab (handles refresh case)
                if ((activeAuditTabId === null && currentAuditEnabled) || activeAuditTabId === tabId) {
                    activeAuditTabId = tabId;
                    await setActiveAuditTabIdPersisted(tabId);
                    console.log("[UI Inventory] Set/restored activeAuditTabId:", tabId);
                }

                // Apply current project to newly registered tab
                if (currentProjectId) {
                    activeProjectByTabId.set(tabId, currentProjectId);
                }

                // Apply current audit enabled state to newly registered tab
                auditEnabledByTab.set(tabId, currentAuditEnabled);

                // Broadcast registration event (non-fatal)
                chrome.runtime.sendMessage({ type: "UI/TAB_REGISTERED", tabId }, () => void chrome.runtime.lastError);

                sendResponse({ ok: true });
            } else {
                sendResponse({ ok: false, error: "No tab ID" });
            }
        })();
        return true; // async response
    }

    if (msg?.type === "UI/SET_ACTIVE_PROJECT_FOR_TAB") {
        (async () => {
            // 7.8 fix: Use resolveTabId for backward compatibility with Sidepanel
            let tabId = resolveTabId(msg, sender);

            // 7.8 fix: Lazy rehydration if resolveTabId returns null
            if (tabId === null && lastActiveAuditTabId === null) {
                // Try to rehydrate lastActiveAuditTabId from storage (inline to avoid TDZ)
                try {
                    const result = await chrome.storage.session.get("uiinv_last_active_audit_tab_id");
                    const rehydratedTabId = result["uiinv_last_active_audit_tab_id"] || null;
                    if (rehydratedTabId !== null) {
                        lastActiveAuditTabId = rehydratedTabId;
                        tabId = rehydratedTabId;
                        console.log("[UI Inventory] Rehydrated lastActiveAuditTabId:", rehydratedTabId);
                    }
                } catch (err) {
                    console.warn("[UI Inventory] Failed to rehydrate lastActiveAuditTabId:", err);
                }
            }

            if (tabId === null) {
                sendResponse({ ok: false, error: "No tab ID (focus a page tab and retry)" });
                return;
            }

            const projectId = msg.projectId;

            if (projectId && typeof projectId === "string") {
                // Update in-memory map
                activeProjectByTabId.set(tabId, projectId);
                currentProjectId = projectId;

                // 7.8 fix: Persist to chrome.storage.session for SW restart resilience
                await setActiveProjectPersisted(tabId, projectId);

                console.log("[UI Inventory] Set active project for tab", tabId, ":", projectId);
            } else {
                // Clear mapping
                activeProjectByTabId.delete(tabId);

                // 7.8 fix: Clear from storage
                await setActiveProjectPersisted(tabId, null);

                console.log("[UI Inventory] Cleared active project for tab", tabId);
            }

            sendResponse({ ok: true });
        })();

        return true; // async response
    }

    if (msg?.type === "UI/DEBUG_LIST_PROJECT_SESSIONS") {
        (async () => {
            const projectId = msg.projectId;

            if (!projectId || typeof projectId !== "string") {
                sendResponse({ ok: false, error: "projectId is required" });
                return;
            }

            try {
                const links = await listProjectSessionsByProject(projectId);
                sendResponse({ ok: true, links });
            } catch (err) {
                console.error("[UI Inventory] Failed to list project sessions:", err);
                sendResponse({ ok: false, error: "Failed to list project sessions" });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "UI/GET_ACTIVE_SESSION_CAPTURES") {
        (async () => {
            try {
                const tabId = resolveTabId(msg, sender);

                if (tabId === null) {
                    sendResponse({ ok: false, error: "No tab ID" });
                    return;
                }

                // Get active sessionId for this tab
                const sessionId = activeSessionIdByTab.get(tabId);

                if (!sessionId) {
                    sendResponse({ ok: true, sessionId: null, captures: [] });
                    return;
                }

                // Load captures for this session
                const captures = (await listCapturesBySession(sessionId)) ?? [];
                sendResponse({ ok: true, sessionId, captures });
            } catch (err) {
                console.error("[UI Inventory] Failed to get active session captures:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "UI/GET_PROJECT_CAPTURES") {
        (async () => {
            try {
                const tabId = resolveTabId(msg, sender);

                if (tabId === null) {
                    sendResponse({ ok: false, error: "No tab ID" });
                    return;
                }

                // Get active projectId for this tab
                let projectId = activeProjectByTabId.get(tabId);
                if (!projectId) {
                    // Rehydrate from chrome.storage.session (survives SW restarts)
                    projectId = await getActiveProjectPersisted(tabId);
                    if (projectId) {
                        activeProjectByTabId.set(tabId, projectId);
                    }
                }

                if (!projectId) {
                    sendResponse({ ok: true, projectId: null, sessionIds: [], captures: [] });
                    return;
                }

                // Load all session IDs linked to this project
                const sessionIds = await listSessionIdsForProject(projectId);

                // Load all captures across those sessions
                const captures = await listCapturesBySessionIds(sessionIds);
                sendResponse({ ok: true, projectId, sessionIds, captures });
            } catch (err) {
                console.error("[UI Inventory] Failed to get project captures:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    // Milestone 7.4.1: Get captures for a specific project (Viewer use)
    if (msg?.type === "UI/GET_PROJECT_DETAIL") {
        (async () => {
            try {
                const projectId = msg.projectId;

                if (!projectId || typeof projectId !== "string") {
                    sendResponse({ ok: false, error: "projectId is required" });
                    return;
                }

                // Load all session IDs linked to this project
                const sessionIds = await listSessionIdsForProject(projectId);

                // Load all captures across those sessions
                const captures = await listCapturesBySessionIds(sessionIds);

                sendResponse({ ok: true, projectId, sessionIds, captures });
            } catch (err) {
                console.error("[UI Inventory] Failed to get project detail:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "UI/GET_PROJECT_COMPONENT_COUNTS") {
        (async () => {
            try {
                // Load all projects
                const projects = await listProjects();

                // Build counts object for each project
                const counts: Record<string, number> = {};
                for (const project of projects) {
                    counts[project.id] = await getProjectCaptureCount(project.id);
                }

                sendResponse({ ok: true, counts });
            } catch (err) {
                console.error("[UI Inventory] Failed to get project component counts:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "UI/GET_CAPTURE") {
        (async () => {
            try {
                const captureId = msg.captureId;

                // Validate captureId
                if (!captureId || typeof captureId !== "string" || captureId.trim() === "") {
                    sendResponse({ ok: false, error: "Invalid captureId" });
                    return;
                }

                const capture = await getCapture(captureId);
                if (!capture) {
                    sendResponse({ ok: false, error: "Capture not found" });
                    return;
                }

                sendResponse({ ok: true, capture });
            } catch (err) {
                console.error("[UI Inventory] Failed to get capture:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "UI/DELETE_CAPTURE") {
        (async () => {
            try {
                const captureId = msg.captureId;

                // Validate captureId
                if (!captureId || typeof captureId !== "string" || captureId.trim() === "") {
                    sendResponse({ ok: false, error: "Invalid captureId" });
                    return;
                }

                // Delete from IndexedDB
                await deleteCapture(captureId);

                sendResponse({ ok: true });
            } catch (err) {
                console.error("[UI Inventory] Failed to delete capture:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    // ─────────────────────────────────────────────────────────────
    // Annotations (7.7.1: Notes + Tags)
    // ─────────────────────────────────────────────────────────────

    if (msg?.type === "ANNOTATIONS/GET_PROJECT") {
        (async () => {
            const projectId = msg.projectId;
            console.log("[UI Inventory] ANNOTATIONS/GET_PROJECT request for:", projectId);

            if (!projectId || typeof projectId !== "string") {
                sendResponse({ ok: false, error: "Invalid projectId" });
                return;
            }

            try {
                const annotations = await listAnnotationsForProject(projectId);
                sendResponse({ ok: true, annotations });
            } catch (err) {
                console.error("[UI Inventory] Failed to list annotations:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "ANNOTATIONS/GET_ONE") {
        (async () => {
            const { projectId, componentKey } = msg;
            console.log("[UI Inventory] ANNOTATIONS/GET_ONE request for:", projectId, componentKey);

            if (!projectId || typeof projectId !== "string") {
                sendResponse({ ok: false, error: "Invalid projectId" });
                return;
            }

            if (!componentKey || typeof componentKey !== "string") {
                sendResponse({ ok: false, error: "Invalid componentKey" });
                return;
            }

            try {
                const annotation = await getAnnotation(projectId, componentKey);
                sendResponse({ ok: true, annotation });
            } catch (err) {
                console.error("[UI Inventory] Failed to get annotation:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "ANNOTATIONS/UPSERT") {
        (async () => {
            const { projectId, componentKey, notes, tags } = msg;

            if (!projectId || typeof projectId !== "string") {
                sendResponse({ ok: false, error: "Invalid projectId" });
                return;
            }

            if (!componentKey || typeof componentKey !== "string") {
                sendResponse({ ok: false, error: "Invalid componentKey" });
                return;
            }

            if (!Array.isArray(tags)) {
                sendResponse({ ok: false, error: "Invalid tags (must be array)" });
                return;
            }

            try {
                // Get existing annotation to compare tags
                const existing = await getAnnotation(projectId, componentKey);
                const oldTags = existing?.tags || [];
                const newTags = tags || [];

                // Update annotation
                await upsertAnnotation({ projectId, componentKey, notes, tags });

                // Sync tag usage counts
                // Find tags that were added (in newTags but not in oldTags)
                const addedTags = newTags.filter(tag => !oldTags.includes(tag));
                // Find tags that were removed (in oldTags but not in newTags)
                const removedTags = oldTags.filter(tag => !newTags.includes(tag));

                // Increment usage for added tags
                for (const tag of addedTags) {
                    await incrementTagUsage(projectId, tag);
                }

                // Decrement usage for removed tags
                for (const tag of removedTags) {
                    await decrementTagUsage(projectId, tag);
                }

                sendResponse({ ok: true });
            } catch (err) {
                console.error("[UI Inventory] Failed to upsert annotation:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "ANNOTATIONS/DELETE") {
        (async () => {
            const { projectId, componentKey } = msg;

            if (!projectId || typeof projectId !== "string") {
                sendResponse({ ok: false, error: "Invalid projectId" });
                return;
            }

            if (!componentKey || typeof componentKey !== "string") {
                sendResponse({ ok: false, error: "Invalid componentKey" });
                return;
            }

            try {
                await deleteAnnotation(projectId, componentKey);
                sendResponse({ ok: true });
            } catch (err) {
                console.error("[UI Inventory] Failed to delete annotation:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    // ─────────────────────────────────────────────────────────────
    // Project Tags (M9: Project-wide tagging system)
    // ─────────────────────────────────────────────────────────────

    if (msg?.type === "TAGS/GET_ALL") {
        (async () => {
            const { projectId } = msg;

            if (!projectId || typeof projectId !== "string") {
                sendResponse({ ok: false, error: "Invalid projectId" });
                return;
            }

            try {
                const tags = await getAllProjectTags(projectId);
                sendResponse({ ok: true, tags });
            } catch (err) {
                console.error("[UI Inventory] Failed to get project tags:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "TAGS/DELETE") {
        (async () => {
            const { projectId, tagName } = msg;

            if (!projectId || typeof projectId !== "string") {
                sendResponse({ ok: false, error: "Invalid projectId" });
                return;
            }

            if (!tagName || typeof tagName !== "string") {
                sendResponse({ ok: false, error: "Invalid tagName" });
                return;
            }

            try {
                // Get all components that use this tag
                const componentsWithTag = await getComponentsWithTag(projectId, tagName);
                const affectedComponents = componentsWithTag.length;

                // Remove tag from all annotations
                for (const annotation of componentsWithTag) {
                    const updatedTags = annotation.tags.filter(t => t !== tagName);
                    await upsertAnnotation({
                        ...annotation,
                        tags: updatedTags,
                        updatedAt: Date.now(),
                    });
                }

                // Delete the tag from the project tags store
                await deleteProjectTag(projectId, tagName);

                sendResponse({ ok: true, affectedComponents });
            } catch (err) {
                console.error("[UI Inventory] Failed to delete tag:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    // ─────────────────────────────────────────────────────────────
    // Export to Figma
    // ─────────────────────────────────────────────────────────────

    if (msg?.type === "EXPORT/GET_PROJECT_DATA") {
        (async () => {
            const projectId = msg.projectId;
            console.log("[UI Inventory] EXPORT/GET_PROJECT_DATA request for:", projectId);

            if (!projectId || typeof projectId !== "string") {
                sendResponse({ ok: false, error: "Invalid projectId" });
                return;
            }

            try {
                // Get project record by listing all projects and finding the one with matching ID
                const allProjects = await listProjects();
                const project = allProjects.find(p => p.id === projectId);
                if (!project) {
                    sendResponse({ ok: false, error: "Project not found" });
                    return;
                }

                // Get all session IDs linked to this project
                const sessionIds = await listSessionIdsForProject(projectId);

                // Get all captures for these sessions (non-draft only)
                const allCaptures: CaptureRecordV2[] = [];
                for (const sessionId of sessionIds) {
                    const sessionCaptures = await listCapturesBySession(sessionId);
                    // Filter out drafts
                    const savedCaptures = sessionCaptures.filter(c => !c.isDraft);
                    allCaptures.push(...savedCaptures);
                }

                sendResponse({
                    ok: true,
                    data: {
                        project: {
                            id: project.id,
                            name: project.name,
                        },
                        captures: allCaptures,
                    },
                });
            } catch (err) {
                console.error("[UI Inventory] Failed to get project data for export:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "EXPORT/GET_BLOB_BYTES") {
        (async () => {
            const blobId = msg.blobId;

            if (!blobId || typeof blobId !== "string") {
                sendResponse({ ok: false, error: "Invalid blobId" });
                return;
            }

            try {
                const blobRecord = await getBlob(blobId);
                if (!blobRecord || !blobRecord.blob) {
                    sendResponse({ ok: false, error: "Blob not found" });
                    return;
                }

                // Convert blob to ArrayBuffer, then to plain array for Chrome messaging
                const arrayBuffer = await blobRecord.blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                const plainArray = Array.from(uint8Array);
                
                sendResponse({
                    ok: true,
                    bytes: plainArray,
                    mimeType: blobRecord.blob.type, // Include MIME type for conversion
                });
            } catch (err) {
                console.error("[UI Inventory] Failed to get blob bytes:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    // ─────────────────────────────────────────────────────────────
    // Component Overrides (Identity overrides: name/category/type/status)
    // ─────────────────────────────────────────────────────────────

    if (msg?.type === "OVERRIDES/GET_PROJECT") {
        (async () => {
            const projectId = msg.projectId;
            if (!projectId || typeof projectId !== "string") {
                sendResponse({ ok: false, error: "Invalid projectId" });
                return;
            }

            try {
                const overrides = await listComponentOverridesForProject(projectId);
                sendResponse({ ok: true, overrides });
            } catch (err) {
                console.error("[UI Inventory] Failed to list overrides:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "OVERRIDES/GET_ONE") {
        (async () => {
            const { projectId, componentKey } = msg;
            if (!projectId || typeof projectId !== "string") {
                sendResponse({ ok: false, error: "Invalid projectId" });
                return;
            }
            if (!componentKey || typeof componentKey !== "string") {
                sendResponse({ ok: false, error: "Invalid componentKey" });
                return;
            }

            try {
                const override = await getComponentOverride(projectId, componentKey);
                sendResponse({ ok: true, override });
            } catch (err) {
                console.error("[UI Inventory] Failed to get override:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "OVERRIDES/UPSERT") {
        (async () => {
            const { projectId, componentKey, displayName, description, categoryOverride, typeOverride, statusOverride } = msg;
            if (!projectId || typeof projectId !== "string") {
                sendResponse({ ok: false, error: "Invalid projectId" });
                return;
            }
            if (!componentKey || typeof componentKey !== "string") {
                sendResponse({ ok: false, error: "Invalid componentKey" });
                return;
            }

            try {
                await upsertComponentOverride({
                    projectId,
                    componentKey,
                    displayName: typeof displayName === "string" ? displayName : (displayName ?? null),
                    description: typeof description === "string" ? description : (description ?? null),
                    categoryOverride: typeof categoryOverride === "string" ? categoryOverride : (categoryOverride ?? null),
                    typeOverride: typeof typeOverride === "string" ? typeOverride : (typeOverride ?? null),
                    statusOverride: typeof statusOverride === "string" ? statusOverride : (statusOverride ?? null),
                });
                sendResponse({ ok: true });
            } catch (err) {
                console.error("[UI Inventory] Failed to upsert override:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    if (msg?.type === "OVERRIDES/DELETE") {
        (async () => {
            const { projectId, componentKey } = msg;
            if (!projectId || typeof projectId !== "string") {
                sendResponse({ ok: false, error: "Invalid projectId" });
                return;
            }
            if (!componentKey || typeof componentKey !== "string") {
                sendResponse({ ok: false, error: "Invalid componentKey" });
                return;
            }

            try {
                await deleteComponentOverride(projectId, componentKey);
                sendResponse({ ok: true });
            } catch (err) {
                console.error("[UI Inventory] Failed to delete override:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    // 7.8: Draft commit API
    if (msg?.type === "DRAFTS/COMMIT") {
        (async () => {
            const { captureId } = msg;

            if (!captureId || typeof captureId !== "string") {
                sendResponse({ ok: false, error: "Invalid captureId" });
                return;
            }

            try {
                await commitDraftCapture(captureId);
                console.log("[UI Inventory] Committed draft capture:", captureId);
                sendResponse({ ok: true });
            } catch (err) {
                console.error("[UI Inventory] Failed to commit draft:", err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();

        return true; // async response
    }

    // Bug 3 fix: No default sendResponse (prevents double-call race condition)
    // Each handler above explicitly calls sendResponse and returns true
    return false;
});

// 7.8.1: Broadcast active tab changes to Sidepanel for immediate state updates
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);

        // Only broadcast for non-extension tabs
        if (tab.url && !tab.url.startsWith('chrome-extension://')) {
            const message = {
                type: "UI/ACTIVE_TAB_CHANGED",
                tabId: tab.id,
                url: tab.url,
            };

            // Broadcast to all extension contexts (sidepanel, popup, etc.)
            chrome.runtime.sendMessage(message, () => {
                // Ignore errors (no listeners is fine)
                void chrome.runtime.lastError;
            });

            console.log("[UI Inventory] Active tab changed:", tab.id, tab.url);
        }
    } catch (err) {
        console.warn("[UI Inventory] Failed to handle tab activation:", err);
    }
});

// 7.8.1: Broadcast window focus changes to update Sidepanel context
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    // windowId === chrome.windows.WINDOW_ID_NONE means no window has focus
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;

    try {
        // Get the active tab in the newly focused window
        const tabs = await chrome.tabs.query({ active: true, windowId });
        if (tabs.length > 0) {
            const tab = tabs[0];

            // Only broadcast for non-extension tabs
            if (tab.url && !tab.url.startsWith('chrome-extension://')) {
                const message = {
                    type: "UI/ACTIVE_TAB_CHANGED",
                    tabId: tab.id,
                    url: tab.url,
                };

                chrome.runtime.sendMessage(message, () => {
                    void chrome.runtime.lastError;
                });

                console.log("[UI Inventory] Window focus changed, active tab:", tab.id, tab.url);
            }
        }
    } catch (err) {
        console.warn("[UI Inventory] Failed to handle window focus change:", err);
    }
});

// Phase 1: MV3 guardrail — detach debugger on suspend (best-effort)
chrome.runtime.onSuspend.addListener(() => {
    const tabs = Array.from(cdpAttachedTabs);
    if (tabs.length === 0) return;
    for (const tabId of tabs) {
        try {
            chrome.debugger.detach({ tabId }, () => void chrome.runtime.lastError);
        } catch {
            // ignore
        }
    }
    cdpAttachedTabs.clear();
});
