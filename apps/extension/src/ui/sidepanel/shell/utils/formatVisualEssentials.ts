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
 */
function normalizeCssValue(v: string | undefined | null): string {
  if (!v || v === '') return '—';

  // Convert "16px" -> "16", "0px" -> "0"
  const pxMatch = v.match(/^(\d+(?:\.\d+)?)px$/);
  if (pxMatch) {
    const num = parseFloat(pxMatch[1]);
    return num === 0 ? '0' : pxMatch[1];
  }

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

function formatBorderWidth(borderWidth: NonNullable<StylePrimitives["borderWidth"]>): string {
  const t = normalizeCssValue(borderWidth.top);
  const r = normalizeCssValue(borderWidth.right);
  const b = normalizeCssValue(borderWidth.bottom);
  const l = normalizeCssValue(borderWidth.left);

  if (t !== '—' && t === r && r === b && b === l) return t;
  return `${t} / ${r} / ${b} / ${l}`;
}

/**
 * Format padding as T / R / B / L
 */
function formatPadding(spacing: StylePrimitives['spacing']): string {
  const t = normalizeCssValue(spacing.paddingTop);
  const r = normalizeCssValue(spacing.paddingRight);
  const b = normalizeCssValue(spacing.paddingBottom);
  const l = normalizeCssValue(spacing.paddingLeft);

  return `${t} / ${r} / ${b} / ${l}`;
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
 * Format radius - show single value if all corners match, otherwise TL / TR / BR / BL
 */
function formatRadius(radius: StylePrimitives['radius']): string {
  if (!radius) return '—';

  const tl = normalizeCssValue(radius.topLeft);
  const tr = normalizeCssValue(radius.topRight);
  const br = normalizeCssValue(radius.bottomRight);
  const bl = normalizeCssValue(radius.bottomLeft);

  // If all corners are the same and non-empty, show single value
  if (tl !== '—' && tl === tr && tr === br && br === bl) {
    return tl;
  }

  // Otherwise show all four corners
  return `${tl} / ${tr} / ${br} / ${bl}`;
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
      // Show only first font family in the stack
      const firstFamily = fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
      textRows.push({
        label: 'Font family',
        value: firstFamily,
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

  const borderColor = normalizeCssValue(styles.borderColor?.raw);
  if (borderIsPresent && borderColor !== '—') {
    surfaceRows.push({
      label: 'Border color',
      value: borderColor,
      evidence: styles.sources?.borderColor
    });
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
  sections.push({ title: 'Spacing', rows: spacingRows });

  // State section (placeholders for now)
  const stateRows: VisualEssentialsRow[] = [];
  stateRows.push({ label: 'Disabled', value: '—' });
  stateRows.push({ label: 'Focusable', value: '—' });
  sections.push({ title: 'State', rows: stateRows });

  return sections;
}
