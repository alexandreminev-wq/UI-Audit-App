import { ExtractedStyle, STYLE_TYPE_LABELS } from '@/types/audit';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface StyleTableProps {
  styles: ExtractedStyle[];
  onSelect: (style: ExtractedStyle) => void;
}

function ColorPreview({ value }: { value: string }) {
  return (
    <div
      className="w-8 h-8 rounded border border-border shrink-0"
      style={{ backgroundColor: value }}
    />
  );
}

function StyleValuePreview({ style }: { style: ExtractedStyle }) {
  const isColor = ['background', 'text-color', 'border-color'].includes(style.styleType);

  if (isColor) {
    return <ColorPreview value={style.value} />;
  }

  return (
    <div className="w-8 h-8 rounded border border-border bg-muted flex items-center justify-center shrink-0">
      <span className="text-[8px] text-muted-foreground">CSS</span>
    </div>
  );
}

export function StyleTable({ styles, onSelect }: StyleTableProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[60px]">Preview</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="w-[120px]">Type</TableHead>
            <TableHead className="w-[100px]">Variable</TableHead>
            <TableHead className="w-[100px]">Components</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {styles.map((style) => (
            <TableRow
              key={style.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelect(style)}
            >
              <TableCell>
                <StyleValuePreview style={style} />
              </TableCell>
              <TableCell>
                <span className="font-mono text-sm truncate block max-w-[300px]" title={style.value}>
                  {style.value}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">
                  {STYLE_TYPE_LABELS[style.styleType]}
                </Badge>
              </TableCell>
              <TableCell>
                {style.variableName ? (
                  <span className="text-xs font-medium truncate block max-w-[150px]" title={style.variableName}>
                    {style.variableName}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {style.captureIds.length}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
