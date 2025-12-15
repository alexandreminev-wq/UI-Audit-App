const auditEnabledByTab = new Map<number, boolean>();
const lastSelectedByTab = new Map<number, any>();


chrome.runtime.onInstalled.addListener(() => {
    console.log("[UI Inventory] Service worker installed");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("[UI Inventory] SW got message:", msg, "from", sender);

    if (msg?.type === "AUDIT/TOGGLE") {
        // Relay toggle message to content script in active tab
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            const tabId = tabs[0]?.id;
            if (!tabId) {
                console.warn("[UI Inventory] No active tab found for toggle");
                sendResponse({ ok: false, error: "No active tab found" });
                return;
            }
            // ✅ store state for this tab
            auditEnabledByTab.set(tabId, Boolean(msg.enabled));

            chrome.tabs.sendMessage(tabId, { type: "AUDIT/TOGGLE", enabled: msg.enabled }, () => {
                const err = chrome.runtime.lastError;
                if (err) {
                    console.warn("[UI Inventory] Toggle sendMessage error:", err.message);
                    sendResponse({ ok: false, error: err.message });
                } else {
                    sendResponse({ ok: true });
                }
            });
        });

        return true; // async response
    }

    if (msg?.type === "AUDIT/GET_STATE") {
        (async () => {
            // If the request comes from a content script, sender.tab.id exists.
            // If it comes from the popup, we must query the active tab.
            const tabId =
                sender.tab?.id ??
                (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id;

            if (!tabId) {
                sendResponse({ ok: false, error: "No active tab found" });
                return;
            }

            const enabled = auditEnabledByTab.get(tabId) === true;
            const lastSelected = lastSelectedByTab.get(tabId) || null;
            sendResponse({ ok: true, type: "AUDIT/STATE", enabled, lastSelected });
            console.log("[UI Inventory] GET_STATE resolved tabId:", tabId, "lastSelected:", lastSelectedByTab.get(tabId));

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
        const tabId = sender.tab?.id;
        if (tabId) {
            lastSelectedByTab.set(tabId, msg.record);
            console.log("[UI Inventory] Stored capture record for tab", tabId, msg.record);
            // Broadcast to any open UIs (popup, devtools, etc.)
            chrome.runtime.sendMessage(
                { type: "AUDIT/CAPTURED", record: msg.record, tabId },
                () => {
                    void chrome.runtime.lastError;
                }
            );
        }
        sendResponse({ ok: true });
        return true;
    }

    if (msg?.type === "AUDIT/CAPTURED") {
        sendResponse({ ok: true });
        return true;
    }

    if (msg?.type === "AUDIT/CAPTURE_REQUEST") {
        // Popup messages don't reliably include sender.tab,
        // so we find the active tab explicitly.
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0]?.id;
            if (!tabId) {
                console.warn("[UI Inventory] No active tab found to ping");
                sendResponse({ ok: false, error: "No active tab found" });
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
        });

        // Tell Chrome we will respond asynchronously
        return true;
    }


    sendResponse({ ok: false, error: "Unknown message type" });
    return true;
});
