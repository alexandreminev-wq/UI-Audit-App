/**
 * IndexedDB helper for persisting captures, sessions, blobs, projects, and project-session links
 *
 * DB: ui-inventory
 * Version: 4 (v2.2 schema + projects + annotations)
 * Stores:
 *   - captures (keyPath: id, indexes: byCreatedAt, byUrl)
 *   - sessions (keyPath: id, indexes: byCreatedAt, byStartUrl)
 *   - blobs (keyPath: id, indexes: byCreatedAt)
 *   - projects (keyPath: id, indexes: byUpdatedAt, byCreatedAt)
 *   - projectSessions (keyPath: id, indexes: byProjectId, bySessionId)
 *   - annotations (keyPath: id, indexes: byProject) — 7.7.1: Notes + Tags
 */

import type { CaptureRecord, CaptureRecordV2, SessionRecord, BlobRecord } from "../types/capture";

// ─────────────────────────────────────────────────────────────
// Annotation Record (7.7.1)
// ─────────────────────────────────────────────────────────────

export interface AnnotationRecord {
    id: string;             // "${projectId}:${componentKey}"
    projectId: string;      // Project scope
    componentKey: string;   // ViewerComponent.id (deterministic grouping hash)
    notes: string;          // User notes (default "")
    tags: string[];         // User tags (default [])
    updatedAt: number;      // Last modification timestamp (epoch ms)
}

// ─────────────────────────────────────────────────────────────
// Component Overrides (Milestone 8+ evolving review layer)
// ─────────────────────────────────────────────────────────────

export interface ComponentOverrideRecord {
    id: string;                 // "${projectId}:${componentKey}"
    projectId: string;          // Project scope
    componentKey: string;       // Deterministic grouping hash (same as ViewerComponent.id)
    displayName: string | null; // Optional user override
    categoryOverride: string | null;
    typeOverride: string | null;
    statusOverride: string | null;
    updatedAt: number;          // Last modification timestamp (epoch ms)
}

const DB_NAME = "ui-inventory";
const DB_VERSION = 5;
const STORE_CAPTURES = "captures";
const STORE_SESSIONS = "sessions";
const STORE_BLOBS = "blobs";
const STORE_PROJECTS = "projects";
const STORE_PROJECT_SESSIONS = "projectSessions";
const STORE_ANNOTATIONS = "annotations";
const STORE_COMPONENT_OVERRIDES = "component_overrides";

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open/create the database with upgrade path
 */
function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error("[capturesDb] Failed to open database:", request.error);
            dbPromise = null;
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const oldVersion = event.oldVersion;

            console.log(`[capturesDb] Upgrading database from version ${oldVersion} to ${DB_VERSION}`);

            // Version 1 → 2: Create captures store (or keep existing)
            if (!db.objectStoreNames.contains(STORE_CAPTURES)) {
                const capturesStore = db.createObjectStore(STORE_CAPTURES, { keyPath: "id" });
                capturesStore.createIndex("byCreatedAt", "createdAt", { unique: false });
                capturesStore.createIndex("byUrl", "url", { unique: false });
                console.log("[capturesDb] Created captures store with indexes");
            }

            // Version 2: Add sessions store
            if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
                const sessionsStore = db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
                sessionsStore.createIndex("byCreatedAt", "createdAt", { unique: false });
                sessionsStore.createIndex("byStartUrl", "startUrl", { unique: false });
                console.log("[capturesDb] Created sessions store with indexes");
            }

            // Version 2: Add blobs store
            if (!db.objectStoreNames.contains(STORE_BLOBS)) {
                const blobsStore = db.createObjectStore(STORE_BLOBS, { keyPath: "id" });
                blobsStore.createIndex("byCreatedAt", "createdAt", { unique: false });
                console.log("[capturesDb] Created blobs store with indexes");
            }

            // Version 3: Add projects store
            if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
                const projectsStore = db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
                projectsStore.createIndex("byUpdatedAt", "updatedAt", { unique: false });
                projectsStore.createIndex("byCreatedAt", "createdAt", { unique: false });
                console.log("[capturesDb] Created projects store with indexes");
            }

            // Version 3: Add projectSessions store
            if (!db.objectStoreNames.contains(STORE_PROJECT_SESSIONS)) {
                const projectSessionsStore = db.createObjectStore(STORE_PROJECT_SESSIONS, { keyPath: "id" });
                projectSessionsStore.createIndex("byProjectId", "projectId", { unique: false });
                projectSessionsStore.createIndex("bySessionId", "sessionId", { unique: false });
                console.log("[capturesDb] Created projectSessions store with indexes");
            }

            // Version 4: Add annotations store (7.7.1)
            if (!db.objectStoreNames.contains(STORE_ANNOTATIONS)) {
                const annotationsStore = db.createObjectStore(STORE_ANNOTATIONS, { keyPath: "id" });
                annotationsStore.createIndex("byProject", "projectId", { unique: false });
                console.log("[capturesDb] Created annotations store with indexes");
            }

            // Version 5: Add component overrides store (review layer, component-scoped)
            if (!db.objectStoreNames.contains(STORE_COMPONENT_OVERRIDES)) {
                const overridesStore = db.createObjectStore(STORE_COMPONENT_OVERRIDES, { keyPath: "id" });
                overridesStore.createIndex("byProject", "projectId", { unique: false });
                console.log("[capturesDb] Created component_overrides store with indexes");
            }
        };
    });

    return dbPromise;
}

