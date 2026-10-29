// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Kiss State Management for React',
  tagline: 'React state management, built for AI coding agents',
  favicon: 'img/favicon.ico',

  url: 'https://kissforreact.org',
  // url: 'http://192.168.0.11',

  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // Every page is emitted as `page.html`, and the URLs have no trailing slash, which is what
  // the site's links, the sitemap and the README always used. GitHub Pages serves a `.html`
  // file directly, with no redirect. (Without this setting, pages were `page/index.html`, and
  // GitHub Pages redirected each direct access to add the slash.) Don't set it to `true`: the
  // pages link to each other with relative links like `./control-features#retry`, which are
  // resolved against the page URL, and a trailing slash on it breaks all of them.
  trailingSlash: false,

  // GitHub pages deployment config (only if using GitHub)
  organizationName: 'marcglasberg',
  projectName: 'kissforreact.org', // Usually your repo name.

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        href: '/img/docusaurus.png',
      },
    },
  ],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: 'react',
          routeBasePath: 'react',
          sidebarPath: './sidebarsReact.js',

          // Please change this to your repo. Remove this to remove the "edit this page" links.
          editUrl: undefined,
        },
        // This site has no blog.
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  plugins: [],

  themeConfig:
  /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/KISS.svg',
      metadata: [
        {
          name: 'description',
          content: 'React state management, built for AI coding agents. Your agent writes structured, testable code, and a linter checks its work. You can still read every line.'
        },
        {name: 'og:title', content: 'Kiss'},
        {name: 'og:description', content: 'React state management, built for AI coding agents. Your agent writes structured, testable code, and a linter checks its work. You can still read every line.'},
        {name: 'og:url', content: 'https://kissforreact.org'},
        {name: 'og:image', content: 'https://kissforreact.org/img/LandscapeLake.jpg'},
        {name: 'twitter:card', content: 'summary_large_image'},
        {name: 'twitter:title', content: 'Kiss'},
        {
          name: 'twitter:description',
          content: 'React state management, built for AI coding agents. Your agent writes structured, testable code, and a linter checks its work. You can still read every line.'
        },
        {name: 'twitter:image', content: 'https://kissforreact.org/img/LandscapeLake.jpg'},
      ],
      navbar: {
        title: '',
        logo: {
          alt: 'Kiss Logo',
          src: 'img/KISS_outline.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Get Started',
            href: '/react/intro',
          },
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Tutorial',
            href: '/react/category/tutorial',
          },
          {
            href: 'https://github.com/marcglasberg/kiss-for-react',
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
              {
                label: 'Get Started',
                to: '/react/intro',

              },
              {
                label: 'Tutorial',
                to: '/react/category/tutorial',
              },
            ],
          },
          {
            title: 'My personal links',
            items: [
              {
                label: 'Website',
                href: 'https://glasberg.dev',
              },
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/users/3411681/marcelo-glasberg',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/GlasbergMarcelo',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/marcglasberg/kiss-for-react',
              },
              {
                label: 'npm',
                href: 'https://www.npmjs.com/package/kiss-for-react'
              },
            ],
          },
        ],
        logo: {
          alt: 'Kiss Logo',
          src: 'img/KISS_white.svg',
          width: 64,
          height: 64,
        },
        copyright: `Copyright © 2024 Marcelo Glasberg`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['dart'],
      },
    }),
};

export default config;
