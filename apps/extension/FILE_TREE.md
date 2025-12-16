# Extension File Tree

```
apps/extension/
├── dist/                              # Build output (auto-generated, do not edit)
│   ├── contentScript.js
│   ├── serviceWorker.js
│   ├── popup.html
│   ├── popup.js
│   ├── vite.svg
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
│   │   ├── serviceWorker.ts
│   │   └── capturesDb.ts              # IndexedDB wrapper
│   │
│   ├── content/                       # Content script context
│   │   ├── contentScript.ts
│   │   ├── extractComputedStyles.ts
│   │   └── styleKeys.ts
│   │
│   ├── types/                         # Shared TypeScript types
│   │   ├── capture.ts
│   │   └── messages.ts
│   │
│   ├── ui/
│   │   └── popup/
│   │       └── popup.tsx              # Popup UI
│   │
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
│
├── .gitignore
├── eslint.config.js
├── index.html                         # Popup HTML template
├── manifest.json                      # Extension manifest (source)
├── package.json
├── popup.html                         # Additional popup template
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts                     # Build configuration
```

## Key Directories

- **Source files**: `src/` (organized by extension context: background, content, ui)
- **Build output**: `dist/` (auto-generated, never edit directly)
- **Static assets**: `public/` (copied to dist during build)
- **Build tooling**: `vite.config.ts`, `scripts/copy-to-dist.mjs`