// ─────────────────────────────────────────────────────────────
// Captures
// ─────────────────────────────────────────────────────────────

/**
 * Save a capture record to IndexedDB (supports both v1 and v2.2)
 * Fails gracefully - logs warning but doesn't throw
 */
export async function saveCapture(record: CaptureRecord | CaptureRecordV2): Promise<void> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_CAPTURES, "readwrite");
        const store = tx.objectStore(STORE_CAPTURES);

        store.put(record);

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error("Transaction aborted"));
        });

        console.log("[capturesDb] Saved capture:", record.id);
    } catch (err) {
        console.warn("[capturesDb] Failed to save capture (non-fatal):", err);
        // Don't throw - fail gracefully
    }
}

/**
 * List recent captures from IndexedDB (supports both v1 and v2.2)
 * Returns newest first (by createdAt desc)
 * Fails gracefully - returns [] on error
 */
export async function listRecentCaptures(limit = 10): Promise<(CaptureRecord | CaptureRecordV2)[]> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_CAPTURES, "readonly");
        const store = tx.objectStore(STORE_CAPTURES);
        const index = store.index("byCreatedAt");

        const results: (CaptureRecord | CaptureRecordV2)[] = [];

        return new Promise((resolve, reject) => {
            const request = index.openCursor(null, "prev"); // descending order

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.warn("[capturesDb] Failed to list captures (non-fatal):", err);
        return [];
    }
}

/**
 * List recent captures filtered by hostname (supports both v1 and v2.2)
 * Returns newest first (by createdAt desc)
 * Filters in JS by hostname match
 * Fails gracefully - returns [] on error
 */
export async function listRecentCapturesByHost(host: string, limit = 10): Promise<(CaptureRecord | CaptureRecordV2)[]> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_CAPTURES, "readonly");
        const store = tx.objectStore(STORE_CAPTURES);
        const index = store.index("byCreatedAt");

        const results: (CaptureRecord | CaptureRecordV2)[] = [];

        return new Promise((resolve, reject) => {
            const request = index.openCursor(null, "prev"); // descending order

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor && results.length < limit) {
                    const record = cursor.value;

                    // Filter by hostname
                    try {
                        const recordHost = new URL(record.url).hostname;
                        if (recordHost === host) {
                            results.push(record);
                        }
                    } catch {
                        // Invalid URL, skip
                    }

                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.warn("[capturesDb] Failed to list captures by host (non-fatal):", err);
        return [];
    }
}

/**
 * Get a single capture record by ID
 * Fails gracefully - returns null on error
 */
export async function getCapture(captureId: string): Promise<CaptureRecord | CaptureRecordV2 | null> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_CAPTURES, "readonly");
        const store = tx.objectStore(STORE_CAPTURES);

        return new Promise((resolve, reject) => {
            const request = store.get(captureId);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.warn("[capturesDb] Failed to get capture (non-fatal):", err);
        return null;
    }
}

/**
 * List recent captures filtered by sessionId
 * Returns newest first (by createdAt desc)
 * NOTE: We scan instead of adding a bySessionId index to avoid DB version bump
 * This is acceptable for MVP viewer with typical session sizes (<1000 captures)
 * Fails gracefully - returns [] on error
 */
