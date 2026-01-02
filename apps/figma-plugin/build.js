#!/usr/bin/env node

/**
 * Build script for Figma plugin
 * Inlines the bundled JavaScript into the HTML file
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building Figma plugin...');

// Create dist directory
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Build TypeScript files with esbuild
console.log('1. Building code.ts...');
execSync('esbuild code.ts --bundle --outfile=dist/code.js --target=es6 --format=iife', { stdio: 'inherit' });

console.log('2. Building ui.ts...');
execSync('esbuild ui.ts --bundle --outfile=dist/ui.js --target=es6 --format=iife', { stdio: 'inherit' });

// Read the bundled UI JavaScript
console.log('3. Reading bundled ui.js...');
const uiJsContent = fs.readFileSync('dist/ui.js', 'utf8');

// Read the HTML template
console.log('4. Reading ui.html template...');
const htmlTemplate = fs.readFileSync('ui.html', 'utf8');

// Inject the bundled JavaScript into the HTML (replace the script src with inline script)
console.log('5. Inlining JavaScript into HTML...');
const inlinedHtml = htmlTemplate.replace(
  /<script src="ui\.js"[^>]*><\/script>/g,
  `<script>\n${uiJsContent}\n</script>`
).replace(
  /<script src="test\.js"[^>]*><\/script>/g,
  '' // Remove test.js reference
);

// Write the final HTML file
console.log('6. Writing dist/ui.html...');
fs.writeFileSync('dist/ui.html', inlinedHtml);

console.log('✓ Build complete!');
console.log('  - dist/code.js');
console.log('  - dist/ui.html (with inlined JavaScript)');


