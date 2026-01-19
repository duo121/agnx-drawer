#!/usr/bin/env node
/**
 * Generate Excalidraw shape library documentation
 * 
 * Usage: node scripts/gen-excalidraw-shape-libs.js
 */

const fs = require('fs');
const path = require('path');

const REF_DIR = path.join(__dirname, '../ref/excalidraw-libraries-main');
const OUT_DIR = path.join(__dirname, '../skills/excalidraw/shape-libraries');

// Selected libraries with categories
const SELECTED_LIBS = [
  // Cloud Providers
  {slug: "childishgirl-aws-architecture-icons", category: "Cloud Providers"},
  {slug: "stojanovic-aws-serverless-icons-v2", category: "Cloud Providers"},
  {slug: "narhari-motivaras-aws-architecture-icons", category: "Cloud Providers"},
  {slug: "husainkhambaty-aws-simple-icons", category: "Cloud Providers"},
  {slug: "mguidoti-google-icons", category: "Cloud Providers"},
  {slug: "mguidoti-original-google-architecture-icons", category: "Cloud Providers"},
  {slug: "clementbosc-gcp-icons", category: "Cloud Providers"},
  {slug: "7demonsrising-azure-network", category: "Cloud Providers"},
  {slug: "mwc360-microsoft-fabric-architecture-icons", category: "Cloud Providers"},
  {slug: "rockssk-microsoft-azure-cloud-icons", category: "Cloud Providers"},
  {slug: "youritjang-azure-cloud-services", category: "Cloud Providers"},
  // Data & Analytics
  {slug: "https-github-com-patrickcuba-snowflake-iconography", category: "Data & Analytics"},
  {slug: "chuqbach-data-platform", category: "Data & Analytics"},
  {slug: "oehrlis-db-eng", category: "Data & Analytics"},
  // Infrastructure
  {slug: "boemska-nik-kubernetes-icons", category: "Infrastructure"},
  {slug: "odraghi-vmware-architecture-design", category: "Infrastructure"},
  {slug: "dwelle-network-topology-icons", category: "Infrastructure"},
  {slug: "markopolo123-dev_ops", category: "Infrastructure"},
  // Business Process
  {slug: "fraoustin-bpmn", category: "Business Process"},
  {slug: "stuc2010-enterprise-integration-patterns", category: "Business Process"},
  {slug: "aretecode-decision-flow-control", category: "Business Process"},
  {slug: "BjoernKW-UML-ER-library", category: "Business Process"},
  // System Design
  {slug: "youritjang-software-architecture", category: "System Design"},
  {slug: "rohanp-system-design", category: "System Design"},
  {slug: "anna-pastushko-architecture-diagram-components", category: "System Design"},
  {slug: "arach-systems-design-components", category: "System Design"},
  {slug: "aretecode-system-design-template", category: "System Design"},
  // UI & Wireframes
  {slug: "gabrielamacakova-basic-ux-wireframing-elements", category: "UI & Wireframes"},
  {slug: "spfr-lo-fi-wireframing-kit", category: "UI & Wireframes"},
  {slug: "manuelernestog-universal-ui-kit", category: "UI & Wireframes"},
  {slug: "excacomp-web-kit", category: "UI & Wireframes"},
  {slug: "g-script-forms", category: "UI & Wireframes"},
  // Logos & Icons
  {slug: "drwnio-drwnio", category: "Logos & Icons"},
  {slug: "pclainchard-it-logos", category: "Logos & Icons"},
  {slug: "maeddes-technology-logos", category: "Logos & Icons"},
  {slug: "ferminrp-awesome-icons", category: "Logos & Icons"},
  {slug: "xxxdeveloper-icons", category: "Logos & Icons"},
  // Charts & Diagrams
  {slug: "dbssticky-data-viz", category: "Charts & Diagrams"},
  {slug: "intradeus-algorithms-and-data-structures-arrays-matrices-trees", category: "Charts & Diagrams"},
  // Enterprise Software
  {slug: "wictorwilen-microsoft-365-icons", category: "Enterprise Software"},
];

function slugToFilename(slug) {
  return slug.replace(/^https-github-com-/, '').replace(/-/g, '_') + '.md';
}

function loadLibrariesJson() {
  const content = fs.readFileSync(path.join(REF_DIR, 'libraries.json'), 'utf8');
  return JSON.parse(content);
}

function loadStatsJson() {
  const content = fs.readFileSync(path.join(REF_DIR, 'stats.json'), 'utf8');
  return JSON.parse(content);
}