export async function listCapturesBySession(sessionId: string, limit = 200): Promise<(CaptureRecord | CaptureRecordV2)[]> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_CAPTURES, "readonly");
        const store = tx.objectStore(STORE_CAPTURES);
        const index = store.index("byCreatedAt");

        const results: (CaptureRecord | CaptureRecordV2)[] = [];

        return new Promise((resolve, reject) => {
            const request = index.openCursor(null, "prev"); // descending order

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor && results.length < limit) {
                    const record = cursor.value;

                    // Filter by sessionId
                    if (record.sessionId === sessionId) {
                        results.push(record);
                    }

                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.warn("[capturesDb] Failed to list captures by session (non-fatal):", err);
        return [];
    }
}

/**
 * Delete a single capture by ID
 * Throws on error - caller must handle failures
 */
export async function deleteCapture(captureId: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE_CAPTURES, "readwrite");
    const store = tx.objectStore(STORE_CAPTURES);

    store.delete(captureId);

    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error("Transaction aborted"));
    });

    console.log("[capturesDb] Deleted capture:", captureId);
}

/**
 * Clear all captures from IndexedDB
 * Fails gracefully - logs warning but doesn't throw
 */
export async function clearAllCaptures(): Promise<void> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_CAPTURES, "readwrite");
        const store = tx.objectStore(STORE_CAPTURES);

        store.clear();

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error("Transaction aborted"));
        });

        console.log("[capturesDb] Cleared all captures");
    } catch (err) {
        console.warn("[capturesDb] Failed to clear captures (non-fatal):", err);
        // Don't throw - fail gracefully
    }
}

// ─────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────

/**
 * Save a session record to IndexedDB
 * Fails gracefully - logs warning but doesn't throw
 */
export async function saveSession(session: SessionRecord): Promise<void> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_SESSIONS, "readwrite");
        const store = tx.objectStore(STORE_SESSIONS);

        store.put(session);

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error("Transaction aborted"));
        });

        console.log("[capturesDb] Saved session:", session.id);
    } catch (err) {
        console.warn("[capturesDb] Failed to save session (non-fatal):", err);
    }
}

/**
 * Get a session record by ID
 * Fails gracefully - returns null on error
 */
export async function getSession(sessionId: string): Promise<SessionRecord | null> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_SESSIONS, "readonly");
        const store = tx.objectStore(STORE_SESSIONS);

        return new Promise((resolve, reject) => {
            const request = store.get(sessionId);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.warn("[capturesDb] Failed to get session (non-fatal):", err);
        return null;
    }
}

/**
 * List recent sessions from IndexedDB
 * Returns newest first (by createdAt desc)
 * Fails gracefully - returns [] on error
 */
export async function listSessions(limit = 10): Promise<SessionRecord[]> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_SESSIONS, "readonly");
        const store = tx.objectStore(STORE_SESSIONS);
        const index = store.index("byCreatedAt");

        const results: SessionRecord[] = [];

        return new Promise((resolve, reject) => {
            const request = index.openCursor(null, "prev"); // descending order

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.warn("[capturesDb] Failed to list sessions (non-fatal):", err);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────
// Blobs
// ─────────────────────────────────────────────────────────────

/**
 * Save a blob record to IndexedDB
 * Fails gracefully - logs warning but doesn't throw
 */
export async function saveBlob(blobRecord: BlobRecord): Promise<void> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_BLOBS, "readwrite");
        const store = tx.objectStore(STORE_BLOBS);

        store.put(blobRecord);

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error("Transaction aborted"));
        });

        console.log("[capturesDb] Saved blob:", blobRecord.id);
    } catch (err) {
        console.warn("[capturesDb] Failed to save blob (non-fatal):", err);
    }
}

/**
 * Get a blob record by ID
 * Fails gracefully - returns null on error
 */
