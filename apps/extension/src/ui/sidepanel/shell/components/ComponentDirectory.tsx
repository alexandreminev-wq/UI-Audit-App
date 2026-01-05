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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div className="p-3 border-b border-gray-200" style={{ flexShrink: 0 }}>
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
      <div style={{ flex: 1, overflowY: 'auto' }}>
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
                      {/* Show states for interactive categories, description for static ones */}
                      {['Actions', 'Forms', 'Navigation', 'Feedback'].includes(component.category) && 
                       component.availableStates && 
                       component.availableStates.length > 0 && (
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
                      {/* Show description for non-interactive categories */}
                      {!['Actions', 'Forms', 'Navigation', 'Feedback'].includes(component.category) && 
                       component.description && (
                        <div className="text-xs text-gray-500 truncate">
                          {component.description}
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
