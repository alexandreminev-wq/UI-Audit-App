import { generateCaptureId, type CaptureConditions, type ElementIntent, type ThemeHint, type LandmarkRole } from "../types/capture";
import { extractComputedStyles, extractStylePrimitives } from "./extractComputedStyles";

console.log("[UI Inventory] Content script loaded on:", location.href);

// Phase 3: last-resort resolver support
let lastCaptureTargetEl: Element | null = null;
let lastMarkerId: string | null = null;

// Register this tab as active audit tab, then restore audit mode if enabled
chrome.runtime.sendMessage({ type: "UI/REGISTER_ACTIVE_TAB" }, () => {
    if (chrome.runtime.lastError) return;
    chrome.runtime.sendMessage({ type: "AUDIT/GET_STATE" }, (resp) => {
        if (chrome.runtime.lastError) return;
        if (resp?.enabled === true && !isHoverModeActive) {
            startHoverMode();
        }
    });
});

// ─────────────────────────────────────────────────────────────
// Keyboard shortcut handled by chrome.commands API in service worker
// (Cmd/Ctrl + Shift + U to toggle capture mode)
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Toast utility (Milestone 5)
// ─────────────────────────────────────────────────────────────

function showToast(message: string, duration = 3500) {
    const toast = document.createElement("div");
    toast.textContent = message;
    Object.assign(toast.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        background: "#f44336",
        color: "white",
        padding: "12px 16px",
        borderRadius: "4px",
        fontSize: "13px",
        fontWeight: "500",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        zIndex: "999999",
        maxWidth: "300px",
    });
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duration);
}

// ─────────────────────────────────────────────────────────────
// v2.2 Capture helpers
// ─────────────────────────────────────────────────────────────

/**
 * Extract capture conditions (viewport, DPR, theme, etc.)
 */
function extractConditions(): CaptureConditions {
    const themeHint: ThemeHint = (() => {
        try {
            if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                return "dark";
            }
            if (window.matchMedia("(prefers-color-scheme: light)").matches) {
                return "light";
            }
            return "unknown";
        } catch {
            return "unknown";
        }
    })();

    const visualViewportScale = (() => {
        try {
            return window.visualViewport?.scale ?? null;
        } catch {
            return null;
        }
    })();

    return {
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
        },
        devicePixelRatio: window.devicePixelRatio,
        visualViewportScale,
        browserZoom: null, // best-effort; leave null for now (flaky)
        timestamp: Date.now(),
        themeHint,
    };
}

/**
 * Get nearest landmark role for scope context (innermost wins)
 * Walks up DOM tree looking for explicit role attributes or semantic HTML tags
 */
function getNearestLandmarkRole(el: Element): LandmarkRole {
    let current: Element | null = el;
    let depth = 0;
    const maxDepth = 15;

    while (current && current !== document.body && depth < maxDepth) {
        // Check explicit role attribute first
        const role = current.getAttribute("role")?.trim().toLowerCase();
        if (role === "banner" || role === "navigation" || role === "main" ||
            role === "contentinfo" || role === "complementary") {
            return role as LandmarkRole;
        }

        // Check semantic HTML tags
        const tagName = current.tagName;
        if (tagName === "HEADER") return "banner";
        if (tagName === "NAV") return "navigation";
        if (tagName === "MAIN") return "main";
        if (tagName === "FOOTER") return "contentinfo";
        if (tagName === "ASIDE") return "complementary";

        current = current.parentElement;
        depth++;
    }

    return "generic";
}

/**
 * Extract element intent anchors (best-effort)
 */
function extractIntent(element: Element): ElementIntent {
    const intent: ElementIntent = {};

    // accessibleName (best-effort)
    const ariaLabel = element.getAttribute("aria-label");
    const alt = element.getAttribute("alt");
    const title = element.getAttribute("title");
    const innerText = (element.textContent || "").trim().slice(0, 100);

    if (ariaLabel) {
        intent.accessibleName = ariaLabel;
    } else if (alt) {
        intent.accessibleName = alt;
    } else if (title) {
        intent.accessibleName = title;
    } else if (innerText) {
        intent.accessibleName = innerText;
    }

    // inputType
    if (element instanceof HTMLInputElement) {
        intent.inputType = element.type || null;
    }

    // href
    if (element instanceof HTMLAnchorElement && element.href) {
        intent.href = element.href;
    }

    // disabled
    const disabled = (element as any).disabled;
    if (disabled !== undefined) {
        intent.disabled = Boolean(disabled);
    }

    // ariaDisabled
    const ariaDisabled = element.getAttribute("aria-disabled");
    if (ariaDisabled !== null) {
        intent.ariaDisabled = ariaDisabled === "true";
    }

    // checked (for checkbox/radio)
    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
        intent.checked = element.checked;
    }

    // ariaChecked
    const ariaChecked = element.getAttribute("aria-checked");
    if (ariaChecked !== null) {
        intent.ariaChecked = ariaChecked === "true";
    }

    return intent;
}

// ─────────────────────────────────────────────────────────────
// Hover overlay state
// ─────────────────────────────────────────────────────────────

let overlayDiv: HTMLDivElement | null = null;
let pillDiv: HTMLDivElement | null = null;
let stateMenuHost: HTMLDivElement | null = null;
let stateMenuShadow: ShadowRoot | null = null;
let stateMenuIsOpen = false;
let stateMenuTargetEl: Element | null = null;
// Capture options menu (right-click / '.' hotkey)
let captureMenuHost: HTMLDivElement | null = null;
let captureMenuShadow: ShadowRoot | null = null;
let captureMenuIsOpen = false;
let captureMenuTargetEl: Element | null = null;
let captureMenuView: "main" | "children" = "main";
let captureMenuChildCandidates: Element[] = [];
let captureMenuPos: { x: number; y: number } | null = null;
let captureMenuPinnedPrev: { isFrozen: boolean; frozenEl: Element | null } | null = null;
// Region selection (drag to capture a rectangle)
let regionSelectHost: HTMLDivElement | null = null;
let regionSelectShadow: ShadowRoot | null = null;
let regionSelectIsActive = false;
let regionSelectStart: { x: number; y: number } | null = null;
let regionSelectRectEl: HTMLDivElement | null = null;
let regionSelectKind: "region" | "viewport" = "region";
let lastHoverElForPill: Element | null = null;
let currentHoverEl: Element | null = null;
let isFrozen = false;
let frozenEl: Element | null = null;
let suppressNextClickCapture = false;
let isHoverModeActive = false;
let rafId: number | null = null;
let pendingUpdate = false;
let isCaptureInProgress = false; // Prevent overlay updates during CDP capture
let lastMouseX: number | null = null; // Track last mouse position for post-capture overlay refresh
let lastMouseY: number | null = null;

// ─────────────────────────────────────────────────────────────
// Sidebar (Milestone 6.1)
// ─────────────────────────────────────────────────────────────

