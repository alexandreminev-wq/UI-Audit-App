# Schema Delta Report: Stored Data vs Viewer Mock Data

**Date**: 2025-12-29
**Purpose**: Document the gap between current IndexedDB storage schema and Viewer mock data shapes to inform Milestone 7.4.x (real data integration)

---

## 1. Stored Data Model (Current)

### IndexedDB Schema (v3)

**Database**: `ui-inventory`
**Version**: 3 (v2.2 schema + projects)

#### Stores

1. **captures** (keyPath: `id`)
   - Indexes: `byCreatedAt`, `byUrl`
   - Types: `CaptureRecord` (v1, legacy) | `CaptureRecordV2` (v2.2, current)

2. **sessions** (keyPath: `id`)
   - Indexes: `byCreatedAt`, `byStartUrl`
   - Type: `SessionRecord`

3. **blobs** (keyPath: `id`)
   - Indexes: `byCreatedAt`
   - Type: `BlobRecord`

4. **projects** (keyPath: `id`)
   - Indexes: `byUpdatedAt`, `byCreatedAt`
   - Type: `ProjectRecord`

5. **projectSessions** (keyPath: `id`)
   - Indexes: `byProjectId`, `bySessionId`
   - Type: `ProjectSessionLinkRecord`

### Core Types

#### CaptureRecordV2 (apps/extension/src/types/capture.ts)
```typescript
{
  id: string;                          // "cap_<timestamp>_<random>"
  sessionId: string;                   // "session_<timestamp>_<random>"
  captureSchemaVersion: 2;
  stylePrimitiveVersion?: 1;
  url: string;                         // Full URL where captured
  createdAt: number;                   // ms since epoch

  conditions: {
    viewport: { width: number; height: number };
    devicePixelRatio: number;
    visualViewportScale?: number | null;
    browserZoom?: number | null;
    timestamp: number;
    themeHint?: "light" | "dark" | "unknown";
  };

  scope?: {
    nearestLandmarkRole?: LandmarkRole; // M4: "banner" | "navigation" | "main" | etc
  };

  element: {
    tagName: string;                   // "button", "div", "input", etc
    role?: string | null;              // ARIA role
    id?: string | null;
    classList?: string[];
    textPreview?: string;
    intent: {
      accessibleName?: string | null;  // Best-effort
      inputType?: string | null;       // "text", "checkbox", etc
      href?: string | null;
      disabled?: boolean | null;
      ariaDisabled?: boolean | null;
      checked?: boolean | null;
      ariaChecked?: boolean | null;
    };
  };

  boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };

  styles: {
    primitives: {
      spacing: {
        paddingTop: string;
        paddingRight: string;
        paddingBottom: string;
        paddingLeft: string;
      };
      backgroundColor: {
        raw: string;
        rgba?: { r: number; g: number; b: number; a: number } | null;
      };
      color: {
        raw: string;
        rgba?: Rgba | null;
      };
      borderColor?: ColorPrimitive;
      shadow: {
        boxShadowRaw: string;
        shadowPresence: "none" | "some";
        shadowLayerCount?: number | null;
      };
      typography?: {
        fontFamily: string;
        fontSize: string;
        fontWeight: string;
        lineHeight: string;
      };
      radius?: {
        topLeft: string;
        topRight: string;
        bottomRight: string;
        bottomLeft: string;
      };
      sources?: Partial<Record<StyleSourceKey, string>>; // CSS var provenance
    };
    computed?: Record<StyleKey, string>; // Optional debug subset
  };

  screenshot?: {
    screenshotBlobId: string;          // References blobs store
    mimeType: string;
    width: number;
    height: number;
  } | null;
}
```

#### SessionRecord
```typescript
{
  id: string;                          // "session_<timestamp>_<random>"
  createdAt: number;                   // ms since epoch
  startUrl: string;
  userAgent?: string;
  pagesVisited?: string[];             // Optional breadcrumb
}
```

#### ProjectRecord (apps/extension/src/background/capturesDb.ts:464)
```typescript
{
  id: string;                          // "project-<timestamp>-<random>"
  name: string;                        // User-defined name
  createdAt: number;                   // ms since epoch
  updatedAt: number;                   // ms since epoch
}
```

#### ProjectSessionLinkRecord
```typescript
{
  id: string;                          // "${projectId}::${sessionId}"
  projectId: string;
  sessionId: string;
  linkedAt: number;                    // ms since epoch
}
```

#### BlobRecord
```typescript
{
  id: string;                          // "blob_<timestamp>_<random>"
  createdAt: number;                   // ms since epoch
  mimeType: string;                    // "image/webp", "image/jpeg"
  width: number;
  height: number;
  blob: Blob;
}
```

---

## 2. Viewer Mock Model (Current)

