import type {
  AuthorStylePropertyKey,
  TokenDefinitionEvidence,
  TokenUsageEvidence,
} from "../../../types/capture";

export type TokenTraceStep = {
  token: string; // --token
  resolvedValue?: string | null;
  definedValue?: string | null;
  definition?: TokenDefinitionEvidence | null;
};

export type TokenTrace = {
  property: AuthorStylePropertyKey;
  authoredValue?: string | null;
  resolvedValue?: string | null;
  steps: TokenTraceStep[];
  truncated: boolean;
};

function tokensInOrderFromAuthoredValue(authoredValue: string): string[] {
  // Preserve authored order and include nested fallbacks.
  const re = /var\(\s*(--[A-Za-z0-9_-]+)/g;
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(authoredValue)) !== null) {
    const t = m[1];
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function pickBestDefinition(
  token: string,
  definitions: TokenDefinitionEvidence[] | undefined,
  preferredStyleSheetUrl?: string | null
): TokenDefinitionEvidence | null {
  const defs = (definitions ?? []).filter((d) => d.token === token);
  if (defs.length === 0) return null;
  if (preferredStyleSheetUrl) {
    const exact = defs.find((d) => d.styleSheetUrl === preferredStyleSheetUrl);
    if (exact) return exact;
  }
  // Otherwise pick the first (best-effort; definitions are already capped).
  return defs[0] ?? null;
}

export function buildTokenTrace(args: {
  property: AuthorStylePropertyKey;
  authoredValue?: string | null;
  resolvedValue?: string | null;
  used: TokenUsageEvidence[];
  definitions?: TokenDefinitionEvidence[];
  maxDepth?: number;
  preferredStyleSheetUrl?: string | null;
}): TokenTrace | null {
  const {
    property,
    authoredValue,
    resolvedValue,
    used,
    definitions,
    maxDepth = 6,
    preferredStyleSheetUrl,
  } = args;

  if (!authoredValue || !authoredValue.includes("var(--")) return null;

  const directTokens = tokensInOrderFromAuthoredValue(authoredValue);
  if (directTokens.length === 0) return null;

  const usedForProp = used.filter((u) => u.property === property);
  const resolvedByToken = new Map<string, string | null>();
  for (const u of usedForProp) {
    if (!resolvedByToken.has(u.token)) {
      resolvedByToken.set(u.token, u.resolvedValue ?? null);
    }
  }

  const steps: TokenTraceStep[] = [];
  const visited = new Set<string>();
  let truncated = false;

  const pushToken = (token: string) => {
    if (visited.has(token)) return false;
    visited.add(token);
    const def = pickBestDefinition(token, definitions, preferredStyleSheetUrl);
    steps.push({
      token,
      resolvedValue: resolvedByToken.get(token) ?? null,
      definedValue: def?.definedValue ?? null,
      definition: def ?? null,
    });
    return true;
  };

  // Seed with direct authored tokens in order.
  for (const t of directTokens) {
    if (steps.length >= maxDepth) {
      truncated = true;
      break;
    }
    pushToken(t);
  }

  // Best-effort: extend by following definition RHS var() chain (first hop only per step),
  // so we get --tec -> --global when definitions contain "var(--global)".
  for (let i = 0; i < steps.length; i++) {
    if (steps.length >= maxDepth) {
      truncated = true;
      break;
    }
    const dv = steps[i]?.definedValue;
    if (!dv || !dv.includes("var(--")) continue;
    const next = tokensInOrderFromAuthoredValue(dv)[0];
    if (!next) continue;
    if (visited.has(next)) continue;
    pushToken(next);
  }

  return {
    property,
    authoredValue,
    resolvedValue: resolvedValue ?? null,
    steps,
    truncated,
  };
}




