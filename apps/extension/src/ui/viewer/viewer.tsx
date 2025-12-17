import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import ReactDOM from "react-dom/client";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type GroupingMode = "nameOnly" | "namePlusType" | "nameTypePrimitives";

interface SessionRecord {
    id: string;
    createdAt: number;
    startUrl?: string;
    pagesVisited?: string[];
}

interface CaptureListItem {
    id: string;
    sessionId: string;
    createdAt: number | null;
    url: string;
    tagName: string | null;
    role: string | null;
    accessibleName: string | null;
    selector?: string | null;
    screenshot: {
        screenshotBlobId: string;
        mimeType: string;
        width: number;
        height: number;
    } | null;
    primitivesSummary?: {
        paddingTop?: string;
        paddingRight?: string;
        paddingBottom?: string;
        paddingLeft?: string;
        backgroundColorRgba?: { r: number; g: number; b: number; a: number } | null;
        borderColorRgba?: { r: number; g: number; b: number; a: number } | null;
        colorRgba?: { r: number; g: number; b: number; a: number } | null;
        shadowPresence?: string;
        shadowLayerCount?: number;
    };
}

// ─────────────────────────────────────────────────────────────
// Message helper
// ─────────────────────────────────────────────────────────────

function sendMessageAsync<T, R>(msg: T): Promise<R> {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(msg, (resp) => {
            const err = chrome.runtime.lastError;
            if (err) reject(err);
            else resolve(resp as R);
        });
    });
}

// ─────────────────────────────────────────────────────────────
// Grouping Helpers
// ─────────────────────────────────────────────────────────────

// Normalize accessible name for grouping (top-level to avoid closure deps)
function normalizeAccessibleName(name: string | null): string {
    if (!name) return "";
    // Lowercase, trim, collapse multiple spaces, remove surrounding punctuation
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
        .replace(/^[^\p{L}\p{N}\s]+|[^\p{L}\p{N}\s]+$/gu, "");
}

// Parse "10px" -> 10, round to nearest 4
function bucketPadding(value: string | undefined): string {
    if (!value) return "0";
    if (value === "0") return "0"; // Accept "0" without "px"
    const match = value.match(/^([\d.]+)px$/);
    if (!match) return "0";
    const px = parseFloat(match[1]);
    return String(Math.round(px / 4) * 4);
}

