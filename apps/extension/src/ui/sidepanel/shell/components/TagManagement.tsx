import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useToast } from './Toast';

interface ProjectTagRecord {
  id: string;
  projectId: string;
  tagName: string;
  usageCount: number;
  createdAt: number;
  lastUsedAt: number;
}

interface TagManagementProps {
  projectId: string;
  onClose: () => void;
  onTagsChanged?: () => void; // Callback to refresh component list after tag deletion
}

export function TagManagement({ projectId, onClose, onTagsChanged }: TagManagementProps) {
  const { showToast } = useToast();
  const [tags, setTags] = useState<ProjectTagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    tagName: string;
    usageCount: number;
  } | null>(null);

  // Fetch all tags for the project
  useEffect(() => {
    const fetchTags = async () => {
      setLoading(true);
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'TAGS/GET_ALL',
          projectId,
        });

        if (response?.ok && response.tags) {
          setTags(response.tags);
        } else {
          showToast('Failed to load tags', 'error');
        }
      } catch (err) {
        console.error('[TagManagement] Failed to fetch tags:', err);
        showToast('Failed to load tags', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, [projectId, showToast]);

  // Handle delete confirmation
  const handleDeleteClick = (tag: ProjectTagRecord) => {
    setConfirmDelete({
      tagName: tag.tagName,
      usageCount: tag.usageCount,
    });
  };

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;

    const tagName = confirmDelete.tagName;
    setDeletingTagId(`${projectId}:${tagName}`);
    setConfirmDelete(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TAGS/DELETE',
        projectId,
        tagName,
      });

      if (response?.ok) {
        showToast(
          `Deleted "${tagName}" from ${response.affectedComponents} component${
            response.affectedComponents === 1 ? '' : 's'
          }`,
          'success'
        );
        // Remove tag from local state
        setTags((prev) => prev.filter((t) => t.tagName !== tagName));
        // Notify parent to refresh component list
        onTagsChanged?.();
      } else {
        showToast(`Failed to delete tag: ${response?.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error('[TagManagement] Failed to delete tag:', err);
      showToast(`Failed to delete tag: ${String(err)}`, 'error');
    } finally {
      setDeletingTagId(null);
    }
  };

  // Handle cancel delete
  const handleCancelDelete = () => {
    setConfirmDelete(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'hsl(var(--background))',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Fixed Header */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid hsl(var(--border))',
          gap: '12px',
          background: 'hsl(var(--background))',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
          }}
        >
          Manage Tags
        </h2>
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
          onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--muted))')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="Close"
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: 16,
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              fontSize: 14,
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            Loading tags...
          </div>
        ) : tags.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 48,
                marginBottom: 16,
                opacity: 0.3,
              }}
            >
              🏷️
            </div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
                margin: 0,
                marginBottom: 8,
              }}
            >
              No tags created yet
            </h3>
            <p
              style={{
                fontSize: 14,
                color: 'hsl(var(--muted-foreground))',
                lineHeight: 1.5,
                maxWidth: '280px',
                margin: 0,
              }}
            >
              Tags will appear here once you add them to components.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {tags.map((tag) => {
              const isDeleting = deletingTagId === tag.id;
              return (
                <div
                  key={tag.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid hsl(var(--border))',
                    transition: 'background 0.15s ease',
                    opacity: isDeleting ? 0.5 : 1,
                    pointerEvents: isDeleting ? 'none' : 'auto',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'hsl(var(--muted))')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'hsl(var(--foreground))',
                        marginBottom: 4,
                      }}
                    >
                      {tag.tagName}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'hsl(var(--muted-foreground))',
                      }}
                    >
                      Used in {tag.usageCount} component
                      {tag.usageCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteClick(tag)}
                    disabled={isDeleting}
                    style={{
                      padding: 8,
                      color: 'hsl(var(--destructive))',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) =>
                      !isDeleting &&
                      (e.currentTarget.style.background =
                        'hsl(var(--destructive) / 0.1)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                    title="Delete tag"
                  >
                    <Trash2 style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDelete && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={handleCancelDelete}
        >
          <div
            style={{
              background: 'hsl(var(--background))',
              borderRadius: 'var(--radius)',
              padding: 24,
              maxWidth: 400,
              margin: '0 16px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: 0,
                marginBottom: 12,
                fontSize: 16,
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}
            >
              Delete "{confirmDelete.tagName}"?
            </h3>
            <p
              style={{
                margin: 0,
                marginBottom: 24,
                fontSize: 14,
                color: 'hsl(var(--muted-foreground))',
                lineHeight: 1.5,
              }}
            >
              This will remove the tag from {confirmDelete.usageCount} component
              {confirmDelete.usageCount === 1 ? '' : 's'}. This action cannot be
              undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelDelete}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                  border: '1px solid hsl(var(--border))',
                  cursor: 'pointer',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'hsl(var(--muted))')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'hsl(var(--background))')
                }
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'hsl(var(--destructive))',
                  color: 'hsl(var(--destructive-foreground))',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.filter = 'brightness(0.9)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
              >
                Delete Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

