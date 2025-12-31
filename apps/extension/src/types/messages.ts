/**
 * Message types for communication between extension contexts
 * (Popup ↔ Service Worker ↔ Content Script)
 */

// ─────────────────────────────────────────────────────────────
// Popup → Service Worker
// ─────────────────────────────────────────────────────────────

export interface AuditToggleMessage {
    type: "AUDIT/TOGGLE";
    enabled: boolean;
}

export interface CaptureRequestMessage {
    type: "AUDIT/CAPTURE_REQUEST";
}

// ─────────────────────────────────────────────────────────────
// Service Worker → Content Script
// ─────────────────────────────────────────────────────────────

export interface EnableHoverModeMessage {
    type: "AUDIT/ENABLE_HOVER_MODE";
    enabled: boolean;
}

export interface PingMessage {
    type: "AUDIT/PING";
}

// ─────────────────────────────────────────────────────────────
// Phase 3: Resolver fallback (Service Worker → Content Script)
// ─────────────────────────────────────────────────────────────

export interface MarkTargetMessage {
    type: "AUDIT/MARK_TARGET";
    markerId: string;
}

export interface UnmarkTargetMessage {
    type: "AUDIT/UNMARK_TARGET";
    markerId: string;
}

// ─────────────────────────────────────────────────────────────
// Content Script → Service Worker
// ─────────────────────────────────────────────────────────────

export interface ElementSelectedMessage {
    type: "AUDIT/ELEMENT_SELECTED";
    selector: string;
    tagName: string;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    url: string;
}

// ─────────────────────────────────────────────────────────────
// Union types for listeners
// ─────────────────────────────────────────────────────────────

export type PopupMessage = AuditToggleMessage | CaptureRequestMessage;

export type ServiceWorkerMessage = EnableHoverModeMessage | PingMessage | MarkTargetMessage | UnmarkTargetMessage;

export type ContentScriptMessage = ElementSelectedMessage;

// ─────────────────────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────────────────────

export interface SuccessResponse {
    ok: true;
}

export interface ErrorResponse {
    ok: false;
    error: string;
}

export type MessageResponse = SuccessResponse | ErrorResponse;