function findLibraryBySlug(libraries, slug) {
  // slug format: "author-libname" maps to source "author/libname.excalidrawlib"
  for (const lib of libraries) {
    if (!lib.source) continue;
    const sourceSlug = lib.source.replace(/\.excalidrawlib$/, '').replace(/\//g, '-');
    if (sourceSlug === slug) {
      return lib;
    }
  }
  return null;
}

function tryLoadItemsFromExcalidrawlib(source) {
  // source like "stojanovic/aws-serverless-icons-v2.excalidrawlib"
  const libPath = path.join(REF_DIR, 'libraries', source);
  if (!fs.existsSync(libPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(libPath, 'utf8');
    const data = JSON.parse(content);
    if (data.libraryItems && Array.isArray(data.libraryItems)) {
      return data.libraryItems
        .map(item => item.name)
        .filter(name => name && typeof name === 'string');
    }
  } catch (e) {
    console.error(`Failed to parse ${libPath}: ${e.message}`);
  }
  return null;
}

function generateLibraryMd(lib, stats, category) {
  const slug = lib.source.replace(/\.excalidrawlib$/, '').replace(/\//g, '-');
  const downloads = stats[slug]?.total || 0;
  
  // Get items: prefer itemNames from libraries.json, fallback to .excalidrawlib
  let items = lib.itemNames || [];
  if (!items || items.length === 0) {
    const fromLib = tryLoadItemsFromExcalidrawlib(lib.source);
    if (fromLib && fromLib.length > 0) {
      items = fromLib;
    }
  }
  
  const itemCount = items.length || '?';
  
  let md = `# ${lib.name}

**Type:** Excalidraw library
**Source:** \`${lib.source}\`
**Slug:** \`${slug}\`
**Downloads:** ${downloads.toLocaleString()}

## Description

${lib.description || 'No description available.'}

## Usage

In Excalidraw: Search and install "${lib.name}" from the library browser, or visit:
\`https://libraries.excalidraw.com/#${slug}\`

## Items (${itemCount})

`;

  if (items.length > 0) {
    for (const item of items) {
      md += `- \`${item}\`\n`;
    }
  } else {
    md += `*Item list not available. Install the library to see all items.*\n`;
  }

  return md;
}

function generateReadme(libraryData) {
  // Group by category
  const byCategory = {};
  for (const item of libraryData) {
    if (!byCategory[item.category]) {
      byCategory[item.category] = [];
    }
    byCategory[item.category].push(item);
  }

  // Calculate totals
  let totalLibs = 0;
  let totalItems = 0;
  for (const item of libraryData) {
    totalLibs++;
    totalItems += item.itemCount || 0;
  }

  let md = `# Excalidraw Shape Libraries

Reference for AI-assisted diagram generation using Excalidraw libraries.

`;

  // Category order
  const categoryOrder = [
    'Cloud Providers',
    'Infrastructure', 
    'Data & Analytics',
    'Business Process',
    'System Design',
    'UI & Wireframes',
    'Logos & Icons',
    'Charts & Diagrams',
    'Enterprise Software'
  ];

  for (const category of categoryOrder) {
    const libs = byCategory[category];
    if (!libs || libs.length === 0) continue;

    md += `## ${category}

| Library | Items | Downloads | Description | File |
|---------|-------|-----------|-------------|------|
`;

    for (const lib of libs) {
      const desc = (lib.description || '').substring(0, 60) + ((lib.description?.length > 60) ? '...' : '');
      md += `| ${lib.name} | ${lib.itemCount || '?'} | ${lib.downloads.toLocaleString()} | ${desc} | [${lib.filename}](./${lib.filename}) |\n`;
    }

    md += '\n';
  }

  md += `**Total: ${totalLibs} libraries, ${totalItems.toLocaleString()}+ items**\n`;

  return md;
}

function main() {
  console.log('Loading data...');
  const libraries = loadLibrariesJson();
  const stats = loadStatsJson();

  console.log(`Found ${libraries.length} libraries in libraries.json`);

  // Ensure output directory exists
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const libraryData = [];

  for (const selected of SELECTED_LIBS) {
    const lib = findLibraryBySlug(libraries, selected.slug);
    if (!lib) {
      console.warn(`Library not found: ${selected.slug}`);
      continue;
    }

    const filename = slugToFilename(selected.slug);
    const md = generateLibraryMd(lib, stats, selected.category);
    const outPath = path.join(OUT_DIR, filename);
    
    fs.writeFileSync(outPath, md, 'utf8');
    console.log(`Generated: ${filename}`);

    // Collect for README
    let items = lib.itemNames || [];
    if (!items || items.length === 0) {
      const fromLib = tryLoadItemsFromExcalidrawlib(lib.source);
      if (fromLib) items = fromLib;
    }

    libraryData.push({
      name: lib.name,
      category: selected.category,
      description: lib.description,
      filename: filename,
      itemCount: items.length,
      downloads: stats[selected.slug]?.total || 0
    });
  }

  // Generate README
  const readme = generateReadme(libraryData);
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readme, 'utf8');
  console.log('Generated: README.md');

  console.log(`\nDone! Generated ${libraryData.length} library docs + README.md`);
}

main();
