import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────
// DEV-only helpers
// ─────────────────────────────────────────────────────────────

const isDev = import.meta?.env?.DEV ?? false;
const devWarn = (...args: unknown[]) => { if (isDev) console.warn(...args); };

// ─────────────────────────────────────────────────────────────
// Global blob URL cache
// ─────────────────────────────────────────────────────────────

const blobUrlCache = new Map<string, string>();
const failedBlobs = new Set<string>();

export function disposeAllBlobUrls() {
    blobUrlCache.forEach((url) => URL.revokeObjectURL(url));
    blobUrlCache.clear();
    failedBlobs.clear();
}

// ─────────────────────────────────────────────────────────────
// Hook: useBlobUrl
// ─────────────────────────────────────────────────────────────

interface UseBlobUrlResult {
    url: string | null;
    status: "idle" | "loading" | "success" | "error";
}

export function useBlobUrl(blobId: string | null | undefined): UseBlobUrlResult {
    const [result, setResult] = useState<UseBlobUrlResult>({ url: null, status: "idle" });

    useEffect(() => {
        // No blobId => idle
        if (!blobId) {
            setResult({ url: null, status: "idle" });
            return;
        }

        // Already in cache => use cached URL
        if (blobUrlCache.has(blobId)) {
            setResult({ url: blobUrlCache.get(blobId)!, status: "success" });
            return;
        }

        // Already failed => don't retry
        if (failedBlobs.has(blobId)) {
            setResult({ url: null, status: "error" });
            return;
        }

        // Fetch blob from Service Worker
        setResult({ url: null, status: "loading" });

        chrome.runtime.sendMessage(
            { type: "AUDIT/GET_BLOB", blobId },
            (response: { ok: boolean; arrayBuffer?: number[]; mimeType?: string; error?: string }) => {
                if (!response || !response.ok || !response.arrayBuffer) {
                    failedBlobs.add(blobId);
                    devWarn("[UI Inventory Viewer] Failed to fetch blob:", blobId, response?.error);
                    setResult({ url: null, status: "error" });
                    return;
                }

                // Reconstruct blob
                const bytes = new Uint8Array(response.arrayBuffer);
                const blob = new Blob([bytes], { type: response.mimeType || "image/png" });
                const url = URL.createObjectURL(blob);

                // Cache the URL
                blobUrlCache.set(blobId, url);

                setResult({ url, status: "success" });
            }
        );
    }, [blobId]);

    return result;
}