### Project Type (apps/extension/src/ui/viewer/types/projectViewerTypes.ts:7)
```typescript
{
  id: string;
  name: string;
  captureCount?: number;               // TEMP: UI-only mock
  updatedAtLabel?: string;             // TEMP: UI-only mock (e.g. "about 1 year ago")
}
```

### Component Item (apps/extension/src/ui/viewer/mock/projectMockData.ts)
```typescript
{
  id: string;                          // "c1", "c2", etc (mock)
  name: string;                        // "Primary Button", "Search Input", etc
  category: string;                    // "Actions", "Forms", "Layout", "Feedback", "Navigation"
  type: string;                        // "button", "input", "div", "a"
  status: string;                      // "Canonical" | "Variant" | "Unreviewed" | "Deviation" | "Legacy" | "Experimental"
  source: string;                      // "Homepage", "Dashboard", "Product Page", etc
  capturesCount: number;               // Number of capture instances
}
```

### Style Item (apps/extension/src/ui/viewer/mock/projectMockData.ts)
```typescript
{
  id: string;                          // "s1", "s2", etc (mock)
  token: string;                       // "--color-primary", "--spacing-md", etc
  value: string;                       // "217 91% 60%", "16px", "Inter, sans-serif", etc
  kind: string;                        // "color", "spacing", "typography", "shadow", "border"
  usageCount: number;                  // Number of times used across captures
  source: string;                      // "Design System", "Layout Grid", "Theme", "Cards", etc
}
```

---

## 3. Field Mapping Table

### Project-Level Mapping

| Viewer Field | Storage Source | Computation |
|-------------|----------------|-------------|
| `id` | `ProjectRecord.id` | Direct copy |
| `name` | `ProjectRecord.name` | Direct copy |
| `captureCount` | **Derived** | Count all captures across linked sessions: `getProjectCaptureCount(projectId)` (already implemented in capturesDb.ts:646) |
| `updatedAtLabel` | **Derived** | Format `ProjectRecord.updatedAt` as relative time (e.g. "2 days ago", "about 1 year ago") |

### Component-Level Mapping

| Viewer Field | Storage Source | Computation |
|-------------|----------------|-------------|
| `id` | `CaptureRecordV2.id` | **Grouping key required** — multiple captures → 1 component |
| `name` | **Inferred** | From `element.intent.accessibleName` or `element.textPreview` or heuristic |
| `category` | **Inferred** | Categorize by role/tagName/intent (e.g. button → "Actions", input → "Forms", nav role → "Navigation") |
| `type` | `element.tagName` | Direct copy (lowercase) |
| `status` | **Defaults to "Unreviewed"** | User-assigned review state: "Unreviewed" (default), "Canonical", "Variant", "Deviation", "Legacy", "Experimental" |
| `source` | **Inferred** | From `url` (extract page label or hostname) or `scope.nearestLandmarkRole` |
| `capturesCount` | **Derived** | Count captures in same component group |

**Missing from storage**:
- Component grouping/signature (no deduplication key stored)
- Canonical vs variant classification
- User-friendly category taxonomy
- User-friendly page/source labels

### Style-Level Mapping

| Viewer Field | Storage Source | Computation |
|-------------|----------------|-------------|
| `id` | **Grouping key required** | Group by token or by raw value similarity |
| `token` | `styles.primitives.sources[styleKey]` | Extract CSS variable name (e.g. `var(--color-primary)` → `--color-primary`) |
| `value` | `styles.primitives[styleKey].raw` | Direct copy from primitives (e.g. `backgroundColor.raw`, `spacing.paddingTop`, etc) |
| `kind` | **Inferred** | Map primitive type → kind ("color", "spacing", "typography", "shadow", "border") |
| `usageCount` | **Derived** | Count captures using same token/value |
| `source` | **Inferred** | Heuristic from URL or context (e.g. "Design System" if CSS var, page label otherwise) |

**Missing from storage**:
- Style grouping/signature (no deduplication by token or value similarity)
- Token inference when `sources` is null/undefined (fallback to raw value clustering)
- Source labeling heuristics

---

## 4. Gaps

### 4.1. Component Grouping (Critical Gap)

**Problem**: Viewer expects deduplicated "components" (e.g. "Primary Button" with 12 captures), but storage has individual `CaptureRecordV2` instances with no grouping metadata.

**Missing**:
- Component signature/hash for deduplication
- Canonical vs variant classification
- Component naming strategy (accessibleName? textPreview? manual?)

**Current state**: No grouping logic implemented. All captures are treated as individual items.

### 4.2. Style Token Inference (Medium Gap)

**Problem**: Viewer expects CSS variable tokens (e.g. `--color-primary`), but storage may not always have `sources` populated.

**Missing**:
- Fallback strategy when `sources` is null/undefined
- Value-based clustering (e.g. group all "#3b82f6" as same color even without token)
- Token extraction from CSS variable references

