import type { StylePrimitives } from '../../../../types/capture';

export type VisualEssentialsRow = {
  label: string;
  value: string;
  evidence?: string;
};

export type VisualEssentialsSection = {
  title: 'Text' | 'Surface' | 'Spacing' | 'State';
  rows: VisualEssentialsRow[];
};

/**
 * Normalize CSS values for display
 * Updated to keep px units for consistency with Viewer
 */
function normalizeCssValue(v: string | undefined | null): string {
  if (!v || v === '') return '—';
  return v;
}

function pxToNumber(v: string | undefined | null): number {
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const m = s.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 0;
}

function hasBorder(primitives: StylePrimitives): boolean {
  const bw = primitives.borderWidth;
  if (!bw) return false;
  return (
    pxToNumber(bw.top) > 0 ||
    pxToNumber(bw.right) > 0 ||
    pxToNumber(bw.bottom) > 0 ||
    pxToNumber(bw.left) > 0
  );
}

/**
 * Format 4-sided values using CSS shorthand format
 * - All equal: "5px"
 * - Top/bottom equal, left/right equal: "5px 20px"
 * - All different: "25px 10px 4px 35px" (top right bottom left)
 */
function format4SidedValue(top: string, right: string, bottom: string, left: string): string {
  const t = normalizeCssValue(top);
  const r = normalizeCssValue(right);
  const b = normalizeCssValue(bottom);
  const l = normalizeCssValue(left);

  // All sides equal
  if (t !== '—' && t === r && r === b && b === l) {
    return t;
  }

  // Top/bottom equal and left/right equal
  if (t === b && r === l) {
    return `${t} ${r}`;
  }

  // All different
  return `${t} ${r} ${b} ${l}`;
}

function formatBorderWidth(borderWidth: NonNullable<StylePrimitives["borderWidth"]>): string {
  return format4SidedValue(
    borderWidth.top || '0px',
    borderWidth.right || '0px',
    borderWidth.bottom || '0px',
    borderWidth.left || '0px'
  );
}

/**
 * Format padding as CSS shorthand
 */
function formatPadding(spacing: StylePrimitives['spacing']): string {
  return format4SidedValue(
    spacing.paddingTop || '0px',
    spacing.paddingRight || '0px',
    spacing.paddingBottom || '0px',
    spacing.paddingLeft || '0px'
  );
}

/**
 * Format shadow presence
 */
function formatShadow(shadow: StylePrimitives['shadow']): string {
  if (shadow.shadowPresence === 'none' || shadow.boxShadowRaw === 'none') {
    return 'None';
  }

  if (shadow.shadowLayerCount && shadow.shadowLayerCount > 0) {
    return `Yes (${shadow.shadowLayerCount} ${shadow.shadowLayerCount === 1 ? 'layer' : 'layers'})`;
  }

  return 'Yes';
}

/**
 * Format radius using CSS shorthand
 */
function formatRadius(radius: StylePrimitives['radius']): string {
  if (!radius) return '—';

  return format4SidedValue(
    radius.topLeft || '0px',
    radius.topRight || '0px',
    radius.bottomRight || '0px',
    radius.bottomLeft || '0px'
  );
}

/**
 * Format StylePrimitives into designer-friendly Visual Essentials sections
 */
