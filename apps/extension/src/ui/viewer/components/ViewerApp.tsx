import { useState, useEffect } from "react";
import { ProjectsHome } from "./ProjectsHome";
import { ProjectViewShell } from "./ProjectViewShell";
import { LegacySessionsViewer } from "./LegacySessionsViewer";
import type { ViewerRoute, ViewerProject, ViewerComponent, ViewerStyle } from "../types/projectViewerTypes";
import type { CaptureRecordV2 } from "../../../types/capture";
import type { AnnotationRecord } from "../../../background/capturesDb";
import { deriveProjectsIndexFromStorage, deriveComponentInventory, deriveStyleInventory, scopeCapturesToProject } from "../adapters/deriveViewerModels";

type ComponentOverrideRecord = {
    projectId: string;
    componentKey: string;
    displayName: string | null;
    categoryOverride: string | null;
    typeOverride: string | null;
    statusOverride: string | null;
    updatedAt: number;
};

// ─────────────────────────────────────────────────────────────
// DEV-only logging helpers (7.4.4)
// ─────────────────────────────────────────────────────────────

const isDev = import.meta?.env?.DEV ?? false;
const devLog = (...args: unknown[]) => { if (isDev) console.log(...args); };
const devWarn = (...args: unknown[]) => { if (isDev) console.warn(...args); };

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

    // Milestone 7.4.3: Store raw captures for drawer derivation
    const [rawCaptures, setRawCaptures] = useState<CaptureRecordV2[]>([]);

    // 7.7.1: Annotations (Notes + Tags)
    const [annotations, setAnnotations] = useState<AnnotationRecord[]>([]);
    const [overrides, setOverrides] = useState<ComponentOverrideRecord[]>([]);

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

    // Milestone 7.4.1+7.4.2+7.4.3: Load components, styles, and raw captures when selectedProjectId changes
    useEffect(() => {
        if (!selectedProjectId) {
            // No project selected, clear data
            setComponents([]);
            setStyles([]);
            setRawCaptures([]);
            setAnnotations([]); // 7.7.1: Clear annotations
            setOverrides([]);
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
                    // 7.4.4: Harden array handling
                    const loadedCaptures = Array.isArray(response.captures) ? response.captures : [];

                    // 7.4.4: Enforce project scoping at choke point
                    const scopedCaptures = scopeCapturesToProject(loadedCaptures, selectedProjectId);

                    // 7.4.4: DEV-only scoping guardrail logging
                    const missingProjectIdCount = loadedCaptures.filter((c: CaptureRecordV2) => c.projectId === undefined).length;
                    const droppedCount = loadedCaptures.length - scopedCaptures.length;

                    // Always log project detail load (DEV only)
                    devLog("[UI Inventory Viewer] Project detail loaded", {
                        projectId: selectedProjectId,
                        capturesLoaded: loadedCaptures.length,
                        capturesScoped: scopedCaptures.length,
                        missingProjectIdCount,
                    });

                    // Warn if captures were dropped due to projectId mismatch
                    if (droppedCount > 0) {
                        const mismatchSample = loadedCaptures.find(
                            (c: CaptureRecordV2) => c.projectId !== undefined && c.projectId !== selectedProjectId
                        );
                        devWarn("[UI Inventory Viewer] Project scoping dropped captures", {
                            projectId: selectedProjectId,
                            droppedCount,
                            sampleMismatch: mismatchSample ? { id: mismatchSample.id, projectId: mismatchSample.projectId } : null,
                        });
                    }

                    // Warn if captures loaded but none remain after scoping
                    if (loadedCaptures.length > 0 && scopedCaptures.length === 0) {
                        devWarn("[UI Inventory Viewer] Scoping mismatch: captures loaded but none matched project", {
                            projectId: selectedProjectId,
                            loadedCount: loadedCaptures.length,
                        });
                    }

                    // 7.4.3: Store scoped captures for drawer derivation
                    setRawCaptures(scopedCaptures);

                    // 7.4.1: Derive components from scoped captures
                    const derivedComponents = deriveComponentInventory(scopedCaptures);

                    // 7.7.1: Load annotations for this project
                    const annotationsResponse = await chrome.runtime.sendMessage({
                        type: "ANNOTATIONS/GET_PROJECT",
                        projectId: selectedProjectId,
                    });

                    const overridesResponse = await chrome.runtime.sendMessage({
                        type: "OVERRIDES/GET_PROJECT",
                        projectId: selectedProjectId,
                    });

                    if (!isMounted) return;

                    let annotatedComponents = derivedComponents;

                    if (annotationsResponse && annotationsResponse.ok) {
                        const loadedAnnotations = Array.isArray(annotationsResponse.annotations)
                            ? annotationsResponse.annotations
                            : [];
                        setAnnotations(loadedAnnotations);

                        // 7.7.2: Merge annotations NON-MUTATING (map instead of for-loop)
                        const annotationsMap = new Map(
                            loadedAnnotations.map((a: AnnotationRecord) => [a.componentKey, a])
                        );

                        annotatedComponents = derivedComponents.map(component => {
                            const annotation = annotationsMap.get(component.id);
                            if (annotation) {
                                return {
                                    ...component,
                                    notes: annotation.notes || null,
                                    tags: annotation.tags || [],
                                };
                            }
                            return component;
                        });

                        devLog("[UI Inventory Viewer] Loaded annotations", {
                            projectId: selectedProjectId,
                            annotationsCount: loadedAnnotations.length,
                        });
                    } else {
                        // Non-fatal: annotations are optional
                        devWarn("[UI Inventory Viewer] Failed to load annotations", {
                            error: annotationsResponse?.error,
                        });
                        setAnnotations([]);
                    }

                    const loadedOverrides: ComponentOverrideRecord[] =
                        overridesResponse && overridesResponse.ok && Array.isArray(overridesResponse.overrides)
                            ? overridesResponse.overrides
                            : [];
                    setOverrides(loadedOverrides);

                    const overridesMap = new Map(
                        loadedOverrides.map((o) => [o.componentKey, o])
                    );

                    const mergedComponents: ViewerComponent[] = annotatedComponents.map((component) => {
                        const o = overridesMap.get(component.id);
                        if (!o) return component;

                        const name = (o.displayName && o.displayName.trim() !== "") ? o.displayName : component.name;
                        const category = (o.categoryOverride && o.categoryOverride.trim() !== "") ? o.categoryOverride : component.category;
                        const type = (o.typeOverride && o.typeOverride.trim() !== "") ? o.typeOverride : component.type;
                        const status = (o.statusOverride && o.statusOverride.trim() !== "") ? (o.statusOverride as any) : component.status;

                        return {
                            ...component,
                            name,
                            category,
                            type,
                            status,
                            overrides: {
                                displayName: o.displayName ?? null,
                                categoryOverride: o.categoryOverride ?? null,
                                typeOverride: o.typeOverride ?? null,
                                statusOverride: o.statusOverride ?? null,
                            },
                        };
                    });

                    setComponents(mergedComponents);

                    // 7.4.2: Derive styles from scoped captures
                    const derivedStyles = deriveStyleInventory(scopedCaptures);
                    setStyles(derivedStyles);

                    // DEV: Log derivation results
                    devLog("[UI Inventory Viewer] Derived inventories", {
                        componentsCount: derivedComponents.length,
                        stylesCount: derivedStyles.length,
                    });
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

    // 7.7.2: Refresh annotations after save (immediate UI update)
    const refreshAnnotationsForProject = async (projectId: string) => {
        try {
            const annotationsResponse = await chrome.runtime.sendMessage({
                type: "ANNOTATIONS/GET_PROJECT",
                projectId,
            });

            if (annotationsResponse && annotationsResponse.ok) {
                const loadedAnnotations = Array.isArray(annotationsResponse.annotations)
                    ? annotationsResponse.annotations
                    : [];
                setAnnotations(loadedAnnotations);

                // Re-merge annotations into components (non-mutating)
                const annotationsMap = new Map(
                    loadedAnnotations.map((a: AnnotationRecord) => [a.componentKey, a])
                );

                setComponents(prevComponents =>
                    prevComponents.map(component => {
                        const annotation = annotationsMap.get(component.id);
                        if (annotation) {
                            return {
                                ...component,
                                notes: annotation.notes || null,
                                tags: annotation.tags || [],
                            };
                        }
                        // Clear annotations if they were deleted
                        return {
                            ...component,
                            notes: null,
                            tags: [],
                        };
                    })
                );

                devLog("[UI Inventory Viewer] Refreshed annotations", {
                    projectId,
                    annotationsCount: loadedAnnotations.length,
                });
            }
        } catch (err) {
            devWarn("[UI Inventory Viewer] Failed to refresh annotations:", err);
        }
    };

    const refreshOverridesForProject = async (projectId: string) => {
        // To correctly handle deletes (reverting to derived values), re-derive from captures.
        await refreshProjectDetail(projectId);
    };

    // 7.7.2: Refresh project detail after capture delete
    const refreshProjectDetail = async (projectId: string) => {
        try {
            setComponentsLoading(true);
            setComponentsError(null);

            const response = await chrome.runtime.sendMessage({
                type: "UI/GET_PROJECT_DETAIL",
                projectId,
            });

            if (response && response.ok) {
                const loadedCaptures = Array.isArray(response.captures) ? response.captures : [];
                const scopedCaptures = scopeCapturesToProject(loadedCaptures, projectId);

                setRawCaptures(scopedCaptures);

                const derivedComponents = deriveComponentInventory(scopedCaptures);

                // Load annotations for this project
                const annotationsResponse = await chrome.runtime.sendMessage({
                    type: "ANNOTATIONS/GET_PROJECT",
                    projectId,
                });
                const overridesResponse = await chrome.runtime.sendMessage({
                    type: "OVERRIDES/GET_PROJECT",
                    projectId,
                });

                let annotatedComponents = derivedComponents;

                if (annotationsResponse && annotationsResponse.ok) {
                    const loadedAnnotations = Array.isArray(annotationsResponse.annotations)
                        ? annotationsResponse.annotations
                        : [];
                    setAnnotations(loadedAnnotations);

                    const annotationsMap = new Map(
                        loadedAnnotations.map((a: AnnotationRecord) => [a.componentKey, a])
                    );

                    annotatedComponents = derivedComponents.map(component => {
                        const annotation = annotationsMap.get(component.id);
                        if (annotation) {
                            return {
                                ...component,
                                notes: annotation.notes || null,
                                tags: annotation.tags || [],
                            };
                        }
                        return component;
                    });
                } else {
                    setAnnotations([]);
                }

                const loadedOverrides: ComponentOverrideRecord[] =
                    overridesResponse && overridesResponse.ok && Array.isArray(overridesResponse.overrides)
                        ? overridesResponse.overrides
                        : [];
                setOverrides(loadedOverrides);

                const overridesMap = new Map(
                    loadedOverrides.map((o) => [o.componentKey, o])
                );

                const mergedComponents: ViewerComponent[] = annotatedComponents.map(component => {
                    const o = overridesMap.get(component.id);
                    if (!o) return component;

                    const name = (o.displayName && o.displayName.trim() !== "") ? o.displayName : component.name;
                    const category = (o.categoryOverride && o.categoryOverride.trim() !== "") ? o.categoryOverride : component.category;
                    const type = (o.typeOverride && o.typeOverride.trim() !== "") ? o.typeOverride : component.type;
                    const status = (o.statusOverride && o.statusOverride.trim() !== "") ? (o.statusOverride as any) : component.status;

                    return {
                        ...component,
                        name,
                        category,
                        type,
                        status,
                        overrides: {
                            displayName: o.displayName ?? null,
                            categoryOverride: o.categoryOverride ?? null,
                            typeOverride: o.typeOverride ?? null,
                            statusOverride: o.statusOverride ?? null,
                        },
                    };
                });

                setComponents(mergedComponents);

                const derivedStyles = deriveStyleInventory(scopedCaptures);
                setStyles(derivedStyles);

                devLog("[UI Inventory Viewer] Refreshed project detail after delete", {
                    projectId,
                    capturesCount: scopedCaptures.length,
                    componentsCount: derivedComponents.length,
                    stylesCount: derivedStyles.length,
                });
            } else {
                setComponentsError(response?.error || "Failed to reload project data");
            }
        } catch (err) {
            devWarn("[UI Inventory Viewer] Failed to refresh project detail:", err);
            setComponentsError(String(err));
        } finally {
            setComponentsLoading(false);
        }
    };

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
                projectId={selectedProjectId}
                projectName={project?.name || "Unknown Project"}
                components={components}
                componentsLoading={componentsLoading}
                componentsError={componentsError}
                styleItems={styles}
                rawCaptures={rawCaptures}
                onBack={() => {
                    setRoute("projects");
                    setSelectedProjectId(null);
                    setSelectedProjectIdInUrl(null);
                }}
                onAnnotationsChanged={() => refreshAnnotationsForProject(selectedProjectId)}
                onOverridesChanged={() => refreshOverridesForProject(selectedProjectId)}
                onDeleted={() => refreshProjectDetail(selectedProjectId)}
            />
        );
    }

    // Old sessions UI below (temporarily unreachable, will be removed in later slices)
    return <LegacySessionsViewer />;
}
