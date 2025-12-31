import { useState, useEffect } from 'react';
import { Trash2, ExternalLink, X } from 'lucide-react';
import type { Component } from '../App';
import { formatVisualEssentials } from '../utils/formatVisualEssentials';

interface ComponentDetailsProps {
  component: Component;
  projectId: string; // 7.8: Need projectId for annotation save
  onUpdateComponent: (component: Component) => void;
  onDeleteComponent: (componentId: string) => void;
  onClose: () => void;
  onRefresh: () => void; // 7.8: Trigger parent refresh after draft commit
}

export function ComponentDetails({
  component,
  projectId,
  onUpdateComponent,
  onDeleteComponent,
  onClose,
  onRefresh,
}: ComponentDetailsProps) {
  const CATEGORY_OPTIONS = [
    "Actions",
    "Forms",
    "Navigation",
    "Content",
    "Media",
    "Feedback",
    "Layout",
    "Data Display",
    "Unknown",
  ];

  const STATUS_OPTIONS = [
    "Unreviewed",
    "Canonical",
    "Variant",
    "Deviation",
    "Legacy",
    "Experimental",
    "Unknown",
  ];

  const TYPE_OPTIONS_BY_CATEGORY: Record<string, string[]> = {
    Actions: ["Button", "Link", "Icon Button", "Toggle Button"],
    Forms: ["Input", "Textarea", "Select", "Checkbox", "Radio", "Switch", "Slider", "Date Picker", "File Upload"],
    Navigation: ["Nav Link", "Menu", "Menu Item", "Tabs", "Tab", "Breadcrumb", "Pagination", "Sidebar Item"],
    Content: ["Heading", "Paragraph", "Text", "Label", "List", "List Item", "Rich Text"],
    Media: ["Image", "Icon", "Avatar", "Video", "Illustration", "Logo"],
    Feedback: ["Alert", "Toast", "Banner", "Tooltip", "Modal", "Snackbar", "Inline Message", "Empty State"],
    Layout: ["Card", "Container", "Section", "Panel", "Divider", "Grid", "Landmark"],
    "Data Display": ["Table", "Table Row", "Table Cell", "Badge", "Chip", "Tag", "Stat", "Key Value"],
    Unknown: ["Element", "Custom Element", "Unclassified"],
  };

  const getTypeOptions = (category: string, currentType: string): string[] => {
    const base = TYPE_OPTIONS_BY_CATEGORY[category] || [];
    if (currentType && !base.includes(currentType)) {
      return [currentType, ...base];
    }
    return base.length > 0 ? base : (currentType ? [currentType] : []);
  };

  // 7.8: Draft state for notes/tags (no implicit save)
  const [draftNotes, setDraftNotes] = useState(component.comments);
  const [draftTags, setDraftTags] = useState<string[]>(component.tags || []);
  const [newTagInput, setNewTagInput] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Identity overrides (prototype parity)
  const [draftDisplayName, setDraftDisplayName] = useState<string>(component.name || "");
  const [draftCategory, setDraftCategory] = useState<string>(component.category || "Unknown");
  const [draftType, setDraftType] = useState<string>(component.type || "Unclassified");
  const [draftStatus, setDraftStatus] = useState<string>(component.status || "Unreviewed");

  // Update draft when component changes (e.g., user selects different component)
  useEffect(() => {
    setDraftNotes(component.comments);
    setDraftTags(component.tags || []);
    setNewTagInput("");
    setDraftDisplayName(component.name || "");
    setDraftCategory(component.category || "Unknown");
    setDraftType(component.type || "Unclassified");
    setDraftStatus(component.status || "Unreviewed");
    setIsDirty(false);
  }, [component.id, component.comments, component.tags, component.name, component.category, component.type, component.status]);

  // Track dirty state
  useEffect(() => {
    const tagsEqual =
      JSON.stringify([...draftTags].sort()) === JSON.stringify([...(component.tags || [])].sort());
    setIsDirty(
      draftNotes !== component.comments ||
      !tagsEqual ||
      draftDisplayName.trim() !== (component.name || "").trim() ||
      draftCategory !== (component.category || "") ||
      draftType !== (component.type || "") ||
      draftStatus !== (component.status || "")
    );
  }, [draftNotes, draftTags, draftDisplayName, draftCategory, draftType, draftStatus, component.comments, component.tags, component.name, component.category, component.type, component.status]);

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed !== "" && !draftTags.includes(trimmed)) {
      setDraftTags([...draftTags, trimmed]);
    }
    setNewTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setDraftTags(draftTags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 7.8 fix: Step 1 - Always commit draft if isDraft === true
      if (component.isDraft) {
        const commitResp = await chrome.runtime.sendMessage({
          type: "DRAFTS/COMMIT",
          captureId: component.id,
        });

        if (!commitResp || !commitResp.ok) {
          console.error("[ComponentDetails] Failed to commit draft:", commitResp?.error);
          alert(`Failed to save: ${commitResp?.error || "Unknown error"}`);
          setIsSaving(false);
          return;
        }

        console.log("[ComponentDetails] Draft committed successfully");
      }

      // Step 2: Save identity overrides (component-scoped)
      const overrideResp = await chrome.runtime.sendMessage({
        type: "OVERRIDES/UPSERT",
        projectId,
        componentKey: component.componentKey,
        displayName: draftDisplayName.trim() === "" ? null : draftDisplayName.trim(),
        categoryOverride: draftCategory,
        typeOverride: draftType,
        statusOverride: draftStatus,
      });

      if (!overrideResp || !overrideResp.ok) {
        console.error("[ComponentDetails] Failed to save overrides:", overrideResp?.error);
        alert(`Failed to save identity: ${overrideResp?.error || "Unknown error"}`);
        setIsSaving(false);
        return;
      }

      // Step 3: Save annotations (notes + tags)
      // 7.8 fix: Send notes: null for empty trimmed strings
      const componentKey = component.componentKey; // Deterministic component grouping key (shared with Viewer)

      const trimmedNotes = draftNotes.trim();
      const notesToSave = trimmedNotes === "" ? null : trimmedNotes;
      const tagsToSave = draftTags;

      const tagsEqual =
        JSON.stringify([...tagsToSave].sort()) === JSON.stringify([...(component.tags || [])].sort());
      const shouldUpsert = draftNotes !== component.comments || !tagsEqual || component.isDraft;

      if (shouldUpsert) {
        const annotationResp = await chrome.runtime.sendMessage({
          type: "ANNOTATIONS/UPSERT",
          projectId,
          componentKey,
          notes: notesToSave,
          tags: tagsToSave,
        });

        if (!annotationResp || !annotationResp.ok) {
          console.error("[ComponentDetails] Failed to save annotations:", annotationResp?.error);
          alert(`Failed to save: ${annotationResp?.error || "Unknown error"}`);
          setIsSaving(false);
          return;
        }

        console.log("[ComponentDetails] Annotations saved successfully");
      }

      // Step 4: Update local state and refresh parent
      onUpdateComponent({
        ...component,
        name: draftDisplayName,
        category: draftCategory,
        type: draftType,
        status: draftStatus,
        comments: draftNotes,
        tags: draftTags,
        isDraft: false,
        overrides: {
          displayName: draftDisplayName.trim() === "" ? null : draftDisplayName.trim(),
          categoryOverride: draftCategory,
          typeOverride: draftType,
          statusOverride: draftStatus,
        },
      });
      setIsDirty(false);

      // Trigger parent refresh to reload captures (drafts → saved)
      onRefresh();

      console.log("[ComponentDetails] Save complete");
    } catch (err) {
      console.error("[ComponentDetails] Save error:", err);
      alert(`Save failed: ${String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDraftNotes(component.comments);
    setDraftTags(component.tags || []);
    setNewTagInput("");
    setDraftDisplayName(component.name || "");
    setDraftCategory(component.category || "Unknown");
    setDraftType(component.type || "Unclassified");
    setDraftStatus(component.status || "Unreviewed");
    setIsDirty(false);
  };

  const handleResetOverrides = async () => {
    try {
      const resp = await chrome.runtime.sendMessage({
        type: "OVERRIDES/DELETE",
        projectId,
        componentKey: component.componentKey,
      });
      if (resp && resp.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error("[ComponentDetails] Failed to reset overrides:", err);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "UI/DELETE_CAPTURE",
        captureId: component.id,
      });

      if (response && response.ok) {
        console.log("[ComponentDetails] Deleted capture successfully:", component.id);
        onDeleteComponent(component.id);
        onClose();
      } else {
        console.error("[ComponentDetails] Failed to delete capture:", response?.error);
        alert(`Delete failed: ${response?.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("[ComponentDetails] Error deleting capture:", err);
      alert(`Delete failed: ${String(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Component Name */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-gray-900">{component.name}</h3>
            {component.isDraft && (
              <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                Unsaved
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{component.category}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Identity overrides */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-600">Identity</label>
          <button
            type="button"
            onClick={handleResetOverrides}
            disabled={!component.overrides}
            className={`text-xs px-2 py-1 rounded border ${
              component.overrides
                ? "border-gray-300 text-gray-700 hover:bg-gray-100"
                : "border-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            title="Reset identity overrides (revert to derived values)"
          >
            Reset
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500">Display name</label>
          <input
            value={draftDisplayName}
            onChange={(e) => setDraftDisplayName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Category</label>
            <select
              value={draftCategory}
              onChange={(e) => {
                const next = e.target.value;
                setDraftCategory(next);
                const options = getTypeOptions(next, draftType);
                if (options.length > 0 && !options.includes(draftType)) {
                  setDraftType(options[0]);
                }
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Type</label>
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
            >
              {getTypeOptions(draftCategory || "Unknown", draftType).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500">Status</label>
          <select
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
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

      {/* Visual Essentials */}
      <div className="space-y-2">
        <label className="text-sm text-gray-600">Visual Essentials</label>
        {component.stylePrimitives ? (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {formatVisualEssentials(component.stylePrimitives).map((section) => (
              <div key={section.title} className="border-b border-gray-200 last:border-b-0">
                <div className="px-3 py-2 bg-gray-50">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {section.title}
                  </h4>
                </div>
                <div className="divide-y divide-gray-100">
                  {section.rows.map((row, idx) => (
                    <div key={idx} className="px-3 py-2">
                      <div className="flex justify-between items-start gap-3 text-xs">
                        <span className="text-gray-600 flex-shrink-0">{row.label}</span>
                        <span className="text-gray-900 font-mono text-right break-all">{row.value}</span>
                      </div>
                      {row.evidence && (
                        <div className="mt-1 text-xs text-gray-400 font-mono">{row.evidence}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">No style primitives available</div>
        )}

        {/* Debug: Style primitives */}
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
            Debug: Style primitives
          </summary>
          <pre className="mt-2 bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-xs">
            {JSON.stringify(component.stylePrimitives ?? component.styles, null, 2)}
          </pre>
        </details>
      </div>

      {/* Notes (no onBlur - explicit Save only) */}
      <div className="space-y-1">
        <label htmlFor="notes" className="text-sm text-gray-600">
          Notes
        </label>
        <textarea
          id="notes"
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          placeholder="Add notes about this component..."
          rows={4}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      {/* Tags (explicit Save only) */}
      <div className="space-y-2">
        <label className="text-sm text-gray-600">Tags</label>

        {draftTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {draftTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-2 px-3 py-1 text-xs bg-gray-100 text-gray-900 border border-gray-200 rounded-md"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="text-gray-500 hover:text-gray-700"
                  title="Remove tag"
                  type="button"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">No tags yet.</div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="Add a tag..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleAddTag}
            disabled={newTagInput.trim() === ""}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              newTagInput.trim() === ""
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
            type="button"
          >
            Add
          </button>
        </div>
      </div>

      {/* Footer: Save / Cancel / Delete (sticky, avoids covering content) */}
      <div
        className="sticky bottom-0 -mx-4 px-4 pt-3 border-t border-gray-200 bg-white flex gap-2"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={handleSave}
          disabled={!(component.isDraft || isDirty) || isSaving}
          className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
            (component.isDraft || isDirty) && !isSaving
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          disabled={!isDirty}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isDirty
              ? 'border border-gray-300 text-gray-700 hover:bg-gray-100'
              : 'border border-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Cancel
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isDeleting}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isDeleting
              ? 'border border-gray-200 text-gray-400 cursor-not-allowed'
              : 'border border-gray-300 text-red-600 hover:bg-red-50'
          }`}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 space-y-4">
            <div>
              <h4 className="text-gray-900 mb-2">Delete Component?</h4>
              <p className="text-sm text-gray-600">
                {component.isDraft
                  ? `Are you sure you want to delete this unsaved draft of "${component.name}"? This action cannot be undone.`
                  : `Are you sure you want to delete "${component.name}"? This action cannot be undone.`}
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
