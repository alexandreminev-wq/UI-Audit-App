import { useState, useMemo } from 'react';
import { FilterState, Category, ComponentType, CaptureStatus, VisualEssentialField, StyleCategory, StyleType, STYLE_CATEGORY_LABELS, STYLE_TYPE_LABELS } from '@/types/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ViewCustomizer } from './ViewCustomizer';
import { X, Filter, Grid3X3, Table2, Link, Search, Check, Layers, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'grid' | 'table';
export type SectionMode = 'components' | 'styles';

export interface StyleFilterState {
  category: StyleCategory | 'all';
  type: StyleType | 'all';
  search: string;
}

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  availableSources: string[];
  visibleEssentials: VisualEssentialField[];
  onVisibleEssentialsChange: (essentials: VisualEssentialField[]) => void;
  sectionMode: SectionMode;
  onSectionModeChange: (mode: SectionMode) => void;
  styleFilters: StyleFilterState;
  onStyleFiltersChange: (filters: StyleFilterState) => void;
}

const categories: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'actions', label: 'Actions' },
  { value: 'forms', label: 'Forms' },
  { value: 'content', label: 'Content' },
  { value: 'unknown', label: 'Unknown' },
];

const types: { value: ComponentType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
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

const statuses: { value: CaptureStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'canonical', label: 'Canonical' },
  { value: 'variant', label: 'Variant' },
  { value: 'deviation', label: 'Deviation' },
  { value: 'legacy', label: 'Legacy' },
  { value: 'experimental', label: 'Experimental' },
];

const styleCategories: { value: StyleCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'colors', label: 'Colors' },
  { value: 'borders', label: 'Borders' },
  { value: 'spacing', label: 'Spacing' },
  { value: 'typography', label: 'Typography' },
  { value: 'effects', label: 'Effects' },
];

const styleTypes: { value: StyleType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'background', label: 'Background' },
  { value: 'text-color', label: 'Text Color' },
  { value: 'border-color', label: 'Border Color' },
  { value: 'border-width', label: 'Border Width' },
  { value: 'border-radius', label: 'Border Radius' },
  { value: 'padding', label: 'Padding' },
  { value: 'margin', label: 'Margin' },
  { value: 'font-family', label: 'Font Family' },
  { value: 'font-size', label: 'Font Size' },
  { value: 'font-weight', label: 'Font Weight' },
  { value: 'line-height', label: 'Line Height' },
  { value: 'box-shadow', label: 'Box Shadow' },
  { value: 'opacity', label: 'Opacity' },
];