**Current state**: `sources` is optional in `StylePrimitives`. Need fallback for raw value clustering.

### 4.3. Category Taxonomy (Medium Gap)

**Problem**: Viewer expects friendly categories ("Actions", "Forms", "Layout", etc), but storage has raw `tagName` and `role`.

**Missing**:
- Category inference rules (e.g. button/a[href] → "Actions", input/select → "Forms")
- Custom category overrides (user-defined grouping)

**Current state**: No categorization logic exists.

### 4.4. Status Semantics (Needs Definition)

**Problem**: What does "Canonical" vs "Variant" vs "Unknown" mean?

**Possible interpretations**:
- **Canonical**: First instance captured OR manually marked as reference
- **Variant**: Duplicate with minor style differences
- **Unknown**: No classification yet (default for new captures)

**Current state**: Not defined. Need product decision.

### 4.5. Source Labeling (Low Gap)

**Problem**: Viewer expects friendly labels ("Homepage", "Dashboard"), but storage has raw URLs.

**Missing**:
- URL → page label mapping (heuristic or manual)
- Breadcrumb context (e.g. "Header > Navigation Link")

**Current state**: `url` is stored as-is. `scope.nearestLandmarkRole` exists (M4) but not used for labeling.

### 4.6. Timestamp Formatting (Trivial Gap)

**Problem**: Viewer expects relative time labels ("2 days ago"), but storage has `createdAt`/`updatedAt` as Unix timestamps.

**Missing**: Simple time formatting utility

**Current state**: Can be easily derived at read time.

---

## 5. Decisions Needed

### 5.1. Project Definition
- **Q**: What defines a "project"?
- **Current**: User manually creates projects and links sessions
- **Future**: Auto-group by domain? By time window? Manual only?

### 5.2. Component Grouping Strategy
- **Q**: How do we deduplicate captures into "components"?
- **Options**:
  - **A**: Normalize `accessibleName` + `tagName` + role (loose grouping, may over-group)
  - **B**: Hash style primitives (tight grouping, may under-group)
  - **C**: Hybrid: name + tagName + category, then sub-group by style similarity
- **Recommendation**: Start with **Option A** (loose grouping by intent), refine later

### 5.3. Status Classification
- **Q**: What determines "Canonical" vs "Variant"?
- **Options**:
  - **A**: First-captured in project = Canonical, rest = Variant
  - **B**: User manually marks Canonical
  - **C**: Clustering: most common style = Canonical, deviations = Variant
- **Recommendation**: Start with **Option C** (automatic), add manual override in M8+

### 5.4. Token Inference
- **Q**: When `sources` is missing, how do we extract tokens?
- **Options**:
  - **A**: Skip — only show tokens when CSS variables detected
  - **B**: Generate pseudo-tokens from raw values (e.g. `#3b82f6` → `color-blue-500-inferred`)
  - **C**: Cluster by raw value similarity (e.g. all `rgba(59, 130, 246, 1)` → same group)
- **Recommendation**: Start with **Option A** (conservative), add **Option C** in later milestone

### 5.5. Category Taxonomy
- **Q**: Fixed categories or user-defined?
- **Recommendation**: Fixed set initially (Actions, Forms, Layout, Feedback, Navigation, Media), allow custom in M8+

### 5.6. Persistence vs Derivation
- **Q**: Should we persist grouping/categorization metadata or compute on-the-fly?
- **Trade-offs**:
  - **Persist**: Faster reads, user can override, requires migration
  - **Derive**: Simpler schema, always fresh, slower for large datasets
- **Recommendation**: **Derive** for 7.4.x (100-1000 captures is fast enough), persist in M8 if needed

---

## 6. Recommended Adapter Approach for 7.4.x

### 6.1. Data Flow Architecture

```
IndexedDB (raw captures)
    ↓
[Adapter Layer] (in-memory grouping + categorization)
    ↓
Viewer Model (components, styles, projects)
```

### 6.2. Adapter Functions (to be implemented)

#### `adaptProjectsForViewer(projects: ProjectRecord[]): Promise<Project[]>`
```typescript
// For each project:
// 1. Copy id, name
// 2. Compute captureCount via getProjectCaptureCount()
// 3. Format updatedAt → updatedAtLabel (e.g. formatRelativeTime(project.updatedAt))
```

#### `adaptCapturesForComponents(captures: CaptureRecordV2[]): ComponentItem[]`
```typescript
// 1. Group captures by signature (accessibleName + tagName + role)
// 2. For each group:
//    - Pick first capture as representative
//    - name = element.intent.accessibleName || element.textPreview || `${tagName} (unnamed)`
//    - category = inferCategory(element) // button → "Actions", input → "Forms", etc
//    - type = element.tagName.toLowerCase()
//    - status = inferStatus(group) // "Canonical" (most common style) vs "Variant"
//    - source = inferSource(url, scope)
//    - capturesCount = group.length
// 3. Return sorted by capturesCount desc
```

