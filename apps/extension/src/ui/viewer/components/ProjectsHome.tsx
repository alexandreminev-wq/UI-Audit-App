import type { KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import { Folder, Clock } from "lucide-react";
import type { ViewerProject } from "../types/projectViewerTypes";

// ─────────────────────────────────────────────────────────────
// ProjectsHome Component
// ─────────────────────────────────────────────────────────────

export function ProjectsHome({
    projects,
    onSelectProject,
    onDeleteProject,
}: {
    projects: ViewerProject[];
    onSelectProject: (projectId: string) => void;
    onDeleteProject: (projectId: string) => Promise<void>;
}) {
    const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);
    const [confirmProject, setConfirmProject] = useState<ViewerProject | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Close menu when clicking outside
    useEffect(() => {
        if (!openMenuProjectId) return;

        const onMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && target.closest("[data-project-menu-root='true']")) {
                return;
            }
            setOpenMenuProjectId(null);
        };

        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, [openMenuProjectId]);

    const handleKeyDown = (e: KeyboardEvent, action: () => void) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            action();
        }
    };

    const requestDelete = (project: ViewerProject) => {
        setDeleteError(null);
        setConfirmProject(project);
        setOpenMenuProjectId(null);
    };

    const confirmDelete = async () => {
        if (!confirmProject) return;
        setIsDeleting(true);
        setDeleteError(null);
        try {
            await onDeleteProject(confirmProject.id);
            setConfirmProject(null);
        } catch (err) {
            setDeleteError(String(err));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Header */}
            <div style={{
                padding: "16px 24px",
                borderBottom: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
            }}>
                <div style={{ maxWidth: 800, margin: "0 auto" }}>
                    <h1 style={{
                        fontSize: 16,
                        fontWeight: 500,
                        margin: 0,
                        color: "hsl(var(--foreground))",
                    }}>
                        UI Audit Tool
                    </h1>
                </div>
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                overflow: "auto",
                padding: "32px 24px",
            }}>
                <div style={{ maxWidth: 800, margin: "0 auto" }}>
                    {/* Section header with icon */}
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <Folder size={20} strokeWidth={1.5} style={{ color: "hsl(var(--muted-foreground))" }} />
                            <h2 style={{
                                fontSize: 16,
                                fontWeight: 600,
                                margin: 0,
                                color: "hsl(var(--foreground))",
                            }}>
                                Projects
                            </h2>
                        </div>
                        <p style={{
                            fontSize: 14,
                            color: "hsl(var(--muted-foreground))",
                            margin: "0 0 0 28px",
                        }}>
                            Review and organize your captured UI components
                        </p>
                    </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {projects.map((project) => (
                    <div
                        key={project.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectProject(project.id)}
                        onKeyDown={(e) => handleKeyDown(e, () => onSelectProject(project.id))}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "20px 24px",
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                            cursor: "pointer",
                            textAlign: "left",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                            <div data-project-menu-root="true" style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                <button
                                    type="button"
                                    aria-label={`Project actions for ${project.name}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setOpenMenuProjectId((prev) => (prev === project.id ? null : project.id));
                                    }}
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 8,
                                        border: "1px solid hsl(var(--border))",
                                        background: "hsl(var(--background))",
                                        color: "hsl(var(--muted-foreground))",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 18,
                                        lineHeight: "18px",
                                    }}
                                >
                                    ⋯
                                </button>

                                {openMenuProjectId === project.id && (
                                    <div
                                        data-project-menu-root="true"
                                        style={{
                                            position: "absolute",
                                            top: 34,
                                            left: 0,
                                            zIndex: 10,
                                            minWidth: 180,
                                            background: "hsl(var(--popover))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "var(--radius)",
                                            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                                            padding: 6,
                                        }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => requestDelete(project)}
                                            style={{
                                                width: "100%",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "8px 10px",
                                                borderRadius: "calc(var(--radius) - 2px)",
                                                border: "none",
                                                background: "transparent",
                                                color: "hsl(var(--destructive))",
                                                cursor: "pointer",
                                                fontSize: 13,
                                                fontWeight: 500,
                                            }}
                                        >
                                            <span>Delete project…</span>
                                            <span aria-hidden>⌫</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <div style={{
                                    fontSize: 15,
                                    fontWeight: 500,
                                    color: "hsl(var(--foreground))",
                                    marginBottom: 8,
                                }}>
                                    {project.name}
                                </div>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 13,
                                    color: "hsl(var(--muted-foreground))",
                                }}>
                                    <Clock size={14} strokeWidth={1.5} />
                                    <span>{project.updatedAtLabel}</span>
                                </div>
                            </div>
                        </div>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            fontSize: 14,
                            color: "hsl(var(--muted-foreground))",
                        }}>
                            <span>{project.captureCount} captures</span>
                            <span style={{ fontSize: 20 }}>›</span>
                        </div>
                    </div>
                ))}
            </div>
                </div>
            </div>

            {confirmProject && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Delete project confirmation"
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 50,
                        background: "rgba(0,0,0,0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 24,
                    }}
                    onClick={() => {
                        if (isDeleting) return;
                        setConfirmProject(null);
                    }}
                >
                    <div
                        style={{
                            width: "100%",
                            maxWidth: 520,
                            background: "hsl(var(--background))",
                            borderRadius: "calc(var(--radius) + 4px)",
                            border: "1px solid hsl(var(--border))",
                            padding: 16,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: "hsl(var(--foreground))" }}>
                            Delete project “{confirmProject.name}”?
                        </div>
                        <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>
                            This permanently deletes captures, screenshots, drafts, notes/tags, and identity overrides for this project.
                            This can’t be undone.
                        </div>

                        {deleteError && (
                            <div style={{ marginTop: 10, fontSize: 13, color: "hsl(var(--destructive))" }}>
                                {deleteError}
                            </div>
                        )}

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => setConfirmProject(null)}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: "var(--radius)",
                                    border: "1px solid hsl(var(--border))",
                                    background: "hsl(var(--background))",
                                    color: "hsl(var(--foreground))",
                                    cursor: isDeleting ? "not-allowed" : "pointer",
                                    fontSize: 13,
                                    fontWeight: 500,
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={confirmDelete}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: "var(--radius)",
                                    border: "1px solid hsl(var(--destructive))",
                                    background: "hsl(var(--destructive))",
                                    color: "hsl(var(--destructive-foreground))",
                                    cursor: isDeleting ? "not-allowed" : "pointer",
                                    fontSize: 13,
                                    fontWeight: 600,
                                }}
                            >
                                {isDeleting ? "Deleting…" : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
