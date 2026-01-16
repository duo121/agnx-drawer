// @ts-check
const { themes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'AGNX Drawer',
  tagline: 'AI-Powered Diagram Creation Tool',
  favicon: 'img/favicon.ico',

  url: 'https://agnx-drawer.vercel.app',
  baseUrl: '/',

  organizationName: 'duo121',
  projectName: 'agnx-drawer',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    localeConfigs: {
      en: { label: 'English' },
      zh: { label: '中文' },
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/duo121/agnx-drawer/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/social-card.png',
      navbar: {
        title: 'AGNX Drawer',
        logo: {
          alt: 'AGNX Drawer Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            type: 'localeDropdown',
            position: 'right',
          },
          {
            href: 'https://github.com/duo121/agnx-drawer',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Getting Started', to: '/docs/getting-started' },
              { label: 'Configuration', to: '/docs/configuration/ai-providers' },
              { label: 'Deployment', to: '/docs/deployment/vercel' },
            ],
          },
          {
            title: 'Community',
            items: [
              { label: 'GitHub', href: 'https://github.com/duo121/agnx-drawer' },
              { label: 'Issues', href: 'https://github.com/duo121/agnx-drawer/issues' },
            ],
          },
          {
            title: 'Credits',
            items: [
              {
                label: 'Original Project by @DayuanJiang',
                href: 'https://github.com/DayuanJiang/next-ai-draw-io',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} AGNX Drawer. Built with Docusaurus.`,
      },
      prism: {
        theme: themes.github,
        darkTheme: themes.dracula,
      },
    }),
};

module.exports = config;
