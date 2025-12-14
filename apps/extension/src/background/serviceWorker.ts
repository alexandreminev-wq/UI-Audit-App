chrome.runtime.onInstalled.addListener(() => {
    console.log("[UI Inventory] Service worker installed");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("[UI Inventory] SW got message:", msg, "from", sender);

    if (msg?.type === "AUDIT/TOGGLE") {
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
