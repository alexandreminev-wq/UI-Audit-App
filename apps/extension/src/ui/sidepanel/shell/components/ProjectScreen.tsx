import { useState, useEffect, useRef } from 'react';
import type { Project, Component } from '../App';
import type { CaptureRecordV2 } from '../../../../../types/capture';
import { ProjectView } from './ProjectView';
import { classifyCapture } from '../utils/classifyCapture';
import { deriveComponentKey } from '../../../shared/componentKey';

interface ProjectScreenProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
  onBack: () => void;
  isTabInactive: boolean;
  onActivateTab: () => void;
  tabActivationError: string;
}

export function ProjectScreen({
  project,
  onUpdateProject: _onUpdateProject,
  onBack,
  isTabInactive,
  onActivateTab,
  tabActivationError
}: ProjectScreenProps) {
  const [capturedComponents, setCapturedComponents] = useState<Component[]>([]);
  const [isLoadingComponents, setIsLoadingComponents] = useState<boolean>(false);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const pendingReviewIdRef = useRef<string | null>(null);

  // 7.8.1: Current page tab state (not extension tabs)
  const [currentPageTabId, setCurrentPageTabId] = useState<number | null>(null);
  const [auditEnabled, setAuditEnabled] = useState<boolean>(false);
  const [reviewingComponentId, setReviewingComponentId] = useState<string | null>(null);

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

        // 1) Group captures by componentKey
        const capturesByKey = new Map<string, CaptureRecordV2[]>();
        for (const capture of captures) {
          const key = deriveComponentKey(capture);
          if (!capturesByKey.has(key)) {
            capturesByKey.set(key, []);
          }
          capturesByKey.get(key)!.push(capture);
        }

        // 2) Build one component per componentKey
        const baseComponents: Component[] = Array.from(capturesByKey.entries()).map(([componentKey, stateCaptures]) => {
          // Sort captures by state priority: default > hover > active > focus > disabled > open
          const stateOrder = ["default", "hover", "active", "focus", "disabled", "open"];
          const sortedCaptures = [...stateCaptures].sort((a, b) => {
            const aState = a.styles?.evidence?.state || "default";
            const bState = b.styles?.evidence?.state || "default";
            return stateOrder.indexOf(aState) - stateOrder.indexOf(bState);
          });

          // Use first capture (default state if available) as the primary/display capture
          const primaryCapture = sortedCaptures[0];

          // Use classifier for designer-friendly categorization and naming (NO state suffix)
          const classification = classifyCapture(primaryCapture);

          // Build availableStates array - include ALL captured states
          // UI will decide whether to show based on current category (including overrides)
          const availableStates = sortedCaptures.map(capture => ({
            state: (capture.styles?.evidence?.state || "default") as "default" | "hover" | "active" | "focus" | "disabled" | "open",
            captureId: capture.id,
            screenshotBlobId: capture.screenshot?.screenshotBlobId,
          }));
          const titleType = (classification.typeKey || "")
            .replace(/([A-Z])/g, ' $1')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .trim()
            .split(' ')
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

          // Convert styles to Record<string, string>
          const stylesObj = primaryCapture.styles?.primitives || primaryCapture.styles || {};
          const styles: Record<string, string> = {};
          for (const [key, value] of Object.entries(stylesObj)) {
            styles[key] = typeof value === 'string' ? value : JSON.stringify(value);
          }

          // Extract URL with fallbacks
          const captureUrl = primaryCapture.page?.url || primaryCapture.url || (primaryCapture as any).pageUrl || '';

          const component = {
            id: primaryCapture.id, // primary captureId (default state)
            componentKey,
            name: primaryCapture.displayName || classification.displayName, // Use capture displayName if available
            description: primaryCapture.description,
            category: classification.functionalCategory,
            type: titleType || classification.typeKey || primaryCapture.element?.tagName?.toLowerCase?.() || "Element",
            status: "Unreviewed",
            availableStates,
            selectedState: availableStates[0].state,
            url: captureUrl,
            html: primaryCapture.element?.outerHTML || '',
            styles,
            stylePrimitives: primaryCapture.styles?.primitives,
            styleEvidence: {
              author: primaryCapture.styles?.author,
              tokens: primaryCapture.styles?.tokens,
              evidence: primaryCapture.styles?.evidence,
            },
            imageUrl: '',
            screenshotBlobId: primaryCapture.screenshot?.screenshotBlobId,
            comments: '',
            tags: [],
            typeKey: classification.typeKey,
            confidence: classification.confidence,
            isDraft: primaryCapture.isDraft,
          };

          return component;
        });

        setCapturedComponents(baseComponents);
        
        // Loading is complete - base components are ready to display
        setIsLoadingComponents(false);

        // Preserve currently reviewing component after refresh
        // (important when saving a draft - the component ID might change)
        if (reviewingComponentId) {
          const currentlyReviewing = capturedComponents.find(c => c.id === reviewingComponentId);
          if (currentlyReviewing) {
            // Find the same component by componentKey in the new list
            const stillExists = baseComponents.find(c => c.componentKey === currentlyReviewing.componentKey);
            if (stillExists && stillExists.id !== reviewingComponentId) {
              // Component exists but with a new ID - update reviewingComponentId
              setReviewingComponentId(stillExists.id);
            } else if (!stillExists) {
              // Component was deleted - close detail view
              setReviewingComponentId(null);
            }
          }
        }

        // Auto-review pending component if set (when a new capture is saved)
        if (pendingReviewIdRef.current) {
          const found = baseComponents.find(c => c.id === pendingReviewIdRef.current);
          if (found) {
            setReviewingComponentId(found.id);
          }
          pendingReviewIdRef.current = null;
        }

        // 2) Load annotations and merge opportunistically (should never block base render)
        chrome.runtime.sendMessage({ type: "ANNOTATIONS/GET_PROJECT", projectId: project.id }, (annResp) => {
          if (chrome.runtime.lastError) {
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
        });

        // 3) Load identity overrides and merge opportunistically
        chrome.runtime.sendMessage({ type: "OVERRIDES/GET_PROJECT", projectId: project.id }, (ovResp) => {
          if (chrome.runtime.lastError) return;
          const overrides: Array<{
            componentKey: string;
            displayName: string | null;
            description: string | null;
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
                description: (o.description && o.description.trim() !== "") ? o.description : comp.description,
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
            pendingReviewIdRef.current = msg.captureId;
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
          
          // Immediately set project mapping for the new tab to prevent empty state
          chrome.runtime.sendMessage({
            type: "UI/SET_ACTIVE_PROJECT_FOR_TAB",
            projectId: project.id,
            tabId,
          }, (resp) => {
            if (chrome.runtime.lastError) {
              console.warn("[ProjectScreen] Failed to set project for tab:", chrome.runtime.lastError);
            }
          });
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

      // M9: Listen for audit state changes (e.g., from hotkey)
      if (msg?.type === "UI/AUDIT_STATE_CHANGED") {
        const { tabId, enabled } = msg;
        // Only update if it's for the current page tab
        if (tabId === currentPageTabId && typeof enabled === "boolean") {
          console.log("[ProjectScreen] Audit state changed via hotkey:", { tabId, enabled });
          setAuditEnabled(enabled);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [project.id, currentPageTabId]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

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
        if (currentPageTabId !== null) {
          loadCapturesForTab(currentPageTabId);
        }
      } else {
        console.warn("[UI Inventory] Delete capture failed:", resp?.error);
      }
    });
  };

  const handleRefresh = () => {
    if (currentPageTabId !== null) {
      loadCapturesForTab(currentPageTabId);
    }
  };

  const handleStartCapture = () => {
    if (currentPageTabId === null) return;

    // Toggle capture for current page tab
    const nextEnabled = !auditEnabled;
    chrome.runtime.sendMessage(
      { type: "AUDIT/TOGGLE", enabled: nextEnabled, tabId: currentPageTabId },
      (resp) => {
        if (chrome.runtime.lastError) {
          console.warn("[ProjectScreen] AUDIT/TOGGLE failed:", chrome.runtime.lastError.message);
          return;
        }
        if (resp?.ok) {
          setAuditEnabled(nextEnabled);
        }
      }
    );
  };

  return (
    <ProjectView
      project={project}
      components={capturedComponents}
      onUpdateComponent={handleUpdateComponent}
      onDeleteComponent={handleDeleteComponent}
      onRefresh={handleRefresh}
      onBack={onBack}
      onStartCapture={handleStartCapture}
      captureEnabled={auditEnabled}
      reviewingComponentId={reviewingComponentId}
      onSetReviewingComponentId={setReviewingComponentId}
      isTabInactive={isTabInactive}
      onActivateTab={onActivateTab}
      tabActivationError={tabActivationError}
      isLoadingComponents={isLoadingComponents}
    />
  );
}