function ensureRegionSelectOverlay() {
    if (regionSelectHost && regionSelectShadow) return;

    regionSelectHost = document.createElement("div");
    regionSelectHost.id = "ui-inventory-region-select-host";
    regionSelectHost.style.cssText = `
        all: initial;
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        pointer-events: none;
    `;

    regionSelectShadow = regionSelectHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
        * { box-sizing: border-box; }
        .overlay {
            position: fixed;
            inset: 0;
            pointer-events: auto;
            cursor: crosshair;
            background: rgba(0,0,0,0.02);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .rect {
            position: absolute;
            border: 2px solid rgba(37, 99, 235, 0.9);
            background: rgba(37, 99, 235, 0.12);
            border-radius: 6px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        }
        .hint {
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            padding: 6px 10px;
            border-radius: 10px;
            background: rgba(17, 24, 39, 0.92);
            color: white;
            font-size: 12px;
            font-weight: 600;
            pointer-events: none;
        }
    `;

    const overlay = document.createElement("div");
    overlay.className = "overlay";

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Drag to select a region. Press Esc to cancel.";

    const rect = document.createElement("div");
    rect.className = "rect";
    rect.style.left = "0px";
    rect.style.top = "0px";
    rect.style.width = "0px";
    rect.style.height = "0px";
    rect.style.display = "none";
    regionSelectRectEl = rect;

    const updateRect = (start: { x: number; y: number }, cur: { x: number; y: number }) => {
        const left = Math.max(0, Math.min(start.x, cur.x));
        const top = Math.max(0, Math.min(start.y, cur.y));
        const right = Math.min(window.innerWidth, Math.max(start.x, cur.x));
        const bottom = Math.min(window.innerHeight, Math.max(start.y, cur.y));
        const w = Math.max(0, right - left);
        const h = Math.max(0, bottom - top);
        rect.style.display = "block";
        rect.style.left = `${Math.round(left)}px`;
        rect.style.top = `${Math.round(top)}px`;
        rect.style.width = `${Math.round(w)}px`;
        rect.style.height = `${Math.round(h)}px`;
    };

    const stopRegionSelect = () => {
        regionSelectIsActive = false;
        regionSelectStart = null;
        regionSelectKind = "region";
        regionSelectRectEl = null;
        if (regionSelectHost) {
            regionSelectHost.remove();
        }
        regionSelectHost = null;
        regionSelectShadow = null;
    };

    const sendRegionCapture = async (box: { left: number; top: number; width: number; height: number }, kind: "region" | "viewport") => {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const url = window.location.href;
        const viewport = { width: window.innerWidth, height: window.innerHeight };
        // Prevent hover UI from reappearing while the screenshot is being taken (it would end up in the image)
        isCaptureInProgress = true;
        if (overlayDiv) overlayDiv.style.display = "none";
        if (pillDiv) pillDiv.style.display = "none";
        chrome.runtime.sendMessage(
            { type: "AUDIT/CAPTURE_REGION", boundingBox: box, devicePixelRatio, url, viewport, kind },
            (resp) => {
                const err = chrome.runtime.lastError;
                if (err) {
                    console.warn("[UI Inventory] CAPTURE_REGION sendMessage error:", err.message);
                    isCaptureInProgress = false;
                    return;
                }
                if (!resp?.ok) {
                    console.warn("[UI Inventory] CAPTURE_REGION failed:", resp?.error || resp);
                    isCaptureInProgress = false;
                    return;
                }
                // Restore hover UI after capture is complete
                isCaptureInProgress = false;
                if (isHoverModeActive) {
                    if (overlayDiv) overlayDiv.style.display = "";
                    if (pillDiv) pillDiv.style.display = "";
                }
            }
        );
    };

    overlay.addEventListener("pointerdown", (e) => {
        if (!regionSelectIsActive) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        regionSelectStart = { x: e.clientX, y: e.clientY };
        updateRect(regionSelectStart, regionSelectStart);
        try {
            (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
        } catch {
            // ignore
        }
    }, true);

    overlay.addEventListener("pointermove", (e) => {
        if (!regionSelectIsActive || !regionSelectStart) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        updateRect(regionSelectStart, { x: e.clientX, y: e.clientY });
    }, true);

    overlay.addEventListener("pointerup", async (e) => {
        if (!regionSelectIsActive || !regionSelectStart) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const start = regionSelectStart;
        const cur = { x: e.clientX, y: e.clientY };
        const left = Math.max(0, Math.min(start.x, cur.x));
        const top = Math.max(0, Math.min(start.y, cur.y));
        const right = Math.min(window.innerWidth, Math.max(start.x, cur.x));
        const bottom = Math.min(window.innerHeight, Math.max(start.y, cur.y));
        const width = Math.max(0, right - left);
        const height = Math.max(0, bottom - top);

        // reject tiny selections
        if (width >= 8 && height >= 8) {
            await sendRegionCapture(
                { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) },
                regionSelectKind
            );
        }

        stopRegionSelect();
    }, true);

    overlay.appendChild(hint);
    overlay.appendChild(rect);

    regionSelectShadow.appendChild(style);
    regionSelectShadow.appendChild(overlay);
    document.documentElement.appendChild(regionSelectHost);

    // expose cancel helper via host dataset hook (used by keydown Escape)
    (regionSelectHost as any).__uiinv_cancel = stopRegionSelect;
    (regionSelectHost as any).__uiinv_sendViewport = async () => {
        await sendRegionCapture(
            { left: 0, top: 0, width: Math.round(window.innerWidth), height: Math.round(window.innerHeight) },
            "viewport"
        );
        stopRegionSelect();
    };
    (regionSelectHost as any).__uiinv_sendRegion = async () => {
        // just a marker; actual region is sent on pointerup
    };
}

function startRegionSelect(kind: "region" | "viewport") {
    ensureRegionSelectOverlay();
    regionSelectIsActive = true;
    regionSelectStart = null;
    regionSelectKind = kind;
    // Hide hover UI while selecting a screenshot region/viewport
    if (overlayDiv) overlayDiv.style.display = "none";
    if (pillDiv) pillDiv.style.display = "none";
    // enable pointer events for host while active
    if (regionSelectHost) {
        regionSelectHost.style.pointerEvents = "auto";
    }
}

let sidebarHost: HTMLDivElement | null = null;
let sidebarShadow: ShadowRoot | null = null;
let sidebarIsOpen = false;

function ensureSidebar() {
    if (sidebarHost && sidebarShadow) return;

    sidebarIsOpen = false;

    // Create host element
    sidebarHost = document.createElement("div");
    sidebarHost.id = "ui-inventory-sidebar-host";
    sidebarHost.style.cssText = `
        all: initial;
        position: fixed;
        top: 0;
        right: 0;
        width: 0;
        height: 100vh;
        z-index: 2147483646;
        pointer-events: none;
    `;

    // Attach shadow DOM
    sidebarShadow = sidebarHost.attachShadow({ mode: "open" });

    // Build sidebar UI (vanilla DOM + minimal CSS)
    const style = document.createElement("style");
    style.textContent = `
        * { box-sizing: border-box; }

        .edge-toggle {
            position: fixed;
            top: 50%;
            right: 0;
            transform: translateY(-50%);
            background: #2563eb;
            color: white;
            border: none;
            padding: 12px 6px;
            font-size: 11px;
            font-weight: 600;
            writing-mode: vertical-rl;
            text-orientation: mixed;
            cursor: pointer;
            border-radius: 4px 0 0 4px;
            box-shadow: -2px 2px 8px rgba(0,0,0,0.2);
            pointer-events: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .edge-toggle:hover {
            background: #1d4ed8;
        }

        .panel {
            position: fixed;
            top: 0;
            right: 0;
            width: 320px;
            height: 100vh;
            background: white;
            border-left: 1px solid #e5e7eb;
            box-shadow: -2px 0 8px rgba(0,0,0,0.1);
            display: none;
            flex-direction: column;
            pointer-events: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .panel.open {
            display: flex;
        }

        .panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid #e5e7eb;
            background: #f9fafb;
        }

        .panel-title {
            font-size: 14px;
            font-weight: 600;
            color: #111827;
            margin: 0;
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 18px;
            color: #6b7280;
            cursor: pointer;
            padding: 0;
            line-height: 1;
        }

        .close-btn:hover {
            color: #111827;
        }
    `;

    const edgeToggle = document.createElement("button");
    edgeToggle.className = "edge-toggle";
    edgeToggle.textContent = "UI Audit";
    edgeToggle.addEventListener("click", () => toggleSidebar());

    const panel = document.createElement("div");
    panel.className = "panel";

    const header = document.createElement("div");
    header.className = "panel-header";

    const title = document.createElement("h3");
    title.className = "panel-title";
    title.textContent = "UI Audit";

    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => closeSidebar());

    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    sidebarShadow.appendChild(style);
    sidebarShadow.appendChild(edgeToggle);
    sidebarShadow.appendChild(panel);

    document.documentElement.appendChild(sidebarHost);

    console.log("[UI Inventory] Sidebar shell created");
}

function openSidebar() {
    ensureSidebar();
    sidebarIsOpen = true;
    const panel = sidebarShadow?.querySelector(".panel");
    if (panel) {
        panel.classList.add("open");
    }
}

function closeSidebar() {
    sidebarIsOpen = false;
    const panel = sidebarShadow?.querySelector(".panel");
    if (panel) {
        panel.classList.remove("open");
    }
}

function toggleSidebar() {
    if (sidebarIsOpen) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

// ─────────────────────────────────────────────────────────────
// Hover overlay logic
// ─────────────────────────────────────────────────────────────

function createOverlay(): HTMLDivElement {
    const div = document.createElement("div");
    div.id = "ui-inventory-hover-overlay";
    div.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        border: 2px solid #FF6B6B;
        background: rgba(255, 107, 107, 0.1);
        box-sizing: border-box;
        display: none;
    `;
    document.documentElement.appendChild(div);
    return div;
}

// ─────────────────────────────────────────────────────────────
// Metadata pill logic
// ─────────────────────────────────────────────────────────────

function createMetadataPill(): HTMLDivElement {
    const div = document.createElement("div");
    div.id = "ui-inventory-metadata-pill";
    div.style.cssText = `
        all: initial;
        position: fixed;
        z-index: 2147483647;
        pointer-events: none;
        display: none;
    `;
    // Set explicit basics after reset
    div.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    div.style.fontSize = "12px";
    div.style.lineHeight = "1.4";
    div.style.color = "#1a1a1a";
    div.style.backgroundColor = "#ffffff";
    div.style.borderWidth = "1px";
    div.style.borderStyle = "solid";
    div.style.borderColor = "#e0e0e0";
    div.style.padding = "8px 12px";
    div.style.borderRadius = "6px";
    div.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    div.style.maxWidth = "320px";
    div.style.whiteSpace = "pre-line";
    div.style.wordBreak = "break-word";

    document.documentElement.appendChild(div);
    return div;
}

// ─────────────────────────────────────────────────────────────
// Button State Capture Menu (contextual popover)
// ─────────────────────────────────────────────────────────────

type StateCaptureMode = "default" | "force_hover" | "force_active" | "as_is";

type CaptureMenuActionState = {
    label: string;
    mode: StateCaptureMode;
    requestedState: "default" | "hover" | "active";
    kbd?: string;
};

function isInteractiveTarget(el: Element | null | undefined): el is Element {
    if (!el) return false;
    if (el === document.documentElement || el === document.body) return false;
    return true;
}

function isOurUiElement(el: Element): boolean {
    if (overlayDiv && (el === overlayDiv || overlayDiv.contains(el))) return true;
    if (pillDiv && (el === pillDiv || pillDiv.contains(el))) return true;
    if (stateMenuHost && (el === stateMenuHost || stateMenuHost.contains(el))) return true;
    if (captureMenuHost && (el === captureMenuHost || captureMenuHost.contains(el))) return true;
    if (sidebarHost && (el === sidebarHost || sidebarHost.contains(el))) return true;
    if (confirmationPopoverHost && (el === confirmationPopoverHost || confirmationPopoverHost.contains(el))) return true;
    return false;
}

function resolveTargetFromPoint(x: number, y: number): Element | null {
    const elements = document.elementsFromPoint(x, y);
    const candidate = elements.find((elem) => !isOurUiElement(elem));
    return isInteractiveTarget(candidate) ? candidate : null;
}

function getSemanticTarget(start: Element): Element | null {
    const semanticTags = new Set(["button", "a", "input", "select", "textarea", "label"]);
    const semanticRoles = new Set(["button", "link", "textbox", "checkbox", "radio", "switch", "combobox"]);

    let current: Element | null = start;
    for (let depth = 0; current && depth < 15; depth++) {
        const tag = current.tagName.toLowerCase();
        const role = (current.getAttribute("role") || "").trim().toLowerCase();
        const href = (current as HTMLAnchorElement).href;

        if (semanticTags.has(tag)) {
            // For <a>, require href (otherwise often used as wrapper)
            if (tag !== "a" || !!href) return current;
        }
        if (role && semanticRoles.has(role)) return current;

        current = current.parentElement;
    }
    return null;
}

function formatElLabel(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : "";
    const classes = Array.from(el.classList || []).slice(0, 2);
    const cls = classes.length ? `.${classes.join(".")}` : "";
    return `${tag}${id}${cls}`;
}

function buildBreadcrumb(el: Element): string {
    const segments: string[] = [];
    let current: Element | null = el;
    let depth = 0;
    while (current && current !== document.documentElement && depth < 5) {
        segments.unshift(formatElLabel(current));
        if ((current as HTMLElement).id) break;
        current = current.parentElement;
        depth++;
    }
    const s = segments.join(" > ");
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

function getChildCandidates(parent: Element, limit = 5): Element[] {
    const rectParent = parent.getBoundingClientRect();
    const candidates: Array<{ el: Element; area: number }> = [];
    for (const child of Array.from(parent.children)) {
        if (!isInteractiveTarget(child)) continue;
        const r = child.getBoundingClientRect();
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        if (w <= 0 || h <= 0) continue;
        // Must meaningfully intersect the parent box (avoid positioned strays)
        const intersects =
            r.left < rectParent.right &&
            r.right > rectParent.left &&
            r.top < rectParent.bottom &&
            r.bottom > rectParent.top;
        if (!intersects) continue;
        candidates.push({ el: child, area: w * h });
    }
    candidates.sort((a, b) => b.area - a.area);
    return candidates.slice(0, limit).map((c) => c.el);
}

function pinTargetForMenu(target: Element) {
    // If we've already pinned for an open menu, just retarget the pin.
    // Keep the original pre-menu freeze state so closeCaptureMenu can restore it.
    if (!captureMenuPinnedPrev) {
        captureMenuPinnedPrev = { isFrozen, frozenEl };
    }
    isFrozen = true;
    frozenEl = target;
    renderForElement(target);
}

function unpinTargetForMenu() {
    if (!captureMenuPinnedPrev) return;
    isFrozen = captureMenuPinnedPrev.isFrozen;
    frozenEl = captureMenuPinnedPrev.frozenEl;
    captureMenuPinnedPrev = null;
    const el = frozenEl ?? currentHoverEl ?? lastHoverElForPill;
    if (el) renderForElement(el);
}

function ensureStateMenu() {
    if (stateMenuHost && stateMenuShadow) return;

    stateMenuIsOpen = false;
    stateMenuTargetEl = null;

    stateMenuHost = document.createElement("div");
    stateMenuHost.id = "ui-inventory-state-menu-host";
    stateMenuHost.style.cssText = `
        all: initial;
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483647;
        pointer-events: none;
    `;

    stateMenuShadow = stateMenuHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
        * { box-sizing: border-box; }
        .menu {
            position: fixed;
            min-width: 220px;
            max-width: 320px;
            background: white;
            border: 1px solid rgba(0,0,0,0.10);
            border-radius: 12px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.18);
            padding: 10px;
            display: none;
            pointer-events: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .menu.open { display: block; }
        .title {
            font-size: 12px;
            font-weight: 700;
            color: #111827;
            margin: 0 0 8px 0;
        }
        .desc {
            font-size: 11px;
            color: #6b7280;
            margin: 0 0 10px 0;
            line-height: 1.3;
        }
        .btn {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 9px 10px;
            border-radius: 10px;
            border: 1px solid rgba(0,0,0,0.08);
            background: #f9fafb;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            color: #111827;
        }
        .btn:hover { background: #eef2ff; border-color: rgba(59,130,246,0.35); }
        .btn + .btn { margin-top: 8px; }
        .kbd {
            font-size: 10px;
            font-weight: 700;
            color: #6b7280;
            padding: 2px 6px;
            border: 1px solid rgba(0,0,0,0.12);
            border-radius: 6px;
            background: white;
        }
        .hint {
            font-size: 10px;
            font-weight: 600;
            color: #6b7280;
            margin-top: 10px;
        }
    `;

    const menu = document.createElement("div");
    menu.className = "menu";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = "Capture button state";

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = "Forced states use CDP pseudo-state; As-Is captures what’s currently on screen.";

    const mkBtn = (label: string, kbd: string, mode: StateCaptureMode) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn";
        const left = document.createElement("span");
        left.textContent = label;
        const right = document.createElement("span");
        right.className = "kbd";
        right.textContent = kbd;
        b.appendChild(left);
        b.appendChild(right);
        b.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const target = stateMenuTargetEl;
            closeStateMenu();
            if (!target) return;
            
            // Show confirmation before capturing state
            // Map capture mode to evidence state (what's actually stored)
            const stateLabel = mode === "default" ? "default" :
                              mode === "force_hover" ? "hover" :
                              mode === "force_active" ? "active" :
                              "default"; // as_is defaults to default
            
            await checkDuplicateAndCapture(target, stateLabel, mode);
        });
        return b;
    };

    menu.appendChild(title);
    menu.appendChild(desc);
    menu.appendChild(mkBtn("Default state (non-hover)", "D", "default"));
    menu.appendChild(mkBtn("Force hover", "H", "force_hover"));
    menu.appendChild(mkBtn("Force active", "A", "force_active"));
    menu.appendChild(mkBtn("Capture As-Is", "S", "as_is"));

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Tip: Press Esc to close.";
    menu.appendChild(hint);

    stateMenuShadow.appendChild(style);
    stateMenuShadow.appendChild(menu);
    document.documentElement.appendChild(stateMenuHost);
}

function openStateMenu(target: Element) {
    ensureStateMenu();
    const menu = stateMenuShadow?.querySelector(".menu") as HTMLDivElement | null;
    if (!menu) return;

    stateMenuTargetEl = target;
    stateMenuIsOpen = true;

    const rect = target.getBoundingClientRect();
    const margin = 8;
    const preferredLeft = rect.left;
    const preferredTop = rect.bottom + 10;

    // Measure menu size by temporarily showing it offscreen
    menu.style.left = `-9999px`;
    menu.style.top = `-9999px`;
    menu.classList.add("open");
    const w = menu.offsetWidth || 240;
    const h = menu.offsetHeight || 180;

    let left = preferredLeft;
    let top = preferredTop;
    if (left + w > window.innerWidth - margin) left = window.innerWidth - margin - w;
    if (left < margin) left = margin;
    if (top + h > window.innerHeight - margin) top = rect.top - 10 - h;
    if (top < margin) top = margin;

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
}

function closeStateMenu() {
    stateMenuIsOpen = false;
    stateMenuTargetEl = null;
    const menu = stateMenuShadow?.querySelector(".menu");
    if (menu) menu.classList.remove("open");
}

// ─────────────────────────────────────────────────────────────
// Capture Options Menu (right-click / '.' hotkey)
// ─────────────────────────────────────────────────────────────

function ensureCaptureMenu() {
    if (captureMenuHost && captureMenuShadow) return;

    captureMenuIsOpen = false;
    captureMenuTargetEl = null;
    captureMenuView = "main";
    captureMenuChildCandidates = [];
    captureMenuPos = null;

    captureMenuHost = document.createElement("div");
    captureMenuHost.id = "ui-inventory-capture-menu-host";
    captureMenuHost.style.cssText = `
        all: initial;
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483647;
        pointer-events: none;
    `;

    captureMenuShadow = captureMenuHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
        * { box-sizing: border-box; }
        .menu {
            position: fixed;
            min-width: 260px;
            max-width: 360px;
            background: white;
            border: 1px solid rgba(0,0,0,0.10);
            border-radius: 12px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.18);
            padding: 10px;
            display: none;
            pointer-events: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .menu.open { display: block; }
        .titleRow {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin: 0 0 6px 0;
        }
        .title {
            font-size: 12px;
            font-weight: 800;
            color: #111827;
            margin: 0;
        }
        .crumb {
            font-size: 11px;
            color: #6b7280;
            margin: 0 0 10px 0;
            line-height: 1.3;
        }
        .section {
            margin-top: 10px;
            border-top: 1px solid rgba(0,0,0,0.06);
            padding-top: 10px;
        }
        .section:first-of-type {
            margin-top: 0;
            border-top: none;
            padding-top: 0;
        }
        .sectionTitle {
            font-size: 10px;
            font-weight: 800;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin: 0 0 8px 0;
        }
        .btn {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 9px 10px;
            border-radius: 10px;
            border: 1px solid rgba(0,0,0,0.08);
            background: #f9fafb;
            cursor: pointer;
            font-size: 12px;
            font-weight: 650;
            color: #111827;
        }
        .btn:hover { background: #eef2ff; border-color: rgba(59,130,246,0.35); }
        .btn + .btn { margin-top: 8px; }
        .btn[disabled] {
            cursor: not-allowed;
            opacity: 0.55;
        }
        .kbd {
            font-size: 10px;
            font-weight: 800;
            color: #6b7280;
            padding: 2px 6px;
            border: 1px solid rgba(0,0,0,0.12);
            border-radius: 6px;
            background: white;
        }
        .hint {
            font-size: 10px;
            font-weight: 650;
            color: #6b7280;
            margin-top: 10px;
        }
        .row {
            display: flex;
            gap: 8px;
            margin-top: 10px;
        }
        .btnSecondary {
            flex: 1;
            padding: 8px 10px;
            border-radius: 10px;
            border: 1px solid rgba(0,0,0,0.10);
            background: white;
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
            color: #374151;
        }
        .btnSecondary:hover { background: #f3f4f6; }
    `;

    const menu = document.createElement("div");
    menu.className = "menu";

    // Header
    const titleRow = document.createElement("div");
    titleRow.className = "titleRow";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = "Capture options";
    const titleKbd = document.createElement("span");
    titleKbd.className = "kbd";
    titleKbd.textContent = ".";
    titleRow.appendChild(title);
    titleRow.appendChild(titleKbd);

    const crumb = document.createElement("div");
    crumb.className = "crumb";
    crumb.textContent = "";

    const content = document.createElement("div");
    content.className = "content";

    menu.appendChild(titleRow);
    menu.appendChild(crumb);
    menu.appendChild(content);

    captureMenuShadow.appendChild(style);
    captureMenuShadow.appendChild(menu);
    document.documentElement.appendChild(captureMenuHost);
}

function renderCaptureMenu() {
    if (!captureMenuShadow) return;
    const menu = captureMenuShadow.querySelector(".menu") as HTMLDivElement | null;
    const crumb = captureMenuShadow.querySelector(".crumb") as HTMLDivElement | null;
    const content = captureMenuShadow.querySelector(".content") as HTMLDivElement | null;
    if (!menu || !content) return;

    const target = captureMenuTargetEl;
    if (crumb) crumb.textContent = target ? buildBreadcrumb(target) : "";

    // Clear
    content.innerHTML = "";

    const mkSection = (label: string) => {
        const s = document.createElement("div");
        s.className = "section";
        const t = document.createElement("div");
        t.className = "sectionTitle";
        t.textContent = label;
        s.appendChild(t);
        return s;
    };

    const mkBtn = (label: string, right: string | null, onClick: (() => void | Promise<void>) | null, disabled?: boolean) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn";
        b.disabled = !!disabled;
        const left = document.createElement("span");
        left.textContent = label;
        b.appendChild(left);
        if (right) {
            const r = document.createElement("span");
            r.className = "kbd";
            r.textContent = right;
            b.appendChild(r);
        }
        b.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (!onClick || b.disabled) return;
            await onClick();
        });
        return b;
    };

    const closeAndCapture = async (el: Element, action: CaptureMenuActionState) => {
        closeCaptureMenu();
        await checkDuplicateAndCapture(el, action.requestedState, action.mode);
    };

    if (captureMenuView === "children") {
        const sec = mkSection("Pick a child");
        if (captureMenuChildCandidates.length === 0) {
            sec.appendChild(mkBtn("No suitable children found", null, null, true));
        } else {
            captureMenuChildCandidates.forEach((child, idx) => {
                sec.appendChild(
                    mkBtn(`Capture ${formatElLabel(child)}`, String(idx + 1), async () => {
                        await closeAndCapture(child, { label: "Default", mode: "default", requestedState: "default" });
                    })
                );
            });
        }

        const row = document.createElement("div");
        row.className = "row";
        const back = document.createElement("button");
        back.type = "button";
        back.className = "btnSecondary";
        back.textContent = "Back";
        back.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            captureMenuView = "main";
            renderCaptureMenu();
        });
        row.appendChild(back);
        content.appendChild(sec);
        content.appendChild(row);
        return;
    }

    // Main view
    const selectionSec = mkSection("Selection");
    const exactTarget = target;
    const parentTarget = exactTarget?.parentElement ?? null;
    const semanticTarget = exactTarget ? getSemanticTarget(exactTarget) : null;
    const children = exactTarget ? getChildCandidates(exactTarget, 5) : [];

    selectionSec.appendChild(
        mkBtn(
            exactTarget ? `Capture element (${formatElLabel(exactTarget)})` : "Capture element",
            "↩",
            exactTarget ? async () => await closeAndCapture(exactTarget, { label: "Default", mode: "default", requestedState: "default" }) : null,
            !exactTarget
        )
    );
    selectionSec.appendChild(
        mkBtn(
            parentTarget ? `Capture parent (${formatElLabel(parentTarget)})` : "Capture parent",
            "P",
            parentTarget ? async () => await closeAndCapture(parentTarget, { label: "Default", mode: "default", requestedState: "default" }) : null,
            !parentTarget || parentTarget === document.body || parentTarget === document.documentElement
        )
    );
    selectionSec.appendChild(
        mkBtn(
            semanticTarget ? `Capture semantic (${formatElLabel(semanticTarget)})` : "Capture semantic",
            "M",
            semanticTarget ? async () => await closeAndCapture(semanticTarget, { label: "Default", mode: "default", requestedState: "default" }) : null,
            !semanticTarget
        )
    );
    selectionSec.appendChild(
        mkBtn(
            children.length ? `Capture child… (${children.length} candidates)` : "Capture child…",
            "C",
            children.length
                ? async () => {
                      captureMenuChildCandidates = children;
                      captureMenuView = "children";
                      renderCaptureMenu();
                  }
                : null,
            !children.length
        )
    );

    const shotsSec = mkSection("Screenshots");
    shotsSec.appendChild(
        mkBtn(
            "Capture region… (drag)",
            "R",
            async () => {
                closeCaptureMenu();
                startRegionSelect("region");
            },
            false
        )
    );
    shotsSec.appendChild(
        mkBtn(
            "Capture visible viewport",
            "V",
            async () => {
                closeCaptureMenu();
                startRegionSelect("viewport");
                const sendViewport = (regionSelectHost as any)?.__uiinv_sendViewport as (() => Promise<void>) | undefined;
                if (sendViewport) {
                    await sendViewport();
                }
            },
            false
        )
    );

    const envSec = mkSection("Environment");
    const canFreeze = !!exactTarget;
    envSec.appendChild(
        mkBtn(
            isFrozen ? "Unfreeze (restore hover)" : "Freeze (lock selection)",
            "Shift",
            canFreeze
                ? async () => {
                      // This is explicit user freeze/unfreeze (not just menu pinning)
                      if (isFrozen) {
                          isFrozen = false;
                          frozenEl = null;
                          closeCaptureMenu();
                          return;
                      }
                      isFrozen = true;
                      frozenEl = exactTarget!;
                      renderForElement(frozenEl);
                      closeCaptureMenu();
                  }
                : null,
            !canFreeze
        )
    );

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Tip: Right-click to open here. Press Esc to close.";

    content.appendChild(selectionSec);
    content.appendChild(shotsSec);
    content.appendChild(envSec);
    content.appendChild(hint);
}

