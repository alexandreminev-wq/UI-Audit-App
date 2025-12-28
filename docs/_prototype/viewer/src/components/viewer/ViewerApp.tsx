import { useState } from 'react';
import { Project, Capture } from '@/types/audit';
import { ProjectsScreen } from './ProjectsScreen';
import { ProjectOverview } from './ProjectOverview';
import { mockProjects, mockCaptures } from '@/data/mockData';
import { toast } from 'sonner';

type ViewState = 
  | { type: 'projects' }
  | { type: 'project'; project: Project };

export function ViewerApp() {
  const [viewState, setViewState] = useState<ViewState>({ type: 'projects' });
  const [projects] = useState<Project[]>(mockProjects);
  const [captures, setCaptures] = useState<Capture[]>(mockCaptures);

  const handleSelectProject = (project: Project) => {
    setViewState({ type: 'project', project });
  };


  const handleBack = () => {
    setViewState({ type: 'projects' });
  };

  const handleUpdateCapture = (updatedCapture: Capture) => {
    setCaptures((prev) =>
      prev.map((c) => (c.id === updatedCapture.id ? updatedCapture : c))
    );
    toast.success('Capture updated');
  };

  if (viewState.type === 'projects') {
    return (
      <ProjectsScreen
        projects={projects}
        onSelectProject={handleSelectProject}
      />
    );
  }

  const projectCaptures = captures.filter(
    (c) => c.projectId === viewState.project.id
  );

  return (
    <ProjectOverview
      project={viewState.project}
      captures={projectCaptures}
      onBack={handleBack}
      onUpdateCapture={handleUpdateCapture}
    />
  );
}