export function formatVisualEssentials(styles: StylePrimitives): VisualEssentialsSection[] {
  const sections: VisualEssentialsSection[] = [];

  // Text section
  const textRows: VisualEssentialsRow[] = [];
  const textColor = normalizeCssValue(styles.color?.raw);
  if (textColor !== '—') {
    textRows.push({
      label: 'Text color',
      value: textColor,
      evidence: styles.sources?.color
    });
  }

  // Add typography if available
  if (styles.typography) {
    const fontFamily = styles.typography.fontFamily;
    if (fontFamily) {
      textRows.push({
        label: 'Font family',
        value: fontFamily,
        evidence: styles.sources?.fontFamily
      });
    }

    const fontSize = normalizeCssValue(styles.typography.fontSize);
    if (fontSize !== '—') {
      textRows.push({
        label: 'Font size',
        value: fontSize,
        evidence: styles.sources?.fontSize
      });
    }

    const fontWeight = styles.typography.fontWeight;
    if (fontWeight) {
      textRows.push({
        label: 'Font weight',
        value: fontWeight,
        evidence: styles.sources?.fontWeight
      });
    }

    const lineHeight = styles.typography.lineHeight;
    if (lineHeight) {
      textRows.push({
        label: 'Line height',
        value: lineHeight,
        evidence: styles.sources?.lineHeight
      });
    }
  }

  if (textRows.length > 0) {
    sections.push({ title: 'Text', rows: textRows });
  }

  // Surface section
  const surfaceRows: VisualEssentialsRow[] = [];
  const bgColor = normalizeCssValue(styles.backgroundColor?.raw);
  if (bgColor !== '—') {
    surfaceRows.push({
      label: 'Background',
      value: bgColor,
      evidence: styles.sources?.backgroundColor
    });
  }

  const borderIsPresent = hasBorder(styles);
  if (borderIsPresent && styles.borderWidth) {
    surfaceRows.push({
      label: 'Border width',
      value: formatBorderWidth(styles.borderWidth),
      evidence: styles.sources?.borderTopWidth || styles.sources?.borderRightWidth || styles.sources?.borderBottomWidth || styles.sources?.borderLeftWidth
    });
  }

  // Handle border color (new format: per-side, old format: single color)
  if (borderIsPresent && styles.borderColor) {
    const bc = styles.borderColor as any;
    
    // Check if it's the new per-side format
    if (bc.top && bc.right && bc.bottom && bc.left) {
      const topHex = bc.top?.hex8 || bc.top?.raw;
      const rightHex = bc.right?.hex8 || bc.right?.raw;
      const bottomHex = bc.bottom?.hex8 || bc.bottom?.raw;
      const leftHex = bc.left?.hex8 || bc.left?.raw;

      if (topHex) {
        const borderColorValue = format4SidedValue(topHex, rightHex || topHex, bottomHex || topHex, leftHex || topHex);
        
        surfaceRows.push({
          label: 'Border color',
          value: borderColorValue,
          evidence: styles.sources?.borderColor
        });
      }
    } else {
      // Old format: single ColorPrimitive
      const borderColorValue = bc.hex8 || bc.raw;
      if (borderColorValue) {
        surfaceRows.push({
          label: 'Border color',
          value: borderColorValue,
          evidence: styles.sources?.borderColor
        });
      }
    }
  }

  // Add radius if available
  if (styles.radius) {
    const radiusValue = formatRadius(styles.radius);
    if (radiusValue !== '—') {
      // Build radius evidence if any corner uses CSS variables
      let radiusEvidence: string | undefined;
      if (styles.sources) {
        const corners = [
          styles.sources.radiusTopLeft && `TL: ${styles.sources.radiusTopLeft}`,
          styles.sources.radiusTopRight && `TR: ${styles.sources.radiusTopRight}`,
          styles.sources.radiusBottomRight && `BR: ${styles.sources.radiusBottomRight}`,
          styles.sources.radiusBottomLeft && `BL: ${styles.sources.radiusBottomLeft}`,
        ].filter(Boolean);
        if (corners.length > 0) {
          radiusEvidence = `border-radius: { ${corners.join(', ')} }`;
        }
      }
      surfaceRows.push({
        label: 'Radius',
        value: radiusValue,
        evidence: radiusEvidence
      });
    }
  }

  surfaceRows.push({
    label: 'Shadow',
    value: formatShadow(styles.shadow),
    evidence: styles.sources?.boxShadow
  });
  if (surfaceRows.length > 0) {
    sections.push({ title: 'Surface', rows: surfaceRows });
  }

  // Spacing section
  const spacingRows: VisualEssentialsRow[] = [];
  // Build padding evidence if any side uses CSS variables
  let paddingEvidence: string | undefined;
  if (styles.sources) {
    const sides = [
      styles.sources.paddingTop && `top: ${styles.sources.paddingTop}`,
      styles.sources.paddingRight && `right: ${styles.sources.paddingRight}`,
      styles.sources.paddingBottom && `bottom: ${styles.sources.paddingBottom}`,
      styles.sources.paddingLeft && `left: ${styles.sources.paddingLeft}`,
    ].filter(Boolean);
    if (sides.length > 0) {
      paddingEvidence = `padding: { ${sides.join(', ')} }`;
    }
  }
  spacingRows.push({
    label: 'Padding',
    value: formatPadding(styles.spacing),
    evidence: paddingEvidence
  });

  // Add margin if available
  if (styles.margin) {
    const marginValue = format4SidedValue(
      styles.margin.marginTop || '0px',
      styles.margin.marginRight || '0px',
      styles.margin.marginBottom || '0px',
      styles.margin.marginLeft || '0px'
    );
    
    let marginEvidence: string | undefined;
    if (styles.sources) {
      const sides = [
        styles.sources.marginTop && `top: ${styles.sources.marginTop}`,
        styles.sources.marginRight && `right: ${styles.sources.marginRight}`,
        styles.sources.marginBottom && `bottom: ${styles.sources.marginBottom}`,
        styles.sources.marginLeft && `left: ${styles.sources.marginLeft}`,
      ].filter(Boolean);
      if (sides.length > 0) {
        marginEvidence = `margin: { ${sides.join(', ')} }`;
      }
    }
    
    spacingRows.push({
      label: 'Margin',
      value: marginValue,
      evidence: marginEvidence
    });
  }

  // Add gap if available
  if (styles.gap) {
    spacingRows.push({
      label: 'Gap',
      value: `${styles.gap.rowGap} / ${styles.gap.columnGap}`,
      evidence: styles.sources?.gap
    });
  }

  sections.push({ title: 'Spacing', rows: spacingRows });

  return sections;
}
