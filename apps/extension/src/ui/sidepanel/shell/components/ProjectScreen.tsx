import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, ChevronDown, ChevronRight, RefreshCw, ExternalLink } from 'lucide-react';
import type { Project, Component } from '../App';
import type { CaptureRecordV2 } from '../../../../../types/capture';
import { ComponentDirectory } from './ComponentDirectory';
import { ComponentDetails } from './ComponentDetails';
import { classifyCapture } from '../utils/classifyCapture';
import { deriveComponentKey } from '../../../shared/componentKey';

interface ProjectScreenProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  onBack: () => void;
}

export function ProjectScreen({ project, onUpdateProject: _onUpdateProject, onBack }: ProjectScreenProps) {
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [showDirectory, setShowDirectory] = useState(false);
  const [auditEnabled, setAuditEnabled] = useState<boolean | null>(null);
  const [capturedComponents, setCapturedComponents] = useState<Component[]>([]);
  const [isLoadingComponents, setIsLoadingComponents] = useState<boolean>(false);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const pendingSelectIdRef = useRef<string | null>(null);

  // 7.8.1: Current page tab state (not extension tabs)
  const [currentPageTabId, setCurrentPageTabId] = useState<number | null>(null);

  const selectedComponent = capturedComponents.find(c => c.id === selectedComponentId) ?? null;

  // App-level gating (in App.tsx) ensures ProjectScreen is only shown for the owner tab.
  const isCaptureEnabledHere = auditEnabled === true;

  // 7.8.1: Helper to get active page tab and URL (not extension pages)
  const refreshCurrentPageTab = async (): Promise<void> => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const pageTab = tabs[0];

      if (pageTab) {
        setCurrentPageTabId(pageTab.id ?? null);
        console.log("[ProjectScreen] Current page tab:", pageTab.id, pageTab.url);
      } else {
        setCurrentPageTabId(null);
      }
    } catch (err) {
      console.error("[ProjectScreen] Failed to query active tab:", err);
      setCurrentPageTabId(null);
    }
  };

  const loadCapturesForTab = (tabId: number, attempt: number = 0) => {
    // Revoke previous object URLs to prevent memory leaks
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();

    setIsLoadingComponents(true);

    chrome.runtime.sendMessage({ type: "UI/GET_PROJECT_CAPTURES", tabId }, (resp) => {
      if (chrome.runtime.lastError) {
        // Transient SW/message timing issues happen after reloads. Retry once.
        if (attempt === 0) {
          setTimeout(() => loadCapturesForTab(tabId, 1), 350);
        } else {
          setIsLoadingComponents(false);
        }
        return;
      }
      if (resp?.ok && Array.isArray(resp.captures)) {
        const captures: CaptureRecordV2[] = resp.captures;

        // 1) Build base components immediately (independent of annotations)
        const baseComponents: Component[] = captures.map((capture) => {
          const componentKey = deriveComponentKey(capture);

          // Use classifier for designer-friendly categorization and naming
          const classification = classifyCapture(capture);
          const titleType = (classification.typeKey || "")
            .replace(/([A-Z])/g, ' $1')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .trim()
            .split(' ')
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

          // Convert styles to Record<string, string>
          const stylesObj = capture.styles?.primitives || capture.styles || {};
          const styles: Record<string, string> = {};
          for (const [key, value] of Object.entries(stylesObj)) {
            styles[key] = typeof value === 'string' ? value : JSON.stringify(value);
          }

          // Extract URL with fallbacks
          const captureUrl = capture.page?.url || capture.url || (capture as any).pageUrl || '';

          return {
            id: capture.id, // captureId
            componentKey, // deterministic grouping id (matches Viewer)
            name: classification.displayName,
            category: classification.functionalCategory,
            type: titleType || classification.typeKey || capture.element?.tagName?.toLowerCase?.() || "Element",
            status: "Unreviewed",
            url: captureUrl,
            html: capture.element?.outerHTML || '',
            styles,
            stylePrimitives: capture.styles?.primitives, // Pass through for Visual Essentials
            imageUrl: '',
            comments: '',
            tags: [],
            typeKey: classification.typeKey,
            confidence: classification.confidence,
            isDraft: capture.isDraft, // 7.8: Draft status
          };
        });

        setCapturedComponents(baseComponents);

        // Auto-select pending component if set
        if (pendingSelectIdRef.current) {
          const found = baseComponents.find(c => c.id === pendingSelectIdRef.current);
          if (found) {
            setSelectedComponentId(found.id);
          }
          pendingSelectIdRef.current = null;
        }

        // 2) Load annotations and merge opportunistically (should never block base render)
        chrome.runtime.sendMessage({ type: "ANNOTATIONS/GET_PROJECT", projectId: project.id }, (annResp) => {
          if (chrome.runtime.lastError) {
            setIsLoadingComponents(false);
            return;
          }

          const annotations: Array<{ componentKey: string; notes?: string | null; tags?: string[] }> =
            annResp?.ok && Array.isArray(annResp.annotations) ? annResp.annotations : [];
          const annotationsMap = new Map<string, { notes: string; tags: string[] }>(
            annotations.map((a) => [
              a.componentKey,
              { notes: a.notes ?? "", tags: Array.isArray(a.tags) ? a.tags : [] },
            ])
          );
          setCapturedComponents((prev) =>
            prev.map((comp) => {
              const ann = annotationsMap.get(comp.componentKey);
              if (!ann) return comp;
              return {
                ...comp,
                comments: ann.notes ?? "",
                tags: ann.tags ?? [],
              };
            })
          );

          setIsLoadingComponents(false);
        });

        // 3) Load identity overrides and merge opportunistically
        chrome.runtime.sendMessage({ type: "OVERRIDES/GET_PROJECT", projectId: project.id }, (ovResp) => {
          if (chrome.runtime.lastError) return;
          const overrides: Array<{
            componentKey: string;
            displayName: string | null;
            categoryOverride: string | null;
            typeOverride: string | null;
            statusOverride: string | null;
          }> = ovResp?.ok && Array.isArray(ovResp.overrides) ? ovResp.overrides : [];

          const overridesMap = new Map(
            overrides.map((o) => [o.componentKey, o])
          );

          setCapturedComponents((prev) =>
            prev.map((comp) => {
              const o = overridesMap.get(comp.componentKey);
              if (!o) return { ...comp, overrides: undefined };
              return {
                ...comp,
                name: (o.displayName && o.displayName.trim() !== "") ? o.displayName : comp.name,
                category: (o.categoryOverride && o.categoryOverride.trim() !== "") ? o.categoryOverride : comp.category,
                type: (o.typeOverride && o.typeOverride.trim() !== "") ? o.typeOverride : comp.type,
                status: (o.statusOverride && o.statusOverride.trim() !== "") ? o.statusOverride : comp.status,
                overrides: {
                  displayName: o.displayName ?? null,
                  categoryOverride: o.categoryOverride ?? null,
                  typeOverride: o.typeOverride ?? null,
                  statusOverride: o.statusOverride ?? null,
                },
              };
            })
          );
        });

        // Load screenshots asynchronously
        captures.forEach((capture: CaptureRecordV2) => {
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
      } else {
        setIsLoadingComponents(false);
      }
    });
  };

  // 7.8.1: On mount, refresh current page tab, active audit tab, and set active project
  useEffect(() => {
    (async () => {
      // Refresh current page tab and URL
      await refreshCurrentPageTab();

      // Get the current page tab ID to use for project association
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id ?? null;

      if (tabId !== null) {
        // Set active project for this tab
        chrome.runtime.sendMessage({
          type: "UI/SET_ACTIVE_PROJECT_FOR_TAB",
          projectId: project.id,
          tabId,
        }, (resp) => {
          if (chrome.runtime.lastError) {
            console.error("[ProjectScreen] Failed to set active project:", chrome.runtime.lastError);
          } else if (!resp?.ok) {
            console.error("[ProjectScreen] Failed to set active project:", resp?.error);
          }
        });

        // Get audit state for this tab
        chrome.runtime.sendMessage({ type: "AUDIT/GET_STATE", tabId }, (resp) => {
          if (chrome.runtime.lastError) return;
          if (typeof resp?.enabled === "boolean") {
            setAuditEnabled(resp.enabled);
          }
        });
      }
    })();
  }, [project.id]);

  useEffect(() => {
    if (currentPageTabId !== null) {
      loadCapturesForTab(currentPageTabId);
    }
  }, [currentPageTabId, project.id]);

  // Listen for capture saved events
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg?.type === "UI/CAPTURE_SAVED") {
        if (typeof msg.projectId === "string" && typeof msg.captureId === "string") {
          if (msg.projectId === project.id) {
            pendingSelectIdRef.current = msg.captureId;
            if (currentPageTabId !== null) {
              loadCapturesForTab(currentPageTabId);
            } else {
              // Best effort: query tab and load
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const id = tabs?.[0]?.id;
                if (typeof id === "number") {
                  loadCapturesForTab(id);
                }
              });
            }
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
    const handleMessage = async (msg: any) => {
      if (msg?.type === "UI/TAB_REGISTERED") {
        await refreshCurrentPageTab();

        // Re-query audit state for current page tab
        if (currentPageTabId !== null) {
          chrome.runtime.sendMessage({ type: "AUDIT/GET_STATE", tabId: currentPageTabId }, (resp) => {
            if (chrome.runtime.lastError) return;
            if (typeof resp?.enabled === "boolean") {
              setAuditEnabled(resp.enabled);
            }
          });
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [currentPageTabId]);

  // 7.8.1: Listen for active tab changes from service worker
  useEffect(() => {
    const handleMessage = async (msg: any) => {
      if (msg?.type === "UI/ACTIVE_TAB_CHANGED") {
        const { tabId, url } = msg;

        console.log("[ProjectScreen] Active tab changed:", tabId, url);

        // Update current page tab state
        if (typeof tabId === "number") {
          setCurrentPageTabId(tabId);
        }

        // Get audit state for the new tab
        if (typeof tabId === "number") {
          chrome.runtime.sendMessage({ type: "AUDIT/GET_STATE", tabId }, (resp) => {
            if (chrome.runtime.lastError) return;
            if (typeof resp?.enabled === "boolean") {
              setAuditEnabled(resp.enabled);
            }
          });
        }
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
    if (currentPageTabId === null) return;

    // 7.8.1: Toggle capture for current page tab
    const nextEnabled = !isCaptureEnabledHere;
    chrome.runtime.sendMessage(
      { type: "AUDIT/TOGGLE", enabled: nextEnabled, tabId: currentPageTabId },
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
        if (currentPageTabId !== null) {
          loadCapturesForTab(currentPageTabId);
        }
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
            <span>{isCaptureEnabledHere ? 'Stop Capture' : 'Capture Element'}</span>
          </button>
          <button
            onClick={() => {
              if (currentPageTabId !== null) {
                loadCapturesForTab(currentPageTabId);
              }
            }}
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
            projectId={project.id}
            onUpdateComponent={handleUpdateComponent}
            onDeleteComponent={handleDeleteComponent}
            onClose={() => setSelectedComponentId(null)}
            onRefresh={() => {
              if (currentPageTabId !== null) {
                loadCapturesForTab(currentPageTabId);
              }
            }}
          />
        ) : (
          <div className="p-8 text-center text-gray-500">
            {isLoadingComponents ? (
              <p>Loading components...</p>
            ) : (
              <>
                <p>Select a component from the directory to view details</p>
                <p className="text-sm mt-2">or capture a new element</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
