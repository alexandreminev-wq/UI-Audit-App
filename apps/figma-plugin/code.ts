/**
 * UI Inventory Figma Plugin - Main Thread
 * 
 * Handles import logic: creates pages, frames, and nodes from inventory data
 */

// Show UI when plugin runs
figma.showUI(__html__, { width: 480, height: 600 });

// Message handler from UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === "import-inventory") {
    try {
      await importInventory(msg.inventory, msg.images);
      figma.ui.postMessage({ type: "import-complete", success: true });
      figma.notify("✓ Import complete!");
    } catch (err) {
      console.error("Import failed:", err);
      figma.ui.postMessage({ 
        type: "import-complete", 
        success: false, 
        error: err instanceof Error ? err.message : String(err)
      });
      figma.notify("✗ Import failed. See console for details.");
    }
  }

  if (msg.type === "cancel") {
    figma.closePlugin();
  }
};

// ─────────────────────────────────────────────────────────────
// Import Logic
// ─────────────────────────────────────────────────────────────

interface ExportInventory {
  version: string;
  exportedAt: string;
  project: {
    id: string;
    name: string;
  };
  components: ExportComponent[];
}

interface ExportComponent {
  componentKey: string;
  name: string;
  category: string;
  type: string;
  status: string;
  sources: string[];
  notes: string | null;
  tags: string[];
  states: ExportComponentState[];
}

interface ExportComponentState {
  state: string;
  screenshotFilename: string | null;
  visualEssentials: {
    Text?: { label: string; value: string }[];
    Surface?: { label: string; value: string }[];
    Spacing?: { label: string; value: string }[];
  };
  stylePrimitives: Record<string, any>;
  htmlSnippet: string;
}

async function importInventory(
  inventory: ExportInventory,
  images: Record<string, Uint8Array>
): Promise<void> {
  // Load font for text nodes
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });

  // Create new page for this project
  const page = figma.createPage();
  page.name = inventory.project.name;
  figma.currentPage = page;

  // Group components by category
  const componentsByCategory = new Map<string, ExportComponent[]>();
  for (const component of inventory.components) {
    const category = component.category || "Unknown";
    if (!componentsByCategory.has(category)) {
      componentsByCategory.set(category, []);
    }
    componentsByCategory.get(category)!.push(component);
  }

  let yOffset = 0;

  // Create section for each category
  for (const [category, components] of componentsByCategory.entries()) {
    // Category section frame
    const sectionFrame = figma.createFrame();
    sectionFrame.name = `${category} (${components.length})`;
    sectionFrame.x = 0;
    sectionFrame.y = yOffset;
    sectionFrame.resize(1200, 100); // Will auto-resize
    sectionFrame.layoutMode = "VERTICAL";
    sectionFrame.primaryAxisSizingMode = "AUTO";
    sectionFrame.counterAxisSizingMode = "FIXED";
    sectionFrame.itemSpacing = 24;
    sectionFrame.paddingTop = sectionFrame.paddingBottom = 24;
    sectionFrame.paddingLeft = sectionFrame.paddingRight = 24;
    sectionFrame.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }];

    // Category header
    const categoryHeader = figma.createText();
    categoryHeader.fontName = { family: "Inter", style: "Bold" };
    categoryHeader.fontSize = 20;
    categoryHeader.characters = category;
    categoryHeader.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
    sectionFrame.appendChild(categoryHeader);

    // Create component sheets
    for (const component of components) {
      const componentSheet = await createComponentSheet(component, images);
      sectionFrame.appendChild(componentSheet);
    }

    page.appendChild(sectionFrame);
    yOffset += sectionFrame.height + 40;
  }

  // Zoom to fit all content
  figma.viewport.scrollAndZoomIntoView([page]);
}

