import { useState, useEffect } from 'react';
import { Capture, Category, CaptureStatus, ComponentType } from '@/types/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  X,
  ExternalLink,
  ChevronDown,
  Star,
  Code,
  Layers,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaptureDetailPanelProps {
  capture: Capture;
  onClose: () => void;
  onUpdate: (capture: Capture) => void;
  onDelete?: (capture: Capture) => void;
}

const categories: { value: Category; label: string }[] = [
  { value: 'actions', label: 'Actions' },
  { value: 'forms', label: 'Forms' },
  { value: 'content', label: 'Content' },
  { value: 'unknown', label: 'Unknown' },
];

const types: { value: ComponentType; label: string }[] = [
  { value: 'button', label: 'Button' },
  { value: 'link', label: 'Link' },
  { value: 'input', label: 'Input' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'heading', label: 'Heading' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'image', label: 'Image' },
  { value: 'card', label: 'Card' },
  { value: 'unknown', label: 'Unknown' },
];

const statuses: { value: CaptureStatus; label: string }[] = [
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'canonical', label: 'Canonical' },
  { value: 'variant', label: 'Variant' },
  { value: 'deviation', label: 'Deviation' },
  { value: 'legacy', label: 'Legacy' },
  { value: 'experimental', label: 'Experimental' },
];

export function CaptureDetailPanel({
  capture,
  onClose,
  onUpdate,
  onDelete,
}: CaptureDetailPanelProps) {
  // Local state for all editable fields
  const [displayName, setDisplayName] = useState(capture.displayName || capture.name);
  const [categoryOverride, setCategoryOverride] = useState<Category>(capture.categoryOverride || capture.category);
  const [typeOverride, setTypeOverride] = useState<ComponentType>(capture.typeOverride || capture.type);
  const [status, setStatus] = useState<CaptureStatus>(capture.status);
  const [notes, setNotes] = useState(capture.notes);
  const [tags, setTags] = useState<string[]>(capture.tags);
  const [tagInput, setTagInput] = useState('');
  const [isHtmlExpanded, setIsHtmlExpanded] = useState(false);
  const [isStylesExpanded, setIsStylesExpanded] = useState(true);

  // Reset local state when capture changes
  useEffect(() => {
    setDisplayName(capture.displayName || capture.name);
    setCategoryOverride(capture.categoryOverride || capture.category);
    setTypeOverride(capture.typeOverride || capture.type);
    setStatus(capture.status);
    setNotes(capture.notes);
    setTags(capture.tags);
  }, [capture]);

  const hasChanges = 
    displayName !== (capture.displayName || capture.name) ||
    categoryOverride !== (capture.categoryOverride || capture.category) ||
    typeOverride !== (capture.typeOverride || capture.type) ||
    status !== capture.status ||
    notes !== capture.notes ||
    JSON.stringify(tags) !== JSON.stringify(capture.tags);

  const handleSave = () => {
    onUpdate({
      ...capture,
      displayName: displayName.trim() !== capture.name ? displayName.trim() : capture.displayName,
      categoryOverride,
      typeOverride,
      status,
      notes,
      tags,
    });
  };

  const handleCancel = () => {
    // Reset to original values
    setDisplayName(capture.displayName || capture.name);
    setCategoryOverride(capture.categoryOverride || capture.category);
    setTypeOverride(capture.typeOverride || capture.type);
    setStatus(capture.status);
    setNotes(capture.notes);
    setTags(capture.tags);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(capture);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <div className="flex h-full flex-col border-l border-border bg-card animate-slide-in-right overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold text-foreground">Capture Details</h2>
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6 pb-24">
          {/* Screenshot */}
          <div className="overflow-hidden rounded-lg border border-border">
            <img
              src={capture.screenshotUrl}
              alt={displayName}
              className="w-full object-contain"
            />
          </div>

          {/* Identity */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">Identity</h3>
              {capture.isCanonical && (
                <Badge variant="canonical" className="gap-1">
                  <Star className="h-3 w-3" />
                  Canonical
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="display-name" className="text-xs text-muted-foreground">
                Display Name
              </Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={categoryOverride} onValueChange={(v) => setCategoryOverride(v as Category)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={typeOverride} onValueChange={(v) => setTypeOverride(v as ComponentType)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CaptureStatus)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Source */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Source</h3>
            <a
              href={capture.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <span className="truncate">{capture.sourceUrl}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>

          <Separator />

          {/* HTML Structure */}
          <Collapsible open={isHtmlExpanded} onOpenChange={setIsHtmlExpanded}>
            <CollapsibleTrigger className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">HTML Structure</h3>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isHtmlExpanded && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                {capture.htmlSnapshot}
              </pre>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Style Properties */}
          <Collapsible open={isStylesExpanded} onOpenChange={setIsStylesExpanded}>
            <CollapsibleTrigger className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">Style Properties</h3>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isStylesExpanded && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {capture.styleProperties.map((prop, index) => (
                      <tr
                        key={prop.name}
                        className={cn(index % 2 === 0 ? 'bg-background' : 'bg-muted/50')}
                      >
                        <td className="px-3 py-2 text-muted-foreground font-mono">
                          {prop.name}
                        </td>
                        <td className="px-3 py-2 text-foreground font-mono">
                          {prop.isVariable ? (
                            <span className="text-primary">{prop.value}</span>
                          ) : (
                            prop.value
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this component..."
              className="bg-background resize-none"
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleRemoveTag(tag)}
                >
                  {tag}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Add tag..."
                className="bg-background"
              />
              <Button variant="secondary" size="sm" onClick={handleAddTag}>
                Add
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Fixed Footer */}
      <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
