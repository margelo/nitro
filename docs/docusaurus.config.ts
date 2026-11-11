import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import type { Options as SitemapOptions } from '@docusaurus/plugin-sitemap';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const title = 'Nitro Modules';
const tagline = 'A framework for building fast, type-safe native modules for React Native with statically compiled JSI bindings.';
const url = 'https://nitro.margelo.com';
const homeUrl = new URL('/', url).href;
const repoRoot = path.resolve(__dirname, '..');

const marcId = 'https://mrousavy.com/#person';
const margeloId = 'https://margelo.com/#organization';
const nitroWebsiteId = `${homeUrl}#website`;
const nitroSoftwareId = `${homeUrl}#software`;

function getGitLastmodDate(sourcePath: string): string | null {
  try {
    const timestamp = execFileSync('git', ['log', '-1', '--format=%ct', '--', sourcePath], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    if (timestamp.length === 0) return null;
    return new Date(Number(timestamp) * 1000).toISOString().split('T')[0]!;
  } catch {
    return null;
  }
}

function getSitemapSourcePath(itemUrl: string): string | null {
  const pathname = new URL(itemUrl).pathname;
  if (pathname === '/') {
    return 'docs/src/pages/index.tsx';
  }
  if (!pathname.startsWith('/docs/')) {
    return null;
  }

  const docId = decodeURIComponent(pathname.slice('/docs/'.length));
  const candidates = [`docs/docs/${docId}.md`, `docs/docs/${docId}.mdx`];
  return candidates.find((candidate) => existsSync(path.join(repoRoot, candidate))) ?? null;
}

const createSitemapItems: NonNullable<SitemapOptions['createSitemapItems']> = async (params) => {
  const { defaultCreateSitemapItems, ...rest } = params;
  const items = await defaultCreateSitemapItems(rest);
  return items
    .filter((item) => !item.url.includes('/page/'))
    .map((item) => {
      const sourcePath = getSitemapSourcePath(item.url);
      const lastmod = sourcePath == null ? null : getGitLastmodDate(sourcePath);
      return lastmod == null ? item : { ...item, lastmod };
    });
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': marcId,
      name: 'Marc Rousavy',
      url: 'https://mrousavy.com',
      jobTitle: 'Founder & CEO',
      sameAs: [
        'https://github.com/mrousavy',
        'https://twitter.com/mrousavy',
        'https://www.youtube.com/@mrousavy',
      ],
      worksFor: { '@id': margeloId },
    },
    {
      '@type': 'Organization',
      '@id': margeloId,
      name: 'Margelo',
      url: 'https://margelo.com',
      founder: { '@id': marcId },
      sameAs: [
        'https://github.com/margelo',
        'https://twitter.com/margelo_com',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': nitroWebsiteId,
      url: homeUrl,
      name: title,
      alternateName: ['Nitro', 'React Native Nitro', 'React Native Nitro Modules'],
      description: tagline,
      inLanguage: 'en',
      publisher: { '@id': margeloId },
      author: { '@id': marcId },
      about: { '@id': nitroSoftwareId },
    },
    {
      '@type': ['SoftwareApplication', 'SoftwareSourceCode'],
      '@id': nitroSoftwareId,
      name: title,
      alternateName: [
        'Nitro',
        'React Native Nitro',
        'React Native Nitro Modules',
        'react-native-nitro-modules',
      ],
      description: tagline,
      url: homeUrl,
      sameAs: [
        'https://github.com/margelo/nitro',
        'https://www.npmjs.com/package/react-native-nitro-modules',
        'https://www.npmjs.com/package/nitrogen',
      ],
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'iOS, Android',
      codeRepository: 'https://github.com/margelo/nitro',
      programmingLanguage: ['C++', 'Swift', 'Kotlin', 'TypeScript'],
      license: 'https://opensource.org/licenses/MIT',
      author: { '@id': marcId },
      creator: { '@id': marcId },
      publisher: { '@id': margeloId },
      sourceOrganization: { '@id': margeloId },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ],
};

const config: Config = {
  title: title,
  tagline: tagline,
  favicon: '/img/favicon.ico',

  // Set the production url of your site here
  url: url,
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  organizationName: 'margelo',
  projectName: 'nitro',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  // Runs animations on page change
  clientModules: ['./src/clientModules/pageSwitchFadeAnimation.ts'],

  headTags: [
    {
      tagName: 'script',
      attributes: {
        type: 'application/ld+json',
      },
      innerHTML: JSON.stringify(jsonLd),
    },
  ],

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  future: {
    faster: true,
    v4: true
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        sitemap: {
          lastmod: 'date',
          changefreq: null,
          priority: null,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
          createSitemapItems,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    require('./src/plugins/enforce-single-react-instance'),
    [
      'vercel-analytics',
      {},
    ],
    [
      'docusaurus-plugin-llms',
      {
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        generateMarkdownFiles: true,
        preserveDirectoryStructure: true,
        excludeImports: true,
        includeOrder: [
          'getting-started/what-is-nitro.md',
          'concepts/nitro-modules.md',
          'concepts/hybrid-objects.md',
          'concepts/hybrid-views.md',
          'concepts/nitrogen.md',
          'types/typing-system.md',
          'getting-started/minimum-requirements.md',
          'getting-started/how-to-build-a-nitro-module.md',
          'getting-started/configuration-nitro-json.md',
          // ... then the remaining pages in whatever order
        ]
      },
    ],
    [
      require('./src/plugins/generate-og-images'),
      {
        docsDir: "docs",
        outDir: "static/og",
        width: 1200,
        height: 630,
      },
    ]
  ],

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],
  themeConfig: {
    image: 'img/social-cards/og-card.png',
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 5,
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      logo: {
        alt: 'Nitro Modules',
        src: 'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
        height: 32,
        width: 160,
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'right',
          label: 'Docs',
        },
        {
          type: 'doc',
          docId: 'resources/for-library-users',
          position: 'right',
          label: 'Installation',
        },
        {
          href: 'https://youtu.be/528SxTGnIlc?si=IxH7n09ZVe4iwRPv',
          label: 'YouTube Tutorial',
          position: 'right',
        },
        {
          href: 'https://chatgpt.com/g/g-6870125d0fcc8191925bd20a02c78bcf-nitro-module-builder',
          label: 'Ask AI',
          position: 'right',
        },
        {
          href: 'https://github.com/margelo/nitro/releases/latest',
          label: 'Latest Release',
          position: 'right',
        },
        {
          href: 'https://github.com/margelo/nitro',
          label: 'GitHub',
          position: 'right',
        },
        {
          type: 'search',
          position: 'right',
        },
      ],
    },
    algolia: {
      appId: 'Y788VW5KZO',
      apiKey: 'c077f6bb95a5a11a69a7e65315a795c5',
      indexName: 'nitro-docs',
      contextualSearch: true,
      searchPagePath: false,
      insights: false,
      replaceSearchResultPathname: {
        from: '/nitro/',
        to: '/'
      }
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://margelo.com/discord',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/mrousavy',
            },
            {
              label: 'GitHub Sponsors',
              href: 'https://github.com/sponsors/mrousavy',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'mrousavy.com',
              href: 'https://mrousavy.com',
            },
            {
              label: 'margelo.com',
              href: 'https://margelo.com',
            },
            {
              label: 'Nitro Benchmarks',
              href: 'https://github.com/mrousavy/NitroBenchmarks',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Marc Rousavy / Margelo`,
    },
    metadata: [
      {
        name: 'author',
        content: 'Marc Rousavy',
      },
      {
        name: 'keywords',
        content:
          'react, native, nitro, modules, react-native, native, turbo, expo, documentation, fast, hybrid, hybrid-object, objects, nitrogen, coding, docs, guides, marc, rousavy, mrousavy',
      },
      {
        property: 'og:site_name',
        content: 'Nitro Modules',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:description',
        content: tagline,
      },
      {
        property: 'og:image',
        content: `${url}/img/social-cards/og-card.png`,
      },
      {
        name: 'twitter:creator',
        content: '@mrousavy',
      },
    ],
    prism: {
      theme: prismThemes.oneLight,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: [
        'bash',
        'json',
        'kotlin',
        'ruby',
        'cmake',
        'groovy',
        'java',
      ],
      magicComments: [
        {
          className: 'theme-code-block-highlighted-line',
          line: 'highlight-next-line',
          block: { start: 'highlight-start', end: 'highlight-end' },
        },
        {
          className: 'code-block-diff-add-line',
          line: 'diff-add',
        },
        {
          className: 'code-block-diff-remove-line',
          line: 'diff-remove',
        },
        {
          className: 'code-block-error-line',
          line: 'code-error',
        },
      ],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