function openCaptureMenu(target: Element, pos: { x: number; y: number }) {
    ensureCaptureMenu();
    const menu = captureMenuShadow?.querySelector(".menu") as HTMLDivElement | null;
    if (!menu) return;

    captureMenuTargetEl = target;
    captureMenuIsOpen = true;
    captureMenuView = "main";
    captureMenuChildCandidates = [];
    captureMenuPos = pos;

    pinTargetForMenu(target);
    renderCaptureMenu();

    const margin = 8;
    // Measure menu size offscreen
    menu.style.left = `-9999px`;
    menu.style.top = `-9999px`;
    menu.classList.add("open");
    const w = menu.offsetWidth || 300;
    const h = menu.offsetHeight || 220;

    let left = pos.x;
    let top = pos.y;
    if (left + w > window.innerWidth - margin) left = window.innerWidth - margin - w;
    if (top + h > window.innerHeight - margin) top = window.innerHeight - margin - h;
    if (left < margin) left = margin;
    if (top < margin) top = margin;

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
}

function closeCaptureMenu() {
    captureMenuIsOpen = false;
    captureMenuTargetEl = null;
    captureMenuView = "main";
    captureMenuChildCandidates = [];
    captureMenuPos = null;
    const menu = captureMenuShadow?.querySelector(".menu");
    if (menu) menu.classList.remove("open");
    unpinTargetForMenu();
}