async function createComponentSheet(
  component: ExportComponent,
  images: Record<string, Uint8Array>
): Promise<FrameNode> {
  const sheet = figma.createFrame();
  sheet.name = component.name;
  sheet.resize(1000, 100); // Will auto-resize
  sheet.layoutMode = "VERTICAL";
  sheet.primaryAxisSizingMode = "AUTO";
  sheet.counterAxisSizingMode = "FIXED";
  sheet.itemSpacing = 16;
  sheet.paddingTop = sheet.paddingBottom = 20;
  sheet.paddingLeft = sheet.paddingRight = 20;
  sheet.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  sheet.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
  sheet.strokeWeight = 1;
  sheet.cornerRadius = 8;

  // Header: Component name
  const header = figma.createText();
  header.fontName = { family: "Inter", style: "Bold" };
  header.fontSize = 18;
  header.characters = component.name;
  header.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  sheet.appendChild(header);

  // Metadata pills (category, type, status)
  const metadataRow = figma.createFrame();
  metadataRow.layoutMode = "HORIZONTAL";
  metadataRow.primaryAxisSizingMode = "AUTO";
  metadataRow.counterAxisSizingMode = "AUTO";
  metadataRow.itemSpacing = 8;
  metadataRow.fills = [];
  
  for (const [label, value] of [
    ["Category", component.category],
    ["Type", component.type],
    ["Status", component.status],
  ]) {
    const pill = createPill(`${label}: ${value}`);
    metadataRow.appendChild(pill);
  }
  sheet.appendChild(metadataRow);

  // States (if multiple)
  if (component.states.length > 1) {
    const statesLabel = figma.createText();
    statesLabel.fontName = { family: "Inter", style: "Medium" };
    statesLabel.fontSize = 14;
    statesLabel.characters = `States: ${component.states.map(s => s.state).join(", ")}`;
    statesLabel.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
    sheet.appendChild(statesLabel);
  }

  // For each state, create a section
  for (const state of component.states) {
    const stateSection = await createStateSection(state, images);
    sheet.appendChild(stateSection);
  }

  // Sources
  if (component.sources.length > 0) {
    const sourcesLabel = figma.createText();
    sourcesLabel.fontName = { family: "Inter", style: "Medium" };
    sourcesLabel.fontSize = 12;
    sourcesLabel.characters = `Sources:\n${component.sources.join("\n")}`;
    sourcesLabel.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
    sheet.appendChild(sourcesLabel);
  }

  // Notes
  if (component.notes) {
    const notesLabel = figma.createText();
    notesLabel.fontName = { family: "Inter", style: "Regular" };
    notesLabel.fontSize = 12;
    notesLabel.characters = `Notes: ${component.notes}`;
    notesLabel.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
    sheet.appendChild(notesLabel);
  }

  // Tags
  if (component.tags.length > 0) {
    const tagsRow = figma.createFrame();
    tagsRow.layoutMode = "HORIZONTAL";
    tagsRow.primaryAxisSizingMode = "AUTO";
    tagsRow.counterAxisSizingMode = "AUTO";
    tagsRow.itemSpacing = 6;
    tagsRow.fills = [];

    for (const tag of component.tags) {
      const tagPill = createPill(tag, { r: 0.9, g: 0.95, b: 1 });
      tagsRow.appendChild(tagPill);
    }
    sheet.appendChild(tagsRow);
  }

  return sheet;
}

