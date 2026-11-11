import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'category',
      label: 'Getting started',
      items: [
        'getting-started/what-is-nitro',
        'getting-started/how-to-build-a-nitro-module',
        'getting-started/configuration-nitro-json',
        'getting-started/minimum-requirements',
      ]
    },
    {
      type: 'category',
      label: 'Concepts',
      items: [
        'concepts/nitro-modules',
        'concepts/hybrid-objects',
        'concepts/hybrid-views',
        'concepts/nitrogen',
      ]
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/errors',
        'guides/performance-tips',
        'guides/worklets',
        'guides/android-context',
        'guides/entry-point',
        'guides/sync-vs-async',
        'guides/view-components',
        'guides/troubleshooting',
        'guides/running-example-app',
      ]
    },
    {
      type: 'category',
      label: 'Types',
      items: [
        'types/typing-system',
        'types/primitives',
        'types/strings',
        'types/arrays',
        'types/array-buffers',
        'types/optionals',
        'types/nulls',
        'types/promises',
        'types/callbacks',
        'types/tuples',
        'types/variants',
        'types/dates',
        'types/typed-maps',
        'types/untyped-maps',
        'types/hybrid-objects',
        'types/custom-structs',
        'types/custom-enums',
        'types/custom-types',
        'types/raw-jsi-value',
      ],
    },
    {
      type: 'category',
      label: 'Resources',
      items: [
        'resources/apps-using-nitro',
        'resources/awesome-nitro-modules',
        'resources/comparison',
        'resources/for-library-users',
        'resources/contributing',
      ]
    },
  ],
};

export default sidebars;
