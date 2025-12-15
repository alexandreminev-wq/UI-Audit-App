import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

function PopupApp() {
    const [enabled, setEnabled] = useState(false);
    const [lastSelected, setLastSelected] = useState<any>(null);

    useEffect(() => {
        chrome.runtime.sendMessage({ type: "AUDIT/GET_STATE" }, (resp) => {
            const err = chrome.runtime.lastError;
            if (err) {
                console.warn("[UI Inventory] GET_STATE error:", err.message);
                return;
            }

            if (resp?.type === "AUDIT/STATE") {
                setEnabled(Boolean(resp.enabled));
                setLastSelected(resp.lastSelected || null);
            }
        });
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

    const toggle = async () => {
        const next = !enabled;
        setEnabled(next);

        // send to service worker
        const res = await chrome.runtime.sendMessage({ type: "AUDIT/TOGGLE", enabled: next });
        console.log("toggle response:", res);

        // ✅ If we just turned audit ON, close the popup so the next click is captured on the page.
        if (next) {
            // tiny delay helps ensure the message is fully sent before the popup closes
            setTimeout(() => window.close(), 50);
        }
    };

    const capture = async () => {
        const res = await chrome.runtime.sendMessage({ type: "AUDIT/CAPTURE_REQUEST" });
        console.log("capture response:", res);
    };

    // Detect CaptureRecord vs legacy shape
    const isCapture = Boolean(lastSelected?.element && lastSelected?.boundingBox);

    // Normalize fields for backward compatibility (Milestone 1 vs Milestone 2 shapes)
    const tagName = lastSelected?.element?.tagName ?? lastSelected?.tagName;
    const elementId = isCapture ? lastSelected.element.id : lastSelected?.id;
    const classList = lastSelected?.element?.classList ?? lastSelected?.classList;
    const textPreview = lastSelected?.element?.textPreview ?? lastSelected?.textPreview;
    const width = lastSelected?.boundingBox?.width ?? lastSelected?.rect?.width;
    const height = lastSelected?.boundingBox?.height ?? lastSelected?.rect?.height;

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
                        {textPreview && (
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
                        {isCapture && (
                            <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                                Capture ID: {lastSelected.id}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );


}


ReactDOM.createRoot(document.getElementById("root")!).render(<PopupApp />);
