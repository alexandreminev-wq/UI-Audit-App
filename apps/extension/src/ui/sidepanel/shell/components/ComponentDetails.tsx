import { useState, useEffect } from 'react';
import { Trash2, ExternalLink, X } from 'lucide-react';
import type { Component } from '../App';
import { formatVisualEssentials } from '../utils/formatVisualEssentials';
import { TokenTraceValue } from '../../../shared/tokenTrace/TokenTraceValue';
import { useBlobUrl } from '../../../viewer/hooks/useBlobUrl';
import { StylePropertiesTable, type StylePropertiesSection } from '../../../shared/components';

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
  const [draftDescription, setDraftDescription] = useState<string>(component.description || "");
  const [draftCategory, setDraftCategory] = useState<string>(component.category || "Unknown");
  const [draftType, setDraftType] = useState<string>(component.type || "Unclassified");
  const [draftStatus, setDraftStatus] = useState<string>(component.status || "Unreviewed");

  // State selection for multi-state components
  const [selectedState, setSelectedState] = useState(component.selectedState);
  const [isLoadingState, setIsLoadingState] = useState(false);

  // Load screenshot blob URL
  const { url: screenshotUrl } = useBlobUrl(component.screenshotBlobId);

  // Update draft when component changes (e.g., user selects different component)
  useEffect(() => {
    setDraftNotes(component.comments);
    setDraftTags(component.tags || []);
    setNewTagInput("");
    setDraftDisplayName(component.name || "");
    setDraftDescription(component.description || "");
    setDraftCategory(component.category || "Unknown");
    setDraftType(component.type || "Unclassified");
    setDraftStatus(component.status || "Unreviewed");
    setSelectedState(component.selectedState);
    setIsDirty(false);
  }, [component.id, component.comments, component.tags, component.name, component.description, component.category, component.type, component.status, component.selectedState]);

  // Track dirty state
  useEffect(() => {
    const tagsEqual =
      JSON.stringify([...draftTags].sort()) === JSON.stringify([...(component.tags || [])].sort());
    setIsDirty(
      draftNotes !== component.comments ||
      !tagsEqual ||
      draftDisplayName.trim() !== (component.name || "").trim() ||
      draftDescription.trim() !== (component.description || "").trim() ||
      draftCategory !== (component.category || "") ||
      draftType !== (component.type || "") ||
      draftStatus !== (component.status || "")
    );
  }, [draftNotes, draftTags, draftDisplayName, draftDescription, draftCategory, draftType, draftStatus, component.comments, component.tags, component.name, component.description, component.category, component.type, component.status]);

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
        description: draftDescription.trim() === "" ? null : draftDescription.trim(),
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
        description: draftDescription,
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
    setDraftDescription(component.description || "");
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

  const handleStateChange = async (newState: string) => {
    const stateEntry = component.availableStates.find(s => s.state === newState);
    if (!stateEntry) return;

    setIsLoadingState(true);
    try {
      const captureResp = await chrome.runtime.sendMessage({
        type: "UI/GET_CAPTURE",
        captureId: stateEntry.captureId,
      });

      if (captureResp?.ok && captureResp.capture) {
        const capture = captureResp.capture;
        const updatedComponent = {
          ...component,
          // DO NOT change id - keep it stable for handleUpdateComponent to find it
          selectedState: newState as any,
          html: capture.element?.outerHTML || '',
          screenshotBlobId: capture.screenshot?.screenshotBlobId,
          stylePrimitives: capture.styles?.primitives,
          styleEvidence: {
            author: capture.styles?.author,
            tokens: capture.styles?.tokens,
            evidence: capture.styles?.evidence,
          },
        };
        // Update component with new state's data
        onUpdateComponent(updatedComponent);
        setSelectedState(newState as any);
      }
    } catch (err) {
      console.error("[ComponentDetails] Failed to load state:", err);
    } finally {
      setIsLoadingState(false);
    }
  };

  const capitalizeState = (state: string): string => {
    return state.charAt(0).toUpperCase() + state.slice(1);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {/* Component header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            margin: 0,
            marginBottom: 4,
            fontSize: 20,
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
          }}>
            {component.name}
          </h2>
          {/* Caption with component description */}
          {component.description && (
            <div style={{
              fontSize: 13,
              color: 'hsl(var(--muted-foreground))',
              marginBottom: 12,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {component.description}
            </div>
          )}
          {/* Tags/chips */}
          <div style={{
            display: 'flex',
            gap: 6,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}>
            {/* Status chip */}
            <span style={{
              fontSize: 11,
              padding: '3px 8px',
              background: 'hsl(var(--muted))',
              color: 'hsl(var(--muted-foreground))',
              borderRadius: 'calc(var(--radius) - 2px)',
            }}>
              {component.status}
            </span>
            {/* Draft badge */}
            {component.isDraft && (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#ea580c',
                background: '#ffedd5',
                padding: '3px 8px',
                borderRadius: 'calc(var(--radius) - 2px)',
              }}>
                Unsaved
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: 8,
            color: 'hsl(var(--muted-foreground))',
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'hsl(var(--muted))'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          title="Close"
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Identity section */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{
          fontSize: 14,
          fontWeight: 600,
          marginTop: 0,
          marginBottom: 8,
          color: 'hsl(var(--foreground))',
        }}>Identity</h3>

        <div style={{
          padding: 12,
          background: 'hsl(var(--muted))',
          borderRadius: 'var(--radius)',
          border: '1px solid hsl(var(--border))',
          fontSize: 13,
        }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 6, display: 'block' }}>Name</label>
            <input
              value={draftDisplayName}
              onChange={(e) => setDraftDisplayName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'hsl(var(--background))',
                borderRadius: 'var(--radius)',
                border: '1px solid hsl(var(--border))',
                fontSize: 13,
                color: 'hsl(var(--foreground))',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 6, display: 'block' }}>Description</label>
            <input
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'hsl(var(--background))',
                borderRadius: 'var(--radius)',
                border: '1px solid hsl(var(--border))',
                fontSize: 13,
                color: 'hsl(var(--foreground))',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 6, display: 'block' }}>Category</label>
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
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'hsl(var(--background))',
                  borderRadius: 'var(--radius)',
                  border: '1px solid hsl(var(--border))',
                  fontSize: 13,
                  color: 'hsl(var(--foreground))',
                  boxSizing: 'border-box',
                }}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 6, display: 'block' }}>Type</label>
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'hsl(var(--background))',
                  borderRadius: 'var(--radius)',
                  border: '1px solid hsl(var(--border))',
                  fontSize: 13,
                  color: 'hsl(var(--foreground))',
                  boxSizing: 'border-box',
                }}
              >
                {getTypeOptions(draftCategory || "Unknown", draftType).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 6, display: 'block' }}>Status</label>
            <select
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                background: 'hsl(var(--background))',
                borderRadius: 'var(--radius)',
                border: '1px solid hsl(var(--border))',
                fontSize: 13,
                color: 'hsl(var(--foreground))',
                boxSizing: 'border-box',
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* State field - only show for interactive categories */}
          {component.availableStates && component.availableStates.length > 1 && ["Actions", "Forms", "Navigation"].includes(component.category) ? (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 6, display: 'block' }}>State</label>
              <select
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                disabled={isLoadingState}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: isLoadingState ? 'hsl(var(--muted))' : 'hsl(var(--background))',
                  borderRadius: 'var(--radius)',
                  border: '1px solid hsl(var(--border))',
                  fontSize: 13,
                  color: 'hsl(var(--foreground))',
                  cursor: isLoadingState ? 'not-allowed' : 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {component.availableStates.map(({state}) => (
                  <option key={state} value={state}>
                    {capitalizeState(state)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            component.availableStates && component.availableStates.length === 1 && ["Actions", "Forms", "Navigation"].includes(component.category) && (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 6, display: 'block' }}>State</label>
                <div style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--muted-foreground))',
                  borderRadius: 'var(--radius)',
                  border: '1px solid hsl(var(--border))',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}>
                  {capitalizeState(selectedState)}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Preview section */}
      <div style={{ marginBottom: 24, maxWidth: '100%' }}>
        <h3 style={{
          fontSize: 14,
          fontWeight: 600,
          marginTop: 0,
          marginBottom: 8,
          color: 'hsl(var(--foreground))',
        }}>Preview</h3>
        <div style={{
          width: '100%',
          maxWidth: '100%',
          maxHeight: 220,
          minHeight: 180,
          padding: 12,
          borderRadius: 'var(--radius)',
          border: '1px solid hsl(var(--border))',
          background: 'hsl(var(--muted))',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}>
          {screenshotUrl ? (
            <img
              src={screenshotUrl}
              alt="Component screenshot"
              style={{
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
                display: 'block',
                objectFit: 'contain',
              }}
            />
          ) : component.imageUrl ? (
            <img
              src={component.imageUrl}
              alt="Component screenshot"
              style={{
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
                display: 'block',
                objectFit: 'contain',
              }}
            />
          ) : (
            <div style={{
              fontSize: 13,
              color: 'hsl(var(--muted-foreground))',
            }}>
              No screenshot yet
            </div>
          )}
        </div>
      </div>

      {/* Source section */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{
          fontSize: 14,
          fontWeight: 600,
          marginTop: 0,
          marginBottom: 8,
          color: 'hsl(var(--foreground))',
        }}>Source</h3>
        {component.url ? (
          <div style={{
            padding: '8px 12px',
            background: 'hsl(var(--muted))',
            borderRadius: 'calc(var(--radius) - 2px)',
            fontSize: 13,
          }}>
            <div style={{
              color: 'hsl(var(--foreground))',
              fontWeight: 500,
              marginBottom: 4,
            }}>
              {new URL(component.url).hostname}
            </div>
            <a
              href={component.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'hsl(var(--muted-foreground))',
                fontSize: 12,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                overflowWrap: 'anywhere',
                lineHeight: 1.4,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'hsl(var(--primary))'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'hsl(var(--muted-foreground))'}
            >
              <span style={{ flex: 1 }}>{component.url}</span>
              <ExternalLink style={{ width: 12, height: 12, flexShrink: 0 }} />
            </a>
          </div>
        ) : (
          <div style={{
            padding: 12,
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--muted))',
            fontSize: 13,
            color: 'hsl(var(--muted-foreground))',
            lineHeight: 1.5,
          }}>
            No source found.
          </div>
        )}
      </div>

      {/* HTML Structure */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <details style={{ cursor: 'pointer' }}>
          <summary style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'hsl(var(--foreground))',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            userSelect: 'none',
          }}>
            <span style={{
              display: 'inline-block',
              transition: 'transform 0.2s',
            }}>▸</span>
            HTML Structure
          </summary>
          <div style={{
            marginTop: 8,
            padding: 12,
            background: 'hsl(var(--muted))',
            borderRadius: 'var(--radius)',
            border: '1px solid hsl(var(--border))',
            fontSize: 13,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            lineHeight: 1.5,
            color: component.html ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
          }}>
            {component.html || 'No HTML available'}
          </div>
        </details>
        <style>{`
          details[open] > summary > span {
            transform: rotate(90deg);
          }
        `}</style>
      </div>

      {/* Visual Essentials */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))' }}>Visual Essentials</label>
          <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
            Authored styles:{" "}
            {component.styleEvidence?.evidence?.method === "cdp" ? "available (CDP)" : "computed"}
          </span>
        </div>
        {component.stylePrimitives ? (
          <StylePropertiesTable
            sections={formatVisualEssentials(component.stylePrimitives).map((section) => ({
              title: section.title,
              rows: section.rows.map((row) => {
                const isColorRow =
                  row.label === "Text color" ||
                  row.label === "Background" ||
                  row.label === "Border color";

                if (!isColorRow) {
                  return {
                    label: row.label,
                    value: row.value,
                  };
                }

                const prop =
                  row.label === "Text color"
                    ? "color"
                    : row.label === "Background"
                      ? "backgroundColor"
                      : "borderColor";

                const primitives: any = component.stylePrimitives;
                const hex8 =
                  prop === "color"
                    ? primitives?.color?.hex8
                    : prop === "backgroundColor"
                      ? primitives?.backgroundColor?.hex8
                      : primitives?.borderColor?.hex8;

                const authoredValue =
                  (component.styleEvidence?.author?.properties as any)?.[prop]?.authoredValue ?? null;

                return {
                  label: row.label,
                  value: row.value,
                  customContent: (
                    <TokenTraceValue
                      property={prop as any}
                      label={row.label}
                      resolvedValue={row.value}
                      hex8={hex8 ?? null}
                      authoredValue={authoredValue}
                      tokens={component.styleEvidence?.tokens ?? null}
                      showCopyActions={false}
                    />
                  ),
                };
              }),
            }))}
          />
        ) : (
          <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No style primitives available</div>
        )}

        {/* Debug: Style primitives */}
        <details style={{ fontSize: 11 }}>
          <summary style={{
            cursor: 'pointer',
            color: 'hsl(var(--muted-foreground))',
          }}>
            Debug: Style primitives
          </summary>
          <pre style={{
            marginTop: 8,
            background: '#111827',
            color: '#f3f4f6',
            padding: 12,
            borderRadius: 'var(--radius)',
            overflowX: 'auto',
            fontSize: 11,
          }}>
            {JSON.stringify(component.stylePrimitives ?? component.styles, null, 2)}
          </pre>
        </details>
      </div>

      {/* Notes (no onBlur - explicit Save only) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label htmlFor="notes" style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))' }}>
          Notes
        </label>
        <textarea
          id="notes"
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          placeholder="Add notes about this component..."
          rows={4}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 13,
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'hsl(var(--ring))'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'hsl(var(--border))'}
        />
      </div>

      {/* Tags (explicit Save only) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))' }}>Tags</label>

        {draftTags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {draftTags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 12px',
                  fontSize: 11,
                  background: 'hsl(var(--muted))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                }}
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'hsl(var(--muted-foreground))',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'hsl(var(--foreground))'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'hsl(var(--muted-foreground))'}
                  title="Remove tag"
                  type="button"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No tags yet.</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
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
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'hsl(var(--ring))'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'hsl(var(--border))'}
          />
          <button
            onClick={handleAddTag}
            disabled={newTagInput.trim() === ""}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              fontSize: 13,
              fontWeight: 500,
              transition: 'all 0.15s ease',
              border: 'none',
              cursor: newTagInput.trim() === "" ? 'not-allowed' : 'pointer',
              background: newTagInput.trim() === "" ? 'hsl(var(--muted))' : 'hsl(var(--primary))',
              color: newTagInput.trim() === "" ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))',
            }}
            onMouseEnter={(e) => newTagInput.trim() !== "" && (e.currentTarget.style.filter = 'brightness(0.9)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            type="button"
          >
            Add
          </button>
        </div>
      </div>
      </div>

      {/* Fixed Footer: Save / Cancel / Delete */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px',
          borderTop: '1px solid hsl(var(--border))',
          background: 'hsl(var(--background))',
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          onClick={handleSave}
          disabled={!(component.isDraft || isDirty) || isSaving}
          style={{
            flex: 1,
            padding: '8px 16px',
            background: (!(component.isDraft || isDirty) || isSaving) ? 'hsl(var(--muted))' : 'hsl(var(--primary))',
            color: (!(component.isDraft || isDirty) || isSaving) ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontSize: 14,
            fontWeight: 600,
            cursor: (!(component.isDraft || isDirty) || isSaving) ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!(!(component.isDraft || isDirty) || isSaving)) {
              e.currentTarget.style.filter = 'brightness(0.9)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'none';
          }}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          disabled={!isDirty}
          style={{
            padding: '8px 16px',
            background: 'hsl(var(--background))',
            color: !isDirty ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            fontSize: 14,
            fontWeight: 500,
            cursor: !isDirty ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (isDirty) {
              e.currentTarget.style.background = 'hsl(var(--muted))';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'hsl(var(--background))';
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isDeleting}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: isDeleting ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            color: isDeleting ? 'hsl(var(--foreground))' : '#dc2626',
            opacity: isDeleting ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isDeleting) {
              e.currentTarget.style.background = 'hsl(var(--muted))';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDeleting) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            background: 'hsl(var(--background))',
            borderRadius: 'var(--radius)',
            padding: 24,
            maxWidth: 384,
            margin: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div>
              <h4 style={{
                margin: 0,
                marginBottom: 8,
                fontSize: 16,
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}>
                Delete Component?
              </h4>
              <p style={{
                margin: 0,
                fontSize: 13,
                color: 'hsl(var(--muted-foreground))',
                lineHeight: 1.5,
              }}>
                {component.isDraft
                  ? `Are you sure you want to delete this unsaved draft of "${component.name}"? This action cannot be undone.`
                  : `Are you sure you want to delete "${component.name}"? This action cannot be undone.`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleDelete}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  background: 'hsl(var(--destructive))',
                  color: 'hsl(var(--destructive-foreground))',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'hsl(var(--muted))'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'hsl(var(--background))'}
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
