import type { ReactNode } from 'react';

export interface StylePropertyRow {
  label: string;
  value: string;
  customContent?: ReactNode; // For TokenTraceValue or other custom rendering
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
            {section.rows.map((row, rowIdx) => (
              <div
                key={`${section.title}-${rowIdx}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 24px',
                  background: rowIdx % 2 === 0 ? 'transparent' : 'hsl(var(--muted) / 0.3)',
                  borderRadius: '8px',
                }}
              >
                {row.customContent ? (
                  // Custom rendering (e.g., TokenTraceValue)
                  <div style={{ width: '100%' }}>{row.customContent}</div>
                ) : (
                  // Default label-value pair
                  <>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'hsl(var(--foreground))',
                        fontWeight: 500,
                      }}
                    >
                      {row.label}
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        color: '#374151', // Exact color from the screenshot
                      }}
                    >
                      {row.value}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

