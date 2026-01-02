import { useMemo, useState } from "react";
import type { TokenEvidence } from "../../../types/capture";
import type { AuthorStylePropertyKey } from "../../../types/capture";
import { buildTokenTrace } from "./tokenTrace";

type Props = {
  property: AuthorStylePropertyKey;
  label: string;
  // Display / resolved values
  resolvedValue?: string | null; // e.g. rgb(...)
  hex8?: string | null; // e.g. #RRGGBBAA
  // Evidence
  authoredValue?: string | null; // e.g. var(--a, var(--b))
  tokens?: TokenEvidence | null;
  preferredStyleSheetUrl?: string | null;
  showCopyActions?: boolean;
};

function swatchStyle(color: string | null | undefined): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: color || "transparent",
    border: "1px solid hsl(var(--border, 0 0% 80%))",
    flexShrink: 0,
  };
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore (non-fatal)
  }
}

export function TokenTraceValue({
  property,
  label,
  resolvedValue,
  hex8,
  authoredValue,
  tokens,
  preferredStyleSheetUrl,
  showCopyActions = true,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const trace = useMemo(() => {
    if (!tokens) return null;
    return buildTokenTrace({
      property,
      authoredValue,
      resolvedValue,
      used: tokens.used,
      definitions: tokens.definitions,
      preferredStyleSheetUrl,
      maxDepth: 6,
    });
  }, [property, authoredValue, resolvedValue, tokens, preferredStyleSheetUrl]);

  const primary = hex8 || resolvedValue || "—";
  const hint = (() => {
    if (trace && trace.steps.length > 0) {
      const tokens = trace.steps.map((s) => s.token);
      if (tokens.length <= 3) return tokens.join(" → ");
      // Show first and last so the “canonical” token is visible even when the chain is long.
      return `${tokens[0]} → … → ${tokens[tokens.length - 1]}`;
    }
    if (authoredValue && authoredValue.includes("var(--")) return authoredValue;
    return null;
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={swatchStyle(hex8 || resolvedValue)} />
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground, 0 0% 45%))", flexShrink: 0 }}>{label}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize: 12, color: "hsl(var(--foreground, 0 0% 10%))", textAlign: "right" }}>
            {primary}
          </div>
          {trace ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 8,
                border: "1px solid hsl(var(--border, 0 0% 80%))",
                background: "hsl(var(--background, 0 0% 100%))",
                cursor: "pointer",
                color: "hsl(var(--muted-foreground, 0 0% 45%))",
              }}
            >
              {expanded ? "Hide" : "Trace"}
            </button>
          ) : null}
        </div>
      </div>

      {hint ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              fontSize: 11,
              color: "hsl(var(--muted-foreground, 0 0% 45%))",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={hint}
          >
            {hint}
          </div>
          {showCopyActions ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {trace?.steps?.[0]?.token ? (
                <button
                  type="button"
                  onClick={() => copyText(trace.steps[0].token)}
                  style={{
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 6,
                    border: "1px solid hsl(var(--border, 0 0% 80%))",
                    background: "hsl(var(--background, 0 0% 100%))",
                    cursor: "pointer",
                    color: "hsl(var(--muted-foreground, 0 0% 45%))",
                  }}
                >
                  Copy token
                </button>
              ) : null}
              {hex8 ? (
                <button
                  type="button"
                  onClick={() => copyText(hex8)}
                  style={{
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 6,
                    border: "1px solid hsl(var(--border, 0 0% 80%))",
                    background: "hsl(var(--background, 0 0% 100%))",
                    cursor: "pointer",
                    color: "hsl(var(--muted-foreground, 0 0% 45%))",
                  }}
                >
                  Copy hex
                </button>
              ) : null}
              {resolvedValue ? (
                <button
                  type="button"
                  onClick={() => copyText(resolvedValue)}
                  style={{
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 6,
                    border: "1px solid hsl(var(--border, 0 0% 80%))",
                    background: "hsl(var(--background, 0 0% 100%))",
                    cursor: "pointer",
                    color: "hsl(var(--muted-foreground, 0 0% 45%))",
                  }}
                >
                  Copy value
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {expanded && trace ? (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid hsl(var(--border, 0 0% 80%))",
            background: "hsl(var(--muted, 0 0% 96%))",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground, 0 0% 45%))" }}>
            Authored:{" "}
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
              {trace.authoredValue}
            </span>
            {trace.truncated ? " (truncated)" : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {trace.steps.map((s) => (
              <div key={`${property}|${s.token}`} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={swatchStyle(s.resolvedValue ?? null)} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                      fontSize: 11,
                      color: "hsl(var(--foreground, 0 0% 10%))",
                    }}
                  >
                    {s.token}
                  </div>
                  {s.definedValue ? (
                    <div
                      style={{
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                        fontSize: 11,
                        color: "hsl(var(--muted-foreground, 0 0% 45%))",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={s.definedValue}
                    >
                      = {s.definedValue}
                    </div>
                  ) : null}
                  {s.definition?.selectorText || s.definition?.styleSheetUrl ? (
                    <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground, 0 0% 45%))" }}>
                      {s.definition?.selectorText ? `via ${s.definition.selectorText}` : "via (unknown selector)"}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}


