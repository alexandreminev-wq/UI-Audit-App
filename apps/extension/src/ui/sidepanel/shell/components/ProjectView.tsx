import { Camera, LayoutGrid, ChevronLeft } from 'lucide-react';
import type { Project, Component } from '../App';
import { ComponentDirectory } from './ComponentDirectory';
import { ComponentDetails } from './ComponentDetails';
import { EmptyState } from './EmptyState';
import { InactiveTabScreen } from './InactiveTabScreen';

interface ProjectViewProps {
  project: Project;
  components: Component[];
  onUpdateComponent: (component: Component) => void;
  onDeleteComponent: (componentId: string) => void;
  onRefresh: () => void;
  onBack: () => void;
  onStartCapture: () => void;
  captureEnabled: boolean;
  reviewingComponentId: string | null;
  onSetReviewingComponentId: (componentId: string | null) => void;
  isTabInactive: boolean;
  onActivateTab: () => void;
  tabActivationError: string;
  isLoadingComponents: boolean;
}

export function ProjectView({
  project,
  components,
  onUpdateComponent,
  onDeleteComponent,
  onRefresh,
  onBack,
  onStartCapture,
  captureEnabled,
  reviewingComponentId,
  onSetReviewingComponentId,
  isTabInactive,
  onActivateTab,
  tabActivationError,
  isLoadingComponents,
}: ProjectViewProps) {
  const reviewingComponent = reviewingComponentId
    ? components.find(c => c.id === reviewingComponentId)
    : null;

  // Only show capture button when NOT reviewing a component
  const showCaptureButton = !reviewingComponentId;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
    }}>
      {/* Fixed Header */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid hsl(var(--border))',
        gap: '12px',
      }}>
        {/* Left: Back button + Project title */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flex: 1,
          minWidth: 0,
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              fontWeight: 500,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'hsl(var(--muted))'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="Back to Audits"
          >
            <ChevronLeft style={{ width: 18, height: 18 }} />
          </button>
          <div style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'hsl(var(--foreground))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {project.title || 'Audit Project'}
          </div>
        </div>

        {/* Right: Library button */}
        <button
          onClick={() => {
            const url = chrome.runtime.getURL("viewer.html") + "?project=" + encodeURIComponent(project.id);
            chrome.tabs.create({ url });
          }}
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
            flexShrink: 0,
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
      }}>
        {/* State 1: Inactive tab (highest priority) */}
        {isTabInactive ? (
          <InactiveTabScreen error={tabActivationError} onActivate={onActivateTab} />
        ) : /* State 2: Loading */
        isLoadingComponents && components.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontSize: '14px',
            color: 'hsl(var(--muted-foreground))',
          }}>
            Loading captures...
          </div>
        ) : /* State 3: Empty (no captures) */
        components.length === 0 ? (
          <EmptyState />
        ) : /* State 4: Reviewing a component (full height) */
        reviewingComponent ? (
          <ComponentDetails
            component={reviewingComponent}
            projectId={project.id}
            onUpdateComponent={onUpdateComponent}
            onDeleteComponent={onDeleteComponent}
            onClose={() => onSetReviewingComponentId(null)}
            onRefresh={onRefresh}
          />
        ) : /* State 5: Component Directory (default) */
        (
          <ComponentDirectory
            components={components}
            selectedComponent={reviewingComponent}
            onSelectComponent={(component) => onSetReviewingComponentId(component.id)}
          />
        )}
      </div>

      {/* Fixed Footer - Only for Capture button */}
      {showCaptureButton && (
        <div style={{
          flexShrink: 0,
          padding: '12px 16px',
          borderTop: '1px solid hsl(var(--border))',
          background: 'hsl(var(--background))',
        }}>
          <button
            onClick={onStartCapture}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: captureEnabled ? '#dc2626' : 'hsl(var(--foreground))',
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
            <Camera style={{ width: '16px', height: '16px' }} />
            <span>{captureEnabled ? 'Stop Capture' : 'Start Capture'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

