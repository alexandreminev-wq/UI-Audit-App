import { Capture, ExtractedStyle, StyleType, StyleCategory, STYLE_CATEGORY_MAP, ComponentType } from '@/types/audit';

interface ExtractedStyleMap {
  [key: string]: ExtractedStyle;
}

// Helper to generate a unique key for style deduplication
function getStyleKey(styleType: StyleType, value: string, variableName?: string): string {
  return `${styleType}::${variableName || value}`;
}

// Parse border shorthand to extract width
function parseBorderWidth(borderValue: string): string | null {
  // Matches patterns like "1px solid #color" or "2px dashed rgb(...)"
  const match = borderValue.match(/^(\d+(?:\.\d+)?(?:px|rem|em))/);
  return match ? match[1] : null;
}

// Extract variable name from var() syntax
function extractVariableFromValue(value: string): { variableName?: string; resolvedValue?: string } {
  const varMatch = value.match(/var\((--[^,)]+)(?:,\s*([^)]+))?\)/);
  if (varMatch) {
    return {
      variableName: varMatch[1],
      resolvedValue: varMatch[2]?.trim(),
    };
  }
  return {};
}

// Extract styles from a single capture
function extractStylesFromCapture(capture: Capture): Array<{
  styleType: StyleType;
  value: string;
  variableName?: string;
}> {
  const styles: Array<{
    styleType: StyleType;
    value: string;
    variableName?: string;
  }> = [];

  const ve = capture.visualEssentials;

  // Build a map of property names to their variable info from styleProperties
  const variableMap: Record<string, { variableName: string; rawValue: string }> = {};
  capture.styleProperties.forEach(prop => {
    if (prop.isVariable && prop.variableName) {
      variableMap[prop.name] = { variableName: prop.variableName, rawValue: prop.value };
    }
    // Also check for var() in the value itself
    const extracted = extractVariableFromValue(prop.value);
    if (extracted.variableName) {
      variableMap[prop.name] = { variableName: extracted.variableName, rawValue: prop.value };
    }
  });

  // Colors
  if (ve.colors.background && ve.colors.background !== 'transparent') {
    styles.push({ 
      styleType: 'background', 
      value: ve.colors.background,
      variableName: variableMap['background']?.variableName,
    });
  }
  if (ve.typography.color) {
    styles.push({ 
      styleType: 'text-color', 
      value: ve.typography.color,
      variableName: variableMap['color']?.variableName,
    });
  }
  if (ve.colors.border && ve.colors.border !== 'transparent' && ve.colors.border !== 'none') {
    styles.push({ 
      styleType: 'border-color', 
      value: ve.colors.border,
    });
  }

  // Border width - parse from styleProperties
  const borderProp = capture.styleProperties.find(p => p.name === 'border' || p.name === 'border-width');
  if (borderProp) {
    const borderWidth = borderProp.name === 'border-width' 
      ? borderProp.value 
      : parseBorderWidth(borderProp.value);
    if (borderWidth && borderWidth !== '0' && borderWidth !== '0px') {
      styles.push({ 
        styleType: 'border-width', 
        value: borderWidth,
        variableName: variableMap['border-width']?.variableName,
      });
    }
  }

  // Border radius
  if (ve.borderRadius && ve.borderRadius !== '0px' && ve.borderRadius !== '0') {
    styles.push({ 
      styleType: 'border-radius', 
      value: ve.borderRadius,
      variableName: variableMap['border-radius']?.variableName,
    });
  }

  // Spacing
  if (ve.spacing.padding && ve.spacing.padding !== '0px' && ve.spacing.padding !== '0') {
    styles.push({ 
      styleType: 'padding', 
      value: ve.spacing.padding,
      variableName: variableMap['padding']?.variableName,
    });
  }
  if (ve.spacing.margin && ve.spacing.margin !== '0px' && ve.spacing.margin !== '0') {
    styles.push({ 
      styleType: 'margin', 
      value: ve.spacing.margin,
      variableName: variableMap['margin']?.variableName,
    });
  }

  // Typography
  if (ve.typography.fontFamily) {
    styles.push({ 
      styleType: 'font-family', 
      value: ve.typography.fontFamily,
      variableName: variableMap['font-family']?.variableName,
    });
  }
  if (ve.typography.fontSize) {
    styles.push({ 
      styleType: 'font-size', 
      value: ve.typography.fontSize,
      variableName: variableMap['font-size']?.variableName,
    });
  }
  if (ve.typography.fontWeight) {
    styles.push({ 
      styleType: 'font-weight', 
      value: ve.typography.fontWeight,
      variableName: variableMap['font-weight']?.variableName,
    });
  }
  if (ve.typography.lineHeight) {
    styles.push({ 
      styleType: 'line-height', 
      value: ve.typography.lineHeight,
      variableName: variableMap['line-height']?.variableName,
    });
  }

  // Effects
  if (ve.boxShadow && ve.boxShadow !== 'none') {
    styles.push({ 
      styleType: 'box-shadow', 
      value: ve.boxShadow,
      variableName: variableMap['box-shadow']?.variableName,
    });
  }

  return styles;
}

// Extract all unique styles from captures
export function extractStyles(captures: Capture[]): ExtractedStyle[] {
  const styleMap: ExtractedStyleMap = {};
  let idCounter = 0;

  captures.forEach(capture => {
    const captureStyles = extractStylesFromCapture(capture);

    captureStyles.forEach(style => {
      const key = getStyleKey(style.styleType, style.value, style.variableName);

      if (styleMap[key]) {
        // Add capture to existing style if not already present
        if (!styleMap[key].captureIds.includes(capture.id)) {
          styleMap[key].captureIds.push(capture.id);
        }
      } else {
        // Create new style entry
        styleMap[key] = {
          id: `style-${idCounter++}`,
          styleType: style.styleType,
          category: STYLE_CATEGORY_MAP[style.styleType],
          value: style.value,
          variableName: style.variableName,
          captureIds: [capture.id],
        };
      }
    });
  });

  return Object.values(styleMap);
}

// Filter styles by component type
export function filterStylesByComponentType(
  styles: ExtractedStyle[],
  captures: Capture[],
  componentType: ComponentType | 'all'
): ExtractedStyle[] {
  if (componentType === 'all') return styles;

  const filteredCaptureIds = new Set(
    captures
      .filter(c => (c.typeOverride || c.type) === componentType)
      .map(c => c.id)
  );

  return styles
    .map(style => ({
      ...style,
      captureIds: style.captureIds.filter(id => filteredCaptureIds.has(id)),
    }))
    .filter(style => style.captureIds.length > 0);
}

// Group styles by category
export function groupStylesByCategory(
  styles: ExtractedStyle[]
): Record<StyleCategory, ExtractedStyle[]> {
  const groups: Record<StyleCategory, ExtractedStyle[]> = {
    colors: [],
    borders: [],
    spacing: [],
    typography: [],
    effects: [],
  };

  styles.forEach(style => {
    groups[style.category].push(style);
  });

  return groups;
}