#### `adaptCapturesForStyles(captures: CaptureRecordV2[]): StyleItem[]`
```typescript
// 1. Extract all style primitives from captures
// 2. Group by token (from sources) OR raw value (fallback)
// 3. For each group:
//    - id = generateStyleId(token || value)
//    - token = extractToken(sources) || "" // empty if no CSS var
//    - value = primitives[key].raw
//    - kind = inferStyleKind(key) // "color", "spacing", "typography", etc
//    - usageCount = group.length
//    - source = inferStyleSource(sources, url)
// 4. Return sorted by usageCount desc
```

### 6.3. Helper Functions

```typescript
// Category inference
function inferCategory(element: ElementCore): string {
  if (element.role === "navigation" || element.tagName === "nav") return "Navigation";
  if (element.tagName === "button" || (element.tagName === "a" && element.intent.href)) return "Actions";
  if (element.tagName === "input" || element.tagName === "select" || element.tagName === "textarea") return "Forms";
  if (element.role === "alert" || element.role === "status") return "Feedback";
  if (element.tagName === "img" || element.tagName === "video" || element.tagName === "svg") return "Media";
  return "Layout"; // Default
}

// Source inference
function inferSource(url: string, scope?: CaptureScope): string {
  // Try extracting page name from URL pathname
  const path = new URL(url).pathname;
  if (path === "/" || path === "") return "Homepage";
  // Simple heuristic: /dashboard → "Dashboard", /product/123 → "Product Page"
  const segments = path.split("/").filter(Boolean);
  if (segments.length > 0) {
    const firstSegment = segments[0];
    return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
  }
  return new URL(url).hostname; // Fallback to hostname
}

// Token extraction
function extractToken(sources?: StyleSources): string | null {
  if (!sources) return null;
  // Find first CSS variable reference
  for (const [key, value] of Object.entries(sources)) {
    if (value && value.startsWith("--")) {
      return value; // e.g. "--color-primary"
    }
  }
  return null;
}

// Relative time formatting
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return "about 1 year ago";
}

// Style kind inference
function inferStyleKind(primitiveKey: keyof StylePrimitives): string {
  if (primitiveKey === "backgroundColor" || primitiveKey === "color" || primitiveKey === "borderColor") return "color";
  if (primitiveKey === "spacing") return "spacing";
  if (primitiveKey === "typography") return "typography";
  if (primitiveKey === "shadow") return "shadow";
  if (primitiveKey === "radius") return "border";
  return "unknown";
}
```

### 6.4. Implementation Plan (7.4.x)

1. **Create adapter module**: `apps/extension/src/ui/viewer/adapters/storageAdapter.ts`
2. **Implement helper functions** (inferCategory, inferSource, extractToken, etc)
3. **Implement adapter functions** (adaptProjectsForViewer, adaptCapturesForComponents, adaptCapturesForStyles)
4. **Wire up ViewerApp** to call adapters instead of using MOCK_COMPONENTS/MOCK_STYLES
5. **Test with real data** (100-1000 captures, validate grouping quality)
6. **Iterate on grouping heuristics** based on user feedback

### 6.5. Performance Considerations

- **Small datasets (< 1000 captures)**: In-memory grouping is fast (< 100ms)
- **Medium datasets (1000-5000 captures)**: May need memoization/caching
- **Large datasets (> 5000 captures)**: Consider persisting grouping metadata in future milestone

### 6.6. Future Persistence (M8+)

If derivation becomes too slow:
- Add `componentGroups` store to cache grouping results
- Add `styleTokens` store to cache token extraction
- Invalidate cache on new captures (simpler than incremental updates)

---

## 7. Summary

**Storage Model**:
- ✅ Rich capture data (element, styles, screenshot refs)
- ✅ Projects and session linking
- ❌ No component grouping metadata
- ❌ No style token extraction
- ❌ No categorization

**Viewer Model**:
- ✅ Clean component/style abstractions
- ❌ Mock data only (not wired to storage)
- ❌ No adapter layer yet

**Next Steps for 7.4.x**:
1. Build adapter layer (derive components/styles from captures)
2. Implement grouping heuristics (accessibleName + tagName + role)
3. Implement category inference (role/tagName → friendly labels)
4. Implement token extraction (sources → CSS var names)
5. Replace MOCK_COMPONENTS/MOCK_STYLES with real data
6. Test and iterate on grouping quality

**Long-term** (M8+):
- Add user overrides (manual categorization, canonical marking)
- Persist grouping metadata if performance requires
- Add advanced clustering (style similarity, visual clustering)
