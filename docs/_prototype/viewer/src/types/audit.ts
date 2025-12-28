export type Category = 'actions' | 'forms' | 'content' | 'unknown';

export type ComponentType = 
  | 'button' 
  | 'link' 
  | 'input' 
  | 'select' 
  | 'checkbox' 
  | 'radio' 
  | 'textarea'
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'icon'
  | 'card'
  | 'modal'
  | 'tooltip'
  | 'unknown';

export type CaptureStatus = 
  | 'unreviewed'
  | 'canonical' 
  | 'variant' 
  | 'deviation' 
  | 'legacy' 
  | 'experimental';

export interface StyleProperty {
  name: string;
  value: string;
  isVariable?: boolean;
  variableName?: string;
}

export interface VisualEssentials {
  typography: {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    color: string;
  };
  colors: {
    background: string;
    border: string;
    text: string;
  };
  spacing: {
    padding: string;
    margin: string;
  };
  dimensions: {
    width: string;
    height: string;
  };
  borderRadius: string;
  boxShadow: string;
}

export interface Capture {
  id: string;
  projectId: string;
  name: string;
  displayName?: string; // User override
  category: Category;
  categoryOverride?: Category;
  type: ComponentType;
  typeOverride?: ComponentType;
  status: CaptureStatus;
  screenshotUrl: string;
  sourceUrl: string;
  htmlSnapshot: string;
  styleProperties: StyleProperty[];
  visualEssentials: VisualEssentials;
  notes: string;
  tags: string[];
  variantGroupId?: string;
  isCanonical?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VariantGroup {
  id: string;
  projectId: string;
  name: string;
  canonicalCaptureId?: string;
  captureIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  captureCount: number;
  lastUpdated: string;
  createdAt: string;
  categoryCounts: {
    actions: number;
    forms: number;
    content: number;
    unknown: number;
  };
}

export interface FilterState {
  category: Category | 'all';
  type: ComponentType | 'all';
  status: CaptureStatus | 'all';
  source: string;
  search: string;
  showUnknownOnly: boolean;
}

export interface SortState {
  field: 'name' | 'category' | 'type' | 'status' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}

export type VisualEssentialField = 
  | 'background'
  | 'border'
  | 'borderRadius'
  | 'padding'
  | 'color'
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'boxShadow';

export const VISUAL_ESSENTIAL_LABELS: Record<VisualEssentialField, string> = {
  background: 'background',
  border: 'border',
  borderRadius: 'border-radius',
  padding: 'padding',
  color: 'color',
  fontFamily: 'font-family',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  lineHeight: 'line-height',
  boxShadow: 'box-shadow',
};

export const DEFAULT_VISIBLE_ESSENTIALS: VisualEssentialField[] = [
  'background',
  'border',
  'borderRadius',
  'padding',
];

// Style extraction types
export type StyleCategory = 'colors' | 'borders' | 'spacing' | 'typography' | 'effects';

export type StyleType = 
  | 'background'
  | 'text-color'
  | 'border-color'
  | 'border-width'
  | 'border-radius'
  | 'padding'
  | 'margin'
  | 'font-family'
  | 'font-size'
  | 'font-weight'
  | 'line-height'
  | 'box-shadow'
  | 'opacity';

export const STYLE_CATEGORY_MAP: Record<StyleType, StyleCategory> = {
  'background': 'colors',
  'text-color': 'colors',
  'border-color': 'colors',
  'border-width': 'borders',
  'border-radius': 'borders',
  'padding': 'spacing',
  'margin': 'spacing',
  'font-family': 'typography',
  'font-size': 'typography',
  'font-weight': 'typography',
  'line-height': 'typography',
  'box-shadow': 'effects',
  'opacity': 'effects',
};

export const STYLE_TYPE_LABELS: Record<StyleType, string> = {
  'background': 'Background',
  'text-color': 'Text Color',
  'border-color': 'Border Color',
  'border-width': 'Border Width',
  'border-radius': 'Border Radius',
  'padding': 'Padding',
  'margin': 'Margin',
  'font-family': 'Font Family',
  'font-size': 'Font Size',
  'font-weight': 'Font Weight',
  'line-height': 'Line Height',
  'box-shadow': 'Box Shadow',
  'opacity': 'Opacity',
};

export const STYLE_CATEGORY_LABELS: Record<StyleCategory, string> = {
  'colors': 'Colors',
  'borders': 'Borders',
  'spacing': 'Spacing',
  'typography': 'Typography',
  'effects': 'Effects',
};

export interface ExtractedStyle {
  id: string;
  styleType: StyleType;
  category: StyleCategory;
  value: string;
  variableName?: string;
  captureIds: string[];
}
