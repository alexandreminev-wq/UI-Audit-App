import { Project } from '@/types/audit';
import { ProjectCard } from './ProjectCard';
import { FolderOpen } from 'lucide-react';

interface ProjectsScreenProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
}

export function ProjectsScreen({ projects, onSelectProject }: ProjectsScreenProps) {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div>
          <h1 className="font-semibold text-foreground">UI Audit Tool</h1>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">

        {/* Projects list */}
        {projects.length > 0 ? (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FolderOpen className="h-4 w-4" />
                <span>Projects</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 ml-6">
                Review and organize your captured UI components
              </p>
            </div>
            <div className="space-y-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => onSelectProject(project)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">No projects yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first project to start capturing UI components
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