// ─────────────────────────────────────────────────────────────
// Confirmation Popover (M9: Duplicate detection & state confirmation)
// ─────────────────────────────────────────────────────────────

let confirmationPopoverHost: HTMLDivElement | null = null;
let confirmationPopoverShadow: ShadowRoot | null = null;
let confirmationPopoverIsOpen = false;
let confirmationPopoverCallbacks: { onConfirm: () => void; onCancel: () => void } | null = null;

function ensureConfirmationPopover() {
    if (confirmationPopoverHost && confirmationPopoverShadow) return;

    confirmationPopoverIsOpen = false;

    confirmationPopoverHost = document.createElement("div");
    confirmationPopoverHost.id = "ui-inventory-confirmation-popover-host";
    confirmationPopoverHost.style.cssText = `
        all: initial;
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483647;
        pointer-events: none;
    `;

    confirmationPopoverShadow = confirmationPopoverHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
        * { box-sizing: border-box; }
        .popover {
            position: fixed;
            min-width: 260px;
            max-width: 360px;
            background: white;
            border: 1px solid rgba(0,0,0,0.10);
            border-radius: 12px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.18);
            padding: 16px;
            display: none;
            pointer-events: auto;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .popover.open { display: block; }
        .message {
            font-size: 14px;
            font-weight: 500;
            color: #111827;
            margin: 0 0 16px 0;
            line-height: 1.4;
        }
        .buttons {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        .btn {
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.15s ease;
        }
        .btn-primary {
            background: #3b82f6;
            color: white;
        }
        .btn-primary:hover {
            background: #2563eb;
        }
        .btn-secondary {
            background: #f3f4f6;
            color: #374151;
        }
        .btn-secondary:hover {
            background: #e5e7eb;
        }
    `;

    const popover = document.createElement("div");
    popover.className = "popover";
    popover.innerHTML = `
        <div class="message"></div>
        <div class="buttons">
            <button class="btn btn-secondary cancel-btn">Cancel</button>
            <button class="btn btn-primary confirm-btn">Capture</button>
        </div>
    `;

    confirmationPopoverShadow.appendChild(style);
    confirmationPopoverShadow.appendChild(popover);

    // Event listeners
    const confirmBtn = popover.querySelector(".confirm-btn") as HTMLButtonElement;
    const cancelBtn = popover.querySelector(".cancel-btn") as HTMLButtonElement;

    confirmBtn.addEventListener("click", () => {
        if (confirmationPopoverCallbacks?.onConfirm) {
            confirmationPopoverCallbacks.onConfirm();
        }
        closeConfirmationPopover();
    });

    cancelBtn.addEventListener("click", () => {
        if (confirmationPopoverCallbacks?.onCancel) {
            confirmationPopoverCallbacks.onCancel();
        }
        closeConfirmationPopover();
    });

    document.documentElement.appendChild(confirmationPopoverHost);
}

interface ConfirmationPopoverConfig {
    targetElement: Element;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

function showConfirmationPopover(config: ConfirmationPopoverConfig) {
    ensureConfirmationPopover();
    const popover = confirmationPopoverShadow?.querySelector(".popover") as HTMLDivElement | null;
    if (!popover) return;

    // Update content
    const messageEl = popover.querySelector(".message");
    const confirmBtn = popover.querySelector(".confirm-btn") as HTMLButtonElement;
    
    if (messageEl) messageEl.textContent = config.message;
    if (confirmBtn) confirmBtn.textContent = config.confirmLabel || "Capture";

    // Store callbacks
    confirmationPopoverCallbacks = {
        onConfirm: config.onConfirm,
        onCancel: config.onCancel
    };

    confirmationPopoverIsOpen = true;

    // Position popover near target element
    const rect = config.targetElement.getBoundingClientRect();
    const margin = 8;
    const preferredLeft = rect.left;
    const preferredTop = rect.bottom + 10;

    // Measure popover size by temporarily showing it offscreen
    popover.style.left = `-9999px`;
    popover.style.top = `-9999px`;
    popover.classList.add("open");
    const w = popover.offsetWidth || 280;
    const h = popover.offsetHeight || 100;

    let left = preferredLeft;
    let top = preferredTop;
    if (left + w > window.innerWidth - margin) left = window.innerWidth - margin - w;
    if (left < margin) left = margin;
    if (top + h > window.innerHeight - margin) top = rect.top - 10 - h;
    if (top < margin) top = margin;

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
}

function closeConfirmationPopover() {
    confirmationPopoverIsOpen = false;
    confirmationPopoverCallbacks = null;
    const popover = confirmationPopoverShadow?.querySelector(".popover");
    if (popover) popover.classList.remove("open");
}

/**
 * Get readable CSS-ish path (display-only, max ~80 chars)
 */
function getReadableCssPath(el: Element): string {
    const segments: string[] = [];
    let current: Element | null = el;
    let depth = 0;

    while (current && current !== document.documentElement && depth < 3) {
        let segment = current.tagName.toLowerCase();

        // Add id if present
        const id = (current as HTMLElement).id;
        if (id) {
            segment += `#${id}`;
        }

        // Add up to 2 classes
        const classes = Array.from(current.classList).slice(0, 2);
        if (classes.length > 0) {
            segment += "." + classes.join(".");
        }

        segments.unshift(segment);

        // Stop if we found an id (good anchor point)
        if (id) break;

        current = current.parentElement;
        depth++;
    }

    let path = segments.join(" > ");

    // Cap to ~80 chars
    if (path.length > 80) {
        path = path.slice(0, 77) + "…";
    }

    return path;
}

