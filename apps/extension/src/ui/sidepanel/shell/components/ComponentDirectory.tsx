import { useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { Component } from '../App';

interface ComponentDirectoryProps {
  components: Component[];
  selectedComponent: Component | null;
  onSelectComponent: (component: Component) => void;
}

export function ComponentDirectory({ 
  components, 
  selectedComponent, 
  onSelectComponent 
}: ComponentDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/72f3f074-a83c-49b0-9a1e-6ec7f7304c62',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ComponentDirectory.tsx:18',message:'ComponentDirectory rendered',data:{componentCount:components.length,components:components.map(c=>({id:c.id,name:c.name,availableStatesCount:c.availableStates?.length||0,states:c.availableStates?.map(s=>s.state)||[]}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A2,D1'})}).catch(()=>{});
  // #endregion

  // Group components by category
  const componentsByCategory = components.reduce((acc, component) => {
    if (!acc[component.category]) {
      acc[component.category] = [];
    }
    acc[component.category].push(component);
    return acc;
  }, {} as Record<string, Component[]>);

  // Filter components based on search
  const filteredCategories = Object.entries(componentsByCategory).reduce((acc, [category, items]) => {
    const filteredItems = items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filteredItems.length > 0) {
      acc[category] = filteredItems;
    }
    return acc;
  }, {} as Record<string, Component[]>);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="max-h-80 flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search components..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tree Structure */}
      <div className="overflow-y-auto flex-1">
        {Object.entries(filteredCategories).map(([category, items]) => (
          <div key={category} className="border-b border-gray-100 last:border-b-0">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              {expandedCategories.has(category) ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
              <span className="text-gray-900">{category}</span>
              <span className="ml-auto text-xs text-gray-500">
                {items.length}
              </span>
            </button>

            {expandedCategories.has(category) && (
              <div className="bg-gray-50">
                {items.map((component) => (
                  <button
                    key={component.id}
                    onClick={() => onSelectComponent(component)}
                    className={`w-full text-left px-4 py-2 pl-10 text-sm hover:bg-gray-100 transition-colors ${
                      selectedComponent?.id === component.id
                        ? 'bg-blue-100 text-blue-900 hover:bg-blue-100'
                        : 'text-gray-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex-1">{component.name}</span>
                        {component.isDraft && (
                          <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                            Unsaved
                          </span>
                        )}
                      </div>
                      {component.availableStates && component.availableStates.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {component.availableStates.map(({state}) => (
                            <span
                              key={state}
                              className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-700"
                            >
                              {state}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {Object.keys(filteredCategories).length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            No components found
          </div>
        )}
      </div>
    </div>
  );
}