async function createStateSection(
  state: ExportComponentState,
  images: Record<string, Uint8Array>
): Promise<FrameNode> {
  const section = figma.createFrame();
  section.layoutMode = "VERTICAL";
  section.primaryAxisSizingMode = "AUTO";
  section.counterAxisSizingMode = "FIXED";
  section.itemSpacing = 12;
  section.fills = [];

  // State label (if not default)
  if (state.state !== "default") {
    const stateLabel = figma.createText();
    stateLabel.fontName = { family: "Inter", style: "Bold" };
    stateLabel.fontSize = 14;
    stateLabel.characters = `State: ${state.state}`;
    stateLabel.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
    section.appendChild(stateLabel);
  }

  // Screenshot
  if (state.screenshotFilename && images[state.screenshotFilename]) {
    try {
      const imageBytes = images[state.screenshotFilename];
      
      // Validate that this is actually image data (check for PNG or JPEG magic bytes)
      const isPNG = imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4E && imageBytes[3] === 0x47;
      const isJPEG = imageBytes[0] === 0xFF && imageBytes[1] === 0xD8 && imageBytes[2] === 0xFF;
      
      if (!isPNG && !isJPEG) {
        console.warn(`Skipping screenshot ${state.screenshotFilename}: not a valid PNG or JPEG (magic bytes: ${imageBytes.slice(0, 4).join(', ')})`);
      } else {
        const image = figma.createImage(imageBytes);
        const rect = figma.createRectangle();
        
        // Get image size from the hash
        const { width, height } = await image.getSizeAsync();
        
        // Scale to fit max width of 600px while maintaining aspect ratio
        const maxWidth = 600;
        const scale = width > maxWidth ? maxWidth / width : 1;
        const displayWidth = width * scale;
        const displayHeight = height * scale;
        
        rect.resize(displayWidth, displayHeight);
        rect.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FIT" }];
        rect.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
        rect.strokeWeight = 1;
        section.appendChild(rect);
      }
    } catch (err) {
      console.error(`Failed to create image for ${state.screenshotFilename}:`, err);
      // Add error placeholder
      const errorText = figma.createText();
      errorText.fontName = { family: "Inter", style: "Regular" };
      errorText.fontSize = 11;
      errorText.characters = `⚠️ Screenshot failed to load: ${state.screenshotFilename}`;
      errorText.fills = [{ type: "SOLID", color: { r: 0.8, g: 0.2, b: 0.2 } }];
      section.appendChild(errorText);
    }
  }

  // Visual Essentials
  const veFrame = createVisualEssentialsFrame(state.visualEssentials);
  section.appendChild(veFrame);

  return section;
}

function createVisualEssentialsFrame(visualEssentials: ExportComponentState["visualEssentials"]): FrameNode {
  const frame = figma.createFrame();
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.itemSpacing = 8;
  frame.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.97, b: 0.97 } }];
  frame.paddingTop = frame.paddingBottom = 12;
  frame.paddingLeft = frame.paddingRight = 12;
  frame.cornerRadius = 4;

  const title = figma.createText();
  title.fontName = { family: "Inter", style: "Bold" };
  title.fontSize = 13;
  title.characters = "Visual Essentials";
  title.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  frame.appendChild(title);

  // Add sections
  for (const [sectionName, rows] of Object.entries(visualEssentials)) {
    if (!rows || rows.length === 0) continue;

    const sectionTitle = figma.createText();
    sectionTitle.fontName = { family: "Inter", style: "Medium" };
    sectionTitle.fontSize = 11;
    sectionTitle.characters = sectionName;
    sectionTitle.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
    frame.appendChild(sectionTitle);

    for (const row of rows) {
      const rowText = figma.createText();
      rowText.fontName = { family: "Inter", style: "Regular" };
      rowText.fontSize = 11;
      rowText.characters = `${row.label}: ${row.value}`;
      rowText.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
      frame.appendChild(rowText);
    }
  }

  return frame;
}

function createPill(text: string, bgColor = { r: 0.95, g: 0.95, b: 0.95 }): FrameNode {
  const pill = figma.createFrame();
  pill.layoutMode = "HORIZONTAL";
  pill.primaryAxisSizingMode = "AUTO";
  pill.counterAxisSizingMode = "AUTO";
  pill.paddingLeft = pill.paddingRight = 8;
  pill.paddingTop = pill.paddingBottom = 4;
  pill.cornerRadius = 12;
  pill.fills = [{ type: "SOLID", color: bgColor }];

  const pillText = figma.createText();
  pillText.fontName = { family: "Inter", style: "Medium" };
  pillText.fontSize = 11;
  pillText.characters = text;
  pillText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  pill.appendChild(pillText);

  return pill;
}

