import { useState } from 'react';
import { FolderOpen, Plus, LayoutGrid, ChevronRight } from 'lucide-react';
import type { Project } from '../App';

interface StartScreenProps {
  onCreateProject: (title: string) => void;
  onOpenProject: (project: Project) => void;
  projects: Project[];
  loading: boolean;
  error: string;
}

export function StartScreen({ onCreateProject, onOpenProject, projects, loading, error }: StartScreenProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');

  const handleCreateProject = () => {
    if (projectTitle.trim()) {
      onCreateProject(projectTitle.trim());
      setProjectTitle('');
      setDrawerOpen(false);
    }
  };

  const handleOpenViewer = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const getProjectCount = (project: Project): string => {
    const count = project.components.length;
    return count === 1 ? '1 Capture' : `${count} Captures`;
  };

  return (
    <>
      {/* Main Container: Fixed Header + Scrollable Content + Fixed Footer */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Fixed Header */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid hsl(var(--border))',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px',
            fontSize: '14px',
            fontWeight: 500,
            color: 'hsl(var(--foreground))',
          }}>
            Audits
          </div>
          <button
            onClick={handleOpenViewer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'hsl(var(--muted))'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="Open Library"
          >
            <LayoutGrid style={{ width: 18, height: 18 }} />
            <span>Library</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {error && (
            <div style={{
              padding: '12px',
              background: 'hsl(var(--destructive) / 0.1)',
              color: 'hsl(var(--destructive))',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{
              fontSize: '14px',
              color: 'hsl(var(--muted-foreground))',
              textAlign: 'center',
              padding: '24px',
            }}>
              Loading projects...
            </div>
          )}

          {!loading && projects.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Section Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <FolderOpen style={{
                  width: '16px',
                  height: '16px',
                  color: 'hsl(var(--muted-foreground))',
                }} />
                <span style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'hsl(var(--muted-foreground))',
                }}>
                  Recent
                </span>
              </div>

              {/* Project Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {projects.map((project) => {
                  const dateText = formatDate(project.updatedAt || project.createdAt);
                  const countText = getProjectCount(project);

                  return (
                    <button
                      key={project.id}
                      onClick={() => onOpenProject(project)}
                      style={{
                        padding: '16px',
                        textAlign: 'left',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        background: 'hsl(var(--background))',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'hsl(var(--ring))';
                        e.currentTarget.style.background = 'hsl(var(--muted) / 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'hsl(var(--border))';
                        e.currentTarget.style.background = 'hsl(var(--background))';
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '15px',
                          fontWeight: 500,
                          color: 'hsl(var(--foreground))',
                          marginBottom: '4px',
                        }}>
                          {project.title}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: 'hsl(var(--muted-foreground))',
                        }}>
                          {countText} • {dateText}
                        </div>
                      </div>
                      <ChevronRight style={{
                        width: '20px',
                        height: '20px',
                        color: 'hsl(var(--muted-foreground))',
                        flexShrink: 0,
                      }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
            }}>
              {/* Illustration Card */}
              <div style={{
                width: '220px',
                padding: '32px',
                border: '2px dashed #e0e0e0',
                borderRadius: '8px',
                background: '#ffffff',
                marginBottom: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                {/* Screenshot area */}
                <div style={{
                  width: '100%',
                  height: '80px',
                  background: '#d1d5db',
                  borderRadius: '4px',
                }} />
                
                {/* Text lines */}
                <div style={{
                  width: '80%',
                  height: '8px',
                  background: '#d1d5db',
                  borderRadius: '2px',
                }} />
                <div style={{
                  width: '60%',
                  height: '8px',
                  background: '#d1d5db',
                  borderRadius: '2px',
                }} />
                
                {/* Button representation */}
                <div style={{
                  width: '45%',
                  height: '12px',
                  background: '#1f2937',
                  borderRadius: '2px',
                  marginTop: '4px',
                }} />
                
                {/* More text lines */}
                <div style={{
                  width: '90%',
                  height: '8px',
                  background: '#d1d5db',
                  borderRadius: '2px',
                  marginTop: '4px',
                }} />
              </div>
              
              {/* Heading */}
              <h2 style={{
                fontSize: '17px',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
                margin: 0,
                marginBottom: '8px',
                textAlign: 'center',
              }}>
                Your audit is one step away
              </h2>
              
              {/* Subtext */}
              <p style={{
                fontSize: '14px',
                color: 'hsl(var(--muted-foreground))',
                lineHeight: 1.5,
                maxWidth: '280px',
                margin: 0,
                textAlign: 'center',
              }}>
                Capture elements on the page to create and manage your UI inventory.
              </p>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid hsl(var(--border))',
        }}>
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'hsl(var(--foreground))',
              color: 'hsl(var(--background))',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            <span>Create New Audit</span>
          </button>
        </div>
      </div>

      {/* Slide-in Drawer */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
              animation: 'fadeIn 0.2s ease',
            }}
          />

          {/* Drawer */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'hsl(var(--background))',
              borderTop: '1px solid hsl(var(--border))',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
              padding: '24px',
              zIndex: 1000,
              animation: 'slideUp 0.3s ease',
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 600,
                color: 'hsl(var(--foreground))',
              }}>
                Create New Audit
              </h2>

              <div>
                <label
                  htmlFor="project-title"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'hsl(var(--foreground))',
                  }}
                >
                  Project Title
                </label>
                <input
                  id="project-title"
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateProject();
                    }
                    if (e.key === 'Escape') {
                      setDrawerOpen(false);
                      setProjectTitle('');
                    }
                  }}
                  placeholder="Enter project name..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                    outline: 'none',
                    color: 'hsl(var(--foreground))',
                    background: 'hsl(var(--input-background, var(--background)))',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'hsl(var(--ring))')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleCreateProject}
                  disabled={!projectTitle.trim()}
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    background: !projectTitle.trim() ? 'hsl(var(--muted))' : 'hsl(var(--primary))',
                    color: !projectTitle.trim() ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: !projectTitle.trim() ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (projectTitle.trim()) {
                      e.currentTarget.style.filter = 'brightness(0.9)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'none';
                  }}
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    setProjectTitle('');
                  }}
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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'hsl(var(--muted))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'hsl(var(--background))';
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* Animation styles */}
          <style>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            @keyframes slideUp {
              from {
                transform: translateY(100%);
              }
              to {
                transform: translateY(0);
              }
            }
          `}</style>
        </>
      )}
    </>
  );
}
