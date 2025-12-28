import { ExtractedStyle, STYLE_TYPE_LABELS } from '@/types/audit';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface StyleCardProps {
  style: ExtractedStyle;
  onSelect: (style: ExtractedStyle) => void;
}

function ColorPreview({ value }: { value: string }) {
  return (
    <div
      className="w-full h-12 rounded-md border border-border"
      style={{ backgroundColor: value }}
    />
  );
}

function StyleValuePreview({ style }: { style: ExtractedStyle }) {
  const isColor = ['background', 'text-color', 'border-color'].includes(style.styleType);

  if (isColor) {
    return <ColorPreview value={style.value} />;
  }

  // For non-color styles, show a styled preview box
  return (
    <div className="w-full h-12 rounded-md border border-border bg-muted flex items-center justify-center">
      <span className="text-xs text-muted-foreground font-mono truncate px-2">
        {style.value}
      </span>
    </div>
  );
}

export function StyleCard({ style, onSelect }: StyleCardProps) {
  return (
    <Card
      className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onClick={() => onSelect(style)}
    >
      <CardContent className="p-3 space-y-2">
        <StyleValuePreview style={style} />

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-[10px] shrink-0">
              {STYLE_TYPE_LABELS[style.styleType]}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {style.captureIds.length} component{style.captureIds.length !== 1 ? 's' : ''}
            </span>
          </div>

          {style.variableName ? (
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground truncate" title={style.variableName}>
                {style.variableName}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground truncate" title={style.value}>
                {style.value}
              </p>
            </div>
          ) : (
            <p className="text-xs font-mono text-muted-foreground truncate" title={style.value}>
              {style.value}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
