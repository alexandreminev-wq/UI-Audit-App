export type FunctionalCategory =
  | "Actions"
  | "Forms"
  | "Navigation"
  | "Content"
  | "Feedback"
  | "Media"
  | "Layout"
  | "Screenshots"
  | "Unknown";

export type Classification = {
  functionalCategory: FunctionalCategory;
  typeKey: string;       // stable internal id like "button", "link", "textInput"
  displayName: string;   // designer-readable
  confidence: number;    // 0-100 (debug-only)
};

/**
 * Convert "textInput" -> "Text Input"
 */
function titleCase(key: string): string {
  // Split on capital letters or known patterns
  const spaced = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();

  return spaced
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Collapse whitespace and trim
 */
function collapseWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Extract best accessible label from capture
 */
function getBestLabel(capture: any): string {
  const candidates = [
    capture?.element?.intent?.accessibleName,
    capture?.accessibleName,
    capture?.accessibleLabel,
    capture?.name,
    capture?.element?.accessibleName,
    capture?.element?.ariaLabel,
    capture?.element?.label,
    capture?.element?.placeholder,
    capture?.element?.alt,
    capture?.element?.title,
    capture?.element?.text,
    capture?.element?.innerText,
    capture?.element?.textContent,
    capture?.element?.textPreview,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string') {
      const normalized = collapseWhitespace(candidate);
      if (normalized) {
        // Truncate if too long
        return normalized.length > 60
          ? normalized.substring(0, 57) + '...'
          : normalized;
      }
    }
  }

  return '';
}

/**
 * Classify a capture into functional category and type
 */
