import { useEffect, useState, type ChangeEvent } from "react";

interface Project {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
}

function sendMessageAsync<T, R>(msg: T): Promise<R> {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(msg, (resp) => {
            const err = chrome.runtime.lastError;
            if (err) reject(err);
            else resolve(resp as R);
        });
    });
}

export function SidePanelAppLegacy() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [newProjectName, setNewProjectName] = useState("");
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const [auditEnabled, setAuditEnabled] = useState<boolean | null>(null);
    const [auditLoading, setAuditLoading] = useState(false);

    const loadProjects = async () => {
        setError("");
        try {
            const resp = await sendMessageAsync<{ type: string }, any>({
                type: "UI/LIST_PROJECTS",
            });
            if (resp?.ok && Array.isArray(resp.projects)) {
                setProjects(resp.projects);
            } else {
                setError("Failed to load projects");
            }
        } catch (err: any) {
            setError(err?.message || "Failed to load projects");
        }
    };

    const loadAuditState = async () => {
        try {
            const resp = await sendMessageAsync<{ type: string }, any>({
                type: "AUDIT/GET_STATE",
            });
            if (typeof resp?.enabled === "boolean") {
                setAuditEnabled(resp.enabled);
            } else {
                setAuditEnabled(null);
                setError("Could not read capture mode state. Refresh the page and try again.");
            }
        } catch (err: any) {
            setAuditEnabled(null);
            setError("Could not read capture mode state. Refresh the page and try again.");
        }
    };

    useEffect(() => {
        loadProjects();
        loadAuditState();
    }, []);

    const handleCreate = async () => {
        const name = newProjectName.trim();
        if (!name) {
            setError("Project name is required");
            return;
        }

        setError("");
        setStatus("");

        try {
            const resp = await sendMessageAsync<{ type: string; name: string }, any>({
                type: "UI/CREATE_PROJECT",
                name,
            });

            if (resp?.ok && resp.project) {
                await loadProjects();
                setNewProjectName("");

                // Set as active project for current audit tab
                const setResp = await sendMessageAsync<
                    { type: string; projectId: string },
                    any
                >({
                    type: "UI/SET_ACTIVE_PROJECT_FOR_TAB",
                    projectId: resp.project.id,
                });

                if (setResp?.ok) {
                    setStatus("Active project set.");
                } else {
                    setError(setResp?.error || "Failed to set active project");
                }
            } else {
                setError(resp?.error || "Failed to create project");
            }
        } catch (err: any) {
            setError(err?.message || "Failed to create project");
        }
    };

    const handleSelectChange = async (e: ChangeEvent<HTMLSelectElement>) => {
        const projectId = e.target.value;
        setSelectedProjectId(projectId);

        if (!projectId) return;

        setError("");
        setStatus("");

        try {
            const resp = await sendMessageAsync<{ type: string; projectId: string }, any>({
                type: "UI/SET_ACTIVE_PROJECT_FOR_TAB",
                projectId,
            });

            if (resp?.ok) {
                setStatus("Active project set.");
            } else {
                setError(resp?.error || "Failed to set active project");
            }
        } catch (err: any) {
            setError(err?.message || "Failed to set active project");
        }
    };

    const handleToggleAudit = async () => {
        if (typeof auditEnabled !== "boolean") return;

        const nextEnabled = !auditEnabled;
        setAuditLoading(true);
        setError("");
        setStatus("");

        try {
            const resp = await sendMessageAsync<{ type: string; enabled: boolean }, any>({
                type: "AUDIT/TOGGLE",
                enabled: nextEnabled,
            });

            if (resp?.ok) {
                await loadAuditState();
                setStatus(nextEnabled ? "Capture mode enabled." : "Capture mode disabled.");
            } else {
                setError(resp?.error || "Failed to toggle capture mode");
            }
        } catch (err: any) {
            setError(err?.message || "Failed to toggle capture mode");
        } finally {
            setAuditLoading(false);
        }
    };

    return (
        <div style={{ padding: 16, fontFamily: "system-ui" }}>
            <h1 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>UI Audit</h1>

            {/* Capture mode toggle */}
            <div style={{ marginBottom: 16 }}>
                <label
                    style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        marginBottom: 6,
                    }}
                >
                    Capture mode
                </label>
                <button
                    onClick={handleToggleAudit}
                    disabled={auditLoading || auditEnabled === null}
                    style={{
                        width: "100%",
                        padding: "6px 12px",
                        fontSize: 13,
                        fontWeight: 500,
                        background: auditEnabled ? "#dc2626" : "#059669",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: auditLoading || auditEnabled === null ? "not-allowed" : "pointer",
                        opacity: auditLoading || auditEnabled === null ? 0.6 : 1,
                    }}
                >
                    {auditLoading
                        ? "Loading..."
                        : auditEnabled
                        ? "Disable capture mode"
                        : "Enable capture mode"}
                </button>
            </div>

            {/* Create project */}
            <div style={{ marginBottom: 16 }}>
                <label
                    style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        marginBottom: 6,
                    }}
                >
                    Create project
                </label>
                <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    style={{
                        width: "100%",
                        padding: "6px 8px",
                        fontSize: 13,
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        marginBottom: 8,
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreate();
                    }}
                />
                <button
                    onClick={handleCreate}
                    disabled={!newProjectName.trim()}
                    style={{
                        width: "100%",
                        padding: "6px 12px",
                        fontSize: 13,
                        fontWeight: 500,
                        background: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: newProjectName.trim() ? "pointer" : "not-allowed",
                        opacity: newProjectName.trim() ? 1 : 0.6,
                    }}
                >
                    Create
                </button>
            </div>

            {/* Continue in project */}
            {projects.length > 0 ? (
                <div style={{ marginBottom: 16 }}>
                    <label
                        style={{
                            display: "block",
                            fontSize: 13,
                            fontWeight: 500,
                            marginBottom: 6,
                        }}
                    >
                        Continue in project
                    </label>
                    <select
                        value={selectedProjectId}
                        onChange={handleSelectChange}
                        style={{
                            width: "100%",
                            padding: "6px 8px",
                            fontSize: 13,
                            border: "1px solid #d1d5db",
                            borderRadius: 4,
                        }}
                    >
                        <option value="">Select a project…</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </div>
            ) : (
                <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
                    No projects yet — create one to start.
                </p>
            )}

            {/* Status */}
            {status && (
                <p style={{ fontSize: 12, color: "#059669", margin: "0 0 8px" }}>{status}</p>
            )}

            {/* Error */}
            {error && (
                <p style={{ fontSize: 12, color: "#dc2626", margin: "0 0 8px" }}>{error}</p>
            )}
        </div>
    );
}
