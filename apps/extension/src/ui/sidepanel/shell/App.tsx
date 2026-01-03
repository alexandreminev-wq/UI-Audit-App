import { useState, useEffect } from 'react';
import { StartScreen } from './components/StartScreen';
import { ProjectScreen } from './components/ProjectScreen';
import { InactiveTabScreen } from './components/InactiveTabScreen';

function sendMessageAsync<T, R>(msg: T): Promise<R> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve(resp as R);
    });
  });
}

import type { AuthorStyleEvidence, StyleEvidenceMeta, StylePrimitives, TokenEvidence } from '../../../types/capture';

async function getActivePageTabId(): Promise<number | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    // In Sidepanel contexts, tab.url may be unavailable depending on permissions.
    // We only need the tabId, so pick the active tab if present.
    return tabs[0]?.id ?? null;
  } catch {
    return null;
  }
}

export interface Component {
  id: string; // Primary capture ID (typically the default state)
  componentKey: string; // Deterministic grouping key (shared with Viewer)
  name: string;
  category: string;
  type: string;
  status: string;
  
  // Multi-state support: all captured states for this component
  availableStates: Array<{
    state: "default" | "hover" | "active" | "focus" | "disabled" | "open";
    captureId: string;
    screenshotBlobId?: string;
  }>;
  selectedState: "default" | "hover" | "active" | "focus" | "disabled" | "open";
  
  // State-specific data (reflects currently selected state)
  imageUrl: string;
  screenshotBlobId?: string;
  html: string;
  stylePrimitives?: StylePrimitives;
  styleEvidence?: {
    author?: AuthorStyleEvidence;
    tokens?: TokenEvidence;
    evidence?: StyleEvidenceMeta;
  };
  
  // Shared across all states
  url: string;
  styles: Record<string, string>; // Legacy, kept for compatibility
  comments: string;
  tags: string[];
  overrides?: {
    displayName: string | null;
    categoryOverride: string | null;
    typeOverride: string | null;
    statusOverride: string | null;
  };
  typeKey?: string; // Classifier output
  confidence?: number; // Classifier output (debug)
  isDraft?: boolean; // 7.8: Draft until Save
}

export interface Project {
  id: string;
  title: string;
  components: Component[];
}

interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export default function App() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [error, setError] = useState('');
  const [currentPageTabId, setCurrentPageTabId] = useState<number | null>(null);
  const [activeAuditTabId, setActiveAuditTabId] = useState<number | null>(null);

  const loadProjects = async () => {
    setLoadingProjects(true);
    setError('');
    try {
      const resp = await sendMessageAsync<{ type: string }, any>({
        type: 'UI/LIST_PROJECTS',
      });
      if (resp?.ok && Array.isArray(resp.projects)) {
        setProjects(resp.projects);
      } else {
        setError('Failed to load projects');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const refreshCurrentPageTab = async () => {
    const tabId = await getActivePageTabId();
    setCurrentPageTabId(tabId);
  };

  const refreshRoutingState = async () => {
    try {
      const resp = await sendMessageAsync<{ type: string }, any>({ type: 'AUDIT/GET_ROUTING_STATE' });
      if (resp?.ok) {
        setActiveAuditTabId(resp.activeAuditTabId ?? null);
      }
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    refreshCurrentPageTab();
    refreshRoutingState();

    const listener = (msg: any) => {
      if (msg?.type === 'UI/ACTIVE_TAB_CHANGED') {
        refreshCurrentPageTab();
      }
      if (msg?.type === 'UI/AUDIT_OWNER_CHANGED') {
        setActiveAuditTabId(msg.activeAuditTabId ?? null);
        refreshCurrentPageTab();
      }
      if (msg?.type === 'UI/TAB_REGISTERED') {
        refreshCurrentPageTab();
        refreshRoutingState();
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleActivateInThisTab = async () => {
    setError('');
    const tabId = await getActivePageTabId();
    setCurrentPageTabId(tabId);
    if (tabId === null) {
      setError('No tab ID (focus a page tab and retry)');
      return;
    }

    const resp = await sendMessageAsync<{ type: string; tabId: number }, any>({
      type: 'AUDIT/CLAIM_TAB',
      tabId,
    });

    if (!resp?.ok) {
      setError(resp?.error || 'Failed to activate capture in this tab');
      return;
    }

    setActiveAuditTabId(tabId);
    setCurrentProject(null); // force project re-selection (re-open flow)
  };

  const handleCreateProject = async (title: string) => {
    setError('');
    try {
      const resp = await sendMessageAsync<{ type: string; name: string }, any>({
        type: 'UI/CREATE_PROJECT',
        name: title,
      });

      if (resp?.ok && resp.project) {
        await loadProjects();

        // Navigate immediately; ProjectScreen will also set mapping on mount.
        setCurrentProject({
          id: resp.project.id,
          title: resp.project.name,
          components: [],
        });

        // Best-effort: set active project mapping for the current page tab.
        const tabId = await getActivePageTabId();
        const setResp = await sendMessageAsync<
          { type: string; projectId: string; tabId?: number | null },
          any
        >({
          type: 'UI/SET_ACTIVE_PROJECT_FOR_TAB',
          projectId: resp.project.id,
          tabId,
        });

        if (!setResp?.ok) {
          setError(setResp?.error || 'Failed to set active project (try focusing the page tab)');
        }
      } else {
        setError(resp?.error || 'Failed to create project');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create project');
    }
  };

  const handleOpenProject = async (project: Project) => {
    setError('');
    try {
      // Navigate immediately; ProjectScreen will also set mapping on mount.
      setCurrentProject(project);

      // Best-effort: set active project mapping for the current page tab.
      const tabId = await getActivePageTabId();
      const resp = await sendMessageAsync<{ type: string; projectId: string; tabId?: number | null }, any>({
        type: 'UI/SET_ACTIVE_PROJECT_FOR_TAB',
        projectId: project.id,
        tabId,
      });

      if (!resp?.ok) {
        setError(resp?.error || 'Failed to set active project (try focusing the page tab)');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to set active project');
    }
  };

  const handleUpdateProject = (updatedProject: Project) => {
    setCurrentProject(updatedProject);
  };

  const handleBackToStart = () => {
    setCurrentProject(null);
  };

  // Map ProjectRecords to Projects for StartScreen
  const shellProjects: Project[] = projects.map((p) => ({
    id: p.id,
    title: p.name,
    components: [],
  }));

  const shouldShowInactiveScreen =
    activeAuditTabId !== null && currentPageTabId !== null && currentPageTabId !== activeAuditTabId;

  return (
    <div style={{ minWidth: '360px', width: '100%', height: '100vh', background: 'hsl(var(--background))' }}>
      {shouldShowInactiveScreen ? (
        <InactiveTabScreen error={error} onActivate={handleActivateInThisTab} />
      ) : !currentProject ? (
        <StartScreen
          onCreateProject={handleCreateProject}
          onOpenProject={handleOpenProject}
          projects={shellProjects}
          loading={loadingProjects}
          error={error}
        />
      ) : (
        <ProjectScreen
          project={currentProject}
          onUpdateProject={handleUpdateProject}
          onBack={handleBackToStart}
        />
      )}
    </div>
  );
}
