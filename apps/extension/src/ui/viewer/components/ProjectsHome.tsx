import type { ViewerProject } from "../types/projectViewerTypes";

// ─────────────────────────────────────────────────────────────
// ProjectsHome Component
// ─────────────────────────────────────────────────────────────

export function ProjectsHome({
    projects,
    onSelectProject,
}: {
    projects: ViewerProject[];
    onSelectProject: (projectId: string) => void;
}) {
    return (
        <div style={{
            maxWidth: 800,
            margin: "0 auto",
            padding: "48px 24px",
        }}>
            <h1 style={{
                fontSize: 32,
                fontWeight: 600,
                margin: "0 0 8px 0",
                color: "hsl(var(--foreground))",
            }}>
                UI Audit Tool
            </h1>
            <p style={{
                fontSize: 16,
                color: "hsl(var(--muted-foreground))",
                margin: "0 0 48px 0",
            }}>
                Review and organize your captured UI components
            </p>

            <h2 style={{
                fontSize: 20,
                fontWeight: 600,
                margin: "0 0 16px 0",
                color: "hsl(var(--foreground))",
            }}>
                Projects
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {projects.map((project) => (
                    <button
                        key={project.id}
                        onClick={() => onSelectProject(project.id)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "16px 20px",
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "calc(var(--radius) + 2px)",
                            cursor: "pointer",
                            textAlign: "left",
                        }}
                    >
                        <div>
                            <div style={{
                                fontSize: 16,
                                fontWeight: 500,
                                color: "hsl(var(--foreground))",
                                marginBottom: 4,
                            }}>
                                {project.name}
                            </div>
                            <div style={{
                                fontSize: 13,
                                color: "hsl(var(--muted-foreground))",
                            }}>
                                {project.updatedAtLabel} • {project.captureCount} captures
                            </div>
                        </div>
                        <div style={{
                            color: "hsl(var(--muted-foreground))",
                            fontSize: 20,
                        }}>
                            ›
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