// Round RGB to 16-step buckets (0,16,32...240), alpha to 0.1
// Supports rgba object {r,g,b,a}, "rgba(r,g,b,a)", and "r,g,b,a" formats
function bucketRgba(value: { r: number; g: number; b: number; a: number } | string | null | undefined): string {
    if (!value) return "none";

    // Handle object format (primary)
    if (typeof value === "object" && "r" in value) {
        const rb = Math.min(240, Math.round(value.r / 16) * 16);
        const gb = Math.min(240, Math.round(value.g / 16) * 16);
        const bb = Math.min(240, Math.round(value.b / 16) * 16);
        const ab = Math.round(value.a * 10) / 10;
        return `${rb},${gb},${bb},${ab}`;
    }

    // Handle string formats (legacy)
    if (typeof value === "string") {
        // Try "rgba(r,g,b,a)" or "rgb(r,g,b)" format first
        let match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
        if (match) {
            const [, r, g, b, a] = match;
            const rb = Math.min(240, Math.round(parseInt(r) / 16) * 16);
            const gb = Math.min(240, Math.round(parseInt(g) / 16) * 16);
            const bb = Math.min(240, Math.round(parseInt(b) / 16) * 16);
            const ab = a ? Math.round(parseFloat(a) * 10) / 10 : 1;
            return `${rb},${gb},${bb},${ab}`;
        }

        // Try "r,g,b,a" format
        match = value.match(/^(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?$/);
        if (match) {
            const [, r, g, b, a] = match;
            const rb = Math.min(240, Math.round(parseInt(r) / 16) * 16);
            const gb = Math.min(240, Math.round(parseInt(g) / 16) * 16);
            const bb = Math.min(240, Math.round(parseInt(b) / 16) * 16);
            const ab = a ? Math.round(parseFloat(a) * 10) / 10 : 1;
            return `${rb},${gb},${bb},${ab}`;
        }
    }

    return "none";
}

// Shadow: presence + layerCount
function bucketShadow(presence: string | undefined, layerCount: number | undefined): string {
    if (!presence || presence === "none") return "noshadow";
    return `${presence}-${layerCount ?? 0}`;
}

// ─────────────────────────────────────────────────────────────
// Group Explanation
// ─────────────────────────────────────────────────────────────

type GroupExplanation = {
    tag?: string;
    role?: string | null;
    name?: string;
    primitives?: {
        padding?: string;   // e.g. "pt8 pr12 pb8 pl12"
        colors?: string;    // e.g. "bg240,240,240,1 bdnone c0,0,0,1"
        shadow?: string;    // e.g. "shsome-2"
    } | null;
};

// Parse group key into human-readable explanation
function explainGroupKey(groupKey: string): GroupExplanation {
    const parts = groupKey.split("::");

    // parts[0] = tag
    // parts[1] = role (if 3+ parts) or name (if 2 parts)
    // parts[2] = name (if 3+ parts)
    // parts[3+] = primitive tokens (if present)

    if (parts.length === 2) {
        // nameOnly: "tag::name"
        return {
            tag: parts[0],
            name: parts[1] || "(no name)",
            primitives: null,
        };
    } else if (parts.length === 3) {
        // namePlusType: "tag::role::name"
        return {
            tag: parts[0],
            role: parts[1] === "norole" ? null : parts[1],
            name: parts[2] || "(no name)",
            primitives: null,
        };
    } else if (parts.length > 3) {
        // nameTypePrimitives: "tag::role::name::primitives..."
        const primitiveTokens = parts.slice(3);

        // Parse primitive tokens
        const paddingTokens: string[] = [];
        const colorTokens: string[] = [];
        const shadowTokens: string[] = [];

        primitiveTokens.forEach((token) => {
            if (token.startsWith("p")) {
                // padding: "p8-12-8-12" -> extract pt/pr/pb/pl
                const match = token.match(/^p([\d]+)-([\d]+)-([\d]+)-([\d]+)$/);
                if (match) {
                    paddingTokens.push(`pt${match[1]} pr${match[2]} pb${match[3]} pl${match[4]}`);
                }
            } else if (token.startsWith("bg")) {
                colorTokens.push(token);
            } else if (token.startsWith("bd")) {
                colorTokens.push(token);
            } else if (token === "cnone" || /^c\d/.test(token)) {
                colorTokens.push(token);
            } else if (token.startsWith("sh")) {
                shadowTokens.push(token);
            }
        });

        return {
            tag: parts[0],
            role: parts[1] === "norole" ? null : parts[1],
            name: parts[2] || "(no name)",
            primitives: {
                padding: paddingTokens.length > 0 ? paddingTokens.join(" ") : undefined,
                colors: colorTokens.length > 0 ? colorTokens.join(" ") : undefined,
                shadow: shadowTokens.length > 0 ? shadowTokens.join(" ") : undefined,
            },
        };
    } else {
        // Fallback: just tag
        return {
            tag: parts[0] || "unknown",
            primitives: null,
        };
    }
}

// ─────────────────────────────────────────────────────────────
// Capture Display Helpers
// ─────────────────────────────────────────────────────────────

// Get display name for a capture (used in both ungrouped and group detail views)
function getCaptureDisplayName(capture: CaptureListItem): string {
    return capture.accessibleName || capture.selector || "(no name)";
}

// Get hostname from capture URL (used in both ungrouped and group detail views)
function getCaptureHostname(capture: CaptureListItem): string {
    try {
        return new URL(capture.url).hostname;
    } catch {
        return "(unknown)";
    }
}

// Get formatted time for a capture (used in both ungrouped and group detail views)
function getCaptureTime(capture: CaptureListItem): string {
    return capture.createdAt ? new Date(capture.createdAt).toLocaleString() : "";
}

// Fetch full capture record by ID (used for compare A/B)
async function fetchCaptureRecord(captureId: string | null): Promise<any | null> {
    if (!captureId) return null;

    try {
        const resp = await sendMessageAsync<{ type: string; captureId: string }, any>({
            type: "VIEWER/GET_CAPTURE",
            captureId: captureId,
        });

        if (resp?.ok && resp.capture) {
            return resp.capture;
        } else {
            console.error("[VIEWER] Failed to fetch capture:", captureId, resp);
            return null;
        }
    } catch (err) {
        console.error("[VIEWER] Error fetching capture:", captureId, err);
        return null;
    }
}

// Compute variant key from primitives (for within-group variant detection)
function computeVariantKey(capture: CaptureListItem): string {
    const prims = capture.primitivesSummary;
    if (!prims) return "v::unknown";

    const pt = bucketPadding(prims.paddingTop);
    const pr = bucketPadding(prims.paddingRight);
    const pb = bucketPadding(prims.paddingBottom);
    const pl = bucketPadding(prims.paddingLeft);
    const bg = bucketRgba(prims.backgroundColorRgba);
    const bd = bucketRgba(prims.borderColorRgba);
    const c = bucketRgba(prims.colorRgba);
    const sh = bucketShadow(prims.shadowPresence, prims.shadowLayerCount);

    return `v::p${pt}-${pr}-${pb}-${pl}::bg${bg}::bd${bd}::c${c}::sh${sh}`;
}

// Shared export runner for both JSON and CSV exports
async function runExport(opts: {
    capturesToExport: CaptureListItem[];
    fetchFullCaptures: (captures: CaptureListItem[]) => Promise<any[]>;
    onProgress: (current: number, total: number) => void;
    buildOutput: (fullRecords: any[]) => { blob: Blob; filename: string };
    batchSize?: number;
}): Promise<{ blob: Blob; filename: string }> {
    const { capturesToExport, fetchFullCaptures, onProgress, buildOutput, batchSize = 50 } = opts;

    const total = capturesToExport.length;
    onProgress(0, total);

    const fullRecords = [];
    for (let i = 0; i < total; i += batchSize) {
        const batch = capturesToExport.slice(i, i + batchSize);
        const batchRecords = await fetchFullCaptures(batch);
        fullRecords.push(...batchRecords);

        onProgress(Math.min(i + batchSize, total), total);
        await new Promise((r) => setTimeout(r, 0));
    }

    return buildOutput(fullRecords);
}

// ─────────────────────────────────────────────────────────────
// Main Viewer Component
// ─────────────────────────────────────────────────────────────

function ViewerApp() {
    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [captures, setCaptures] = useState<CaptureListItem[]>([]);
    const blobUrlCacheRef = useRef<Map<string, string>>(new Map());
    const capturesRequestIdRef = useRef(0); // guards against stale capture list responses
    const compareARequestIdRef = useRef(0); // guards against stale compare A fetch responses
    const compareBRequestIdRef = useRef(0); // guards against stale compare B fetch responses
    const [missingBlobIds, setMissingBlobIds] = useState<Set<string>>(new Set());
    const loggedMissingBlobIdsRef = useRef<Set<string>>(new Set());

    // Viewer-side filters
    const [searchQuery, setSearchQuery] = useState("");
    const [hasScreenshotOnly, setHasScreenshotOnly] = useState(false);
    const [selectedTagName, setSelectedTagName] = useState<string>("all");

    // View mode: "ungrouped" | "grouped"
    const [viewMode, setViewMode] = useState<"ungrouped" | "grouped">("ungrouped");
    const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
    const [selectedVariantKey, setSelectedVariantKey] = useState<string | null>(null);
    const [groupingMode, setGroupingMode] = useState<GroupingMode>("nameOnly");

    // Compare mode
    const [compareAId, setCompareAId] = useState<string | null>(null);
    const [compareBId, setCompareBId] = useState<string | null>(null);
    const [compareARecord, setCompareARecord] = useState<any | null>(null);
    const [compareBRecord, setCompareBRecord] = useState<any | null>(null);

    // Export state
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "success" | "error">("idle");
    const [exportMessage, setExportMessage] = useState<string | null>(null);
    const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
    const [includeViewerDerived, setIncludeViewerDerived] = useState(false);
    const exportResetTimerRef = useRef<number | null>(null);

    // Loading and error states
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);
    const [sessionsError, setSessionsError] = useState<string | null>(null);
    const [isLoadingCaptures, setIsLoadingCaptures] = useState(false);
    const [capturesError, setCapturesError] = useState<string | null>(null);

    // Handle session selection with immediate UI update (prevents old-captures flash)
    const handleSelectSession = useCallback(
        (sessionId: string) => {
            // Don't clear captures if clicking the already-selected session
            if (sessionId === selectedSessionId) return;

            setSelectedSessionId(sessionId);
            setCaptures([]);
            setCapturesError(null);
            setIsLoadingCaptures(true);
        },
        [selectedSessionId]
    );


    // Load sessions on mount
    const loadSessions = useCallback(async () => {
        setIsLoadingSessions(true);
        setSessionsError(null);
        try {
            const resp = await sendMessageAsync<{ type: string; limit: number }, any>({
                type: "VIEWER/LIST_SESSIONS",
                limit: 50,
            });

            if (resp?.ok && resp.sessions) {
                setSessions(resp.sessions);
            } else {
                setSessionsError("Failed to load sessions. Please try again.");
            }
        } catch (err) {
            console.error("[VIEWER] Failed to load sessions:", err);
            setSessionsError("Failed to load sessions. Please try again.");
        } finally {
            setIsLoadingSessions(false);
        }
    }, []);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    // Cleanup export timer on unmount
    useEffect(() => {
        return () => {
            if (exportResetTimerRef.current !== null) {
                clearTimeout(exportResetTimerRef.current);
            }
        };
    }, []);

    // Load captures when session changes
    const loadCaptures = useCallback(async (sessionId: string) => {
        const reqId = ++capturesRequestIdRef.current;

        setIsLoadingCaptures(true);
        setCapturesError(null);
        try {
            const resp = await sendMessageAsync<{ type: string; sessionId: string; limit: number }, any>({
                type: "VIEWER/LIST_CAPTURES",
                sessionId: sessionId,
                limit: 300,
            });

            // Ignore stale response (user switched sessions while this request was in-flight)
            if (reqId !== capturesRequestIdRef.current) return;

            if (resp?.ok && resp.captures) {
                setCaptures(resp.captures);
            } else {
                setCapturesError("Failed to load captures. Please try again.");
            }
        } catch (err) {
            // Ignore stale response
            if (reqId !== capturesRequestIdRef.current) return;

            console.error("[VIEWER] Failed to load captures:", err);
            setCapturesError("Failed to load captures. Please try again.");
        } finally {
            // Ignore stale response
            if (reqId !== capturesRequestIdRef.current) return;

            setIsLoadingCaptures(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedSessionId) {
            setCaptures([]);
            setCapturesError(null);
            return;
        }

        // Reset filters, group selection, and compare state when session changes
        setSearchQuery("");
        setHasScreenshotOnly(false);
        setSelectedTagName("all");
        setSelectedGroupKey(null);
        setCompareAId(null);
        setCompareBId(null);

        loadCaptures(selectedSessionId);
    }, [selectedSessionId, loadCaptures]);

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
            blobUrlCacheRef.current.clear();
        };
    }, []);

    // Reset group selection when filters change (only in grouped mode)
    useEffect(() => {
        if (viewMode === "grouped") {
            setSelectedGroupKey(null);
            setSelectedVariantKey(null);
        }
    }, [searchQuery, hasScreenshotOnly, selectedTagName, viewMode]);

    // Reset variant selection when group or grouping mode changes
    useEffect(() => {
        setSelectedVariantKey(null);
    }, [selectedGroupKey, groupingMode]);

    // Fetch full record when compareAId changes
    useEffect(() => {
        if (!compareAId) {
            compareARequestIdRef.current++;
            setCompareARecord(null);
            return;
        }

        const reqId = ++compareARequestIdRef.current;

        (async () => {
            const record = await fetchCaptureRecord(compareAId);
            // Only update if this is still the most recent request
            if (reqId === compareARequestIdRef.current) {
                setCompareARecord(record);
            }
        })();
    }, [compareAId]);

    // Fetch full record when compareBId changes
    useEffect(() => {
        if (!compareBId) {
            compareBRequestIdRef.current++;
            setCompareBRecord(null);
            return;
        }

        const reqId = ++compareBRequestIdRef.current;

        (async () => {
            const record = await fetchCaptureRecord(compareBId);
            // Only update if this is still the most recent request
            if (reqId === compareBRequestIdRef.current) {
                setCompareBRecord(record);
            }
        })();
    }, [compareBId]);

    // Compute filtered captures
    const filteredCaptures = useMemo(() => {
        return captures.filter((capture) => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const haystack = [
                    capture.accessibleName || "",
                    capture.selector || "",
                    capture.url || "",
                    capture.tagName || "",
                    capture.role || "",
                ].join(" ").toLowerCase();

                if (!haystack.includes(query)) return false;
            }

            // Screenshot filter
            if (hasScreenshotOnly && !capture.screenshot?.screenshotBlobId) {
                return false;
            }

            // Tag name filter
            if (selectedTagName !== "all" && capture.tagName !== selectedTagName) {
                return false;
            }

            return true;
        });
    }, [captures, searchQuery, hasScreenshotOnly, selectedTagName]);

    // Get unique tag names for dropdown
    const uniqueTagNames = useMemo(() => {
        return Array.from(new Set(captures.map((c) => c.tagName).filter(Boolean))).sort();
    }, [captures]);

    // Compute group key based on grouping mode
    const computeGroupKey = useCallback((capture: CaptureListItem, mode: GroupingMode): string => {
        const typeKey = capture.tagName ?? "unknown";
        const nameKey = normalizeAccessibleName(capture.accessibleName);
        const roleKey = capture.role ?? "norole";

        switch (mode) {
            case "nameOnly":
                // Tag + Name (default)
                return `${typeKey}::${nameKey}`;
            case "namePlusType":
                // Tag + Role + Name
                return `${typeKey}::${roleKey}::${nameKey}`;
            case "nameTypePrimitives": {
                // Tag + Role + Name + Primitives
                const prims = capture.primitivesSummary;
                const pt = bucketPadding(prims?.paddingTop);
                const pr = bucketPadding(prims?.paddingRight);
                const pb = bucketPadding(prims?.paddingBottom);
                const pl = bucketPadding(prims?.paddingLeft);
                const bg = bucketRgba(prims?.backgroundColorRgba);
                const border = bucketRgba(prims?.borderColorRgba);
                const color = bucketRgba(prims?.colorRgba);
                const shadow = bucketShadow(prims?.shadowPresence, prims?.shadowLayerCount);
                return `${typeKey}::${roleKey}::${nameKey}::p${pt}-${pr}-${pb}-${pl}::bg${bg}::bd${border}::c${color}::sh${shadow}`;
            }
            default:
                return `${typeKey}::${nameKey}`;
        }
    }, []);

    // Compute groups from filtered captures
    const groups = useMemo(() => {
        const groupMap = new Map<string, CaptureListItem[]>();

        filteredCaptures.forEach((capture) => {
            const groupKey = computeGroupKey(capture, groupingMode);

            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, []);
            }
            groupMap.get(groupKey)!.push(capture);
        });

        // Convert to array and sort by count descending
        return Array.from(groupMap.entries())
            .map(([key, items]) => ({
                key,
                items,
                count: items.length,
                explanation: explainGroupKey(key),
            }))
            .sort((a, b) => b.count - a.count);
    }, [filteredCaptures, groupingMode, computeGroupKey]);

    // Memoized selected group (for group detail view)
    const selectedGroup = useMemo(() => {
        if (!selectedGroupKey) return null;
        return groups.find((g) => g.key === selectedGroupKey) ?? null;
    }, [selectedGroupKey, groups]);

    // Memoized variant model (for group detail view)
    const variantModel = useMemo(() => {
        if (!selectedGroup) return null;

        const captureVariantCache = new Map<string, string>();
        const variantsMap = new Map<string, CaptureListItem[]>();

        selectedGroup.items.forEach((capture) => {
            const variantKey = computeVariantKey(capture);
            captureVariantCache.set(capture.id, variantKey);

            if (!variantsMap.has(variantKey)) {
                variantsMap.set(variantKey, []);
            }
            variantsMap.get(variantKey)!.push(capture);
        });

        const variants = Array.from(variantsMap.entries())
            .map(([key, items]) => ({
                key,
                items,
                count: items.length,
            }))
            .sort((a, b) => {
                if (a.count !== b.count) return b.count - a.count;
                return a.key.localeCompare(b.key);
            })
            .map((v, index) => ({
                ...v,
                index: index + 1,
            }));

        const variantIndexMap = new Map<string, number>();
        variants.forEach((v) => variantIndexMap.set(v.key, v.index));

        return { captureVariantCache, variants, variantIndexMap };
    }, [selectedGroupKey, selectedGroup?.items]);

    // Helper to determine which captures to export
    const getCapturesToExport = useCallback((): CaptureListItem[] => {
        if (viewMode === "ungrouped") {
            return filteredCaptures;
        } else if (viewMode === "grouped") {
            if (selectedGroupKey) {
                const selectedGroup = groups.find((g) => g.key === selectedGroupKey);
                return selectedGroup?.items || [];
            } else {
                return filteredCaptures;
            }
        }
        return filteredCaptures;
    }, [viewMode, filteredCaptures, selectedGroupKey, groups]);

    // Helper to fetch full capture records
    const fetchFullCaptures = useCallback(async (captureList: CaptureListItem[]): Promise<any[]> => {
        const fullRecords: any[] = [];
        let counter = 0;
        for (const capture of captureList) {
            try {
                const resp = await sendMessageAsync<{ type: string; captureId: string }, any>({
                    type: "VIEWER/GET_CAPTURE",
                    captureId: capture.id,
                });
                if (resp?.ok && resp.capture) {
                    fullRecords.push(resp.capture);
                }
            } catch (err) {
                console.error("[VIEWER] Failed to fetch capture for export:", capture.id, err);
            }
            counter++;
            // Yield every 10 captures to keep UI responsive
            if (counter % 10 === 0) {
                await new Promise((r) => setTimeout(r, 0));
            }
        }
        return fullRecords;
    }, []);

    // Export as JSON
    const handleExportJSON = useCallback(async () => {
        setIsExporting(true);
        setExportStatus("exporting");
        setExportMessage("Exporting...");
        setExportProgress(null);
        if (exportResetTimerRef.current !== null) {
            clearTimeout(exportResetTimerRef.current);
            exportResetTimerRef.current = null;
        }
        try {
            const capturesToExport = getCapturesToExport();

            const { blob, filename } = await runExport({
                capturesToExport,
                fetchFullCaptures,
                onProgress: (current, total) => setExportProgress({ current, total }),
                buildOutput: (fullRecords) => {
                    // Build map from capture ID to CaptureListItem for derived fields
                    const captureMap = new Map<string, CaptureListItem>();
                    capturesToExport.forEach((item) => captureMap.set(item.id, item));

                    // Remove computed styles to keep file size down
                    const cleanedRecords = fullRecords.map((record) => {
                        const cleaned = { ...record };
                        if (cleaned.styles?.computed) {
                            delete cleaned.styles.computed;
                        }

                        // Add viewer-derived grouping fields if enabled
                        if (includeViewerDerived) {
                            const captureItem = captureMap.get(record.id);
                            if (captureItem) {
                                const groupKey = computeGroupKey(captureItem, groupingMode);
                                const variantKey = computeVariantKey(captureItem);
                                cleaned.viewerDerived = {
                                    groupingMode,
                                    groupKey,
                                    variantKey,
                                    signatureVersion: 1,
                                };
                            }
                        }

                        return cleaned;
                    });

                    const session = sessions.find((s) => s.id === selectedSessionId) ?? null;
                    const exportData = {
                        exportedAt: new Date().toISOString(),
                        session: session,
                        captures: cleanedRecords,
                    };

                    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                        type: "application/json",
                    });
                    const filename = `captures-${selectedSessionId?.slice(0, 8)}-${Date.now()}.json`;
                    return { blob, filename };
                },
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            setExportProgress(null);
            setExportStatus("success");
            setExportMessage("Export complete");
            exportResetTimerRef.current = window.setTimeout(() => {
                setExportStatus("idle");
                setExportMessage(null);
                exportResetTimerRef.current = null;
            }, 2500);
        } catch (err) {
            console.error("[VIEWER] Export JSON failed:", err);
            setExportProgress(null);
            setExportStatus("error");
            setExportMessage("Export failed");
            exportResetTimerRef.current = window.setTimeout(() => {
                setExportStatus("idle");
                setExportMessage(null);
                exportResetTimerRef.current = null;
            }, 4000);
        } finally {
            setIsExporting(false);
        }
    }, [getCapturesToExport, fetchFullCaptures, selectedSessionId, sessions, includeViewerDerived, groupingMode, computeGroupKey]);

    // Export as CSV
    const handleExportCSV = useCallback(async () => {
        setIsExporting(true);
        setExportStatus("exporting");
        setExportMessage("Exporting...");
        setExportProgress(null);
        if (exportResetTimerRef.current !== null) {
            clearTimeout(exportResetTimerRef.current);
            exportResetTimerRef.current = null;
        }
        try {
            const capturesToExport = getCapturesToExport();

            const { blob, filename } = await runExport({
                capturesToExport,
                fetchFullCaptures,
                onProgress: (current, total) => setExportProgress({ current, total }),
                buildOutput: (fullRecords) => {
                    // Build map from capture ID to CaptureListItem for derived fields
                    const captureMap = new Map<string, CaptureListItem>();
                    capturesToExport.forEach((item) => captureMap.set(item.id, item));

                    // Helper to escape CSV values
                    const escapeCsv = (val: any): string => {
                        if (val === null || val === undefined) return "";
                        const str = String(val);
                        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                            return `"${str.replace(/"/g, '""')}"`;
                        }
                        return str;
                    };

                    // CSV header
                    const headers = [
                        "sessionId",
                        "captureId",
                        "createdAt",
                        "url",
                        "tagName",
                        "role",
                        "accessibleName",
                        "screenshotBlobId",
                        "paddingTop",
                        "paddingRight",
                        "paddingBottom",
                        "paddingLeft",
                        "backgroundColorRgba",
                        "colorRgba",
                        "borderColorRgba",
                        "shadowPresence",
                        "shadowLayerCount",
                    ];

                    // Add viewer-derived headers if enabled
                    if (includeViewerDerived) {
                        headers.push(
                            "viewer_grouping_mode",
                            "viewer_group_key",
                            "viewer_variant_key",
                            "viewer_signature_version"
                        );
                    }

                    const rows = fullRecords.map((record) => {
                        const prims = record.styles?.primitives || {};
                        // Format rgba objects as strings for CSV
                        const formatRgba = (rgba: any) => {
                            if (!rgba) return "";
                            if (typeof rgba === "object" && "r" in rgba) {
                                return `${rgba.r},${rgba.g},${rgba.b},${rgba.a}`;
                            }
                            return String(rgba);
                        };
                        const baseFields = [
                            record.sessionId,
                            record.id,
                            record.createdAt ?? record.conditions?.timestamp ?? "",
                            record.url ?? record.page?.url ?? "",
                            record.element?.tagName,
                            record.element?.role,
                            record.element?.intent?.accessibleName,
                            record.screenshot?.screenshotBlobId || "",
                            prims.spacing?.paddingTop,
                            prims.spacing?.paddingRight,
                            prims.spacing?.paddingBottom,
                            prims.spacing?.paddingLeft,
                            formatRgba(prims.backgroundColor?.rgba),
                            formatRgba(prims.color?.rgba),
                            formatRgba(prims.borderColor?.rgba),
                            prims.shadow?.shadowPresence,
                            prims.shadow?.shadowLayerCount,
                        ];

                        // Add viewer-derived fields if enabled
                        if (includeViewerDerived) {
                            const captureItem = captureMap.get(record.id);
                            if (captureItem) {
                                const groupKey = computeGroupKey(captureItem, groupingMode);
                                const variantKey = computeVariantKey(captureItem);
                                baseFields.push(
                                    groupingMode,
                                    groupKey,
                                    variantKey,
                                    "1"
                                );
                            } else {
                                // Missing capture item: add empty values to keep row length consistent
                                baseFields.push("", "", "", "");
                            }
                        }

                        return baseFields.map(escapeCsv);
                    });

                    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                    const blob = new Blob([csvContent], { type: "text/csv" });
                    const filename = `captures-${selectedSessionId?.slice(0, 8)}-${Date.now()}.csv`;
                    return { blob, filename };
                },
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            setExportProgress(null);
            setExportStatus("success");
            setExportMessage("Export complete");
            exportResetTimerRef.current = window.setTimeout(() => {
                setExportStatus("idle");
                setExportMessage(null);
                exportResetTimerRef.current = null;
            }, 2500);
        } catch (err) {
            console.error("[VIEWER] Export CSV failed:", err);
            setExportProgress(null);
            setExportStatus("error");
            setExportMessage("Export failed");
            exportResetTimerRef.current = window.setTimeout(() => {
                setExportStatus("idle");
                setExportMessage(null);
                exportResetTimerRef.current = null;
            }, 4000);
        } finally {
            setIsExporting(false);
        }
    }, [getCapturesToExport, fetchFullCaptures, selectedSessionId, includeViewerDerived, groupingMode, computeGroupKey]);

    // Helper to get or fetch blob URL
    const getBlobUrl = useCallback(async (blobId: string, mimeType: string): Promise<string | null> => {
        // Check cache first
        if (blobUrlCacheRef.current.has(blobId)) {
            return blobUrlCacheRef.current.get(blobId)!;
        }

        try {
            const resp = await sendMessageAsync<{ type: string; blobId: string }, any>({
                type: "AUDIT/GET_BLOB",
                blobId,
            });

            if (resp?.ok && resp.arrayBuffer && resp.arrayBuffer.length > 0) {
                // Convert Array back to Uint8Array, then to Blob
                // (ArrayBuffers don't survive chrome.runtime.sendMessage)
                const uint8Array = new Uint8Array(resp.arrayBuffer);
                const blob = new Blob([uint8Array], { type: mimeType || "image/webp" });
                const url = URL.createObjectURL(blob);

                // Cache it
                blobUrlCacheRef.current.set(blobId, url);

                return url;
            } else {
                // Missing blob: !ok OR empty arrayBuffer
                setMissingBlobIds((prev) => (prev.has(blobId) ? prev : new Set(prev).add(blobId)));
                if (!loggedMissingBlobIdsRef.current.has(blobId)) {
                    loggedMissingBlobIdsRef.current.add(blobId);
                    console.warn("[VIEWER] Missing blob:", blobId);
                }
            }
        } catch (err) {
            // Treat errors as missing blobs
            setMissingBlobIds((prev) => (prev.has(blobId) ? prev : new Set(prev).add(blobId)));
            if (!loggedMissingBlobIdsRef.current.has(blobId)) {
                loggedMissingBlobIdsRef.current.add(blobId);
                console.warn("[VIEWER] Failed to load blob:", blobId, err);
            }
        }

        return null;
    }, []);

    return (
        <>
            <style>{`
                button:focus-visible,
                a:focus-visible,
                input:focus-visible,
                select:focus-visible {
                    outline: 2px solid #2196f3;
                    outline-offset: 2px;
                    border-radius: 4px;
                }
            `}</style>
            <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui" }}>
                {/* Sessions column */}
            <div
                style={{
                    width: 300,
                    borderRight: "1px solid #ddd",
                    padding: 16,
                    overflowY: "auto",
                    background: "#f9f9f9",
                }}
            >
                <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Sessions ({sessions.length})</h2>

                {/* Sessions loading state */}
                {isLoadingSessions && (
                    <div style={{ textAlign: "center", padding: 20, color: "#666", fontSize: 13 }}>
                        Loading sessions...
                    </div>
                )}

                {/* Sessions error state */}
                {sessionsError && (
                    <div
                        style={{
                            padding: 12,
                            background: "#ffebee",
                            border: "1px solid #ef5350",
                            borderRadius: 4,
                            marginBottom: 12,
                        }}
                    >
                        <div style={{ fontSize: 13, color: "#c62828", marginBottom: 8 }}>
                            {sessionsError}
                        </div>
                        <button
                            onClick={loadSessions}
                            style={{
                                padding: "6px 12px",
                                fontSize: 12,
                                border: "1px solid #c62828",
                                borderRadius: 4,
                                background: "white",
                                color: "#c62828",
                                cursor: "pointer",
                            }}
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Sessions list */}
                {!isLoadingSessions && !sessionsError && sessions.map((session) => {
                    const isSelected = session.id === selectedSessionId;
                    const hostname = session.startUrl
                        ? (() => {
                              try {
                                  return new URL(session.startUrl).hostname;
                              } catch {
                                  return "unknown";
                              }
                          })()
                        : "unknown";

                    const time = new Date(session.createdAt).toLocaleString();

                    return (
                        <div
                            key={session.id}
                            onClick={() => handleSelectSession(session.id)}
                            style={{
                                padding: 12,
                                marginBottom: 8,
                                background: isSelected ? "#e3f2fd" : "white",
                                border: isSelected ? "2px solid #2196f3" : "1px solid #ddd",
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: 13,
                            }}
                        >
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                {session.id.slice(0, 20)}...
                            </div>
                            <div style={{ color: "#666", fontSize: 12 }}>{hostname}</div>
                            <div style={{ color: "#999", fontSize: 11, marginTop: 4 }}>{time}</div>
                            {session.pagesVisited && (
                                <div style={{ color: "#999", fontSize: 11, marginTop: 4 }}>
                                    {session.pagesVisited.length} page(s)
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Captures grid */}
            <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
                {!selectedSessionId ? (
                    <div style={{ textAlign: "center", marginTop: 100, color: "#999" }}>
                        Select a session to view captures
                    </div>
                ) : isLoadingCaptures ? (
                    <div style={{ textAlign: "center", marginTop: 100, color: "#666", fontSize: 14 }}>
                        Loading captures...
                    </div>
                ) : capturesError ? (
                    <div style={{ textAlign: "center", marginTop: 100 }}>
                        <div
                            style={{
                                display: "inline-block",
                                padding: 16,
                                background: "#ffebee",
                                border: "1px solid #ef5350",
                                borderRadius: 4,
                            }}
                        >
                            <div style={{ fontSize: 14, color: "#c62828", marginBottom: 12 }}>
                                {capturesError}
                            </div>
                            <button
                                onClick={() => selectedSessionId && loadCaptures(selectedSessionId)}
                                style={{
                                    padding: "8px 16px",
                                    fontSize: 13,
                                    border: "1px solid #c62828",
                                    borderRadius: 4,
                                    background: "white",
                                    color: "#c62828",
                                    cursor: "pointer",
                                }}
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                ) : captures.length === 0 ? (
                    <div style={{ textAlign: "center", marginTop: 100 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "#333", marginBottom: 8 }}>
                            No captures in this session yet.
                        </div>
                        <div style={{ fontSize: 13, color: "#666" }}>
                            Capture some elements in the extension, then reopen the viewer.
                        </div>
                    </div>
                ) : (
                    <>

                        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>
                            Captures ({filteredCaptures.length} of {captures.length})
                        </h2>

                        {/* Compare panel */}
                        {(compareAId || compareBId) && (
                            <ComparePanel
                                compareAId={compareAId}
                                compareBId={compareBId}
                                compareARecord={compareARecord}
                                compareBRecord={compareBRecord}
                                onClearA={() => setCompareAId(null)}
                                onClearB={() => setCompareBId(null)}
                                onClearCompare={() => {
                                    setCompareAId(null);
                                    setCompareBId(null);
                                }}
                                getBlobUrl={getBlobUrl}
                                missingBlobIds={missingBlobIds}
                            />
                        )}

                        {/* View mode toggle and Export */}
                        <div style={{ marginBottom: 16, display: "flex", gap: 8, justifyContent: "space-between" }}>
                            <div style={{ display: "flex", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>View:</span>
                                <button
                                    onClick={() => {
                                        setViewMode("ungrouped");
                                        setSelectedGroupKey(null);
                                    }}
                                    style={{
                                        padding: "6px 12px",
                                        fontSize: 13,
                                        border: viewMode === "ungrouped" ? "2px solid #2196f3" : "1px solid #ddd",
                                        borderRadius: 4,
                                        background: viewMode === "ungrouped" ? "#e3f2fd" : "white",
                                        cursor: "pointer",
                                        fontWeight: viewMode === "ungrouped" ? 600 : 400,
                                    }}
                                >
                                    Ungrouped
                                </button>
                                <button
                                    onClick={() => {
                                        setViewMode("grouped");
                                        setSelectedGroupKey(null);
                                    }}
                                    style={{
                                        padding: "6px 12px",
                                        fontSize: 13,
                                        border: viewMode === "grouped" ? "2px solid #2196f3" : "1px solid #ddd",
                                        borderRadius: 4,
                                        background: viewMode === "grouped" ? "#e3f2fd" : "white",
                                        cursor: "pointer",
                                        fontWeight: viewMode === "grouped" ? 600 : 400,
                                    }}
                                >
                                    Grouped
                                </button>
                                {viewMode === "grouped" && (
                                    <>
                                        <span style={{ fontSize: 13, color: "#666", marginLeft: 8 }}>by</span>
                                        <select
                                            value={groupingMode}
                                            onChange={(e) => {
                                                setGroupingMode(e.target.value as GroupingMode);
                                                setSelectedGroupKey(null);
                                            }}
                                            style={{
                                                padding: "6px 8px",
                                                fontSize: 13,
                                                border: "1px solid #ddd",
                                                borderRadius: 4,
                                                background: "white",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <option value="nameOnly">Tag + Name</option>
                                            <option value="namePlusType">Tag + Role + Name</option>
                                            <option value="nameTypePrimitives">Tag + Role + Name + Primitives</option>
                                        </select>
                                    </>
                                )}
                            </div>

                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                {(exportMessage || exportProgress) && (
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontStyle: "italic",
                                            color:
                                                exportStatus === "error"
                                                    ? "#d32f2f"
                                                    : exportStatus === "success"
                                                    ? "#388e3c"
                                                    : "#666",
                                        }}
                                    >
                                        {exportProgress
                                            ? `Exporting ${exportProgress.current} / ${exportProgress.total}...`
                                            : exportMessage}
                                    </span>
                                )}
                                <label
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        fontSize: 12,
                                        cursor: "pointer",
                                    }}
                                    title="Adds group/variant keys to exports. Not saved to captures."
                                >
                                    <input
                                        type="checkbox"
                                        checked={includeViewerDerived}
                                        onChange={(e) => setIncludeViewerDerived(e.target.checked)}
                                    />
                                    Include viewer-derived grouping fields
                                </label>
                                <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 4, marginRight: 4 }}>Export:</span>
                                <button
                                    onClick={handleExportJSON}
                                    disabled={isExporting}
                                    style={{
                                        padding: "6px 12px",
                                        fontSize: 13,
                                        border: "1px solid #ddd",
                                        borderRadius: 4,
                                        background: isExporting ? "#f5f5f5" : "white",
                                        cursor: isExporting ? "not-allowed" : "pointer",
                                        opacity: isExporting ? 0.6 : 1,
                                    }}
                                >
                                    Export JSON
                                </button>
                                <button
                                    onClick={handleExportCSV}
                                    disabled={isExporting}
                                    style={{
                                        padding: "6px 12px",
                                        fontSize: 13,
                                        border: "1px solid #ddd",
                                        borderRadius: 4,
                                        background: isExporting ? "#f5f5f5" : "white",
                                        cursor: isExporting ? "not-allowed" : "pointer",
                                        opacity: isExporting ? 0.6 : 1,
                                    }}
                                >
                                    Export CSV
                                </button>
                            </div>
                        </div>

                        {/* Filter controls */}
                        <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
                            {/* Search input */}
                            <input
                                type="text"
                                placeholder="Search by name, URL, tag, role..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: "8px 12px",
                                    fontSize: 13,
                                    border: "1px solid #ddd",
                                    borderRadius: 4,
                                }}
                            />

                            {/* Has screenshot checkbox */}
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                                <input
                                    type="checkbox"
                                    checked={hasScreenshotOnly}
                                    onChange={(e) => setHasScreenshotOnly(e.target.checked)}
                                />
                                Has screenshot
                            </label>

                            {/* Tag name dropdown */}
                            <select
                                value={selectedTagName}
                                onChange={(e) => setSelectedTagName(e.target.value)}
                                style={{
                                    padding: "8px 12px",
                                    fontSize: 13,
                                    border: "1px solid #ddd",
                                    borderRadius: 4,
                                    minWidth: 120,
                                }}
                            >
                                <option value="all">All types</option>
                                {uniqueTagNames.map((tagName) => (
                                    <option key={tagName} value={tagName!}>
                                        &lt;{tagName}&gt;
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Empty filter state */}
                        {captures.length > 0 && filteredCaptures.length === 0 && (
                            <div style={{ textAlign: "center", marginTop: 60 }}>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#333", marginBottom: 8 }}>
                                    No captures match your filters.
                                </div>
                                <button
                                    onClick={() => {
                                        setSearchQuery("");
                                        setHasScreenshotOnly(false);
                                        setSelectedTagName("all");
                                        setSelectedGroupKey(null);
                                    }}
                                    style={{
                                        marginTop: 12,
                                        padding: "8px 16px",
                                        fontSize: 13,
                                        border: "1px solid #2196f3",
                                        borderRadius: 4,
                                        background: "white",
                                        color: "#2196f3",
                                        cursor: "pointer",
                                    }}
                                >
                                    Clear filters
                                </button>
                            </div>
                        )}

                        {/* Ungrouped view */}
                        {filteredCaptures.length > 0 && viewMode === "ungrouped" && (
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                                    gap: 16,
                                }}
                            >
                                {filteredCaptures.map((capture) => {
                                    return (
                                        <CaptureCard
                                            key={capture.id}
                                            capture={capture}
                                            displayName={getCaptureDisplayName(capture)}
                                            time={getCaptureTime(capture)}
                                            hostname={getCaptureHostname(capture)}
                                            getBlobUrl={getBlobUrl}
                                            onSetCompareA={setCompareAId}
                                            onSetCompareB={setCompareBId}
                                            isCompareA={capture.id === compareAId}
                                            isCompareB={capture.id === compareBId}
                                            missingBlobIds={missingBlobIds}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {/* Grouped view */}
                        {filteredCaptures.length > 0 && viewMode === "grouped" && !selectedGroupKey && (
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                                    gap: 16,
                                }}
                            >
                                {groups.map((group) => (
                                    <GroupCard
                                        key={group.key}
                                        groupKey={group.key}
                                        count={group.count}
                                        items={group.items}
                                        explanation={group.explanation}
                                        getBlobUrl={getBlobUrl}
                                        onSelect={setSelectedGroupKey}
                                        missingBlobIds={missingBlobIds}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Group detail view */}
                        {filteredCaptures.length > 0 && viewMode === "grouped" && selectedGroupKey && selectedGroup && (() => {
                            if (!variantModel) return null;
                            const { captureVariantCache, variants, variantIndexMap } = variantModel;

                            // Filter items by selected variant (use cache)
                            const displayedItems = selectedVariantKey
                                ? selectedGroup.items.filter((c) => captureVariantCache.get(c.id) === selectedVariantKey)
                                : selectedGroup.items;

                            return (
                                <>
                                    <button
                                        onClick={() => setSelectedGroupKey(null)}
                                        style={{
                                            marginBottom: 16,
                                            padding: "8px 16px",
                                            fontSize: 13,
                                            border: "1px solid #ddd",
                                            borderRadius: 4,
                                            background: "white",
                                            cursor: "pointer",
                                        }}
                                    >
                                        ← Back to groups
                                    </button>

                                    {/* Variants UI */}
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                                            Variants: {variants.length}
                                        </div>
                                        {variants.length > 1 && (
                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                {selectedVariantKey && (
                                                    <button
                                                        onClick={() => setSelectedVariantKey(null)}
                                                        style={{
                                                            padding: "6px 12px",
                                                            fontSize: 12,
                                                            border: "1px solid #ddd",
                                                            borderRadius: 4,
                                                            background: "white",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        All variants
                                                    </button>
                                                )}
                                                {variants.map((variant) => (
                                                    <button
                                                        key={variant.key}
                                                        onClick={() =>
                                                            setSelectedVariantKey(
                                                                selectedVariantKey === variant.key
                                                                    ? null
                                                                    : variant.key
                                                            )
                                                        }
                                                        style={{
                                                            padding: "6px 12px",
                                                            fontSize: 12,
                                                            border:
                                                                selectedVariantKey === variant.key
                                                                    ? "2px solid #2196f3"
                                                                    : "1px solid #ddd",
                                                            borderRadius: 4,
                                                            background:
                                                                selectedVariantKey === variant.key
                                                                    ? "#e3f2fd"
                                                                    : "white",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        Variant {variant.index} ({variant.count})
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                                            gap: 16,
                                        }}
                                    >
                                        {displayedItems.map((capture) => {
                                            const variantKey = captureVariantCache.get(capture.id)!;
                                            const variantIndex = variantIndexMap.get(variantKey);

                                            return (
                                                <div key={capture.id} style={{ position: "relative" }}>
                                                    {variants.length > 1 && variantIndex && (
                                                        <div
                                                            style={{
                                                                position: "absolute",
                                                                top: 8,
                                                                right: 8,
                                                                padding: "2px 6px",
                                                                fontSize: 10,
                                                                fontWeight: 600,
                                                                background: "rgba(33, 150, 243, 0.9)",
                                                                color: "white",
                                                                borderRadius: 3,
                                                                zIndex: 1,
                                                            }}
                                                        >
                                                            V{variantIndex}
                                                        </div>
                                                    )}
                                                    <CaptureCard
                                                        capture={capture}
                                                        displayName={getCaptureDisplayName(capture)}
                                                        time={getCaptureTime(capture)}
                                                        hostname={getCaptureHostname(capture)}
                                                        getBlobUrl={getBlobUrl}
                                                        onSetCompareA={setCompareAId}
                                                        onSetCompareB={setCompareBId}
                                                        isCompareA={capture.id === compareAId}
                                                        isCompareB={capture.id === compareBId}
                                                        missingBlobIds={missingBlobIds}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            );
                        })()}
                    </>
                )}
            </div>
        </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────
// Compare Panel Component
// ─────────────────────────────────────────────────────────────

interface ComparePanelProps {
    compareAId: string | null;
    compareBId: string | null;
    compareARecord: any | null;
    compareBRecord: any | null;
    onClearA: () => void;
    onClearB: () => void;
    onClearCompare: () => void;
    getBlobUrl: (blobId: string, mimeType: string) => Promise<string | null>;
    missingBlobIds: Set<string>;
}

function ComparePanel({
    compareAId,
    compareBId,
    compareARecord,
    compareBRecord,
    onClearA,
    onClearB,
    onClearCompare,
    getBlobUrl,
    missingBlobIds,
}: ComparePanelProps) {
    const [screenshotAUrl, setScreenshotAUrl] = useState<string | null>(null);
    const [screenshotBUrl, setScreenshotBUrl] = useState<string | null>(null);

    // Load screenshot A
    useEffect(() => {
        setScreenshotAUrl(null);
        if (compareARecord?.screenshot?.screenshotBlobId) {
            getBlobUrl(
                compareARecord.screenshot.screenshotBlobId,
                compareARecord.screenshot.mimeType
            ).then(setScreenshotAUrl);
        }
    }, [compareARecord, getBlobUrl]);

    // Load screenshot B
    useEffect(() => {
        setScreenshotBUrl(null);
        if (compareBRecord?.screenshot?.screenshotBlobId) {
            getBlobUrl(
                compareBRecord.screenshot.screenshotBlobId,
                compareBRecord.screenshot.mimeType
            ).then(setScreenshotBUrl);
        }
    }, [compareBRecord, getBlobUrl]);

    // Compute primitives diff
    const primitivesDiff = useMemo(() => {
        if (!compareARecord?.styles?.primitives || !compareBRecord?.styles?.primitives) {
            return null;
        }

        const primA = compareARecord.styles.primitives;
        const primB = compareBRecord.styles.primitives;
        const diffs: { path: string; valueA: any; valueB: any }[] = [];

        // Helper to compare nested objects
        const comparePrimitives = (a: any, b: any, prefix: string) => {
            const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
            allKeys.forEach((key) => {
                const valA = a?.[key];
                const valB = b?.[key];
                const path = prefix ? `${prefix}.${key}` : key;

                if (typeof valA === "object" && valA !== null && typeof valB === "object" && valB !== null) {
                    // Both are objects, recurse
                    comparePrimitives(valA, valB, path);
                } else if (valA !== valB) {
                    // Values differ
                    diffs.push({ path, valueA: valA, valueB: valB });
                }
            });
        };

        comparePrimitives(primA, primB, "");
        return diffs;
    }, [compareARecord, compareBRecord]);

    return (
        <div
            style={{
                border: "2px solid #ff9800",
                borderRadius: 4,
                padding: 16,
                marginBottom: 16,
                background: "#fff3e0",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Compare Mode</div>
                <div style={{ display: "flex", gap: 8 }}>
                    {compareAId && (
                        <button
                            onClick={onClearA}
                            style={{
                                padding: "4px 8px",
                                fontSize: 11,
                                border: "1px solid #ddd",
                                borderRadius: 3,
                                background: "white",
                                cursor: "pointer",
                            }}
                        >
                            Clear A
                        </button>
                    )}
                    {compareBId && (
                        <button
                            onClick={onClearB}
                            style={{
                                padding: "4px 8px",
                                fontSize: 11,
                                border: "1px solid #ddd",
                                borderRadius: 3,
                                background: "white",
                                cursor: "pointer",
                            }}
                        >
                            Clear B
                        </button>
                    )}
                    <button
                        onClick={onClearCompare}
                        style={{
                            padding: "4px 8px",
                            fontSize: 11,
                            border: "1px solid #ddd",
                            borderRadius: 3,
                            background: "white",
                            cursor: "pointer",
                        }}
                    >
                        Clear Compare
                    </button>
                </div>
            </div>

            <div style={{ display: "flex", gap: 8, fontSize: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                    <strong>A:</strong> {compareAId ? compareAId.slice(0, 20) + "..." : "(not set)"}
                </div>
                <div style={{ flex: 1 }}>
                    <strong>B:</strong> {compareBId ? compareBId.slice(0, 20) + "..." : "(not set)"}
                </div>
            </div>

            {/* Screenshots side-by-side */}
            {compareAId && compareBId && (
                <>
                    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                                Screenshot A
                            </div>
                            {!compareARecord?.screenshot?.screenshotBlobId ? (
                                <div
                                    style={{
                                        width: "100%",
                                        height: 100,
                                        border: "1px solid #ddd",
                                        borderRadius: 4,
                                        background: "#f5f5f5",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        color: "#999",
                                    }}
                                >
                                    No screenshot
                                </div>
                            ) : missingBlobIds.has(compareARecord.screenshot.screenshotBlobId) ? (
                                <div
                                    style={{
                                        width: "100%",
                                        height: 100,
                                        border: "1px solid #ddd",
                                        borderRadius: 4,
                                        background: "#fff3cd",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        color: "#856404",
                                    }}
                                >
                                    Missing blob
                                </div>
                            ) : screenshotAUrl ? (
                                <img
                                    src={screenshotAUrl}
                                    alt="Screenshot A"
                                    style={{
                                        width: "100%",
                                        maxHeight: 200,
                                        objectFit: "contain",
                                        border: "1px solid #ddd",
                                        borderRadius: 4,
                                        background: "white",
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: "100%",
                                        height: 100,
                                        border: "1px solid #ddd",
                                        borderRadius: 4,
                                        background: "#f5f5f5",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        color: "#999",
                                    }}
                                >
                                    Loading...
                                </div>
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                                Screenshot B
                            </div>
                            {!compareBRecord?.screenshot?.screenshotBlobId ? (
                                <div
                                    style={{
                                        width: "100%",
                                        height: 100,
                                        border: "1px solid #ddd",
                                        borderRadius: 4,
                                        background: "#f5f5f5",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        color: "#999",
                                    }}
                                >
                                    No screenshot
                                </div>
                            ) : missingBlobIds.has(compareBRecord.screenshot.screenshotBlobId) ? (
                                <div
                                    style={{
                                        width: "100%",
                                        height: 100,
                                        border: "1px solid #ddd",
                                        borderRadius: 4,
                                        background: "#fff3cd",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        color: "#856404",
                                    }}
                                >
                                    Missing blob
                                </div>
                            ) : screenshotBUrl ? (
                                <img
                                    src={screenshotBUrl}
                                    alt="Screenshot B"
                                    style={{
                                        width: "100%",
                                        maxHeight: 200,
                                        objectFit: "contain",
                                        border: "1px solid #ddd",
                                        borderRadius: 4,
                                        background: "white",
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: "100%",
                                        height: 100,
                                        border: "1px solid #ddd",
                                        borderRadius: 4,
                                        background: "#f5f5f5",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        color: "#999",
                                    }}
                                >
                                    Loading...
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Primitives diff */}
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                            Primitives Diff
                        </div>
                        {primitivesDiff === null ? (
                            <div style={{ fontSize: 11, color: "#666", fontStyle: "italic" }}>
                                One or both captures are missing style primitives
                            </div>
                        ) : primitivesDiff.length === 0 ? (
                            <div style={{ fontSize: 11, color: "#666", fontStyle: "italic" }}>
                                No differences in primitives
                            </div>
                        ) : (
                            <div
                                style={{
                                    maxHeight: 200,
                                    overflowY: "auto",
                                    fontSize: 11,
                                    background: "white",
                                    border: "1px solid #ddd",
                                    borderRadius: 4,
                                    padding: 8,
                                }}
                            >
                                {primitivesDiff.map((diff, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            marginBottom: 6,
                                            paddingBottom: 6,
                                            borderBottom:
                                                idx < primitivesDiff.length - 1
                                                    ? "1px solid #eee"
                                                    : "none",
                                        }}
                                    >
                                        <div style={{ fontWeight: 600, color: "#333" }}>
                                            {diff.path}
                                        </div>
                                        <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
                                            <div style={{ flex: 1 }}>
                                                <span style={{ color: "#4caf50", fontWeight: 600 }}>
                                                    A:
                                                </span>{" "}
                                                {JSON.stringify(diff.valueA)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <span style={{ color: "#2196f3", fontWeight: 600 }}>
                                                    B:
                                                </span>{" "}
                                                {JSON.stringify(diff.valueB)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Group Card Component
// ─────────────────────────────────────────────────────────────

interface GroupCardProps {
    groupKey: string;
    count: number;
    items: CaptureListItem[];
    explanation: GroupExplanation;
    getBlobUrl: (blobId: string, mimeType: string) => Promise<string | null>;
    onSelect: (groupKey: string) => void;
    missingBlobIds: Set<string>;
}

function GroupCard({ groupKey, count, items, explanation, getBlobUrl, onSelect, missingBlobIds }: GroupCardProps) {
    const [thumbnailUrls, setThumbnailUrls] = useState<(string | null)[]>([]);
    const [thumbnailBlobIds, setThumbnailBlobIds] = useState<(string | null)[]>([]);

    // Parse groupKey: supports "tag::name", "tag::role::name", or "tag::role::name::primitives..."
    const parts = groupKey.split("::");
    const typeKey = parts[0] || "unknown";
    const displayLabel = (() => {
        if (parts.length === 2) {
            // nameOnly: "tag::name"
            const nameKey = parts[1];
            return nameKey ? `<${typeKey}> ${nameKey}` : `<${typeKey}> (no name)`;
        } else if (parts.length === 3) {
            // namePlusType: "tag::role::name"
            const roleKey = parts[1];
            const nameKey = parts[2];
            if (roleKey === "norole") {
                return nameKey ? `<${typeKey}> ${nameKey}` : `<${typeKey}> (no name)`;
            }
            return nameKey ? `<${typeKey}> [${roleKey}] ${nameKey}` : `<${typeKey}> [${roleKey}] (no name)`;
        } else if (parts.length > 3) {
            // nameTypePrimitives: "tag::role::name::primitives..."
            const roleKey = parts[1];
            const nameKey = parts[2];
            if (roleKey === "norole") {
                return nameKey ? `<${typeKey}> ${nameKey}` : `<${typeKey}> (no name)`;
            }
            return nameKey ? `<${typeKey}> [${roleKey}] ${nameKey}` : `<${typeKey}> [${roleKey}] (no name)`;
        } else {
            return `<${typeKey}>`;
        }
    })();

    // Load up to 3 thumbnails
    useEffect(() => {
        let cancelled = false;
        setThumbnailUrls([]); // Clear old thumbnails to avoid flicker
        setThumbnailBlobIds([]);
        const loadThumbnails = async () => {
            const urls: (string | null)[] = [];
            const blobIds: (string | null)[] = [];
            const itemsWithScreenshots = items.filter((item) => item.screenshot?.screenshotBlobId);
            const thumbnailItems = itemsWithScreenshots.slice(0, 3);

            for (const item of thumbnailItems) {
                if (item.screenshot?.screenshotBlobId) {
                    blobIds.push(item.screenshot.screenshotBlobId);
                    const url = await getBlobUrl(
                        item.screenshot.screenshotBlobId,
                        item.screenshot.mimeType
                    );
                    urls.push(url);
                } else {
                    blobIds.push(null);
                    urls.push(null);
                }
            }

            if (cancelled) return;
            setThumbnailBlobIds(blobIds);
            setThumbnailUrls(urls);
        };

        loadThumbnails();
        return () => {
            cancelled = true;
        };
    }, [items, getBlobUrl]);

    // Build tooltip for "Why grouped?" affordance
    const whyTooltip = (() => {
        const parts: string[] = [];
        if (explanation.tag) parts.push(`tag=${explanation.tag}`);
        if (explanation.role) parts.push(`role=${explanation.role}`);
        if (explanation.name) parts.push(`name=${explanation.name}`);

        const baseLine = parts.join(", ");

        if (!baseLine) return "No explanation available";

        if (explanation.primitives) {
            const primParts: string[] = [];
            if (explanation.primitives.padding) primParts.push(`padding: ${explanation.primitives.padding}`);
            if (explanation.primitives.colors) primParts.push(`colors: ${explanation.primitives.colors}`);
            if (explanation.primitives.shadow) primParts.push(`shadow: ${explanation.primitives.shadow}`);

            if (primParts.length > 0) {
                return `${baseLine}\n${primParts.join("\n")}`;
            }
        }

        return baseLine;
    })();

    return (
        <div
            onClick={() => onSelect(groupKey)}
            style={{
                border: "1px solid #ddd",
                borderRadius: 4,
                padding: 12,
                background: "white",
                cursor: "pointer",
            }}
        >
            {/* Label and Why? affordance */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div
                    style={{
                        fontWeight: 600,
                        fontSize: 14,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                    }}
                    title={displayLabel}
                >
                    {displayLabel}
                </div>
                <span
                    style={{
                        fontSize: 11,
                        color: "#0066cc",
                        cursor: "help",
                        userSelect: "none",
                        flexShrink: 0,
                    }}
                    title={whyTooltip}
                    onClick={(e) => e.stopPropagation()}
                >
                    Why?
                </span>
            </div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
                {count} occurrence{count !== 1 ? "s" : ""}
            </div>

            {/* Thumbnails */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {thumbnailUrls.map((url, idx) => {
                    const blobId = thumbnailBlobIds[idx];
                    const isMissing = blobId && missingBlobIds.has(blobId);

                    return (
                        <div key={idx} style={{ flex: "1 1 calc(33.333% - 8px)", minWidth: 60 }}>
                            {!blobId ? (
                                <div
                                    style={{
                                        width: "100%",
                                        height: 60,
                                        background: "#f5f5f5",
                                        borderRadius: 4,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#ccc",
                                        fontSize: 10,
                                    }}
                                >
                                    No screenshot
                                </div>
                            ) : isMissing ? (
                                <div
                                    style={{
                                        width: "100%",
                                        height: 60,
                                        background: "#fff3cd",
                                        borderRadius: 4,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#856404",
                                        fontSize: 10,
                                    }}
                                >
                                    Missing blob
                                </div>
                            ) : url ? (
                                <img
                                    src={url}
                                    alt={`Thumbnail ${idx + 1}`}
                                    style={{
                                        width: "100%",
                                        height: 60,
                                        objectFit: "cover",
                                        borderRadius: 4,
                                        background: "#f5f5f5",
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: "100%",
                                        height: 60,
                                        background: "#f5f5f5",
                                        borderRadius: 4,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#ccc",
                                        fontSize: 10,
                                    }}
                                >
                                    Loading...
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Capture Card Component
// ─────────────────────────────────────────────────────────────

interface CaptureCardProps {
    capture: CaptureListItem;
    displayName: string;
    time: string;
    hostname: string;
    getBlobUrl: (blobId: string, mimeType: string) => Promise<string | null>;
    onSetCompareA: (id: string) => void;
    onSetCompareB: (id: string) => void;
    isCompareA: boolean;
    isCompareB: boolean;
    missingBlobIds: Set<string>;
}

function CaptureCard({ capture, displayName, time, hostname, getBlobUrl, onSetCompareA, onSetCompareB, isCompareA, isCompareB, missingBlobIds }: CaptureCardProps) {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

    useEffect(() => {
        setThumbnailUrl(null);
        if (capture.screenshot?.screenshotBlobId) {
            getBlobUrl(capture.screenshot.screenshotBlobId, capture.screenshot.mimeType).then(setThumbnailUrl);
        }
    }, [capture.screenshot?.screenshotBlobId, capture.screenshot?.mimeType, getBlobUrl]);

    return (
        <div
            style={{
                border: "1px solid #ddd",
                borderRadius: 4,
                padding: 12,
                background: "white",
            }}
        >
            {/* Thumbnail */}
            {!capture.screenshot?.screenshotBlobId ? (
                <div
                    style={{
                        width: "100%",
                        height: 120,
                        background: "#f5f5f5",
                        borderRadius: 4,
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#999",
                        fontSize: 12,
                    }}
                >
                    No screenshot
                </div>
            ) : missingBlobIds.has(capture.screenshot.screenshotBlobId) ? (
                <div
                    style={{
                        width: "100%",
                        height: 120,
                        background: "#fff3cd",
                        borderRadius: 4,
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#856404",
                        fontSize: 12,
                        fontWeight: 600,
                    }}
                >
                    Missing blob
                </div>
            ) : thumbnailUrl ? (
                <img
                    src={thumbnailUrl}
                    alt="Screenshot"
                    style={{
                        width: "100%",
                        height: 120,
                        objectFit: "cover",
                        borderRadius: 4,
                        marginBottom: 8,
                        background: "#f5f5f5",
                    }}
                />
            ) : (
                <div
                    style={{
                        width: "100%",
                        height: 120,
                        background: "#f5f5f5",
                        borderRadius: 4,
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#999",
                        fontSize: 12,
                    }}
                >
                    Loading...
                </div>
            )}

            {/* Label with compare badges */}
            <div
                style={{
                    fontWeight: 600,
                    fontSize: 13,
                    marginBottom: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                }}
            >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {displayName}
                </span>
                <span
                    style={{
                        background: "#f5f5f5",
                        color: "#666",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 3,
                        border: "1px solid #ddd",
                    }}
                >
                    {(capture.tagName ?? "UNKNOWN").toUpperCase()}
                </span>
                {isCompareA && (
                    <span
                        style={{
                            background: "#4caf50",
                            color: "white",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 4px",
                            borderRadius: 2,
                        }}
                    >
                        A
                    </span>
                )}
                {isCompareB && (
                    <span
                        style={{
                            background: "#2196f3",
                            color: "white",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 4px",
                            borderRadius: 2,
                        }}
                    >
                        B
                    </span>
                )}
            </div>

            {/* Compare buttons */}
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                <button
                    onClick={() => onSetCompareA(capture.id)}
                    style={{
                        flex: 1,
                        padding: "4px 8px",
                        fontSize: 11,
                        border: isCompareA ? "2px solid #4caf50" : "1px solid #ddd",
                        borderRadius: 3,
                        background: isCompareA ? "#e8f5e9" : "white",
                        cursor: "pointer",
                        fontWeight: isCompareA ? 600 : 400,
                    }}
                >
                    Set A
                </button>
                <button
                    onClick={() => onSetCompareB(capture.id)}
                    style={{
                        flex: 1,
                        padding: "4px 8px",
                        fontSize: 11,
                        border: isCompareB ? "2px solid #2196f3" : "1px solid #ddd",
                        borderRadius: 3,
                        background: isCompareB ? "#e3f2fd" : "white",
                        cursor: "pointer",
                        fontWeight: isCompareB ? 600 : 400,
                    }}
                >
                    Set B
                </button>
            </div>

            {/* Metadata */}
            <div style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>{time}</div>
            <div
                style={{
                    fontSize: 11,
                    color: "#999",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {hostname}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById("root")!).render(<ViewerApp />);