export async function getBlob(blobId: string): Promise<BlobRecord | null> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_BLOBS, "readonly");
        const store = tx.objectStore(STORE_BLOBS);

        return new Promise((resolve, reject) => {
            const request = store.get(blobId);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.warn("[capturesDb] Failed to get blob (non-fatal):", err);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────

export type ProjectRecord = {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
};

export type ProjectSessionLinkRecord = {
    id: string;
    projectId: string;
    sessionId: string;
    linkedAt: number;
};

/**
 * Create a new project
 * Throws on error (validation or DB failure)
 */
export async function createProject(name: string): Promise<ProjectRecord> {
    const trimmedName = name.trim();
    if (!trimmedName) {
        throw new Error("Project name cannot be empty");
    }

    const now = Date.now();
    const project: ProjectRecord = {
        id: `project-${now}-${Math.random().toString(36).slice(2, 11)}`,
        name: trimmedName,
        createdAt: now,
        updatedAt: now,
    };

    const db = await openDb();
    const tx = db.transaction(STORE_PROJECTS, "readwrite");
    const store = tx.objectStore(STORE_PROJECTS);

    store.put(project);

    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"));
        tx.onabort = () => reject(new Error("Transaction aborted"));
    });

    console.log("[capturesDb] Created project:", project.id);
    return project;
}

/**
 * List all projects
 * Returns raw getAll() results (no sorting)
 * Throws on error
 */
export async function listProjects(): Promise<ProjectRecord[]> {
    const db = await openDb();
    const tx = db.transaction(STORE_PROJECTS, "readonly");
    const store = tx.objectStore(STORE_PROJECTS);

    return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => reject(request.error ?? new Error("Failed to list projects"));
    });
}

/**
 * Link a session to a project
 * Idempotent: uses deterministic id and put() to avoid duplicates
 * Throws on error (validation or DB failure)
 */
export async function linkSessionToProject(projectId: string, sessionId: string): Promise<void> {
    if (!projectId || !sessionId) {
        throw new Error("projectId and sessionId are required");
    }

    const link: ProjectSessionLinkRecord = {
        id: `${projectId}::${sessionId}`,
        projectId,
        sessionId,
        linkedAt: Date.now(),
    };

    const db = await openDb();
    const tx = db.transaction(STORE_PROJECT_SESSIONS, "readwrite");
    const store = tx.objectStore(STORE_PROJECT_SESSIONS);

    store.put(link);

    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"));
        tx.onabort = () => reject(new Error("Transaction aborted"));
    });

    console.log("[capturesDb] Linked session to project:", link.id);
}

/**
 * List all project-session links for a given project
 * Throws on error (validation or DB failure)
 */
export async function listProjectSessionsByProject(projectId: string): Promise<ProjectSessionLinkRecord[]> {
    if (!projectId || typeof projectId !== "string") {
        throw new Error("projectId is required");
    }

    const db = await openDb();
    const tx = db.transaction(STORE_PROJECT_SESSIONS, "readonly");
    const store = tx.objectStore(STORE_PROJECT_SESSIONS);
    const index = store.index("byProjectId");

    return new Promise((resolve, reject) => {
        const request = index.getAll(projectId);

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => reject(request.error ?? new Error("Failed to list project sessions"));
    });
}

/**
 * List session IDs for a given project (sorted by linkedAt ascending)
 * Read-only helper for aggregating captures across project sessions
 */
export async function listSessionIdsForProject(projectId: string): Promise<string[]> {
    if (!projectId || typeof projectId !== "string") {
        throw new Error("projectId is required");
    }

    const db = await openDb();
    const tx = db.transaction(STORE_PROJECT_SESSIONS, "readonly");
    const store = tx.objectStore(STORE_PROJECT_SESSIONS);
    const index = store.index("byProjectId");

    return new Promise((resolve, reject) => {
        const request = index.getAll(projectId);

        request.onsuccess = () => {
            const links: ProjectSessionLinkRecord[] = request.result || [];
            // Sort by linkedAt ascending, then extract sessionIds
            const sessionIds = links
                .sort((a, b) => a.linkedAt - b.linkedAt)
                .map(link => link.sessionId);
            resolve(sessionIds);
        };

        request.onerror = () => reject(request.error ?? new Error("Failed to list session IDs for project"));
    });
}

/**
 * List captures across multiple sessions (sorted by createdAt ascending)
 * Read-only helper for aggregating captures from multiple sessions
 */
