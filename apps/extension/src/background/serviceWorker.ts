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
} from "./capturesDb";
import type { SessionRecord, CaptureRecordV2, BlobRecord, StylePrimitives } from "../types/capture";
import { generateSessionId, generateBlobId } from "../types/capture";

const auditEnabledByTab = new Map<number, boolean>();
const lastSelectedByTab = new Map<number, any>();
const activeSessionIdByTab = new Map<number, string>();
const activeProjectByTabId = new Map<number, string>();
let lastActiveAuditTabId: number | null = null;
let currentProjectId: string | null = null;
let currentAuditEnabled: boolean = false;

// Track offscreen document state
let offscreenDocumentCreated = false;

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
            auditEnabledByTab.set(tabId, enabled);
            currentAuditEnabled = enabled;
            await setEnabledPersisted(tabId, enabled);

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

            // Link session to active project if one is set for this tab (non-fatal)
            const projectId = activeProjectByTabId.get(tabId);
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

            // Capture screenshot
            const screenshot = await captureScreenshot(tabId, recordV1.boundingBox, devicePixelRatio);

            const recordV2: CaptureRecordV2 = {
                id: recordV1.id,
                sessionId,
                captureSchemaVersion: 2,
                stylePrimitiveVersion: 1,

                url: recordV1.url,
                createdAt: recordV1.createdAt,

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
                    intent,
                },

                boundingBox: recordV1.boundingBox,

                styles: {
                    // Use primitives from content script if available, otherwise use placeholders
                    primitives: recordV1.styles?.primitives || makeDefaultPrimitives(),
                    computed: recordV1.styles?.computed,
                },

                screenshot: screenshot || null,
            };

            lastSelectedByTab.set(tabId, recordV2);
            console.log("[UI Inventory] Stored capture record for tab", tabId, "session", sessionId, recordV2);

            // Persist to IndexedDB with error handling
            try {
                await saveCapture(recordV2);
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
        if (typeof sender.tab?.id === "number") {
            const tabId = sender.tab.id;
            lastActiveAuditTabId = tabId;

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
        return;
    }

    if (msg?.type === "UI/SET_ACTIVE_PROJECT_FOR_TAB") {
        (async () => {
            const tabId = typeof sender.tab?.id === "number"
                ? sender.tab.id
                : (typeof msg.tabId === "number" ? msg.tabId : (lastActiveAuditTabId ?? null));

            if (tabId === null) {
                sendResponse({ ok: false, error: "No tab ID" });
                return;
            }

            const projectId = msg.projectId;

            if (projectId && typeof projectId === "string") {
                activeProjectByTabId.set(tabId, projectId);
                currentProjectId = projectId;
                console.log("[UI Inventory] Set active project for tab", tabId, ":", projectId);
            } else {
                activeProjectByTabId.delete(tabId);
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
                const projectId = activeProjectByTabId.get(tabId);

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

    // Bug 3 fix: No default sendResponse (prevents double-call race condition)
    // Each handler above explicitly calls sendResponse and returns true
    return false;
});
