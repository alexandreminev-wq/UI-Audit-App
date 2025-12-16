import { generateCaptureId, type CaptureConditions, type ElementIntent, type ThemeHint } from "../types/capture";
import { extractComputedStyles, extractStylePrimitives } from "./extractComputedStyles";

console.log("[UI Inventory] Content script loaded on:", location.href);

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
let isHoverModeActive = false;
let rafId: number | null = null;
let pendingUpdate = false;

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

function updateOverlay(x: number, y: number) {
    if (!overlayDiv || !isHoverModeActive) return;

    // Find element under cursor (overlay has pointer-events: none, so it won't interfere)
    const el = document.elementFromPoint(x, y);
    if (!el) {
        overlayDiv.style.display = "none";
        return;
    }

    // Skip <html> and <body> unless truly necessary
    if (el === document.documentElement || el === document.body) {
        overlayDiv.style.display = "none";
        return;
    }

    // Get bounding box and position overlay
    const rect = el.getBoundingClientRect();
    overlayDiv.style.display = "block";
    overlayDiv.style.left = `${rect.left}px`;
    overlayDiv.style.top = `${rect.top}px`;
    overlayDiv.style.width = `${rect.width}px`;
    overlayDiv.style.height = `${rect.height}px`;
}

function onMouseMove(e: MouseEvent) {
    if (!isHoverModeActive || pendingUpdate) return;

    pendingUpdate = true;
    rafId = requestAnimationFrame(() => {
        updateOverlay(e.clientX, e.clientY);
        pendingUpdate = false;
    });
}

async function onClickSelect(e: MouseEvent) {
    if (!isHoverModeActive) return;

    // Block the page interaction (Option A)
    e.preventDefault();
    e.stopPropagation();
    // stopImmediatePropagation is useful when pages attach lots of click handlers
    e.stopImmediatePropagation();

    const target = e.target as Element | null;
    if (!target) return;

    // Ignore selecting <html>/<body>
    if (target === document.documentElement || target === document.body) return;

    const rect = target.getBoundingClientRect();
    const textPreview = ((target.textContent || "").trim()).slice(0, 120);
    const createdAt = Date.now();

    // Extract v2.2 fields
    const conditions = extractConditions();
    const intent = extractIntent(target);
    const primitives = extractStylePrimitives(target);

    // Build capture record (v1 structure with v2.2 fields added)
    // Service worker will transform this to full CaptureRecordV2
    const record: any = {
        id: generateCaptureId(),
        createdAt,
        url: location.href,

        // v2.2: conditions
        conditions,

        element: {
            tagName: target.tagName,
            id: (target as HTMLElement).id || null,
            classList: Array.from(target.classList || []),
            role: target.getAttribute("role"),
            textPreview,

            // v1 attributes (kept for backward compatibility)
            attributes: {
                ariaLabel: target.getAttribute("aria-label") || undefined,
                ariaLabelledBy: target.getAttribute("aria-labelledby") || undefined,
                ariaExpanded: target.getAttribute("aria-expanded") || undefined,
                ariaChecked: target.getAttribute("aria-checked") || undefined,
                ariaSelected: target.getAttribute("aria-selected") || undefined,
                ariaDisabled: target.getAttribute("aria-disabled") || undefined,
                ariaCurrent: target.getAttribute("aria-current") || undefined,
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
    };

    // Hide overlay before screenshot to avoid capturing it
    const wasOverlayVisible = overlayDiv && overlayDiv.style.display !== "none";
    if (overlayDiv) {
        overlayDiv.style.display = "none";
    }

    // Wait for browser to render the hidden overlay (one frame)
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Send capture message to service worker
    chrome.runtime.sendMessage({ type: "AUDIT/CAPTURE", record });

    // Restore overlay after a short delay (allows screenshot to complete)
    setTimeout(() => {
        if (overlayDiv && wasOverlayVisible && isHoverModeActive) {
            overlayDiv.style.display = "block";
        }
    }, 100);
}


function startHoverMode() {
    if (isHoverModeActive) return;

    console.log("[UI Inventory] Starting hover mode");
    isHoverModeActive = true;

    // Create overlay if it doesn't exist
    if (!overlayDiv) {
        overlayDiv = createOverlay();
    }

    // Start listening for mouse movement
    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("click", onClickSelect, true);
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

    // Remove event listener
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("click", onClickSelect, true);


    // Hide and remove overlay
    if (overlayDiv) {
        overlayDiv.remove();
        overlayDiv = null;
    }

    pendingUpdate = false;

}

// ─────────────────────────────────────────────────────────────
// On load: ask SW if audit is enabled for this tab (persists across navigation)
// ─────────────────────────────────────────────────────────────

chrome.runtime.sendMessage({ type: "AUDIT/GET_STATE" }, (resp) => {
    if (resp?.type === "AUDIT/STATE" && resp.enabled) {
        console.log("[UI Inventory] Resuming hover mode (tab state enabled)");
        startHoverMode();
    }
});

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
});