/**
 * Update metadata pill content and position for hovered element
 * Anchors pill above (or below if no space) the element's bounding box
 */
function updateMetadataPill(el: Element | null, forceReposition: boolean = false) {
    if (!pillDiv || !isHoverModeActive) return;

    // Hide if no element or html/body
    if (!el || el === document.documentElement || el === document.body) {
        pillDiv.style.display = "none";
        lastHoverElForPill = null;
        return;
    }

    // Recompute if element changed or forced
    const shouldRecompute = (el !== lastHoverElForPill) || forceReposition;

    if (shouldRecompute) {
        const tagName = `<${el.tagName.toLowerCase()}>`;
        const path = getReadableCssPath(el);

        // Add frozen prefix if frozen
        const prefix = isFrozen ? "❄️ [FROZEN]\n" : "";
        pillDiv.textContent = `${prefix}${tagName}\n${path}`;

        // Update border color based on frozen state
        if (isFrozen) {
            pillDiv.style.borderColor = "#3b82f6";
            pillDiv.style.borderWidth = "2px";
        } else {
            pillDiv.style.borderColor = "#e0e0e0";
            pillDiv.style.borderWidth = "1px";
        }

        lastHoverElForPill = el;

        // Measure pill size (temporarily show if hidden to get dimensions)
        const wasHidden = pillDiv.style.display === "none";
        if (wasHidden) {
            pillDiv.style.display = "block";
            pillDiv.style.visibility = "hidden"; // measure without showing
        }

        const pillWidth = pillDiv.offsetWidth;
        const pillHeight = pillDiv.offsetHeight;

        if (wasHidden) {
            pillDiv.style.visibility = "visible";
        }

        // Get element bounding box
        const rect = el.getBoundingClientRect();

        // Default: place above element with 6px gap
        let top = rect.top - pillHeight - 6;
        let left = rect.left;

        // If not enough space above, place below
        if (top < 6) {
            top = rect.bottom + 6;
        }

        // Clamp top within viewport bounds
        top = Math.max(6, Math.min(top, window.innerHeight - pillHeight - 6));

        // Clamp left within viewport bounds
        left = Math.min(Math.max(6, left), window.innerWidth - pillWidth - 6);

        // Apply position
        pillDiv.style.left = `${Math.round(left)}px`;
        pillDiv.style.top = `${Math.round(top)}px`;
    }

    pillDiv.style.display = "block";
}

