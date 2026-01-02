# Figma Export Feature

The UI Inventory extension allows you to export captured components to Figma via a ZIP package format. This enables you to create component sheets and design audit pages directly in Figma.

## Overview

The export process consists of two parts:

1. **Export from Viewer**: Generate a ZIP package containing component data and screenshots
2. **Import in Figma**: Use the Figma plugin to create component sheets in your Figma document

## Exporting from the Viewer

### Steps to Export

1. Open the UI Inventory Viewer (click the external link icon in the Sidepanel)
2. Navigate to the project you want to export
3. Click the **"Export to Figma"** button in the toolbar (top-right, next to Grid/Table toggle)
4. Wait for the export to complete
5. A ZIP file will be downloaded automatically (e.g., `My_Project_inventory.zip`)

### What's Included in the Export

The generated ZIP package contains:

```
inventory.zip
├── inventory.json        # Structured component data
└── images/
    ├── comp_abc_default.png
    ├── comp_abc_hover.png
    └── ...              # One screenshot per component state
```

#### inventory.json Structure

```json
{
  "version": "1.0",
  "exportedAt": "2025-01-02T12:00:00.000Z",
  "project": {
    "id": "project-123",
    "name": "My Project"
  },
  "components": [
    {
      "componentKey": "comp_abc",
      "name": "Button · Primary",
      "category": "Actions",
      "type": "button",
      "status": "Unreviewed",
      "sources": ["https://example.com/page1", "https://example.com/page2"],
      "notes": "User-provided notes for this component",
      "tags": ["primary", "cta"],
      "states": [
        {
          "state": "default",
          "screenshotFilename": "comp_abc_default.png",
          "visualEssentials": {
            "Text": [
              { "label": "Text color", "value": "#FFFFFF" },
              { "label": "Font family", "value": "Roboto, sans-serif" },
              { "label": "Font size", "value": "14px" }
            ],
            "Surface": [
              { "label": "Background", "value": "#1976D2FF" },
              { "label": "Radius", "value": "4px / 4px / 4px / 4px" }
            ],
            "Spacing": [
              { "label": "Padding", "value": "8px / 16px / 8px / 16px" }
            ]
          },
          "stylePrimitives": { /* Raw style data */ },
          "htmlSnippet": "<button class=\"MuiButton-root\">...</button>"
        }
      ]
    }
  ]
}
```

### What Gets Exported

- **Components**: All saved (non-draft) captures grouped by component
- **States**: All captured states (default, hover, active, etc.) for each component
- **Visual Essentials**: Color, typography, spacing, and other design properties
- **Screenshots**: High-quality component screenshots for each state
- **Metadata**: Notes, tags, sources, and classification data
- **HTML Structure**: The DOM structure of each component

### What Does NOT Get Exported

- Draft captures (unsaved captures are excluded)
- Session history or metadata
- User overrides (display names, category changes, etc.)

## Importing into Figma

### Installing the Figma Plugin

1. Navigate to `apps/figma-plugin/` in this repository
2. Ensure dependencies are installed: `npm install`
3. Build the plugin: `npm run build`
4. In Figma Desktop App:
   - Go to **Plugins → Development → Import plugin from manifest...**
   - Select `manifest.json` from the `apps/figma-plugin/` directory
   - The plugin will appear in your Development plugins

### Using the Plugin

