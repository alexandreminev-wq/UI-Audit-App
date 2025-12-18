# Extension File Tree

```
apps/extension/
├── dist/                              # Build output (auto-generated, do not edit)
│   ├── chunks/
│   │   ├── client-Gn3uUkmT.js
│   │   └── modulepreload-polyfill-B5Qt9EMX.js
│   ├── contentScript.js
│   ├── contentScript.js.map
│   ├── serviceWorker.js
│   ├── popup.html
│   ├── popup.js
│   ├── viewer.html
│   ├── viewer.js
│   ├── offscreen.html
│   ├── offscreen.js
│   ├── manifest.json
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
│
├── public/                            # Static assets copied to dist
│   ├── vite.svg
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
│
├── scripts/
│   └── copy-to-dist.mjs               # Build script for manifest/icons
│
├── src/                               # Source code (edit here)
│   ├── assets/
│   │   └── react.svg
│   │
│   ├── background/                    # Service worker context
│   │   ├── serviceWorker.ts           # Message handlers + IndexedDB orchestration
│   │   └── capturesDb.ts              # IndexedDB wrapper (sessions, captures, blobs)
│   │
│   ├── content/                       # Content script context
│   │   ├── contentScript.ts           # Element selection + capture coordination
│   │   ├── extractComputedStyles.ts   # Style primitive extraction
│   │   └── styleKeys.ts               # Canonical style property list
│   │
│   ├── offscreen/                     # Offscreen document (MV3 screenshot capture)
│   │   └── offscreen.ts
│   │
│   ├── types/                         # Shared TypeScript types
│   │   ├── capture.ts                 # CaptureRecordV2, SessionRecord, BlobRecord schemas
│   │   └── messages.ts                # Message protocol types
│   │
│   ├── ui/
│   │   ├── popup/
│   │   │   └── popup.tsx              # Extension popup UI
│   │   └── viewer/
│   │       └── viewer.tsx             # Viewer app (gallery, grouping, compare, export)
│   │
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
│
├── .gitignore
├── eslint.config.js
├── FILE_TREE.md                       # This file
├── index.html                         # Popup HTML template
├── manifest.json                      # Extension manifest (source)
├── offscreen.html                     # Offscreen document HTML
├── package.json
├── popup.html                         # Popup HTML template
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts                     # Main build config (popup, viewer, service worker, offscreen)
├── vite.content.config.ts             # Content script build config
└── viewer.html                        # Viewer app HTML template
```

## Key Directories

- **Source files**: `src/` (organized by extension context: background, content, offscreen, ui)
- **Build output**: `dist/` (auto-generated, never edit directly)
- **Static assets**: `public/` (copied to dist during build)
- **Build tooling**: `vite.config.ts`, `vite.content.config.ts`, `scripts/copy-to-dist.mjs`

## Architecture Notes

- **Service worker** (`background/serviceWorker.ts`) is the **only IndexedDB accessor**
- **Viewer** (`ui/viewer/viewer.tsx`) uses message passing only (no direct DB access)
- **Offscreen document** (`offscreen/offscreen.ts`) handles screenshot capture (MV3 requirement)
- **Content script** (`content/contentScript.ts`) handles element selection on web pages
