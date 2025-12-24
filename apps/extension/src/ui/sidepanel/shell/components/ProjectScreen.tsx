import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, ChevronDown, ChevronRight, RefreshCw, ExternalLink } from 'lucide-react';
import type { Project, Component } from '../App';
import type { CaptureRecordV2 } from '../../../../../types/capture';
import { ComponentDirectory } from './ComponentDirectory';
import { ComponentDetails } from './ComponentDetails';

interface ProjectScreenProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  onBack: () => void;
}

function categorizeByTagName(tagName: string): string {
  const tag = tagName.toLowerCase();
  if (tag === 'button') return 'Buttons';
  if (tag === 'a') return 'Links';
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6' || tag === 'p') return 'Typography';
  if (tag === 'img' || tag === 'video') return 'Media';
  return 'Other';
}

export function ProjectScreen({ project, onUpdateProject: _onUpdateProject, onBack }: ProjectScreenProps) {
  const [currentUrl] = useState('https://example.com/dashboard');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [showDirectory, setShowDirectory] = useState(false);
  const [auditEnabled, setAuditEnabled] = useState<boolean | null>(null);
  const [capturedComponents, setCapturedComponents] = useState<Component[]>([]);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const pendingSelectIdRef = useRef<string | null>(null);

  const selectedComponent = capturedComponents.find(c => c.id === selectedComponentId) ?? null;

  const loadCaptures = () => {
    // Revoke previous object URLs to prevent memory leaks
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();

    chrome.runtime.sendMessage({ type: "UI/GET_PROJECT_CAPTURES" }, (resp) => {
      if (chrome.runtime.lastError) return;
      if (resp?.ok && Array.isArray(resp.captures)) {
        const components: Component[] = resp.captures.map((capture: CaptureRecordV2) => {
          const tagName = capture.element?.tagName || 'unknown';

          // Convert styles to Record<string, string>
          const stylesObj = capture.styles?.primitives || capture.styles || {};
          const styles: Record<string, string> = {};
          for (const [key, value] of Object.entries(stylesObj)) {
            styles[key] = typeof value === 'string' ? value : JSON.stringify(value);
          }

          // Extract URL with fallbacks
          const captureUrl = capture.page?.url || capture.url || (capture as any).pageUrl || '';

          return {
            id: capture.id,
            name: capture.accessibleName || `<${tagName}>`,
            category: categorizeByTagName(tagName),
            url: captureUrl,
            html: capture.element?.outerHTML || '',
            styles,
            imageUrl: '',
            comments: ''
          };
        });
        setCapturedComponents(components);

        // Auto-select pending component if set
        if (pendingSelectIdRef.current) {
          const found = components.find(c => c.id === pendingSelectIdRef.current);
          if (found) {
            setSelectedComponentId(found.id);
          }
          pendingSelectIdRef.current = null;
        }

        // Load screenshots asynchronously
        resp.captures.forEach((capture: CaptureRecordV2) => {
          const blobId = capture.screenshot?.screenshotBlobId;
          if (blobId) {
            chrome.runtime.sendMessage({ type: "AUDIT/GET_BLOB", blobId }, (blobResp) => {
              if (chrome.runtime.lastError) return;
              if (blobResp?.ok && blobResp.arrayBuffer && blobResp.mimeType) {
                const bytes: number[] = blobResp.arrayBuffer;
                const blob = new Blob([new Uint8Array(bytes)], { type: blobResp.mimeType });
                const objectUrl = URL.createObjectURL(blob);

                objectUrlsRef.current.add(objectUrl);
                setCapturedComponents(prevComponents =>
                  prevComponents.map(comp =>
                    comp.id === capture.id ? { ...comp, imageUrl: objectUrl } : comp
                  )
                );
              }
            });
          }
        });
      }
    });
  };

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "AUDIT/GET_STATE" }, (resp) => {
      if (chrome.runtime.lastError) return;
      if (typeof resp?.enabled === "boolean") setAuditEnabled(resp.enabled);
    });
  }, []);

  useEffect(() => {
    loadCaptures();
  }, []);

  // Listen for capture saved events
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg?.type === "UI/CAPTURE_SAVED") {
        if (typeof msg.projectId === "string" && typeof msg.captureId === "string") {
          if (msg.projectId === project.id) {
            pendingSelectIdRef.current = msg.captureId;
            loadCaptures();
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [project.id]);

  // Listen for tab registration events
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg?.type === "UI/TAB_REGISTERED") {
        // Re-query audit state to keep button label accurate
        chrome.runtime.sendMessage({ type: "AUDIT/GET_STATE" }, (resp) => {
          if (chrome.runtime.lastError) return;
          if (typeof resp?.enabled === "boolean") {
            setAuditEnabled(resp.enabled);
          }
        });
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  const handleCaptureElement = () => {
    if (auditEnabled === null) return;

    const nextEnabled = !auditEnabled;
    chrome.runtime.sendMessage(
      { type: "AUDIT/TOGGLE", enabled: nextEnabled },
      (resp) => {
        if (chrome.runtime.lastError) {
          console.warn("[UI Inventory] AUDIT/TOGGLE failed:", chrome.runtime.lastError.message);
          return;
        }
        if (resp?.ok) {
          setAuditEnabled(nextEnabled);
        }
      }
    );
  };

  const handleUpdateComponent = (updatedComponent: Component) => {
    const updatedComponents = capturedComponents.map(c =>
      c.id === updatedComponent.id ? updatedComponent : c
    );
    setCapturedComponents(updatedComponents);
  };

  const handleDeleteComponent = (componentId: string) => {
    chrome.runtime.sendMessage({ type: "UI/DELETE_CAPTURE", captureId: componentId }, (resp) => {
      if (chrome.runtime.lastError) {
        console.warn("[UI Inventory] Failed to delete capture:", chrome.runtime.lastError.message);
        return;
      }

      if (resp?.ok) {
        if (selectedComponentId === componentId) {
          setSelectedComponentId(null);
        }
        loadCaptures();
      } else {
        console.warn("[UI Inventory] Delete capture failed:", resp?.error);
      }
    });
  };

  const handleOpenViewer = () => {
    const url = chrome.runtime.getURL("viewer.html") + "?projectId=" + encodeURIComponent(project.id);
    chrome.tabs.create({ url });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={onBack}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="flex-1 truncate">{project.title}</h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCaptureElement}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span>{auditEnabled === null ? 'Capture Element' : auditEnabled ? 'Stop Capture' : 'Capture Element'}</span>
          </button>
          <button
            onClick={loadCaptures}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenViewer}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            title="Open Viewer"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Current Page */}
      <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
        <div className="text-xs text-gray-600 mb-1">Current Page</div>
        <div className="text-sm text-gray-900 truncate">{currentUrl}</div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Component Directory */}
        <div className="bg-white border-b border-gray-200">
          <button
            onClick={() => setShowDirectory(!showDirectory)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-gray-900">Component Directory</span>
            {showDirectory ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
          
          {showDirectory && (
            <div className="border-t border-gray-200">
              <ComponentDirectory
                components={capturedComponents}
                selectedComponent={selectedComponent}
                onSelectComponent={(component) => setSelectedComponentId(component.id)}
              />
            </div>
          )}
        </div>

        {/* Component Details */}
        {selectedComponent ? (
          <ComponentDetails
            component={selectedComponent}
            onUpdateComponent={handleUpdateComponent}
            onDeleteComponent={handleDeleteComponent}
            onClose={() => setSelectedComponentId(null)}
          />
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p>Select a component from the directory to view details</p>
            <p className="text-sm mt-2">or capture a new element</p>
          </div>
        )}
      </div>
    </div>
  );
}