1. Open your Figma document (or create a new one)
2. Run the plugin: **Plugins → Development → UI Inventory Importer**
3. In the plugin UI:
   - Click "Choose ZIP file" or drag the exported ZIP onto the file input
   - Wait for the ZIP to be parsed (you'll see a summary of components and screenshots)
   - Click **"Import"**
4. Wait for the import to complete (progress bar shows status)
5. A success message will appear and the plugin will close automatically

### What Gets Created in Figma

The plugin creates a **new page** in your Figma document with the following structure:

```
📄 Project Name (page)
  └── 📦 Category Name (frame)
      ├── 🖼️ Component Sheet 1 (frame)
      │   ├── Name (text)
      │   ├── Metadata pills (category, type, status)
      │   ├── State label (if multiple states)
      │   ├── Screenshot (image fill)
      │   ├── Visual Essentials (frame with text rows)
      │   ├── Sources (text)
      │   ├── Notes (text)
      │   └── Tags (pill frames)
      ├── 🖼️ Component Sheet 2
      └── ...
```

#### Component Sheet Layout

Each component becomes a **"component sheet"** frame containing:

1. **Header**: Component name (bold, 18pt)
2. **Metadata Pills**: Category, Type, and Status in rounded pill shapes
3. **States Indicator**: If multiple states exist, shows "States: default, hover, active"
4. **For each state**:
   - State label (if not "default")
   - Screenshot of the component (fitted to frame)
   - Visual Essentials section with Text, Surface, and Spacing properties
5. **Sources**: List of URLs where the component was captured
6. **Notes**: User-provided notes (if any)
7. **Tags**: Tag pills (if any)

#### Layout Properties

- **Component sheets**: 1000px wide, auto-height, vertical layout
- **Category sections**: 1200px wide, auto-height, vertical layout with 24px spacing
- **Screenshots**: Max 600px wide, fitted to maintain aspect ratio
- **Spacing**: Consistent 16px spacing between sections, 24px between components

## Use Cases

### Design Audits

Export all components from a website to create a comprehensive design audit in Figma. Review components side-by-side, identify inconsistencies, and document design system gaps.

### Component Documentation

Create component sheets to document existing UI patterns. Include screenshots, style properties, and usage notes for your design system.

### Handoff to Designers

Capture production components and export them for designer review. Designers can see actual implementation details (colors, spacing, typography) alongside screenshots.

### Design System Migration

Document your current component library before migrating to a new design system. Export captures to Figma for reference during the redesign process.

## Tips and Best Practices

### Before Exporting

1. **Save Your Captures**: Only saved captures are included in exports. Review the project in the Viewer and ensure all captures are saved (not drafts).
2. **Clean Up Duplicates**: Delete duplicate captures or unwanted states to keep the export clean.
3. **Add Notes & Tags**: Provide context for your components with notes and tags—these will appear in Figma.
4. **Capture Multiple States**: Use the state capture feature (default, hover, active) to document interactive components.

### During Export

- **Be Patient**: Large projects (50+ components) may take 10-20 seconds to export.
- **Check Console**: If export fails, check the browser console (F12) for error details.

### In Figma

- **Organize Pages**: Create a separate Figma page for each project export to keep things organized.
- **Customize Layouts**: After importing, feel free to rearrange component sheets, adjust sizing, or add annotations.
- **Use for Reference**: Component sheets are for reference/documentation—they're not meant to be interactive Figma components.
- **Re-import to Update**: To update an existing export, simply run the plugin again. Create a new page to avoid conflicts.

## Troubleshooting

### Export Issues

**Problem**: Export button doesn't appear  
**Solution**: Ensure you're viewing a project in the Viewer (not the projects list). The export button only appears in project detail view.

**Problem**: Export fails with "No captures found"  
**Solution**: Make sure the project has at least one saved (non-draft) capture.

**Problem**: Export is very slow  
**Solution**: Large projects (100+ components) take time. Consider exporting smaller subsets by deleting unwanted components first.

**Problem**: Some screenshots are missing  
**Solution**: Screenshots may fail to load if IndexedDB is corrupted. Try re-capturing the components.

### Import Issues

**Problem**: Plugin won't install  
**Solution**: Ensure you're using Figma Desktop App (not browser). The plugin requires local file access.

**Problem**: "invalid inventory format" error  
**Solution**: The ZIP may be corrupted or from an incompatible version. Re-export from the Viewer and try again.

**Problem**: Images don't appear in Figma  
**Solution**: Ensure the ZIP contains the `images/` folder with PNG files. Check that file names in `inventory.json` match the image files.

**Problem**: Import is slow  
**Solution**: Large exports (50+ components with screenshots) take time. Figma needs to create many nodes and process images. Wait for the progress bar to complete.

**Problem**: Text appears as rectangles  
**Solution**: The "Inter" font is required. Install Inter font on your system or the plugin will fall back to system fonts.

## Technical Details

### Export File Format Specification

- **Version**: 1.0
- **Format**: ZIP archive
- **Encoding**: UTF-8 for JSON, PNG for images
- **Image Format**: PNG (from captured screenshots)
- **Max Image Size**: No hard limit, but large images (>2MB) may slow import

### Compatibility

- **Viewer Export**: Chrome Extension v0.0.0+
- **Figma Plugin**: Figma Desktop App (Mac/Windows)
- **Figma API Version**: 1.0.0

### Security & Privacy

- **Local Only**: All export data stays on your machine. Nothing is sent to external servers.
- **No Tracking**: The plugin does not collect analytics or usage data.
- **Safe Import**: The plugin only creates visual nodes in Figma—no code execution or external requests.

## Future Enhancements

Planned features for future releases:

- **Figma Variables Export**: Create actual Figma variables (colors, spacing) from design tokens
- **Design Token Sync**: Bidirectional sync between Figma variables and captured tokens
- **Component Variants**: Create Figma component variants for different states
- **Selective Export**: Choose specific components or categories to export
- **Incremental Updates**: Re-import to update existing component sheets instead of creating new ones
- **Export to Other Formats**: Sketch, Adobe XD, or JSON-only exports

## Support

For issues, questions, or feature requests related to Figma export:

1. Check this documentation first
2. Review the browser console (F12) for error messages
3. Check the Figma plugin console (Plugins → Development → Open Console)
4. File an issue in the project repository with:
   - Steps to reproduce
   - Browser/Figma version
   - Console errors
   - Sample export ZIP (if possible)

---

**Last Updated**: January 2, 2025  
**Version**: 1.0