export function classifyCapture(capture: any): Classification {
  // Extract signals defensively
  const tag = (capture?.element?.tagName || capture?.element?.tag || '').toLowerCase();
  const role = (capture?.element?.role || capture?.element?.ariaRole || '').toLowerCase();

  // Region/viewport screenshot captures (screenshot-first)
  if (tag === "region") {
    const displayName =
      typeof capture?.displayName === "string" && capture.displayName.trim()
        ? capture.displayName.trim()
        : "Region";
    const isViewport = displayName.toLowerCase() === "viewport";
    return {
      functionalCategory: "Screenshots",
      typeKey: isViewport ? "viewport" : "region",
      displayName,
      confidence: 95,
    };
  }

  // v2.2+ stores intent anchors under element.intent (service worker transforms v1 -> v2)
  const intent = capture?.element?.intent || {};

  const inputType = (
    intent?.inputType ||
    capture?.element?.inputType ||
    capture?.element?.type ||
    capture?.element?.attributes?.type
  || ''
  ).toLowerCase();

  const href =
    intent?.href ||
    capture?.element?.href ||
    capture?.element?.attributes?.href ||
    capture?.element?.props?.href ||
    capture?.element?.htmlAttributes?.href;
  const ariaModal = capture?.element?.ariaModal || capture?.element?.attributes?.ariaModal;

  let functionalCategory: FunctionalCategory = 'Unknown';
  let typeKey = tag || 'element';
  let confidence = 50;

  // Classification rules (priority: role > tag > inputType)

  // Actions
  if (role === 'button' || tag === 'button' ||
      (tag === 'input' && ['button', 'submit', 'reset'].includes(inputType))) {
    functionalCategory = 'Actions';
    typeKey = 'button';
    confidence += role === 'button' ? 30 : 15;
  }
  // Custom button elements (si-button, ui-button, etc.)
  else if (tag.includes('button')) {
    functionalCategory = 'Actions';
    typeKey = 'button';
    confidence = 40; // Lower confidence for custom elements
  }
  else if (role === 'link' || (tag === 'a' && href)) {
    functionalCategory = 'Actions';
    typeKey = 'link';
    confidence += role === 'link' ? 30 : 15;
  }

  // Forms
  else if (tag === 'fieldset') {
    functionalCategory = 'Forms';
    typeKey = 'fieldset';
    confidence += 20;
  }
  else if (role === 'textbox' ||
           (tag === 'input' && ['text', 'email', 'search', 'url', 'tel', 'password', 'number'].includes(inputType)) ||
           (tag === 'input' && inputType === '')) {
    functionalCategory = 'Forms';
    typeKey = 'textInput';
    confidence += role === 'textbox' ? 30 : 10;
  }
  else if (tag === 'input' && ['date', 'datetime-local', 'month', 'time', 'week'].includes(inputType)) {
    functionalCategory = 'Forms';
    typeKey = 'dateInput';
    confidence += 10;
  }
  else if (tag === 'input' && inputType === 'file') {
    functionalCategory = 'Forms';
    typeKey = 'fileUpload';
    confidence += 10;
  }
  else if (tag === 'textarea') {
    functionalCategory = 'Forms';
    typeKey = 'textarea';
    confidence += 15;
  }
  else if (role === 'combobox' || tag === 'select') {
    functionalCategory = 'Forms';
    typeKey = 'select';
    confidence += role === 'combobox' ? 30 : 15;
  }
  else if (role === 'checkbox' || (tag === 'input' && inputType === 'checkbox')) {
    functionalCategory = 'Forms';
    typeKey = 'checkbox';
    confidence += role === 'checkbox' ? 30 : 10;
  }
  else if (role === 'radio' || (tag === 'input' && inputType === 'radio')) {
    functionalCategory = 'Forms';
    typeKey = 'radio';
    confidence += role === 'radio' ? 30 : 10;
  }
  else if (role === 'switch') {
    functionalCategory = 'Forms';
    typeKey = 'switch';
    confidence += 30;
  }

  // Navigation
  else if (role === 'navigation' || tag === 'nav') {
    functionalCategory = 'Navigation';
    typeKey = 'navigation';
    confidence += role === 'navigation' ? 30 : 15;
  }
  else if (role === 'tablist') {
    functionalCategory = 'Navigation';
    typeKey = 'tabs';
    confidence += 30;
  }
  else if (role === 'tab') {
    functionalCategory = 'Navigation';
    typeKey = 'tab';
    confidence += 30;
  }
  else if (role === 'menu' || role === 'menubar') {
    functionalCategory = 'Navigation';
    typeKey = 'menu';
    confidence += 30;
  }
  else if (role === 'menuitem') {
    functionalCategory = 'Navigation';
    typeKey = 'menuItem';
    confidence += 30;
  }
  else if (role === 'tree') {
    functionalCategory = 'Navigation';
    typeKey = 'tree';
    confidence += 30;
  }
  else if (role === 'treeitem') {
    functionalCategory = 'Navigation';
    typeKey = 'treeItem';
    confidence += 30;
  }

  // Content
  else if (role === 'heading' || ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    functionalCategory = 'Content';
    typeKey = 'heading';
    confidence += role === 'heading' ? 30 : 15;
  }
  else if (tag === 'p') {
    functionalCategory = 'Content';
    typeKey = 'paragraph';
    confidence += 15;
  }
  else if (role === 'list' || ['ul', 'ol'].includes(tag)) {
    functionalCategory = 'Content';
    typeKey = 'list';
    confidence += role === 'list' ? 30 : 15;
  }
  else if (role === 'listitem' || tag === 'li') {
    functionalCategory = 'Content';
    typeKey = 'listItem';
    confidence += role === 'listitem' ? 30 : 15;
  }
  else if (tag === 'span' || tag === 'label') {
    functionalCategory = 'Content';
    typeKey = 'text';
    confidence += 10;
  }

  // Media
  else if (role === 'img' || tag === 'img') {
    functionalCategory = 'Media';
    typeKey = 'image';
    confidence += role === 'img' ? 30 : 15;
  }
  else if (tag === 'svg') {
    functionalCategory = 'Media';
    typeKey = 'icon';
    confidence += 15;
  }
  else if (tag === 'video') {
    functionalCategory = 'Media';
    typeKey = 'video';
    confidence += 15;
  }

  // Feedback
  else if (role === 'alert') {
    functionalCategory = 'Feedback';
    typeKey = 'alert';
    confidence += 30;
  }
  else if (role === 'dialog' || ariaModal === true || ariaModal === 'true') {
    functionalCategory = 'Feedback';
    typeKey = 'modal';
    confidence += 30;
  }
  else if (role === 'tooltip') {
    functionalCategory = 'Feedback';
    typeKey = 'tooltip';
    confidence += 30;
  }

  // Layout
  else if (role === 'separator' || tag === 'hr') {
    functionalCategory = 'Layout';
    typeKey = 'divider';
    confidence += role === 'separator' ? 30 : 15;
  }
  else if (['main', 'banner', 'contentinfo', 'complementary'].includes(role)) {
    functionalCategory = 'Layout';
    typeKey = 'landmark';
    confidence += 30;
  }

  // Unknown fallback
  else {
    functionalCategory = 'Unknown';
    typeKey = 'element';
    confidence -= 20;
  }

  // Clamp confidence
  confidence = Math.max(0, Math.min(100, confidence));

  // Build display name
  const bestLabel = getBestLabel(capture);
  const displayName = bestLabel
    ? `${titleCase(typeKey)} · "${bestLabel}"`
    : titleCase(typeKey);

  return {
    functionalCategory,
    typeKey,
    displayName,
    confidence,
  };
}
