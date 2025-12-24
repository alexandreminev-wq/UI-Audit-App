import { useState } from 'react';
import { Trash2, ExternalLink, X } from 'lucide-react';
import type { Component } from '../App';

interface ComponentDetailsProps {
  component: Component;
  onUpdateComponent: (component: Component) => void;
  onDeleteComponent: (componentId: string) => void;
  onClose: () => void;
}

export function ComponentDetails({
  component,
  onUpdateComponent,
  onDeleteComponent,
  onClose
}: ComponentDetailsProps) {
  const [comments, setComments] = useState(component.comments);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveComments = () => {
    onUpdateComponent({ ...component, comments });
  };

  const handleDelete = () => {
    onDeleteComponent(component.id);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Component Name */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-gray-900">{component.name}</h3>
          <p className="text-sm text-gray-500">{component.category}</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onClose}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete component"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Component Image */}
      <div className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
        {component.imageUrl ? (
          <img
            src={component.imageUrl}
            alt={component.name}
            className="w-full h-auto"
          />
        ) : (
          <div className="w-full p-8 text-center text-gray-500">
            No screenshot yet
          </div>
        )}
      </div>

      {/* URL */}
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Captured From</label>
        {component.url ? (
          <a
            href={component.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 break-all"
          >
            <span className="flex-1">{component.url}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        ) : (
          <div className="text-sm text-gray-400">Unknown</div>
        )}
      </div>

      {/* HTML Structure */}
      <div className="space-y-1">
        <label className="text-sm text-gray-600">HTML Structure</label>
        <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
          <code>{component.html}</code>
        </pre>
      </div>

      {/* Style Properties */}
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Style Properties</label>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          {Object.entries(component.styles).map(([property, value]) => (
            <div key={property} className="flex gap-3 p-2 text-xs">
              <span className="text-gray-600 min-w-[100px]">{property}:</span>
              <span className="text-gray-900 font-mono flex-1 break-all">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-1">
        <label htmlFor="comments" className="text-sm text-gray-600">
          Comments
        </label>
        <textarea
          id="comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          onBlur={handleSaveComments}
          placeholder="Add notes about this component..."
          rows={4}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 space-y-4">
            <div>
              <h4 className="text-gray-900 mb-2">Delete Component?</h4>
              <p className="text-sm text-gray-600">
                Are you sure you want to delete "{component.name}"? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
