# UI Inventory Figma Plugin

Figma plugin to import UI Inventory export packages.

## Setup

```bash
npm install
npm run build
```

## Development

```bash
npm run watch
```

Then in Figma:
1. Go to Plugins → Development → Import plugin from manifest
2. Select `manifest.json` from this directory

## Usage

1. Export a project from the UI Inventory Viewer
2. In Figma, run Plugins → UI Inventory Importer
3. Select the exported ZIP file
4. Click Import

The plugin will create a new page with component sheets organized by category.


