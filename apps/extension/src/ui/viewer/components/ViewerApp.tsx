import { useState, useEffect } from "react";
import { ProjectsHome } from "./ProjectsHome";
import { ProjectViewShell } from "./ProjectViewShell";
import { LegacySessionsViewer } from "./LegacySessionsViewer";
import type { ViewerRoute, ViewerProject, ViewerComponent, ViewerStyle } from "../types/projectViewerTypes";
import { deriveProjectsIndexFromStorage, deriveComponentInventory, deriveStyleInventory } from "../adapters/deriveViewerModels";

// ─────────────────────────────────────────────────────────────
// URL navigation helpers (Milestone 7.2.1)
// ─────────────────────────────────────────────────────────────

function getSelectedProjectIdFromUrl(): string | null {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("project");
    return projectId && projectId.trim() !== "" ? projectId : null;
}

function setSelectedProjectIdInUrl(id: string | null): void {
    const url = new URL(window.location.href);
    if (id === null) {
        url.searchParams.delete("project");
    } else {
        url.searchParams.set("project", id);
    }
    window.history.pushState({}, "", url.pathname + url.search + url.hash);
}

// ─────────────────────────────────────────────────────────────
// ViewerApp Component
// ─────────────────────────────────────────────────────────────

export function ViewerApp() {
    // Milestone 7.2.1: Routing state (initialized from URL)
    const [route, setRoute] = useState<ViewerRoute>(() => {
        const projectId = getSelectedProjectIdFromUrl();
        return projectId ? "project" : "projects";
    });
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
        return getSelectedProjectIdFromUrl();
    });

    // Milestone 7.4.0: Load real projects from IndexedDB
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState<string | null>(null);
    const [projects, setProjects] = useState<ViewerProject[]>([]);

    // Milestone 7.4.1: Load components for selected project
    const [componentsLoading, setComponentsLoading] = useState(false);
    const [componentsError, setComponentsError] = useState<string | null>(null);
    const [components, setComponents] = useState<ViewerComponent[]>([]);

    // Milestone 7.4.2: Load styles for selected project (derived from same captures)
    const [styles, setStyles] = useState<ViewerStyle[]>([]);

    // Milestone 7.4.0: Load projects on mount
    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                if (!isMounted) return;
                setProjectsError(null);
                setProjectsLoading(true);
                const response = await chrome.runtime.sendMessage({ type: "UI/LIST_PROJECTS" });
                if (!isMounted) return;
                if (response && response.ok) {
                    const derived = deriveProjectsIndexFromStorage({ projects: response.projects });
                    setProjects(derived);
                } else {
                    setProjectsError(response?.error || "Failed to load projects");
                }
            } catch (err) {
                if (!isMounted) return;
                setProjectsError(String(err));
            } finally {
                if (!isMounted) return;
                setProjectsLoading(false);
            }
        })();
        return () => {
            isMounted = false;
        };
    }, []);

    // Milestone 7.4.0: Validate selectedProjectId against loaded projects
    useEffect(() => {
        if (!projectsLoading && selectedProjectId) {
            const projectExists = projects.some((p) => p.id === selectedProjectId);
            if (!projectExists) {
                // Invalid project ID in URL, redirect to projects home
                setRoute("projects");
                setSelectedProjectId(null);
                setSelectedProjectIdInUrl(null);
            }
        }
    }, [projectsLoading, projects, selectedProjectId]);

    // Milestone 7.4.1+7.4.2: Load components and styles when selectedProjectId changes
    useEffect(() => {
        if (!selectedProjectId) {
            // No project selected, clear data
            setComponents([]);
            setStyles([]);
            setComponentsError(null);
            return;
        }

        let isMounted = true;
        (async () => {
            try {
                if (!isMounted) return;
                setComponentsError(null);
                setComponentsLoading(true);

                const response = await chrome.runtime.sendMessage({
                    type: "UI/GET_PROJECT_DETAIL",
                    projectId: selectedProjectId,
                });

                if (!isMounted) return;

                if (response && response.ok) {
                    // 7.4.1: Derive components
                    const derivedComponents = deriveComponentInventory(response.captures);
                    setComponents(derivedComponents);

                    // 7.4.2: Derive styles from same captures
                    const derivedStyles = deriveStyleInventory(response.captures);
                    setStyles(derivedStyles);
                } else {
                    setComponentsError(response?.error || "Failed to load project data");
                }
            } catch (err) {
                if (!isMounted) return;
                setComponentsError(String(err));
            } finally {
                if (!isMounted) return;
                setComponentsLoading(false);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [selectedProjectId]);

    // Handle browser back/forward buttons (Milestone 7.2.1)
    useEffect(() => {
        const handlePopState = () => {
            const projectId = getSelectedProjectIdFromUrl();
            if (projectId) {
                setRoute("project");
                setSelectedProjectId(projectId);
            } else {
                setRoute("projects");
                setSelectedProjectId(null);
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, []);

    // Milestone 7.4.0: Loading state
    if (projectsLoading) {
        return (
            <div style={{ padding: "2rem", textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
                Loading projects...
            </div>
        );
    }

    // Milestone 7.4.0: Error state
    if (projectsError) {
        return (
            <div style={{ padding: "2rem", textAlign: "center" }}>
                <div style={{ color: "hsl(var(--destructive))", marginBottom: "0.5rem" }}>
                    Failed to load projects
                </div>
                <div style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.875rem" }}>
                    {projectsError}
                </div>
            </div>
        );
    }

    // Milestone 7.4.0: Empty state
    if (projects.length === 0) {
        return (
            <div style={{ padding: "2rem", textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
                No projects found. Create a project to get started.
            </div>
        );
    }

    // Milestone 7.2.1: Route to Projects or Project view
    if (route === "projects") {
        return (
            <ProjectsHome
                projects={projects}
                onSelectProject={(projectId) => {
                    setSelectedProjectId(projectId);
                    setRoute("project");
                    setSelectedProjectIdInUrl(projectId);
                }}
            />
        );
    }

    if (route === "project") {
        // Safe fallback: if selectedProjectId is missing, show projects home
        if (!selectedProjectId) {
            return <ProjectsHome projects={projects} onSelectProject={(projectId) => { setSelectedProjectId(projectId); setRoute("project"); setSelectedProjectIdInUrl(projectId); }} />;
        }
        const project = projects.find((p) => p.id === selectedProjectId);
        return (
            <ProjectViewShell
                projectName={project?.name || "Unknown Project"}
                components={components}
                componentsLoading={componentsLoading}
                componentsError={componentsError}
                styleItems={styles}
                onBack={() => {
                    setRoute("projects");
                    setSelectedProjectId(null);
                    setSelectedProjectIdInUrl(null);
                }}
            />
        );
    }

    // Old sessions UI below (temporarily unreachable, will be removed in later slices)
    return <LegacySessionsViewer />;
}