/**
 * Render overlay and pill for a specific element (used when frozen)
 */
function renderForElement(el: Element) {
    if (!overlayDiv || !isHoverModeActive) return;

    // Guard against html/body
    if (el === document.documentElement || el === document.body) return;

    const rect = el.getBoundingClientRect();
    overlayDiv.style.display = "block";
    overlayDiv.style.left = `${rect.left}px`;
    overlayDiv.style.top = `${rect.top}px`;
    overlayDiv.style.width = `${rect.width}px`;
    overlayDiv.style.height = `${rect.height}px`;

    updateMetadataPill(el, true); // force reposition
}

function updateOverlay(x: number, y: number) {
    if (!overlayDiv || !isHoverModeActive) return;

    // Don't update overlay during capture (CDP mouse movement triggers this)
    if (isCaptureInProgress) {
        return;
    }

    // If frozen, ignore mouse movement and keep rendering frozen element
    if (isFrozen && frozenEl) {
        renderForElement(frozenEl);
        return;
    }

    // Find element under cursor using elementsFromPoint to capture disabled elements
    // (disabled buttons have pointer-events: none, so elementFromPoint misses them)
    const elements = document.elementsFromPoint(x, y);
    
    // Filter out our own overlay elements and find the first meaningful element
    const el = elements.find(elem => 
        elem !== overlayDiv && 
        elem !== pillDiv &&
        !overlayDiv?.contains(elem) &&
        !pillDiv?.contains(elem)
    );
    
    if (!el) {
        overlayDiv.style.display = "none";
        updateMetadataPill(null);
        currentHoverEl = null;
        return;
    }

    // Skip <html> and <body> unless truly necessary
    if (el === document.documentElement || el === document.body) {
        overlayDiv.style.display = "none";
        updateMetadataPill(null);
        currentHoverEl = null;
        return;
    }

    // Track current hover element
    currentHoverEl = el;

    // Get bounding box and position overlay
    const rect = el.getBoundingClientRect();
    overlayDiv.style.display = "block";
    overlayDiv.style.left = `${rect.left}px`;
    overlayDiv.style.top = `${rect.top}px`;
    overlayDiv.style.width = `${rect.width}px`;
    overlayDiv.style.height = `${rect.height}px`;

    // Update metadata pill
    updateMetadataPill(el);
}

function onMouseMove(e: MouseEvent) {
    if (!isHoverModeActive || pendingUpdate) return;

    // Disable hover highlight while selecting a screenshot region/viewport
    if (regionSelectIsActive) return;

    // M9: Track mouse position for post-capture overlay refresh
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    // Prevent overlay updates during CDP capture (CDP mouse movement triggers this)
    if (isCaptureInProgress) {
        return;
    }

    pendingUpdate = true;
    rafId = requestAnimationFrame(() => {
        updateOverlay(e.clientX, e.clientY);
        pendingUpdate = false;
    });
}

async function onPointerCapture(e: PointerEvent) {
    if (!isHoverModeActive) return;

    // Allow interactions with our UI surfaces (never treat pointerdown inside UI as a capture)
    if (captureMenuHost && e.composedPath().includes(captureMenuHost)) {
        return;
    }
    if (confirmationPopoverHost && e.composedPath().includes(confirmationPopoverHost)) {
        return;
    }
    if (sidebarHost && e.composedPath().includes(sidebarHost)) {
        return;
    }

    // Allow region selection overlay to own pointer events
    if (regionSelectIsActive) {
        if (regionSelectHost && e.composedPath().includes(regionSelectHost)) {
            return;
        }
    }

    // Allow interactions with the state menu
    if (stateMenuHost && e.composedPath().includes(stateMenuHost)) {
        return;
    }

    // Only primary button (left-click)
    if (e.button !== 0) return;

    // Always block pointer interaction during capture mode to prevent focusing inputs
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Only capture when frozen
    if (!isFrozen || !frozenEl) return;

    const target = frozenEl;

    // Ignore selecting <html>/<body>
    if (target === document.documentElement || target === document.body) {
        return;
    }

    // Suppress next click to prevent double-capture
    suppressNextClickCapture = true;

    const actionTarget = (target as Element).closest?.("button, a[href]");
    if (actionTarget) {
        openStateMenu(actionTarget);
        return;
    }

    await performCapture(target);
}

async function onClickSelect(e: MouseEvent) {
    if (!isHoverModeActive) return;

    // Allow region selection overlay to own click events
    if (regionSelectIsActive) {
        if (regionSelectHost && e.composedPath().includes(regionSelectHost)) {
            return;
        }
    }

    // If confirmation popover is open, either let it handle the click or close it
    if (confirmationPopoverIsOpen) {
        if (confirmationPopoverHost && e.composedPath().includes(confirmationPopoverHost)) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Cancel on click outside
        if (confirmationPopoverCallbacks?.onCancel) {
            confirmationPopoverCallbacks.onCancel();
        }
        closeConfirmationPopover();
        return;
    }

    // Skip this click if pointerdown just handled capture/opened a state menu
    // (prevents immediately closing the state menu right after opening it on pointerdown)
    if (suppressNextClickCapture) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        suppressNextClickCapture = false;
        return;
    }

    // If capture menu is open, either let it handle the click or close it.
    if (captureMenuIsOpen) {
        if (captureMenuHost && e.composedPath().includes(captureMenuHost)) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeCaptureMenu();
        return;
    }

    // If menu is open, either let it handle the click or close it.
    if (stateMenuIsOpen) {
        if (stateMenuHost && e.composedPath().includes(stateMenuHost)) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeStateMenu();
        return;
    }

    // Greedy click blocking: always prevent page interaction while auditing
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // If frozen, pointerdown already handled capture - don't double-capture
    if (isFrozen) {
        return;
    }

    // Non-frozen click capture
    const target = e.target as Element | null;
    if (!target) return;

    // Ignore selecting <html>/<body>
    if (target === document.documentElement || target === document.body) {
        return;
    }

    const actionTarget = target.closest?.("button, a[href]");
    if (actionTarget) {
        openStateMenu(actionTarget);
        return;
    }

    // Check for duplicate before capturing
    await checkDuplicateAndCapture(target);
}

/**
 * Check if element is a duplicate and show confirmation popover if needed
 */
