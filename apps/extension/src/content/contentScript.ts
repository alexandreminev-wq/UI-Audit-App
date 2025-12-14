console.log("[UI Inventory] Content script loaded on:", location.href);

chrome.runtime.onMessage.addListener((msg) => {
    console.log("[UI Inventory] CS got message:", msg);

    if (msg?.type === "AUDIT/PING") {
        console.log("[UI Inventory] CS ping received ✅");
    }
});
