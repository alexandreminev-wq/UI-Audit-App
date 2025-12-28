import { Capture, Category, CaptureStatus, VisualEssentialField, VISUAL_ESSENTIAL_LABELS } from '@/types/audit';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaptureCardProps {
  capture: Capture;
  onSelect: (capture: Capture) => void;
  visibleEssentials: VisualEssentialField[];
}

const categoryLabels: Record<Category, string> = {
  actions: 'Actions',
  forms: 'Forms',
  content: 'Content',
  unknown: 'Unknown',
};

const statusLabels: Record<CaptureStatus, string> = {
  unreviewed: 'Unreviewed',
  canonical: 'Canonical',
  variant: 'Variant',
  deviation: 'Deviation',
  legacy: 'Legacy',
  experimental: 'Experimental',
};

function getEssentialValue(capture: Capture, field: VisualEssentialField): string {
  const { visualEssentials } = capture;
  switch (field) {
    case 'background':
      return visualEssentials.colors.background;
    case 'border':
      return visualEssentials.colors.border;
    case 'borderRadius':
      return visualEssentials.borderRadius;
    case 'padding':
      return visualEssentials.spacing.padding;
    case 'color':
      return visualEssentials.colors.text;
    case 'fontFamily':
      return visualEssentials.typography.fontFamily;
    case 'fontSize':
      return visualEssentials.typography.fontSize;
    case 'fontWeight':
      return visualEssentials.typography.fontWeight;
    case 'lineHeight':
      return visualEssentials.typography.lineHeight;
    case 'boxShadow':
      return visualEssentials.boxShadow || 'none';
    default:
      return '';
  }
}

export function CaptureCard({
  capture,
  onSelect,
  visibleEssentials,
}: CaptureCardProps) {
  const displayCategory = capture.categoryOverride || capture.category;
  const displayType = capture.typeOverride || capture.type;
  const displayName = capture.displayName || capture.name;

  const handleClick = () => {
    onSelect(capture);
  };

  const getSourceDisplayName = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
    } catch {
      return url;
    }
  };

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden border transition-all hover:shadow-elevated"
      onClick={handleClick}
    >

      {/* Status badge */}
      {capture.status !== 'unreviewed' && (
        <div className="absolute top-2 right-2 z-10">
          <Badge variant={capture.status} className="text-[10px] uppercase font-semibold">
            {statusLabels[capture.status]}
          </Badge>
        </div>
      )}

      {/* Screenshot */}
      <div className="aspect-[16/10] bg-muted overflow-hidden">
        <img
          src={capture.screenshotUrl}
          alt={displayName}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-foreground">
              {displayName}
            </h4>
            <p className="text-sm text-muted-foreground capitalize mt-0.5">
              {categoryLabels[displayCategory]}
            </p>
          </div>
        </div>

        {/* Style Properties Table */}
        {visibleEssentials.length > 0 && (
          <div className="mt-3 rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                {visibleEssentials.map((field, index) => (
                  <tr 
                    key={field}
                    className={cn(index % 2 === 0 ? 'bg-background' : 'bg-muted/50')}
                  >
                    <td className="px-3 py-2 text-muted-foreground font-mono">
                      {VISUAL_ESSENTIAL_LABELS[field]}
                    </td>
                    <td className="px-3 py-2 font-mono text-foreground truncate">
                      {getEssentialValue(capture, field)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate max-w-[140px]">
            {getSourceDisplayName(capture.sourceUrl)}
          </span>
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(capture);
              }}
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <a
              href={capture.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}

export { getEssentialValue };
