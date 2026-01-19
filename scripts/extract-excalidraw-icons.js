#!/usr/bin/env node
/**
 * Extract and normalize icons from Excalidraw library files
 * 
 * This script:
 * 1. Extracts icons from .excalidrawlib files
 * 2. Normalizes coordinates to (0, 0)
 * 3. Regenerates element IDs
 * 4. Saves individual icon JSON files
 * 5. Generates a combined library.excalidrawlib for UI preload
 * 6. Generates index.json for AI reference
 * 
 * Usage: node scripts/extract-excalidraw-icons.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REF_DIR = path.join(__dirname, '../ref/excalidraw-libraries-main/libraries');
const OUT_DIR = path.join(__dirname, '../skills/excalidraw/icons');

// Selected libraries to extract
const LIBRARIES_TO_EXTRACT = [
  // AWS
  { source: 'childishgirl/aws-architecture-icons.excalidrawlib', category: 'aws', prefix: '' },
  { source: 'stojanovic/aws-serverless-icons-v2.excalidrawlib', category: 'aws', prefix: 'serverless_' },
  // GCP
  { source: 'mguidoti/google-icons.excalidrawlib', category: 'gcp', prefix: '' },
  // Kubernetes
  { source: 'boemska-nik/kubernetes-icons.excalidrawlib', category: 'kubernetes', prefix: '' },
  // Infrastructure
  { source: 'dwelle/network-topology-icons.excalidrawlib', category: 'infra', prefix: 'network_' },
  { source: 'odraghi/vmware-architecture-design.excalidrawlib', category: 'infra', prefix: 'vmware_' },
  // System Design
  { source: 'youritjang/software-architecture.excalidrawlib', category: 'system', prefix: '' },
  // Data
  { source: 'chuqbach/data-platform.excalidrawlib', category: 'data', prefix: '' },
];

function generateId() {
  return crypto.randomBytes(10).toString('base64url');
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
}

function normalizeIcon(libraryItem) {
  const elements = libraryItem.elements || [];
  if (elements.length === 0) return null;

  // Find bounding box
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const el of elements) {
    if (el.isDeleted) continue;
    const x = el.x || 0;
    const y = el.y || 0;
    const w = el.width || 0;
    const h = el.height || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  if (!isFinite(minX)) return null;

  // Create ID mapping for references
  const idMap = new Map();
  
  // Normalize elements
  const normalizedElements = elements
    .filter(el => !el.isDeleted)
    .map(el => {
      const oldId = el.id;
      const newId = generateId();
      idMap.set(oldId, newId);

      const normalized = {
        ...el,
        id: newId,
        x: (el.x || 0) - minX,
        y: (el.y || 0) - minY,
      };

      // Remove unnecessary fields
      delete normalized.version;
      delete normalized.versionNonce;
      delete normalized.updated;
      delete normalized.isDeleted;
      delete normalized.link;
      delete normalized.locked;

      return normalized;
    });

  // Update references (containerId, boundElements, bindings, groupIds)
  for (const el of normalizedElements) {
    if (el.containerId && idMap.has(el.containerId)) {
      el.containerId = idMap.get(el.containerId);
    }
    if (el.boundElements && Array.isArray(el.boundElements)) {
      el.boundElements = el.boundElements.map(be => ({
        ...be,
        id: idMap.get(be.id) || be.id
      }));
    }
    if (el.startBinding && idMap.has(el.startBinding.elementId)) {
      el.startBinding.elementId = idMap.get(el.startBinding.elementId);
    }
    if (el.endBinding && idMap.has(el.endBinding.elementId)) {
      el.endBinding.elementId = idMap.get(el.endBinding.elementId);
    }
    if (el.groupIds && Array.isArray(el.groupIds)) {
      // Generate new group IDs
      el.groupIds = el.groupIds.map(gid => {
        if (!idMap.has(gid)) {
          idMap.set(gid, generateId());
        }
        return idMap.get(gid);
      });
    }
  }

  return {
    name: libraryItem.name || 'unnamed',
    width: maxX - minX,
    height: maxY - minY,
    elements: normalizedElements,
  };
}

function loadLibrary(sourcePath) {
  const fullPath = path.join(REF_DIR, sourcePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`Library not found: ${fullPath}`);
    return null;
  }
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Failed to parse ${sourcePath}: ${e.message}`);
    return null;
  }
}

function main() {
  console.log('Extracting Excalidraw icons...\n');

  // Ensure output directory exists
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const allIcons = [];
  const indexData = { categories: {} };
  const libraryItems = [];

  for (const lib of LIBRARIES_TO_EXTRACT) {
    console.log(`Processing: ${lib.source}`);
    const library = loadLibrary(lib.source);
    if (!library || !library.libraryItems) {
      console.warn(`  Skipped (no libraryItems)`);
      continue;
    }

    const categoryDir = path.join(OUT_DIR, lib.category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    if (!indexData.categories[lib.category]) {
      indexData.categories[lib.category] = [];
    }

    let count = 0;
    for (const item of library.libraryItems) {
      const normalized = normalizeIcon(item);
      if (!normalized) continue;

      const iconName = lib.prefix + slugify(normalized.name);
      const iconPath = `${lib.category}/${iconName}`;
      
      // Skip duplicates
      if (indexData.categories[lib.category].some(i => i.name === iconName)) {
        continue;
      }

      // Save individual icon JSON
      const iconFile = path.join(categoryDir, `${iconName}.json`);
      fs.writeFileSync(iconFile, JSON.stringify(normalized, null, 2), 'utf8');

      // Add to index
      indexData.categories[lib.category].push({
        name: iconName,
        displayName: normalized.name,
        width: Math.round(normalized.width),
        height: Math.round(normalized.height),
        elementCount: normalized.elements.length,
      });

      // Add to combined library
      libraryItems.push({
        status: 'published',
        id: generateId(),
        created: Date.now(),
        name: normalized.name,
        elements: normalized.elements,
      });

      allIcons.push({
        path: iconPath,
        ...normalized,
      });

      count++;
    }
    console.log(`  Extracted ${count} icons → ${lib.category}/`);
  }

  // Generate index.json
  let totalIcons = 0;
  for (const cat of Object.keys(indexData.categories)) {
    totalIcons += indexData.categories[cat].length;
  }
  indexData.totalIcons = totalIcons;
  indexData.generatedAt = new Date().toISOString();

  fs.writeFileSync(
    path.join(OUT_DIR, 'index.json'),
    JSON.stringify(indexData, null, 2),
    'utf8'
  );
  console.log(`\nGenerated: index.json (${totalIcons} icons)`);

  // Generate combined library.excalidrawlib
  const combinedLibrary = {
    type: 'excalidrawlib',
    version: 2,
    source: 'agnx-drawer',
    libraryItems: libraryItems,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, 'library.excalidrawlib'),
    JSON.stringify(combinedLibrary),
    'utf8'
  );
  console.log(`Generated: library.excalidrawlib (${libraryItems.length} items)`);

  // Generate README
  let readme = `# Excalidraw Icon Library

Pre-processed icons for AI-assisted diagram generation.

## Statistics
- **Total Icons:** ${totalIcons}
- **Categories:** ${Object.keys(indexData.categories).length}
- **Generated:** ${indexData.generatedAt}

## Categories

`;

  for (const [cat, icons] of Object.entries(indexData.categories)) {
    readme += `### ${cat}\n`;
    readme += `${icons.length} icons\n\n`;
    readme += icons.map(i => `- \`${cat}/${i.name}\` — ${i.displayName}`).join('\n');
    readme += '\n\n';
  }

  readme += `## Usage

### For AI (via $icon placeholder)
\`\`\`json
{"$icon": "aws/lambda", "x": 100, "y": 200}
\`\`\`

### For UI (library panel)
The \`library.excalidrawlib\` file can be loaded into Excalidraw's library panel for manual drag-and-drop.
`;

  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readme, 'utf8');
  console.log('Generated: README.md');

  console.log('\nDone!');
}

main();
