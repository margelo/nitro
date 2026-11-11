import React, { type ReactNode } from 'react';
import clsx from 'clsx';
import { ThemeClassNames } from '@docusaurus/theme-common';
import { useDoc } from '@docusaurus/plugin-content-docs/client';

import TOC from '@theme/TOC';

import styles from './styles.module.css';

export default function DocItemTOCDesktop(): ReactNode {
  const { toc, frontMatter } = useDoc();
  return (
    <div className={styles.stickyColumn}>
      <TOC
        toc={toc}
        minHeadingLevel={frontMatter.toc_min_heading_level}
        maxHeadingLevel={frontMatter.toc_max_heading_level}
        className={clsx(ThemeClassNames.docs.docTocDesktop, styles.toc)}
      />
      <aside className={styles.ctaCard}>
        <h3 className={styles.ctaTitle}>Building something ambitious?</h3>
        <p className={styles.ctaBody}>
          We help teams ship world-class React Native apps.
        </p>
        <a
          href="https://margelo.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.ctaButton}
        >
          Let's talk <span className={styles.ctaArrow} aria-hidden>→</span>
        </a>
      </aside>
    </div>
  );
}
