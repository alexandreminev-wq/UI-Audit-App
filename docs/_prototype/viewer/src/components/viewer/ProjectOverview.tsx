import { useState, useMemo } from 'react';
import { Project, Capture, FilterState, Category, CaptureStatus, VisualEssentialField, DEFAULT_VISIBLE_ESSENTIALS, ExtractedStyle, StyleCategory, STYLE_CATEGORY_LABELS } from '@/types/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FilterBar, SectionMode, StyleFilterState, ViewMode } from './FilterBar';
import { CaptureCard } from './CaptureCard';
import { CaptureTable } from './CaptureTable';
import { CaptureDetailPanel } from './CaptureDetailPanel';
import { StyleCard } from './StyleCard';
import { StyleTable } from './StyleTable';
import { StyleDetailPanel } from './StyleDetailPanel';
import { ArrowLeft, Download, Layers, Search, Palette } from 'lucide-react';
import { extractStyles, filterStylesByComponentType, groupStylesByCategory } from '@/lib/styleExtractor';

interface ProjectOverviewProps {
  project: Project;
  captures: Capture[];
  onBack: () => void;
  onUpdateCapture: (capture: Capture) => void;
  onDeleteCapture?: (capture: Capture) => void;
}

export function ProjectOverview({
  project,
  captures,
  onBack,
  onUpdateCapture,
  onDeleteCapture
}: ProjectOverviewProps) {
  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    type: 'all',
    status: 'all',
    source: '',
    search: '',
    showUnknownOnly: false
  });
  const [styleFilters, setStyleFilters] = useState<StyleFilterState>({
    category: 'all',
    type: 'all',
    search: '',
  });
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sectionMode, setSectionMode] = useState<SectionMode>('components');
  const [selectedCapture, setSelectedCapture] = useState<Capture | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<ExtractedStyle | null>(null);
  const [visibleEssentials, setVisibleEssentials] = useState<VisualEssentialField[]>(DEFAULT_VISIBLE_ESSENTIALS);

  const availableSources = useMemo(() => {
    const sources = new Set(captures.map(c => c.sourceUrl));
    return Array.from(sources).sort();
  }, [captures]);

  // Components filtering
  const filteredCaptures = useMemo(() => {
    return captures.filter(capture => {
      const category = capture.categoryOverride || capture.category;
      const type = capture.typeOverride || capture.type;
      if (filters.category !== 'all' && category !== filters.category) return false;
      if (filters.type !== 'all' && type !== filters.type) return false;
      if (filters.status !== 'all' && capture.status !== filters.status) return false;
      if (filters.source && capture.sourceUrl !== filters.source) return false;
      if (filters.showUnknownOnly && category !== 'unknown') return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = (capture.displayName || capture.name).toLowerCase();
        const matchesSearch = name.includes(searchLower) || capture.tags.some(tag => tag.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [captures, filters]);

  // Group captures by category for grid view
  const groupedCaptures = useMemo(() => {
    if (filters.category !== 'all') {
      return null;
    }
    
    const groups: Record<Category, Capture[]> = {
      actions: [],
      forms: [],
      content: [],
      unknown: [],
    };
    
    filteredCaptures.forEach(capture => {
      const category = capture.categoryOverride || capture.category;
      groups[category].push(capture);
    });
    
    return groups;
  }, [filteredCaptures, filters.category]);

  // Styles extraction and filtering
  const allStyles = useMemo(() => {
    return extractStyles(captures);
  }, [captures]);

  const filteredStyles = useMemo(() => {
    let styles = filterStylesByComponentType(allStyles, captures, filters.type);
    
    // Filter by style category
    if (styleFilters.category !== 'all') {
      styles = styles.filter(s => s.category === styleFilters.category);
    }
    
    // Filter by style type
    if (styleFilters.type !== 'all') {
      styles = styles.filter(s => s.styleType === styleFilters.type);
    }
    
    // Filter by search
    if (styleFilters.search) {
      const searchLower = styleFilters.search.toLowerCase();
      styles = styles.filter(s => 
        s.value.toLowerCase().includes(searchLower) ||
        (s.variableName && s.variableName.toLowerCase().includes(searchLower))
      );
    }
    
    return styles;
  }, [allStyles, captures, filters.type, styleFilters]);

  // Group styles by category
  const groupedStyles = useMemo(() => {
    if (styleFilters.category !== 'all') {
      return null;
    }
    return groupStylesByCategory(filteredStyles);
  }, [filteredStyles, styleFilters.category]);

  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = {
      actions: 0,
      forms: 0,
      content: 0,
      unknown: 0
    };
    captures.forEach(capture => {
      const category = capture.categoryOverride || capture.category;
      counts[category]++;
    });
    return counts;
  }, [captures]);

  const statusCounts = useMemo(() => {
    const counts: Record<CaptureStatus, number> = {
      unreviewed: 0,
      canonical: 0,
      variant: 0,
      deviation: 0,
      legacy: 0,
      experimental: 0
    };
    captures.forEach(capture => {
      counts[capture.status]++;
    });
    return counts;
  }, [captures]);

  const handleStyleSelect = (style: ExtractedStyle) => {
    setSelectedStyle(style);
  };

  const handleCaptureFromStyle = (capture: Capture) => {
    setSelectedStyle(null);
    setSelectedCapture(capture);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-semibold text-foreground">{project.name}</h1>
              <p className="text-sm text-muted-foreground">
                {captures.length} captures • {allStyles.length} unique styles
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={sectionMode === 'components' ? filters.search : styleFilters.search}
                onChange={(e) => {
                  if (sectionMode === 'components') {
                    setFilters({ ...filters, search: e.target.value });
                  } else {
                    setStyleFilters({ ...styleFilters, search: e.target.value });
                  }
                }}
                className="h-8 w-48 pl-8 text-sm bg-background"
              />
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </header>

        {/* Filter bar */}
        <FilterBar 
          filters={filters} 
          onFiltersChange={setFilters} 
          viewMode={viewMode} 
          onViewModeChange={setViewMode} 
          availableSources={availableSources}
          visibleEssentials={visibleEssentials}
          onVisibleEssentialsChange={setVisibleEssentials}
          sectionMode={sectionMode}
          onSectionModeChange={setSectionMode}
          styleFilters={styleFilters}
          onStyleFiltersChange={setStyleFilters}
        />

        {/* Content area */}
        <div className="flex-1 overflow-auto p-4">
          {sectionMode === 'components' ? (
            // Components View
            filteredCaptures.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Layers className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium text-foreground">
                    No captures found
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try adjusting your filters
                  </p>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              groupedCaptures ? (
                <div className="space-y-8">
                  {(Object.entries(groupedCaptures) as [Category, Capture[]][])
                    .filter(([, captures]) => captures.length > 0)
                    .map(([category, captures]) => (
                      <section key={category}>
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            {category === 'actions' ? 'Actions' : 
                             category === 'forms' ? 'Forms' : 
                             category === 'content' ? 'Content' : 'Unknown'}
                          </h2>
                          <span className="text-sm text-muted-foreground">
                            {captures.length} component{captures.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {captures.map(capture => (
                            <CaptureCard 
                              key={capture.id} 
                              capture={capture} 
                              onSelect={setSelectedCapture} 
                              visibleEssentials={visibleEssentials} 
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredCaptures.map(capture => (
                    <CaptureCard 
                      key={capture.id} 
                      capture={capture} 
                      onSelect={setSelectedCapture} 
                      visibleEssentials={visibleEssentials} 
                    />
                  ))}
                </div>
              )
            ) : groupedCaptures ? (
              <div className="space-y-8">
                {(Object.entries(groupedCaptures) as [Category, Capture[]][])
                  .filter(([, captures]) => captures.length > 0)
                  .map(([category, captures]) => (
                    <section key={category}>
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          {category === 'actions' ? 'Actions' : 
                           category === 'forms' ? 'Forms' : 
                           category === 'content' ? 'Content' : 'Unknown'}
                        </h2>
                        <span className="text-sm text-muted-foreground">
                          {captures.length} component{captures.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <CaptureTable 
                        captures={captures} 
                        onSelect={setSelectedCapture} 
                        visibleEssentials={visibleEssentials} 
                      />
                    </section>
                  ))}
              </div>
            ) : (
              <CaptureTable 
                captures={filteredCaptures} 
                onSelect={setSelectedCapture} 
                visibleEssentials={visibleEssentials} 
              />
            )
          ) : (
            // Styles View
            filteredStyles.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Palette className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium text-foreground">
                    No styles found
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try adjusting your filters
                  </p>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              groupedStyles ? (
                <div className="space-y-8">
                  {(Object.entries(groupedStyles) as [StyleCategory, ExtractedStyle[]][])
                    .filter(([, styles]) => styles.length > 0)
                    .map(([category, styles]) => (
                      <section key={category}>
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            {STYLE_CATEGORY_LABELS[category]}
                          </h2>
                          <span className="text-sm text-muted-foreground">
                            {styles.length} style{styles.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                          {styles.map(style => (
                            <StyleCard 
                              key={style.id} 
                              style={style} 
                              onSelect={handleStyleSelect} 
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                </div>
              ) : (
                <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                  {filteredStyles.map(style => (
                    <StyleCard 
                      key={style.id} 
                      style={style} 
                      onSelect={handleStyleSelect} 
                    />
                  ))}
                </div>
              )
            ) : groupedStyles ? (
              <div className="space-y-8">
                {(Object.entries(groupedStyles) as [StyleCategory, ExtractedStyle[]][])
                  .filter(([, styles]) => styles.length > 0)
                  .map(([category, styles]) => (
                    <section key={category}>
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          {STYLE_CATEGORY_LABELS[category]}
                        </h2>
                        <span className="text-sm text-muted-foreground">
                          {styles.length} style{styles.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <StyleTable 
                        styles={styles} 
                        onSelect={handleStyleSelect} 
                      />
                    </section>
                  ))}
              </div>
            ) : (
              <StyleTable 
                styles={filteredStyles} 
                onSelect={handleStyleSelect} 
              />
            )
          )}
        </div>
      </div>

      {/* Capture Detail panel overlay */}
      {selectedCapture && (
        <>
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setSelectedCapture(null)}
          />
          <div className="fixed top-0 right-0 h-full w-[400px] z-50 shadow-xl">
            <CaptureDetailPanel 
              capture={selectedCapture} 
              onClose={() => setSelectedCapture(null)} 
              onUpdate={updated => {
                onUpdateCapture(updated);
                setSelectedCapture(updated);
              }}
              onDelete={onDeleteCapture ? (capture) => {
                onDeleteCapture(capture);
                setSelectedCapture(null);
              } : undefined}
            />
          </div>
        </>
      )}

      {/* Style Detail panel overlay */}
      {selectedStyle && (
        <>
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setSelectedStyle(null)}
          />
          <div className="fixed top-0 right-0 h-full w-[400px] z-50 shadow-xl">
            <StyleDetailPanel 
              style={selectedStyle}
              captures={captures}
              onClose={() => setSelectedStyle(null)}
              onSelectCapture={handleCaptureFromStyle}
            />
          </div>
        </>
      )}
    </div>
  );
}
