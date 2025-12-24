/**
 * IndexedDB helper for persisting captures, sessions, blobs, projects, and project-session links
 *
 * DB: ui-inventory
 * Version: 3 (v2.2 schema + projects)
 * Stores:
 *   - captures (keyPath: id, indexes: byCreatedAt, byUrl)
 *   - sessions (keyPath: id, indexes: byCreatedAt, byStartUrl)
 *   - blobs (keyPath: id, indexes: byCreatedAt)
 *   - projects (keyPath: id, indexes: byUpdatedAt, byCreatedAt)
 *   - projectSessions (keyPath: id, indexes: byProjectId, bySessionId)
 */

import type { CaptureRecord, CaptureRecordV2, SessionRecord, BlobRecord } from "../types/capture";

const DB_NAME = "ui-inventory";
const DB_VERSION = 3;
const STORE_CAPTURES = "captures";
const STORE_SESSIONS = "sessions";
const STORE_BLOBS = "blobs";
const STORE_PROJECTS = "projects";
const STORE_PROJECT_SESSIONS = "projectSessions";

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
