/**
 * UI Inventory Figma Plugin - UI Thread
 * 
 * Handles file upload, ZIP parsing, and communication with main thread
 */

// #region agent log
console.log('[UI_TS] TOP OF FILE - before any imports', Date.now(), 'hypothesisId:F');
// #endregion

import JSZip from 'jszip';

// #region agent log
console.log('[UI_TS] After JSZip import', Date.now(), 'hypothesisId:F');
// #endregion

let selectedFile: File | null = null;
let parsedInventory: any = null;
let parsedImages: Record<string, Uint8Array> = {};

// #region agent log
console.log('[UI_DEBUG] Script loaded at', Date.now(), 'hypothesisId:C');
// #endregion

// DOM elements
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const fileInfo = document.getElementById('fileInfo') as HTMLDivElement;
const importBtn = document.getElementById('importBtn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement;
const progress = document.getElementById('progress') as HTMLDivElement;
const progressText = document.getElementById('progressText') as HTMLDivElement;
const progressBarFill = document.getElementById('progressBarFill') as HTMLDivElement;
const errorDiv = document.getElementById('error') as HTMLDivElement;
const successDiv = document.getElementById('success') as HTMLDivElement;

// #region agent log
console.log('[UI_DEBUG] DOM elements queried:', {
  fileInput: !!fileInput,
  fileInfo: !!fileInfo,
  importBtn: !!importBtn,
  fileInputId: fileInput?.id,
  fileInputType: fileInput?.type
}, 'hypothesisId:D');
// #endregion

// File input handler
fileInput.addEventListener('change', async (e) => {
  // #region agent log
  console.log('[UI_DEBUG] File input change event fired', {
    hasFiles: !!(e.target as HTMLInputElement).files,
    fileCount: (e.target as HTMLInputElement).files?.length
  }, 'hypothesisId:B');
  // #endregion
  
  const files = (e.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    selectedFile = files[0];
    // #region agent log
    console.log('[UI_DEBUG] File selected via input:', {
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type
    }, 'hypothesisId:B');
    // #endregion
    await processFile(selectedFile);
  }
});

// #region agent log - Add drag/drop handlers
const dropZone = document.querySelector('.file-input') as HTMLElement;
console.log('[UI_DEBUG] Setting up drag/drop, dropZoneFound:', !!dropZone, 'hypothesisId:A');
// #endregion

if (dropZone) {
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.style.borderColor = '#0066ff';
    dropZone.style.background = '#f8f9ff';
    // #region agent log
    console.log('[UI_DEBUG] Dragover event', 'hypothesisId:A');
    // #endregion
  });
  
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.style.borderColor = '#ccc';
    dropZone.style.background = 'white';
  });
  
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.style.borderColor = '#ccc';
    dropZone.style.background = 'white';
    
    // #region agent log
    console.log('[UI_DEBUG] Drop event fired', {
      hasFiles: !!e.dataTransfer?.files,
      fileCount: e.dataTransfer?.files?.length
    }, 'hypothesisId:A');
    // #endregion
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      selectedFile = files[0];
      // #region agent log
      console.log('[UI_DEBUG] File selected via drop:', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type
      }, 'hypothesisId:A');
      // #endregion
      await processFile(selectedFile);
    }
  });
}
// #endregion

// Import button handler
importBtn.addEventListener('click', async () => {
  if (!parsedInventory || Object.keys(parsedImages).length === 0) {
    showError('No valid inventory data to import');
    return;
  }
  
  importBtn.disabled = true;
  showProgress('Importing to Figma...');
  
  // Send to main thread
  parent.postMessage({
    pluginMessage: {
      type: 'import-inventory',
      inventory: parsedInventory,
      images: parsedImages
    }
  }, '*');
});

// Cancel button handler
cancelBtn.addEventListener('click', () => {
  parent.postMessage({ pluginMessage: { type: 'cancel' } }, '*');
});

// Listen for messages from main thread
window.onmessage = (event) => {
  // Check if the message has the expected structure
  if (!event.data || !event.data.pluginMessage) {
    return; // Ignore messages without pluginMessage
  }
  
  const msg = event.data.pluginMessage;
  if (msg.type === 'import-complete') {
    hideProgress();
    if (msg.success) {
      showSuccess('✓ Import completed successfully!');
      setTimeout(() => {
        parent.postMessage({ pluginMessage: { type: 'cancel' } }, '*');
      }, 2000);
    } else {
      showError(`Import failed: ${msg.error || 'Unknown error'}`);
      importBtn.disabled = false;
    }
  }
};

// Process ZIP file
async function processFile(file: File) {
  // #region agent log
  console.log('[UI_DEBUG] processFile called:', {
    fileName: file.name,
    fileSize: file.size
  }, 'hypothesisId:E');
  // #endregion
  
  hideError();
  hideSuccess();
  showProgress('Reading ZIP file...');
  
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    // #region agent log
    console.log('[UI_DEBUG] ZIP loaded, fileCount:', Object.keys(contents.files).length, 'hypothesisId:E');
    // #endregion
    
    // Find inventory.json
    const inventoryFile = contents.file('inventory.json');
    if (!inventoryFile) {
      throw new Error('inventory.json not found in ZIP');
    }
    
    showProgress('Parsing inventory...');
    const inventoryText = await inventoryFile.async('text');
    parsedInventory = JSON.parse(inventoryText);
    
    // Validate inventory structure
    if (!parsedInventory.project || !Array.isArray(parsedInventory.components)) {
      throw new Error('Invalid inventory format');
    }
    
    // Extract images
    showProgress('Extracting images...');
    parsedImages = {};
    const imageFolder = contents.folder('images');
    
    if (imageFolder) {
      const imageFiles = imageFolder.filter((relativePath, file) => !file.dir);
      let processed = 0;
      
      for (const file of imageFiles) {
        const filename = file.name.replace('images/', '');
        const bytes = await file.async('uint8array');
        parsedImages[filename] = bytes;
        
        processed++;
        updateProgress(processed / imageFiles.length);
        progressText.textContent = `Extracting images (${processed}/${imageFiles.length})...`;
      }
    }
    
    // Show file info
    hideProgress();
    fileInfo.style.display = 'block';
    fileInfo.innerHTML = `
      <strong>${parsedInventory.project.name}</strong>
      ${parsedInventory.components.length} components
      <br>
      ${Object.keys(parsedImages).length} screenshots
    `;
    
    // Enable import button
    importBtn.disabled = false;
    
  } catch (err) {
    // #region agent log
    console.error('[UI_DEBUG] processFile error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    }, 'hypothesisId:E');
    // #endregion
    hideProgress();
    showError(err instanceof Error ? err.message : String(err));
    importBtn.disabled = true;
  }
}

// UI helpers
function showProgress(text: string) {
  progressText.textContent = text;
  progress.classList.add('visible');
  updateProgress(0);
}

function hideProgress() {
  progress.classList.remove('visible');
}

function updateProgress(ratio: number) {
  progressBarFill.style.width = `${ratio * 100}%`;
}

function showError(message: string) {
  errorDiv.textContent = message;
  errorDiv.classList.add('visible');
}

function hideError() {
  errorDiv.classList.remove('visible');
}

function showSuccess(message: string) {
  successDiv.textContent = message;
  successDiv.classList.add('visible');
}

function hideSuccess() {
  successDiv.classList.remove('visible');
}

