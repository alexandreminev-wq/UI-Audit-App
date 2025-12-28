import { Capture, Category, CaptureStatus, VisualEssentialField, VISUAL_ESSENTIAL_LABELS } from '@/types/audit';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Star, ExternalLink } from 'lucide-react';
import { getEssentialValue } from './CaptureCard';

interface CaptureTableProps {
  captures: Capture[];
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

export function CaptureTable({
  captures,
  onSelect,
  visibleEssentials,
}: CaptureTableProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[60px]">Preview</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-[100px]">Type</TableHead>
            
            <TableHead className="w-[110px]">Status</TableHead>
            {visibleEssentials.map((field) => (
              <TableHead key={field} className="min-w-[120px]">
                {VISUAL_ESSENTIAL_LABELS[field]}
              </TableHead>
            ))}
            <TableHead className="w-[140px]">Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {captures.map((capture) => {
            const displayCategory = capture.categoryOverride || capture.category;
            const displayType = capture.typeOverride || capture.type;
            const displayName = capture.displayName || capture.name;

            return (
              <TableRow
                key={capture.id}
                className="cursor-pointer transition-colors"
                onClick={() => onSelect(capture)}
              >
                <TableCell className="p-2">
                  <div className="relative h-10 w-14 overflow-hidden rounded border border-border bg-muted">
                    <img
                      src={capture.screenshotUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                    {capture.isCanonical && (
                      <div className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-success text-success-foreground">
                        <Star className="h-2.5 w-2.5 fill-current" />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">{displayName}</div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground capitalize">
                    {displayType}
                  </span>
                </TableCell>
                <TableCell>
                  {capture.status !== 'unreviewed' ? (
                    <Badge variant={capture.status} className="text-[10px]">
                      {statusLabels[capture.status]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                {visibleEssentials.map((field) => (
                  <TableCell key={field}>
                    <span className="text-xs font-mono text-foreground truncate block max-w-[150px]">
                      {getEssentialValue(capture, field)}
                    </span>
                  </TableCell>
                ))}
                <TableCell>
                  <a
                    href={capture.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary truncate max-w-[120px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">{new URL(capture.sourceUrl).pathname}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