export function FilterBar({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  availableSources,
  visibleEssentials,
  onVisibleEssentialsChange,
  sectionMode,
  onSectionModeChange,
  styleFilters,
  onStyleFiltersChange,
}: FilterBarProps) {
  const [sourceSearchOpen, setSourceSearchOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');

  const filteredSources = useMemo(() => {
    if (!sourceSearch) return availableSources;
    return availableSources.filter(source => 
      source.toLowerCase().includes(sourceSearch.toLowerCase())
    );
  }, [availableSources, sourceSearch]);

  const hasActiveFilters = sectionMode === 'components'
    ? (filters.category !== 'all' ||
       filters.type !== 'all' ||
       filters.status !== 'all' ||
       filters.source !== '' ||
       filters.search !== '' ||
       filters.showUnknownOnly)
    : (styleFilters.category !== 'all' ||
       styleFilters.type !== 'all' ||
       styleFilters.search !== '');

  const clearFilters = () => {
    if (sectionMode === 'components') {
      onFiltersChange({
        category: 'all',
        type: 'all',
        status: 'all',
        source: '',
        search: '',
        showUnknownOnly: false,
      });
    } else {
      onStyleFiltersChange({
        category: 'all',
        type: 'all',
        search: '',
      });
    }
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
    <div className="border-b border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Section Toggle */}
          <div className="flex rounded-lg border border-border p-0.5 mr-2">
            <Button 
              variant={sectionMode === 'components' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 gap-1.5 px-3"
              onClick={() => onSectionModeChange('components')}
            >
              <Layers className="h-3.5 w-3.5" />
              Components
            </Button>
            <Button 
              variant={sectionMode === 'styles' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 gap-1.5 px-3"
              onClick={() => onSectionModeChange('styles')}
            >
              <Palette className="h-3.5 w-3.5" />
              Styles
            </Button>
          </div>

          <div className="flex items-center gap-1 text-muted-foreground">
            <Filter className="h-4 w-4" />
          </div>

          {sectionMode === 'components' ? (
            <>
              <Select
                value={filters.category}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, category: value as Category | 'all' })
                }
              >
                <SelectTrigger className="h-8 w-auto min-w-[140px] bg-background text-sm">
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

              <Select
                value={filters.type}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, type: value as ComponentType | 'all' })
                }
              >
                <SelectTrigger className="h-8 w-auto min-w-[120px] bg-background text-sm">
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

              <Select
                value={filters.status}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, status: value as CaptureStatus | 'all' })
                }
              >
                <SelectTrigger className="h-8 w-auto min-w-[130px] bg-background text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover open={sourceSearchOpen} onOpenChange={setSourceSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={sourceSearchOpen}
                    className="h-8 w-auto min-w-[140px] justify-between bg-background text-sm font-normal"
                  >
                    <div className="flex items-center gap-2">
                      <Link className="h-3.5 w-3.5 text-muted-foreground" />
                      {filters.source ? (
                        <span className="truncate max-w-[120px]">
                          {getSourceDisplayName(filters.source)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">All Sources</span>
                      )}
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search sources..."
                        value={sourceSearch}
                        onChange={(e) => setSourceSearch(e.target.value)}
                        className="h-8 pl-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="max-h-[200px] overflow-auto p-1">
                    <button
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted",
                        filters.source === '' && "bg-muted"
                      )}
                      onClick={() => {
                        onFiltersChange({ ...filters, source: '' });
                        setSourceSearchOpen(false);
                        setSourceSearch('');
                      }}
                    >
                      <Check className={cn("h-4 w-4", filters.source === '' ? "opacity-100" : "opacity-0")} />
                      <span>All Sources</span>
                    </button>
                    {filteredSources.map((source) => (
                      <button
                        key={source}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted text-left",
                          filters.source === source && "bg-muted"
                        )}
                        onClick={() => {
                          onFiltersChange({ ...filters, source });
                          setSourceSearchOpen(false);
                          setSourceSearch('');
                        }}
                      >
                        <Check className={cn("h-4 w-4 shrink-0", filters.source === source ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{getSourceDisplayName(source)}</span>
                      </button>
                    ))}
                    {filteredSources.length === 0 && (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        No sources found
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <div className="flex items-center gap-2 ml-2">
                <Switch
                  id="unknown-only"
                  checked={filters.showUnknownOnly}
                  onCheckedChange={(checked) =>
                    onFiltersChange({ ...filters, showUnknownOnly: checked })
                  }
                />
                <Label htmlFor="unknown-only" className="text-sm cursor-pointer">
                  Unknown only
                </Label>
              </div>
            </>
          ) : (
            <>
              <Select
                value={styleFilters.category}
                onValueChange={(value) =>
                  onStyleFiltersChange({ ...styleFilters, category: value as StyleCategory | 'all' })
                }
              >
                <SelectTrigger className="h-8 w-auto min-w-[140px] bg-background text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {styleCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={styleFilters.type}
                onValueChange={(value) =>
                  onStyleFiltersChange({ ...styleFilters, type: value as StyleType | 'all' })
                }
              >
                <SelectTrigger className="h-8 w-auto min-w-[140px] bg-background text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {styleTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Component type filter for styles */}
              <Select
                value={filters.type}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, type: value as ComponentType | 'all' })
                }
              >
                <SelectTrigger className="h-8 w-auto min-w-[130px] bg-background text-sm">
                  <SelectValue placeholder="Component Type" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onViewModeChange('grid')}>
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onViewModeChange('table')}>
              <Table2 className="h-4 w-4" />
            </Button>
          </div>
          {sectionMode === 'components' && (
            <ViewCustomizer 
              visibleEssentials={visibleEssentials}
              onVisibleEssentialsChange={onVisibleEssentialsChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