async function checkDuplicateAndCapture(target: Element, requestedState?: string, captureMode?: StateCaptureMode) {
    // Extract element identity for duplicate check
    const tagName = target.tagName;
    const role = (target as HTMLElement).getAttribute("role");
    const ariaLabel = (target as HTMLElement).getAttribute("aria-label");
    const textPreview = ((target.textContent || "").trim()).slice(0, 120);
    const accessibleName = ariaLabel || textPreview;
    
    // For form elements, include additional context to differentiate similar inputs
    const elementId = (target as HTMLElement).id || "";
    const elementName = (target as HTMLInputElement).name || "";
    const placeholder = (target as HTMLInputElement).placeholder || "";
    const inputType = (target instanceof HTMLInputElement) ? (target.type || "") : "";

    console.log("[UI Inventory] Checking duplicate for:", { tagName, role, accessibleName, requestedState, elementId, elementName, placeholder });

    try {
        // Query service worker for duplicate check
        const response = await chrome.runtime.sendMessage({
            type: "AUDIT/CHECK_DUPLICATE",
            tagName,
            role,
            accessibleName,
            requestedState: requestedState || "default",
            // Form element context for differentiation
            elementId,
            elementName,
            placeholder
        });

        console.log("[UI Inventory] Duplicate check response:", response);
        if (!response?.ok) {
            // If check fails, proceed with capture anyway
            console.warn("[UI Inventory] Duplicate check failed, proceeding with capture");
            await performCapture(target, captureMode ? { mode: captureMode } : undefined);
            return;
        }

        if (response.isDuplicate) {
            // Show confirmation popover
            const elementType = tagName.toLowerCase();
            const stateSuffix = requestedState && requestedState !== "default" ? ` (${requestedState} state)` : "";
            
            showConfirmationPopover({
                targetElement: target,
                message: `This ${elementType}${stateSuffix} has already been captured. Capture again?`,
                confirmLabel: "Capture Again",
                onConfirm: async () => {
                    await performCapture(target, captureMode ? { mode: captureMode } : undefined);
                },
                onCancel: () => {
                    // Just return to hover mode
                    console.log("[UI Inventory] Duplicate capture cancelled");
                }
            });
        } else {
            // Not a duplicate, proceed with capture
            await performCapture(target, captureMode ? { mode: captureMode } : undefined);
        }
    } catch (err) {
        console.error("[UI Inventory] Duplicate check error:", err);
        // On error, proceed with capture anyway
        await performCapture(target, captureMode ? { mode: captureMode } : undefined);
    }
}

async function performCapture(target: Element, captureOptions?: { mode: StateCaptureMode }) {
    // Phase 3: keep a reference for last-resort marker operations
    lastCaptureTargetEl = target;

    // Show capturing feedback
    if (pillDiv) {
        pillDiv.textContent = "📸 CAPTURING…";
        pillDiv.style.borderColor = "#10b981";
    }

    const rect = target.getBoundingClientRect();
    const textPreview = ((target.textContent || "").trim()).slice(0, 120);
    const createdAt = Date.now();

    // Extract v2.2 fields
    const conditions = extractConditions();
    const intent = extractIntent(target);
    const primitives = extractStylePrimitives(target);
    const nearestLandmarkRole = getNearestLandmarkRole(target);

    // Phase 1: provide hit-test points for CDP node resolution (best-effort)
    const inset = (v: number) => Math.max(2, Math.min(8, v / 4));
    const dx = inset(rect.width);
    const dy = inset(rect.height);
    const hitTestPoints = [
        { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        { x: rect.left + dx, y: rect.top + dy },
        { x: rect.left + rect.width - dx, y: rect.top + dy },
        { x: rect.left + dx, y: rect.top + rect.height - dy },
        { x: rect.left + rect.width - dx, y: rect.top + rect.height - dy },
    ].map(p => ({
        x: Math.round(p.x),
        y: Math.round(p.y),
    }));

    // Build capture record (v1 structure with v2.2 fields added)
    // Service worker will transform this to full CaptureRecordV2
    const record: any = {
        id: generateCaptureId(),
        createdAt,
        url: location.href,

        // v2.2: conditions
        conditions,

        // Milestone 4: scope (landmark context)
        scope: {
            nearestLandmarkRole,
        },

        element: {
            tagName: target.tagName,
            id: (target as HTMLElement).id || null,
            classList: Array.from(target.classList || []),
            role: target.getAttribute("role"),
            textPreview,
            outerHTML: target.outerHTML, // Add outerHTML for HTML Structure display

            // v1 attributes (kept for backward compatibility)
            attributes: {
                ariaLabel: target.getAttribute("aria-label") || undefined,
                ariaLabelledBy: target.getAttribute("aria-labelledby") || undefined,
                ariaExpanded: target.getAttribute("aria-expanded") || undefined,
                ariaChecked: target.getAttribute("aria-checked") || undefined,
                ariaSelected: target.getAttribute("aria-selected") || undefined,
                ariaDisabled: target.getAttribute("aria-disabled") || undefined,
                ariaCurrent: target.getAttribute("aria-current") || undefined,
                // M9: Add form element context for duplicate detection
                name: (target as HTMLInputElement).name || undefined,
                placeholder: (target as HTMLInputElement).placeholder || undefined,
            },

            // v2.2: intent anchors
            intent,
        },

        boundingBox: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
        },

        // v1 viewport (kept for backward compatibility)
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            devicePixelRatio: window.devicePixelRatio,
        },

        styles: {
            // v2.2: structured primitives (canonical path)
            primitives,
            // v1: flat computed map (kept temporarily for backward compat with old UI)
            computed: extractComputedStyles(target),
        },

        // Phase 1: transient CDP resolver hints (not persisted by schema)
        __uiinv_cdp: {
            hitTestPoints,
        },
    };

    // Hide overlay and pill before screenshot to avoid capturing them
    const wasOverlayVisible = overlayDiv && overlayDiv.style.display !== "none";
    const wasPillVisible = pillDiv && pillDiv.style.display !== "none";
    const wasMenuVisible = stateMenuIsOpen;
    const wasCaptureMenuVisible = captureMenuIsOpen;

    try {
        // Set flag to prevent overlay updates during CDP capture
        isCaptureInProgress = true;

        if (overlayDiv) {
            overlayDiv.style.display = "none";
        }
        if (pillDiv) {
            pillDiv.style.display = "none";
        }
        if (wasMenuVisible) {
            closeStateMenu();
        }
        if (wasCaptureMenuVisible) {
            closeCaptureMenu();
        }

        // Wait for browser to render the hidden overlay (one frame)
        await new Promise(resolve => requestAnimationFrame(resolve));

        // Send capture message to service worker with timeout tracking (Milestone 5)
        let timeoutId: number | null = null;
        let didRespond = false;

        // Start timeout (1200ms - increased from 800ms to reduce false warnings)
        timeoutId = window.setTimeout(() => {
            if (!didRespond) {
                showToast("Capture didn't complete. Try again, or reload the page.");
            }
        }, 1200);

        chrome.runtime.sendMessage({ type: "AUDIT/CAPTURE", record, captureOptions }, (response) => {
            didRespond = true;
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }

            // Check for runtime errors (connection issues, etc.)
            if (chrome.runtime.lastError) {
                showToast("Capture didn't complete. Try again, or reload the page.");
                return;
            }

            // Treat missing response or non-ok response as failure
            if (!response || response.ok !== true) {
                showToast("Capture failed. Try again.");
            }
        });
    } finally {
        // Unfreeze after capture (always runs even if exception occurs)
        isFrozen = false;
        frozenEl = null;

        // Restore overlay and pill after a longer delay (allows CDP screenshot to complete)
        // CDP capture can take 200-500ms, so we wait longer before restoring
        setTimeout(() => {
            isCaptureInProgress = false; // Clear flag after screenshot should be done
            if (overlayDiv && wasOverlayVisible && isHoverModeActive) {
                overlayDiv.style.display = "block";
            }
            if (pillDiv && wasPillVisible && isHoverModeActive) {
                pillDiv.style.display = "block";
            }

            // M9: Force overlay update to refresh currentHoverEl after capture
            // This ensures Shift+freeze works immediately after a capture
            if (isHoverModeActive) {
                const rect = document.documentElement.getBoundingClientRect();
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                
                // Get current mouse position if available, otherwise use center
                const x = lastMouseX ?? centerX;
                const y = lastMouseY ?? centerY;
                
                updateOverlay(x, y);
            }
        }, 600); // Increased from 100ms to 600ms to ensure CDP screenshot completes

        // Restore pill content using final frozen state (after isFrozen cleared)
        setTimeout(() => {
            if (pillDiv && isHoverModeActive) {
                updateMetadataPill(currentHoverEl ?? target, true);
            }
        }, 400);
    }
}

