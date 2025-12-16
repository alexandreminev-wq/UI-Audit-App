import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

function sendMessageAsync<T, R>(msg: T): Promise<R> {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(msg, (resp) => {
            const err = chrome.runtime.lastError;
            if (err) reject(err);
            else resolve(resp as R);
        });
    });
}

async function getActiveTabId(): Promise<number | null> {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.id ?? null;
}

function PopupApp() {
    const [enabled, setEnabled] = useState(false);
    const [lastSelected, setLastSelected] = useState<any>(null);
    const [recent, setRecent] = useState<any[]>([]);
    const [filter, setFilter] = useState<"site" | "all">("site");
    const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            console.log("[POPUP] useEffect mount - getting tabId");
            const tabId = await getActiveTabId();
            console.log("[POPUP] Got tabId:", tabId);
            if (tabId === null) {
                console.warn("[UI Inventory] GET_STATE: No active tab found");
                return;
            }

            sendMessageAsync<{ type: string; tabId: number }, any>({ type: "AUDIT/GET_STATE", tabId })
                .then((resp) => {
                    console.log("[POPUP] GET_STATE response:", JSON.stringify(resp));
                    if (resp?.type === "AUDIT/STATE") {
                        console.log("[POPUP] Setting enabled to:", resp.enabled);
                        setEnabled(Boolean(resp.enabled));
                        setLastSelected(resp.lastSelected || null);
                    } else {
                        console.error("[POPUP] GET_STATE unexpected response type:", JSON.stringify(resp));
                    }
                })
                .catch((err) => {
                    console.warn("[UI Inventory] GET_STATE error:", err.message);
                });
        })();
    }, []);

    // Listen for live capture events
    useEffect(() => {
        const listener = (msg: any) => {
            if (msg?.type === "AUDIT/CAPTURED") {
                setLastSelected(msg.record);
            }
        };

        chrome.runtime.onMessage.addListener(listener);
        return () => chrome.runtime.onMessage.removeListener(listener);
    }, []);

    // Load screenshot when lastSelected changes
    useEffect(() => {
        // Clean up previous screenshot URL
        if (screenshotUrl) {
            URL.revokeObjectURL(screenshotUrl);
            setScreenshotUrl(null);
        }

        // Load new screenshot if available
        if (lastSelected?.screenshot?.screenshotBlobId) {
            const blobId = lastSelected.screenshot.screenshotBlobId;

            sendMessageAsync<{ type: string; blobId: string }, any>({
                type: "AUDIT/GET_BLOB",
                blobId,
            })
                .then((resp) => {
                    if (resp?.ok && resp.arrayBuffer) {
                        // Convert Array back to Uint8Array, then to Blob
                        // (ArrayBuffers don't survive chrome.runtime.sendMessage)
                        const uint8Array = new Uint8Array(resp.arrayBuffer);
                        const blob = new Blob([uint8Array], { type: resp.mimeType || "image/webp" });
                        const url = URL.createObjectURL(blob);
                        setScreenshotUrl(url);
                    } else {
                        console.warn("[POPUP] Failed to load blob:", resp?.error || "Unknown error");
                    }
                })
                .catch((err) => {
                    console.warn("[POPUP] Error loading blob:", err.message);
                });
        }

        // Cleanup on unmount
        return () => {
            if (screenshotUrl) {
                URL.revokeObjectURL(screenshotUrl);
            }
        };
    }, [lastSelected]);

    const toggle = async () => {
        console.log("[POPUP] Toggle clicked, current enabled:", enabled);
        const tabId = await getActiveTabId();
        console.log("[POPUP] Toggle got tabId:", tabId);
        if (tabId === null) {
            console.warn("[UI Inventory] TOGGLE: No active tab found");
            return;
        }

        const next = !enabled;
        console.log("[POPUP] Toggle next state:", next);

        // send to service worker
        const res = await sendMessageAsync<{ type: string; enabled: boolean; tabId: number }, any>({
            type: "AUDIT/TOGGLE",
            enabled: next,
            tabId,
        });
        console.log("[POPUP] Toggle response:", JSON.stringify(res));

        // Only update state if toggle succeeded
        if (res?.ok) {
            console.log("[POPUP] Toggle succeeded, setting enabled to:", next);
            setEnabled(next);

            // ✅ If we just turned audit ON, close the popup so the next click is captured on the page.
            if (next) {
                console.log("[POPUP] Closing popup in 50ms");
                // tiny delay helps ensure the message is fully sent before the popup closes
                setTimeout(() => window.close(), 50);
            }
        } else {
            console.error("[POPUP] Toggle failed:", JSON.stringify(res));
        }
    };

    const capture = async () => {
        const tabId = await getActiveTabId();
        if (tabId === null) {
            console.warn("[UI Inventory] CAPTURE_REQUEST: No active tab found");
            return;
        }

        const res = await sendMessageAsync<{ type: string; tabId: number }, any>({
            type: "AUDIT/CAPTURE_REQUEST",
            tabId,
        });
        console.log("capture response:", res);
    };

    const loadRecent = async () => {
        const tabId = await getActiveTabId();
        if (tabId === null) {
            console.warn("[UI Inventory] LIST_CAPTURES: No active tab found");
            return;
        }

        // Send scope to service worker (let it determine hostname)
        const res = await sendMessageAsync<{ type: string; limit: number; scope: string; tabId: number }, any>({
            type: "AUDIT/LIST_CAPTURES",
            limit: 10,
            scope: filter, // "site" or "all"
            tabId,
        });

        if (res?.ok && res.records) {
            setRecent(res.records);
        }
    };

    const clearCaptures = async () => {
        const res = await sendMessageAsync<{ type: string }, any>({ type: "AUDIT/CLEAR_CAPTURES" });
        if (res?.ok) {
            setRecent([]);
        }
    };

    // Detect CaptureRecord vs legacy shape
    const isCapture = Boolean(lastSelected?.element && lastSelected?.boundingBox);

    // Normalize fields for backward compatibility (v1 vs v2.2)
    const tagName = lastSelected?.element?.tagName ?? lastSelected?.tagName;
    const elementId = isCapture ? lastSelected.element.id : lastSelected?.id;
    const classList = lastSelected?.element?.classList ?? lastSelected?.classList;
    const textPreview = lastSelected?.element?.textPreview ?? lastSelected?.textPreview;
    const width = lastSelected?.boundingBox?.width ?? lastSelected?.rect?.width;
    const height = lastSelected?.boundingBox?.height ?? lastSelected?.rect?.height;

    // v2.2 fields
    const role = lastSelected?.element?.role;
    const accessibleName = lastSelected?.element?.intent?.accessibleName;
    const sessionId = lastSelected?.sessionId;
    const schemaVersion = lastSelected?.captureSchemaVersion;
    const hasScreenshot = Boolean(lastSelected?.screenshot?.screenshotBlobId);

    // Parse timestamp and hostname for CaptureRecord
    let captureTime = "";
    let siteHostname = "(unknown)";
    if (isCapture) {
        if (lastSelected.createdAt) {
            const date = new Date(lastSelected.createdAt);
            captureTime = date.toLocaleTimeString();
        }
        if (lastSelected.url) {
            try {
                siteHostname = new URL(lastSelected.url).hostname;
            } catch {
                siteHostname = "(unknown)";
            }
        }
    }

    return (
        <div style={{ width: 280, padding: 12, fontFamily: "system-ui" }}>
            <h3 style={{ margin: "0 0 8px" }}>UI Inventory</h3>

            <button onClick={toggle} style={{ width: "100%", marginBottom: 8 }}>
                {enabled ? "Stop Audit Mode" : "Start Audit Mode"}
            </button>

            <button onClick={capture} style={{ width: "100%" }} disabled={!enabled}>
                Capture (Milestone 0 Ping)
            </button>

            <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                <button
                    onClick={() => setFilter("site")}
                    style={{
                        flex: 1,
                        fontSize: 11,
                        padding: "4px 8px",
                        background: filter === "site" ? "#ddd" : "white",
                    }}
                >
                    This site
                </button>
                <button
                    onClick={() => setFilter("all")}
                    style={{
                        flex: 1,
                        fontSize: 11,
                        padding: "4px 8px",
                        background: filter === "all" ? "#ddd" : "white",
                    }}
                >
                    All
                </button>
            </div>

            <button onClick={loadRecent} style={{ width: "100%", marginTop: 4 }}>
                Load recent (IndexedDB)
            </button>

            <button onClick={clearCaptures} style={{ width: "100%", marginTop: 8 }}>
                Clear captures
            </button>

            <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                Open DevTools to see logs.
            </p>

            {lastSelected && (
                <div style={{ marginTop: 12, padding: 8, background: "#f5f5f5", borderRadius: 4, fontSize: 12 }}>
                    <strong>Last Selected:</strong>
                    <div style={{ marginTop: 4 }}>
                        <code style={{ display: "block", marginBottom: 4 }}>
                            &lt;{tagName}
                            {elementId && ` id="${elementId}"`}
                            {classList?.length > 0 && ` class="${classList.join(" ")}"`}
                            &gt;
                        </code>

                        {/* v2.2: role + accessibleName */}
                        {role && (
                            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                                <strong>Role:</strong> {role}
                            </div>
                        )}
                        {accessibleName && (
                            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                                <strong>Label:</strong> "{accessibleName.slice(0, 50)}{accessibleName.length > 50 ? '...' : ''}"
                            </div>
                        )}

                        {textPreview && !accessibleName && (
                            <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                                "{textPreview}"
                            </div>
                        )}

                        {typeof width === "number" && typeof height === "number" && (
                            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                                {Math.round(width)} × {Math.round(height)} px
                            </div>
                        )}

                        {isCapture && captureTime && (
                            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                                Captured: {captureTime}
                            </div>
                        )}

                        {isCapture && (
                            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                                Site: {siteHostname}
                            </div>
                        )}

                        {/* v2.2: session + schema version */}
                        {sessionId && (
                            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                                Session: {sessionId.slice(0, 20)}...
                            </div>
                        )}

                        {schemaVersion && (
                            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                                Schema: v{schemaVersion}
                            </div>
                        )}

                        {/* v2.2: screenshot indicator */}
                        <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                            Screenshot: {hasScreenshot ? "✓ Yes" : "✗ No"}
                        </div>

                        {/* Display screenshot if available */}
                        {screenshotUrl && (
                            <div style={{ marginTop: 8 }}>
                                <img
                                    src={screenshotUrl}
                                    alt="Element screenshot"
                                    style={{ width: "100%", border: "1px solid #ddd", borderRadius: 4 }}
                                />
                            </div>
                        )}

                        {isCapture && (
                            <div style={{ fontSize: 10, color: "#aaa", marginTop: 8 }}>
                                ID: {lastSelected.id}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {recent.length > 0 && (
                <div style={{ marginTop: 12, padding: 8, background: "#f5f5f5", borderRadius: 4, fontSize: 12 }}>
                    <strong>
                        Recent Captures ({recent.length}) — {filter === "site" ? "this site" : "all"}
                    </strong>
                    <div style={{ marginTop: 4 }}>
                        {recent.map((record) => {
                            let hostname = "(unknown)";
                            try {
                                hostname = new URL(record.url).hostname;
                            } catch {}

                            const time = record.createdAt
                                ? new Date(record.createdAt).toLocaleTimeString()
                                : "";

                            // v2.2 fields (tolerate missing for old captures)
                            const recTagName = record.element?.tagName || "?";
                            const recRole = record.element?.role;
                            const recAccessibleName = record.element?.intent?.accessibleName;
                            const recSessionId = record.sessionId;
                            const recHasScreenshot = Boolean(record.screenshot?.screenshotBlobId);

                            // Build element summary
                            let elementSummary = `<${recTagName}>`;
                            if (recRole) {
                                elementSummary += ` [${recRole}]`;
                            }

                            return (
                                <div
                                    key={record.id}
                                    onClick={() => setLastSelected(record)}
                                    style={{
                                        padding: "4px 0",
                                        borderBottom: "1px solid #ddd",
                                        fontSize: 11,
                                        cursor: "pointer",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = "#e8e8e8";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = "transparent";
                                    }}
                                >
                                    <div>
                                        <code>{elementSummary}</code> @ {hostname}
                                    </div>
                                    {recAccessibleName && (
                                        <div style={{ color: "#666", fontSize: 10, marginTop: 2 }}>
                                            "{recAccessibleName.slice(0, 40)}{recAccessibleName.length > 40 ? '...' : ''}"
                                        </div>
                                    )}
                                    <div style={{ color: "#999", fontSize: 10, marginTop: 2 }}>
                                        {time}
                                        {recSessionId && ` • ${recSessionId.slice(0, 12)}...`}
                                        {recHasScreenshot && " • 📷"}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );


}


ReactDOM.createRoot(document.getElementById("root")!).render(<PopupApp />);
