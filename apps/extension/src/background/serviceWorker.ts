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
} from "./capturesDb";
import type { SessionRecord, CaptureRecordV2, BlobRecord, StylePrimitives } from "../types/capture";
import { generateSessionId, generateBlobId } from "../types/capture";

const auditEnabledByTab = new Map<number, boolean>();
const lastSelectedByTab = new Map<number, any>();
const activeSessionIdByTab = new Map<number, string>();
const activeProjectByTabId = new Map<number, string>();
let lastActiveAuditTabId: number | null = null;
let activeAuditTabId: number | null = null; // 7.8.1: One-tab-at-a-time capture ownership
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

            // Capture screenshot
            const screenshot = await captureScreenshot(tabId, recordV1.boundingBox, devicePixelRatio);

            const recordV2: CaptureRecordV2 = {
                id: recordV1.id,
                sessionId,
                projectId, // Include projectId (may be undefined if no active project)
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
                if (activeAuditTabId === null && currentAuditEnabled) {
                    activeAuditTabId = tabId;
                    await setActiveAuditTabIdPersisted(tabId);
                    console.log("[UI Inventory] Set activeAuditTabId to first registered tab:", tabId);
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
                await upsertAnnotation({ projectId, componentKey, notes, tags });
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
            const { projectId, componentKey, displayName, categoryOverride, typeOverride, statusOverride } = msg;
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
