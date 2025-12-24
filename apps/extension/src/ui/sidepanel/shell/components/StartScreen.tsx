import { useState, useEffect } from 'react';
import { FolderOpen, Plus, ExternalLink } from 'lucide-react';
import type { Project } from '../App';

interface StartScreenProps {
  onCreateProject: (title: string) => void;
  onOpenProject: (project: Project) => void;
  projects: Project[];
  loading: boolean;
  error: string;
}

export function StartScreen({ onCreateProject, onOpenProject, projects, loading, error }: StartScreenProps) {
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (projects.length > 0) {
      chrome.runtime.sendMessage({ type: "UI/GET_PROJECT_COMPONENT_COUNTS" }, (resp) => {
        if (chrome.runtime.lastError) return;
        if (resp?.ok && resp.counts) {
          setProjectCounts(resp.counts);
        }
      });
    }
  }, [projects]);

  const handleCreateProject = () => {
    if (projectTitle.trim()) {
      onCreateProject(projectTitle.trim());
      setProjectTitle('');
      setShowNewProjectForm(false);
    }
  };

  const handleOpenViewer = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
  };

  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1>UI Audit Tool</h1>
          <button
            onClick={handleOpenViewer}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            title="Open Viewer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Viewer</span>
          </button>
        </div>
        <p className="text-gray-600">
          Create component inventories to track design and technical debt
        </p>
      </div>

      {!showNewProjectForm ? (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setShowNewProjectForm(true)}
            className="flex items-center justify-center gap-3 p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Project</span>
          </button>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {loading && (
            <p className="text-sm text-gray-500">Loading projects...</p>
          )}

          {!loading && projects.length > 0 && (
            <>
              <div className="flex items-center gap-3 my-2">
                <div className="h-px bg-gray-300 flex-1" />
                <span className="text-gray-500">or</span>
                <div className="h-px bg-gray-300 flex-1" />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-2">
                  <FolderOpen className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-700">Recent Projects</span>
                </div>
                {projects.map((project) => {
                  const count = projectCounts[project.id];
                  const countText = count !== undefined ? `${count} components` : '— components';

                  return (
                    <button
                      key={project.id}
                      onClick={() => onOpenProject(project)}
                      className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <div>{project.title}</div>
                      <div className="text-sm text-gray-500">
                        {countText}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="project-title" className="block mb-2 text-gray-700">
              Project Title
            </label>
            <input
              id="project-title"
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Enter project name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreateProject}
              disabled={!projectTitle.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowNewProjectForm(false);
                setProjectTitle('');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
