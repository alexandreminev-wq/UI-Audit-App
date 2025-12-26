import { useState, useEffect } from 'react';
import { StartScreen } from './components/StartScreen';
import { ProjectScreen } from './components/ProjectScreen';

function sendMessageAsync<T, R>(msg: T): Promise<R> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve(resp as R);
    });
  });
}

import type { StylePrimitives } from '../../../types/capture';

export interface Component {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  url: string;
  html: string;
  styles: Record<string, string>;
  stylePrimitives?: StylePrimitives; // Added for Visual Essentials display
  comments: string;
  typeKey?: string; // Classifier output
  confidence?: number; // Classifier output (debug)
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

  const handleCreateProject = async (title: string) => {
    setError('');
    try {
      const resp = await sendMessageAsync<{ type: string; name: string }, any>({
        type: 'UI/CREATE_PROJECT',
        name: title,
      });

      if (resp?.ok && resp.project) {
        await loadProjects();

        const setResp = await sendMessageAsync<
          { type: string; projectId: string },
          any
        >({
          type: 'UI/SET_ACTIVE_PROJECT_FOR_TAB',
          projectId: resp.project.id,
        });

        if (setResp?.ok) {
          setError('');
          setCurrentProject({
            id: resp.project.id,
            title: resp.project.name,
            components: [],
          });
        } else {
          setError(setResp?.error || 'Failed to set active project');
          return;
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
      const resp = await sendMessageAsync<{ type: string; projectId: string }, any>({
        type: 'UI/SET_ACTIVE_PROJECT_FOR_TAB',
        projectId: project.id,
      });

      if (resp?.ok) {
        setError('');
        setCurrentProject(project);
      } else {
        setError(resp?.error || 'Failed to set active project');
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

  return (
    <div className="w-[360px] h-screen bg-white">
      {!currentProject ? (
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
