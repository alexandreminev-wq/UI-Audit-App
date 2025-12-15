import { generateCaptureId, type CaptureRecord } from "../types/capture";
import { extractComputedStyles } from "./extractComputedStyles";

console.log("[UI Inventory] Content script loaded on:", location.href);

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

function onClickSelect(e: MouseEvent) {
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

    // Build full CaptureRecord
    const record: CaptureRecord = {
        id: generateCaptureId(),
        createdAt: Date.now(),
        url: location.href,
        element: {
            tagName: target.tagName,
            id: (target as HTMLElement).id || null,
            classList: Array.from(target.classList || []),
            role: target.getAttribute("role"),
            textPreview,
            attributes: {
                ariaLabel: target.getAttribute("aria-label") || undefined,
                ariaLabelledBy: target.getAttribute("aria-labelledby") || undefined,
                ariaExpanded: target.getAttribute("aria-expanded") || undefined,
                ariaChecked: target.getAttribute("aria-checked") || undefined,
                ariaSelected: target.getAttribute("aria-selected") || undefined,
                ariaDisabled: target.getAttribute("aria-disabled") || undefined,
                ariaCurrent: target.getAttribute("aria-current") || undefined,
            },
        },
        boundingBox: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
        },
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            devicePixelRatio: window.devicePixelRatio,
        },
        styles: {
            computed: extractComputedStyles(target),
        },
    };

    chrome.runtime.sendMessage({ type: "AUDIT/CAPTURE", record });
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
        // ✅ respond so SW doesn’t warn “message port closed”
        sendResponse({ ok: true });
        return; // important: end handler for this message
    }


    if (msg?.type === "AUDIT/PING") {
        console.log("[UI Inventory] CS ping received ✅");
        sendResponse?.({ ok: true });
        return;
    }
});