import { useEffect, useMemo, useState } from "react";
import { LayoutGrid } from "lucide-react";

type ActiveContextKind = "viewer" | "extension";

type ProjectListItem = {
  id: string;
  name: string;
};

interface ExtensionContextScreenProps {
  kind: ActiveContextKind;
  activeTabId: number | null;
  activeUrl: string | null;
  currentProjectId: string;
}

function isViewerUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith("chrome-extension://") && url.includes("/viewer.html");
}

export function ExtensionContextScreen({
  kind,
  activeTabId,
  activeUrl,
  currentProjectId,
}: ExtensionContextScreenProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);

  const title = kind === "viewer" ? "Viewer mode" : "Extension page";
  const message = kind === "viewer"
    ? "You are viewing the Library (Viewer). Capturing is not available right now."
    : "Capture is not available on Chrome Extension pages.";

  const canUpdateActiveViewerTab = useMemo(() => {
    return isViewerUrl(activeUrl) && typeof activeTabId === "number";
  }, [activeUrl, activeTabId]);

  // Extract the project ID from the viewer URL to highlight the correct project
  const viewerProjectId = useMemo(() => {
    if (!isViewerUrl(activeUrl)) return null;
    try {
      const urlObj = new URL(activeUrl!);
      return urlObj.searchParams.get("project");
    } catch {
      return null;
    }
  }, [activeUrl]);

  const openViewerForProject = async (projectId: string) => {
    const url = chrome.runtime.getURL("viewer.html") + "?project=" + encodeURIComponent(projectId);
    if (canUpdateActiveViewerTab && typeof activeTabId === "number") {
      chrome.tabs.update(activeTabId, { url });
      return;
    }
    chrome.tabs.create({ url });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await chrome.runtime.sendMessage({ type: "UI/LIST_PROJECTS" });
        if (cancelled) return;
        if (resp?.ok && Array.isArray(resp.projects)) {
          const items: ProjectListItem[] = resp.projects
            .filter((p: any) => p && typeof p.id === "string")
            .map((p: any) => ({ id: String(p.id), name: String(p.name ?? "Untitled") }));
          setProjects(items);
        } else {
          setError(resp?.error || "Failed to load projects");
        }
      } catch (e) {
        if (cancelled) return;
        setError(String(e));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 16px",
        borderBottom: "1px solid hsl(var(--border))",
      }}>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "hsl(var(--foreground))" }}>{title}</div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {message}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        <div style={{
          padding: "12px",
          border: "1px solid hsl(var(--border))",
          borderRadius: "var(--radius)",
          background: "hsl(var(--muted)/0.35)",
          color: "hsl(var(--foreground))",
          fontSize: 13,
          lineHeight: 1.4,
        }}>
          {kind === "viewer" ? (
            <>
              Capture tools run against web pages. Switch to a site tab to capture, or pick a project below to browse it in the Viewer.
            </>
          ) : (
            <>
              Capture tools don’t run on extension pages. Switch to a site tab to capture, or pick a project below to open it in the Viewer.
            </>
          )}
        </div>

        <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>
          Projects
        </div>

        {loading ? (
          <div style={{ marginTop: 10, fontSize: 13, color: "hsl(var(--muted-foreground))" }}>Loading projects…</div>
        ) : error ? (
          <div style={{ marginTop: 10, fontSize: 13, color: "hsl(var(--destructive))" }}>{error}</div>
        ) : projects.length === 0 ? (
          <div style={{ marginTop: 10, fontSize: 13, color: "hsl(var(--muted-foreground))" }}>No projects yet.</div>
        ) : (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.map((p) => {
              const isViewerProject = p.id === viewerProjectId;
              const isSidepanelProject = p.id === currentProjectId;
              return (
                <button
                  key={p.id}
                  onClick={() => openViewerForProject(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "var(--radius)",
                    border: "1px solid hsl(var(--border))",
                    background: isViewerProject ? "hsl(var(--muted))" : "transparent",
                    cursor: "pointer",
                    color: "hsl(var(--foreground))",
                    textAlign: "left",
                    gap: 10,
                  }}
                  title={p.name}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                      {isViewerProject ? "Currently in Viewer" : isSidepanelProject ? "Sidepanel project" : "Open in Viewer"}
                    </div>
                  </div>
                  <LayoutGrid style={{ width: 18, height: 18, flexShrink: 0, color: "hsl(var(--muted-foreground))" }} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


