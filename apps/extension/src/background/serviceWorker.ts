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
        // For Milestone 0: just ping the content script
        if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, { type: "AUDIT/PING" });
        }
        sendResponse({ ok: true });
        return true;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
    return true;
});
