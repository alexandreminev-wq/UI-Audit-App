import { useState } from 'react';
import type { ReactNode } from 'react';

export interface StylePropertyRow {
  label: string;
  value: string;
  customContent?: ReactNode; // For TokenTraceValue or other custom rendering (replaces entire row)
  valueNode?: ReactNode; // Custom rendering for value cell only (label still shown)
}

export interface StylePropertiesSection {
  title: string;
  rows: StylePropertyRow[];
}

interface StylePropertiesTableProps {
  sections: StylePropertiesSection[];
}

/**
 * Shared StylePropertiesTable component with zebra striping and monospaced values
 * Used for displaying Visual Essentials in both Sidepanel and Viewer
 */
export function StylePropertiesTable({ sections }: StylePropertiesTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };

  return (
    <div
      style={{
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background: 'hsl(var(--background))',
      }}
    >
      {sections.map((section, sectionIdx) => (
        <div
          key={section.title}
          style={{
            borderBottom: sectionIdx < sections.length - 1 ? '1px solid hsl(var(--border))' : 'none',
          }}
        >
          {/* Section Header */}
          <div
            style={{
              padding: '12px 16px',
              background: 'hsl(var(--muted) / 0.5)',
              borderBottom: '1px solid hsl(var(--border))',
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              {section.title}
            </h4>
          </div>

          {/* Section Rows */}
          <div>
            {section.rows.map((row, rowIdx) => {
              const rowKey = `${section.title}-${rowIdx}`;
              const isExpanded = expandedRows.has(rowKey);
              const isFontFamily = row.label === 'Font family';
              const shouldTruncate = isFontFamily && !isExpanded;

              return (
                <div
                  key={rowKey}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 24px',
                    background: rowIdx % 2 === 0 ? 'transparent' : 'hsl(var(--muted) / 0.3)',
                    borderRadius: '8px',
                    gap: '8px', // 8px gap between columns
                  }}
                >
                  {row.customContent ? (
                    // Custom rendering (e.g., TokenTraceValue) - replaces entire row
                    <div style={{ width: '100%' }}>{row.customContent}</div>
                  ) : (
                    // Label-value pair (with optional custom value rendering)
                    <>
                      <span
                        style={{
                          fontSize: '13px',
                          color: 'hsl(var(--foreground))',
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                      >
                        {row.label}
                      </span>
                      {row.valueNode ? (
                        // Custom value rendering (e.g., color tile + hex)
                        <div style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
                          {row.valueNode}
                        </div>
                      ) : (
                        // Default string value
                        <span
                          onClick={isFontFamily ? () => toggleRow(rowKey) : undefined}
                          style={{
                            fontSize: '13px',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            color: '#374151',
                            textAlign: 'right',
                            overflow: shouldTruncate ? 'hidden' : 'visible',
                            textOverflow: shouldTruncate ? 'ellipsis' : 'clip',
                            whiteSpace: shouldTruncate ? 'nowrap' : 'normal',
                            cursor: isFontFamily ? 'pointer' : 'default',
                            minWidth: 0,
                            flex: 1,
                          }}
                          title={isFontFamily ? 'Click to expand/collapse' : undefined}
                        >
                          {row.value}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

