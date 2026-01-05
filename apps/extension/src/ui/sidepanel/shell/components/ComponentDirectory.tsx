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
      <div className="p-3 border-b border-gray-200" style={{ flexShrink: 0, background: '#ffffff' }}>
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
        {Object.entries(filteredCategories).map(([category, items]) => {
          const draftCount = items.filter(item => item.isDraft).length;
          
          return (
            <div key={category} className="border-b border-gray-100 last:border-b-0">
              <button
                onClick={() => toggleCategory(category)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#111827',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ flex: 1, textAlign: 'left' }}>{category}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {draftCount > 0 && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#ea580c',
                      background: '#ffedd5',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}>
                      {draftCount} {draftCount === 1 ? 'Draft' : 'Drafts'}
                    </span>
                  )}
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {items.length}
                  </span>
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </button>

              {expandedCategories.has(category) && (
                <div style={{ background: '#ffffff' }}>
                  {items.map((component) => (
                    <button
                      key={component.id}
                      onClick={() => onSelectComponent(component)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
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
                              Draft
                            </span>
                          )}
                        </div>
                        {/* Show description for all components */}
                        {component.description && (
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
          );
        })}

        {Object.keys(filteredCategories).length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            No components found
          </div>
        )}
      </div>
    </div>
  );
}
