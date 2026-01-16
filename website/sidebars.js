/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'Configuration',
      items: ['configuration/ai-providers', 'configuration/environment'],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: ['deployment/vercel', 'deployment/cloudflare', 'deployment/docker', 'deployment/edgeone'],
    },
    {
      type: 'category',
      label: 'Features',
      items: ['features/dual-engine', 'features/mcp-server', 'features/desktop-app'],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: ['architecture/overview', 'architecture/engines'],
    },
    'acknowledgments',
  ],
};

module.exports = sidebars;
