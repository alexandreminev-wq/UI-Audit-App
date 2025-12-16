/**
 * Offscreen document for image processing using OffscreenCanvas
 * Handles screenshot cropping and encoding in MV3-compatible way
 */

console.log("[UI Inventory] Offscreen document loaded");

interface CropEncodeRequest {
    type: "OFFSCREEN/CROP_ENCODE";
    dataUrl: string;
    cropRectCssPx: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    devicePixelRatio: number;
    mimeType?: string; // default "image/webp"
    quality?: number; // 0-1, default 0.8
    maxDim?: number; // max width or height in px, default 1200
}

interface CropEncodeResponse {
    ok: boolean;
    error?: string;
    arrayBuffer?: ArrayBuffer;
    mimeType?: string;
    width?: number;
    height?: number;
}

/**
 * Load image from data URL to ImageBitmap
 */
async function loadImageBitmap(dataUrl: string): Promise<ImageBitmap> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return await createImageBitmap(blob);
}

/**
 * Crop and encode image using OffscreenCanvas
 */
async function cropAndEncode(request: CropEncodeRequest): Promise<CropEncodeResponse> {
    try {
        const {
            dataUrl,
            cropRectCssPx,
            devicePixelRatio,
            mimeType = "image/webp",
            quality = 0.8,
            maxDim = 1200,
        } = request;

        // Load source image
        const sourceBitmap = await loadImageBitmap(dataUrl);

        // Convert CSS pixels to device pixels
        const cropRectDevicePx = {
            left: Math.max(0, Math.round(cropRectCssPx.left * devicePixelRatio)),
            top: Math.max(0, Math.round(cropRectCssPx.top * devicePixelRatio)),
            width: Math.round(cropRectCssPx.width * devicePixelRatio),
            height: Math.round(cropRectCssPx.height * devicePixelRatio),
        };

        // Clamp to source image dimensions
        const clampedRect = {
            left: Math.min(cropRectDevicePx.left, sourceBitmap.width),
            top: Math.min(cropRectDevicePx.top, sourceBitmap.height),
            width: Math.min(cropRectDevicePx.width, sourceBitmap.width - cropRectDevicePx.left),
            height: Math.min(cropRectDevicePx.height, sourceBitmap.height - cropRectDevicePx.top),
        };

        // Ensure dimensions are positive
        if (clampedRect.width <= 0 || clampedRect.height <= 0) {
            return {
                ok: false,
                error: "Invalid crop dimensions after clamping",
            };
        }

        // Create cropped bitmap
        const croppedBitmap = await createImageBitmap(
            sourceBitmap,
            clampedRect.left,
            clampedRect.top,
            clampedRect.width,
            clampedRect.height
        );

        // Calculate scaled dimensions if needed
        let finalWidth = croppedBitmap.width;
        let finalHeight = croppedBitmap.height;

        if (finalWidth > maxDim || finalHeight > maxDim) {
            const scale = maxDim / Math.max(finalWidth, finalHeight);
            finalWidth = Math.round(finalWidth * scale);
            finalHeight = Math.round(finalHeight * scale);
        }

        // Create offscreen canvas for encoding
        const offscreenCanvas = new OffscreenCanvas(finalWidth, finalHeight);
        const ctx = offscreenCanvas.getContext("2d");

        if (!ctx) {
            return {
                ok: false,
                error: "Failed to get 2d context from OffscreenCanvas",
            };
        }

        // Draw cropped (and possibly scaled) image
        ctx.drawImage(croppedBitmap, 0, 0, finalWidth, finalHeight);

        // Encode to blob
        const blob = await offscreenCanvas.convertToBlob({
            type: mimeType,
            quality,
        });

        // Convert to ArrayBuffer, then to Array for message passing
        // Note: ArrayBuffers don't survive chrome.runtime.sendMessage, so we convert to Array
        const arrayBuffer = await blob.arrayBuffer();
        const byteArray = Array.from(new Uint8Array(arrayBuffer));

        // Clean up bitmaps
        sourceBitmap.close();
        croppedBitmap.close();

        return {
            ok: true,
            arrayBuffer: byteArray, // Send as Array, not ArrayBuffer
            mimeType,
            width: finalWidth,
            height: finalHeight,
        };
    } catch (err) {
        console.error("[Offscreen] Crop/encode error:", err);
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

/**
 * Message handler
 * Only responds to OFFSCREEN/CROP_ENCODE messages - silently ignores all others
 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // Only handle our specific message type - ignore everything else
    if (!msg || msg.type !== "OFFSCREEN/CROP_ENCODE") return false;

    (async () => {
        const result = await cropAndEncode(msg as CropEncodeRequest);
        sendResponse(result);
    })().catch((err) => {
        sendResponse({ ok: false, error: String(err) });
    });

    return true; // Async response
});