export async function listCapturesBySessionIds(sessionIds: string[]): Promise<CaptureRecordV2[]> {
    if (!Array.isArray(sessionIds)) {
        throw new Error("sessionIds must be an array");
    }

    const allCaptures: CaptureRecordV2[] = [];

    for (const sessionId of sessionIds) {
        const captures = await listCapturesBySession(sessionId);
        allCaptures.push(...captures);
    }

    // Sort by createdAt ascending if available
    allCaptures.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    return allCaptures;
}

/**
 * Get total count of captures across all sessions linked to a project.
 * Used for displaying component counts on StartScreen project cards.
 */
export async function getProjectCaptureCount(projectId: string): Promise<number> {
    if (!projectId || typeof projectId !== "string") {
        throw new Error("projectId is required");
    }

    // Get all session IDs linked to this project
    const sessionIds = await listSessionIdsForProject(projectId);

    if (sessionIds.length === 0) {
        return 0;
    }

    // Count captures across all sessions
    let totalCount = 0;
    for (const sessionId of sessionIds) {
        const captures = await listCapturesBySession(sessionId);
        totalCount += captures.length;
    }

    return totalCount;
}

// ─────────────────────────────────────────────────────────────
// Annotations (7.7.1: Notes + Tags)
// ─────────────────────────────────────────────────────────────

/**
 * Get annotation for a specific (projectId, componentKey)
 * Returns null if no annotation exists
 */
export async function getAnnotation(
    projectId: string,
    componentKey: string
): Promise<AnnotationRecord | null> {
    if (!projectId || !componentKey) {
        throw new Error("projectId and componentKey are required");
    }

    try {
        const db = await openDb();
        const tx = db.transaction(STORE_ANNOTATIONS, "readonly");
        const store = tx.objectStore(STORE_ANNOTATIONS);
        
        const id = `${projectId}:${componentKey}`;
        const request = store.get(id);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error("[capturesDb] Failed to get annotation:", err);
        return null;
    }
}

/**
 * List all annotations for a project
 * Returns empty array if none found or on error
 */