function onKeyDown(e: KeyboardEvent) {
    if (!isHoverModeActive) return;

    // '.' : open capture options menu for current target (keyboard fallback)
    if (e.key === "." && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Avoid triggering while focus is on an editable element
        const ae = document.activeElement as Element | null;
        const isEditable =
            ae instanceof HTMLInputElement ||
            ae instanceof HTMLTextAreaElement ||
            (ae && (ae as HTMLElement).isContentEditable);
        if (isEditable) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const target = frozenEl ?? currentHoverEl ?? lastHoverElForPill;
        if (target && isInteractiveTarget(target)) {
            const pos = captureMenuPos ?? (lastMouseX !== null && lastMouseY !== null ? { x: lastMouseX, y: lastMouseY } : { x: window.innerWidth / 2, y: window.innerHeight / 2 });
            openCaptureMenu(target, pos);
        }
        return;
    }

    // Shift: freeze on current hovered element
    if (e.key === "Shift") {
        // Ignore key repeat to prevent flip-flop
        if (e.repeat) return;

        // Only freeze if actively hovering an element (no stale fallback)
        if (currentHoverEl) {
            isFrozen = true;
            frozenEl = currentHoverEl;
            renderForElement(frozenEl);
        }
        return;
    }

    // Escape: exit selection mode
    if (e.key === "Escape") {
        if (regionSelectIsActive) {
            const cancel = (regionSelectHost as any)?.__uiinv_cancel as (() => void) | undefined;
            if (cancel) cancel();
            return;
        }
        if (confirmationPopoverIsOpen) {
            // Cancel on escape
            if (confirmationPopoverCallbacks?.onCancel) {
                confirmationPopoverCallbacks.onCancel();
            }
            closeConfirmationPopover();
            return;
        }
        if (captureMenuIsOpen) {
            closeCaptureMenu();
            return;
        }
        if (stateMenuIsOpen) {
            closeStateMenu();
            return;
        }
        stopHoverMode();
        chrome.runtime.sendMessage({ type: "AUDIT/TOGGLE", enabled: false });
        return;
    }
}

function onContextMenu(e: MouseEvent) {
    if (!isHoverModeActive) return;

    // If user right-clicks inside our UI, let it behave normally (but keep native menu suppressed)
    if (captureMenuHost && e.composedPath().includes(captureMenuHost)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
    }
    if (stateMenuHost && e.composedPath().includes(stateMenuHost)) {
        // Don't open capture menu over state menu; just suppress native menu
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
    }
    if (confirmationPopoverHost && e.composedPath().includes(confirmationPopoverHost)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
    }

    // Safe interception: capture phase, prevent native menu and site handlers while in capture mode.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const target = resolveTargetFromPoint(e.clientX, e.clientY);
    if (!target) return;

    openCaptureMenu(target, { x: e.clientX, y: e.clientY });
}

function onKeyUp(e: KeyboardEvent) {
    if (!isHoverModeActive) return;

    // Shift released: unfreeze
    if (e.key === "Shift") {
        // If the capture menu is open, it owns the frozen state as a pin.
        // Don't unfreeze underneath it.
        if (captureMenuIsOpen && captureMenuPinnedPrev) {
            return;
        }
        isFrozen = false;
        frozenEl = null;
        // Force refresh pill visuals immediately
        const targetEl = currentHoverEl ?? lastHoverElForPill;
        if (targetEl) {
            updateMetadataPill(targetEl, true);
        }
        return;
    }
}


function startHoverMode() {
    if (isHoverModeActive) return;

    console.log("[UI Inventory] Starting hover mode");
    isHoverModeActive = true;

    // Create overlay if it doesn't exist
    if (!overlayDiv) {
        overlayDiv = createOverlay();
    }

    // Create metadata pill if it doesn't exist
    if (!pillDiv) {
        pillDiv = createMetadataPill();
    }

    // Start listening for mouse movement, pointer, and keyboard
    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("pointerdown", onPointerCapture, true);
    document.addEventListener("click", onClickSelect, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
}

function stopHoverMode() {
    if (!isHoverModeActive) return;

    console.log("[UI Inventory] Stopping hover mode");
    isHoverModeActive = false;

    // Cancel any pending animation frame
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    // Remove event listeners
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("pointerdown", onPointerCapture, true);
    document.removeEventListener("click", onClickSelect, true);
    document.removeEventListener("contextmenu", onContextMenu, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("keyup", onKeyUp, true);

    // Hide and remove overlay
    if (overlayDiv) {
        overlayDiv.remove();
        overlayDiv = null;
    }

    // Hide and remove pill
    if (pillDiv) {
        pillDiv.remove();
        pillDiv = null;
    }
    if (stateMenuHost) {
        stateMenuHost.remove();
        stateMenuHost = null;
        stateMenuShadow = null;
    }
    stateMenuIsOpen = false;
    stateMenuTargetEl = null;

    if (captureMenuHost) {
        captureMenuHost.remove();
        captureMenuHost = null;
        captureMenuShadow = null;
    }
    captureMenuIsOpen = false;
    captureMenuTargetEl = null;
    captureMenuView = "main";
    captureMenuChildCandidates = [];
    captureMenuPos = null;
    captureMenuPinnedPrev = null;

    if (regionSelectHost) {
        regionSelectHost.remove();
        regionSelectHost = null;
        regionSelectShadow = null;
    }
    regionSelectIsActive = false;
    regionSelectStart = null;
    regionSelectRectEl = null;
    
    // Clean up confirmation popover
    if (confirmationPopoverHost) {
        confirmationPopoverHost.remove();
        confirmationPopoverHost = null;
        confirmationPopoverShadow = null;
    }
    confirmationPopoverIsOpen = false;
    confirmationPopoverCallbacks = null;
    
    lastHoverElForPill = null;
    currentHoverEl = null;
    isFrozen = false;
    frozenEl = null;

    pendingUpdate = false;

}

// ─────────────────────────────────────────────────────────────
// Message handling
// ─────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    console.log("[UI Inventory] CS got message:", msg);

    if (msg?.type === "AUDIT/TOGGLE") {
        if (msg.enabled) {
            startHoverMode();
        } else {
            stopHoverMode();
        }
        // ✅ respond so SW doesn't warn "message port closed"
        sendResponse({ ok: true });
        return; // important: end handler for this message
    }

    if (msg?.type === "AUDIT/GET_ENABLED") {
        // Authoritative state: return actual hover mode status
        sendResponse({ ok: true, enabled: isHoverModeActive });
        return true;
    }

    if (msg?.type === "AUDIT/PING") {
        console.log("[UI Inventory] CS ping received ✅");
        sendResponse?.({ ok: true });
        return;
    }

    if (msg?.type === "AUDIT/MARK_TARGET") {
        try {
            const markerId = String(msg.markerId || "");
            if (!markerId) {
                sendResponse({ ok: false, error: "markerId is required" });
                return;
            }
            if (!lastCaptureTargetEl) {
                sendResponse({ ok: false, error: "No target element available to mark" });
                return;
            }
            // Apply marker attribute (last resort). Must be removed later.
            (lastCaptureTargetEl as HTMLElement).setAttribute("data-uiinv-target", markerId);
            lastMarkerId = markerId;
            sendResponse({ ok: true });
        } catch (err) {
            sendResponse({ ok: false, error: String(err) });
        }
        return true;
    }

    if (msg?.type === "AUDIT/UNMARK_TARGET") {
        try {
            const markerId = String(msg.markerId || "");
            if (!markerId) {
                sendResponse({ ok: false, error: "markerId is required" });
                return;
            }
            const el = lastCaptureTargetEl as HTMLElement | null;
            if (el) {
                const current = el.getAttribute("data-uiinv-target");
                if (current === markerId || lastMarkerId === markerId) {
                    el.removeAttribute("data-uiinv-target");
                }
            }
            if (lastMarkerId === markerId) {
                lastMarkerId = null;
            }
            sendResponse({ ok: true });
        } catch (err) {
            sendResponse({ ok: false, error: String(err) });
        }
        return true;
    }

    if (msg?.type === "UI/TOGGLE_SIDEBAR") {
        ensureSidebar();
        toggleSidebar();
        sendResponse({ ok: true });
        return;
    }

    // No default sendResponse to avoid interfering with other handlers
});