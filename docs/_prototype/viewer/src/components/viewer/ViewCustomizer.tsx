import { useState } from 'react';
import { VisualEssentialField, VISUAL_ESSENTIAL_LABELS } from '@/types/audit';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Settings2 } from 'lucide-react';

interface ViewCustomizerProps {
  visibleEssentials: VisualEssentialField[];
  onVisibleEssentialsChange: (essentials: VisualEssentialField[]) => void;
}

const ALL_ESSENTIALS: VisualEssentialField[] = [
  'background',
  'border',
  'borderRadius',
  'padding',
  'color',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'boxShadow',
];

export function ViewCustomizer({
  visibleEssentials,
  onVisibleEssentialsChange,
}: ViewCustomizerProps) {
  const [open, setOpen] = useState(false);

  const toggleEssential = (field: VisualEssentialField) => {
    if (visibleEssentials.includes(field)) {
      onVisibleEssentialsChange(visibleEssentials.filter(f => f !== field));
    } else {
      onVisibleEssentialsChange([...visibleEssentials, field]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-7 w-7">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="end">
        <div className="p-3 border-b border-border">
          <h4 className="font-medium text-sm">Visible Properties</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select which essentials to display
          </p>
        </div>
        <div className="p-2 max-h-[280px] overflow-auto">
          {ALL_ESSENTIALS.map((field) => (
            <div
              key={field}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
              onClick={() => toggleEssential(field)}
            >
              <Checkbox
                checked={visibleEssentials.includes(field)}
                onCheckedChange={() => toggleEssential(field)}
                onClick={(e) => e.stopPropagation()}
              />
              <Label className="text-sm cursor-pointer flex-1">
                {VISUAL_ESSENTIAL_LABELS[field]}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