export async function listAnnotationsForProject(projectId: string): Promise<AnnotationRecord[]> {
    if (!projectId) {
        throw new Error("projectId is required");
    }

    try {
        const db = await openDb();
        const tx = db.transaction(STORE_ANNOTATIONS, "readonly");
        const store = tx.objectStore(STORE_ANNOTATIONS);
        const index = store.index("byProject");

        return new Promise((resolve, reject) => {
            const request = index.getAll(projectId);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error("[capturesDb] Failed to list annotations for project:", err);
        return [];
    }
}

/**
 * Upsert annotation (insert or update)
 * 7.7.2: Write support for annotations
 */
export async function upsertAnnotation(input: {
    projectId: string;
    componentKey: string;
    notes: string | null;
    tags: string[];
}): Promise<void> {
    if (!input.projectId || !input.componentKey) {
        throw new Error("projectId and componentKey are required");
    }

    const db = await openDb();
    const tx = db.transaction(STORE_ANNOTATIONS, "readwrite");
    const store = tx.objectStore(STORE_ANNOTATIONS);

    const record: AnnotationRecord = {
        id: `${input.projectId}:${input.componentKey}`,
        projectId: input.projectId,
        componentKey: input.componentKey,
        notes: input.notes || "",
        tags: input.tags || [],
        updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete annotation
 * 7.7.2: Write support for annotations
 */
export async function deleteAnnotation(
    projectId: string,
    componentKey: string
): Promise<void> {
    if (!projectId || !componentKey) {
        throw new Error("projectId and componentKey are required");
    }

    const db = await openDb();
    const tx = db.transaction(STORE_ANNOTATIONS, "readwrite");
    const store = tx.objectStore(STORE_ANNOTATIONS);

    const id = `${projectId}:${componentKey}`;

    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ─────────────────────────────────────────────────────────────
// Component Overrides (projectId + componentKey)
// ─────────────────────────────────────────────────────────────

export async function getComponentOverride(
    projectId: string,
    componentKey: string
): Promise<ComponentOverrideRecord | null> {
    if (!projectId || !componentKey) {
        throw new Error("projectId and componentKey are required");
    }

    const db = await openDb();
    const tx = db.transaction(STORE_COMPONENT_OVERRIDES, "readonly");
    const store = tx.objectStore(STORE_COMPONENT_OVERRIDES);
    const id = `${projectId}:${componentKey}`;

    return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve((request.result as ComponentOverrideRecord) || null);
        request.onerror = () => reject(request.error);
    });
}

export async function listComponentOverridesForProject(projectId: string): Promise<ComponentOverrideRecord[]> {
    if (!projectId) {
        return [];
    }

    const db = await openDb();
    const tx = db.transaction(STORE_COMPONENT_OVERRIDES, "readonly");
    const store = tx.objectStore(STORE_COMPONENT_OVERRIDES);
    const index = store.index("byProject");

    return new Promise((resolve, reject) => {
        const request = index.getAll(projectId);
        request.onsuccess = () => resolve((request.result as ComponentOverrideRecord[]) || []);
        request.onerror = () => reject(request.error);
    });
}

export async function upsertComponentOverride(input: {
    projectId: string;
    componentKey: string;
    displayName?: string | null;
    categoryOverride?: string | null;
    typeOverride?: string | null;
    statusOverride?: string | null;
}): Promise<void> {
    if (!input.projectId || !input.componentKey) {
        throw new Error("projectId and componentKey are required");
    }

    const db = await openDb();
    const tx = db.transaction(STORE_COMPONENT_OVERRIDES, "readwrite");
    const store = tx.objectStore(STORE_COMPONENT_OVERRIDES);

    const record: ComponentOverrideRecord = {
        id: `${input.projectId}:${input.componentKey}`,
        projectId: input.projectId,
        componentKey: input.componentKey,
        displayName: input.displayName ?? null,
        categoryOverride: input.categoryOverride ?? null,
        typeOverride: input.typeOverride ?? null,
        statusOverride: input.statusOverride ?? null,
        updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function deleteComponentOverride(
    projectId: string,
    componentKey: string
): Promise<void> {
    if (!projectId || !componentKey) {
        throw new Error("projectId and componentKey are required");
    }

    const db = await openDb();
    const tx = db.transaction(STORE_COMPONENT_OVERRIDES, "readwrite");
    const store = tx.objectStore(STORE_COMPONENT_OVERRIDES);
    const id = `${projectId}:${componentKey}`;

    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ─────────────────────────────────────────────────────────────
// Draft Captures (7.8)
// ─────────────────────────────────────────────────────────────

/**
 * List draft captures for a project (isDraft = true)
 * 7.8: Draft until Save
 */
export async function listDraftCapturesForProject(projectId: string): Promise<CaptureRecordV2[]> {
    if (!projectId) {
        return [];
    }

    const db = await openDb();
    const tx = db.transaction(STORE_CAPTURES, "readonly");
    const store = tx.objectStore(STORE_CAPTURES);

    return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
            const allCaptures = request.result as CaptureRecordV2[];
            // Filter for drafts belonging to this project
            const drafts = allCaptures.filter(
                (cap) => cap.projectId === projectId && cap.isDraft === true
            );
            resolve(drafts);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * List saved (non-draft) captures for a project
 * 7.8: Draft until Save
 */
export async function listSavedCapturesForProject(projectId: string): Promise<CaptureRecordV2[]> {
    if (!projectId) {
        return [];
    }

    const db = await openDb();
    const tx = db.transaction(STORE_CAPTURES, "readonly");
    const store = tx.objectStore(STORE_CAPTURES);

    return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
            const allCaptures = request.result as CaptureRecordV2[];
            // Filter for saved (non-draft) captures belonging to this project
            const saved = allCaptures.filter(
                (cap) => cap.projectId === projectId && cap.isDraft !== true
            );
            resolve(saved);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Commit draft capture to saved (set isDraft = false)
 * 7.8: Draft until Save
 */
export async function commitDraftCapture(captureId: string): Promise<void> {
    if (!captureId) {
        throw new Error("captureId is required");
    }

    const db = await openDb();
    const tx = db.transaction(STORE_CAPTURES, "readwrite");
    const store = tx.objectStore(STORE_CAPTURES);

    return new Promise((resolve, reject) => {
        const getRequest = store.get(captureId);

        getRequest.onsuccess = () => {
            const capture = getRequest.result as CaptureRecordV2 | undefined;
            if (!capture) {
                reject(new Error(`Capture ${captureId} not found`));
                return;
            }

            // Set isDraft to false (or delete the field)
            capture.isDraft = false;

            const putRequest = store.put(capture);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
}
