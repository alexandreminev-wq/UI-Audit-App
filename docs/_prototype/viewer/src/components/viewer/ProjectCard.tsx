import { Project } from '@/types/audit';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const lastUpdated = formatDistanceToNow(new Date(project.lastUpdated), { addSuffix: true });

  return (
    <Card
      className="group cursor-pointer border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-elevated"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{lastUpdated}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {project.captureCount} captures
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}
