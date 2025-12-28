import { ExtractedStyle, Capture, STYLE_TYPE_LABELS, STYLE_CATEGORY_LABELS } from '@/types/audit';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface StyleDetailPanelProps {
  style: ExtractedStyle;
  captures: Capture[];
  onClose: () => void;
  onSelectCapture: (capture: Capture) => void;
}

function ColorPreview({ value }: { value: string }) {
  return (
    <div
      className="w-full h-24 rounded-lg border border-border"
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
    <div className="w-full h-24 rounded-lg border border-border bg-muted flex items-center justify-center">
      <span className="text-lg font-mono text-muted-foreground">{style.value}</span>
    </div>
  );
}

export function StyleDetailPanel({
  style,
  captures,
  onClose,
  onSelectCapture,
}: StyleDetailPanelProps) {
  const [copied, setCopied] = useState(false);

  const associatedCaptures = captures.filter(c => style.captureIds.includes(c.id));

  const handleCopyValue = () => {
    navigator.clipboard.writeText(style.variableName || style.value);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold text-foreground">Style Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Preview */}
          <StyleValuePreview style={style} />

          {/* Style Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {STYLE_CATEGORY_LABELS[style.category]}
              </Badge>
              <Badge variant="outline">
                {STYLE_TYPE_LABELS[style.styleType]}
              </Badge>
            </div>

            {/* Variable Name */}
            {style.variableName && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Variable
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded bg-muted text-sm font-mono">
                    {style.variableName}
                  </code>
                  <Button variant="ghost" size="icon" onClick={handleCopyValue}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Value */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                Value
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded bg-muted text-sm font-mono break-all">
                  {style.value}
                </code>
                {!style.variableName && (
                  <Button variant="ghost" size="icon" onClick={handleCopyValue}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Associated Captures */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">
                Associated Components
              </h3>
              <span className="text-xs text-muted-foreground">
                {associatedCaptures.length} component{associatedCaptures.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2">
              {associatedCaptures.map(capture => (
                <button
                  key={capture.id}
                  className="w-full flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                  onClick={() => onSelectCapture(capture)}
                >
                  <img
                    src={capture.screenshotUrl}
                    alt={capture.displayName || capture.name}
                    className="w-10 h-10 object-cover rounded border border-border"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {capture.displayName || capture.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {capture.typeOverride || capture.type}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
