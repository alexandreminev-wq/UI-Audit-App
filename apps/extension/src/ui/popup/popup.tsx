import { useState } from "react";
import ReactDOM from "react-dom/client";

function PopupApp() {
    const [enabled, setEnabled] = useState(false);

    const toggle = async () => {
        const next = !enabled;
        setEnabled(next);

        // send to service worker
        const res = await chrome.runtime.sendMessage({ type: "AUDIT/TOGGLE", enabled: next });
        console.log("toggle response:", res);
    };

    const capture = async () => {
        const res = await chrome.runtime.sendMessage({ type: "AUDIT/CAPTURE_REQUEST" });
        console.log("capture response:", res);
    };

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
        </div>
    );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<PopupApp />);
