import React from 'react';
import styles from './styles.module.css';

type App = {
  name: string;
  company: string;
  scale: string;
  category: string;
  icon?: string;
  accent: string;
  featured?: boolean;
};

const apps: App[] = [
  {
    name: 'Discord',
    company: 'Discord Inc.',
    scale: '500M+ installs',
    category: 'Social',
    icon: '/img/apps-using-nitro/discord.png',
    accent: '#5865f2',
    featured: true,
  },
  {
    name: 'v0',
    company: 'Vercel, Inc.',
    scale: 'Public iOS app',
    category: 'Developer Tools',
    icon: '/img/apps-using-nitro/v0.png',
    accent: '#111111',
  },
  {
    name: 'Coinbase',
    company: 'Coinbase Inc.',
    scale: '50M+ installs',
    category: 'Finance',
    icon: '/img/apps-using-nitro/coinbase.png',
    accent: '#0052ff',
    featured: true,
  },
  {
    name: 'MetaMask',
    company: 'MetaMask Web3 Wallet',
    scale: '10M+ installs',
    category: 'Finance',
    icon: '/img/apps-using-nitro/metamask.png',
    accent: '#f6851b',
    featured: true,
  },
  {
    name: 'Starlink',
    company: 'Space Exploration Technologies Corp.',
    scale: '10M+ installs',
    category: 'Connectivity',
    icon: '/img/apps-using-nitro/starlink.png',
    accent: '#4a5568',
    featured: true,
  },
  {
    name: 'Affirm',
    company: 'Affirm, Inc.',
    scale: '10M+ installs',
    category: 'Finance',
    icon: '/img/apps-using-nitro/affirm.png',
    accent: '#4a4af4',
    featured: true,
  },
  {
    name: 'Base',
    company: 'Coinbase Wallet',
    scale: '10M+ installs',
    category: 'Finance',
    icon: '/img/apps-using-nitro/base.png',
    accent: '#0052ff',
    featured: true,
  },
  {
    name: 'HelloFresh',
    company: 'HelloFresh SE',
    scale: '10M+ installs',
    category: 'Food',
    icon: '/img/apps-using-nitro/hellofresh.png',
    accent: '#5c8f22',
  },
  {
    name: 'Picnic',
    company: 'Picnic Technologies B.V.',
    scale: '5M+ installs',
    category: 'Commerce',
    icon: '/img/apps-using-nitro/picnic.png',
    accent: '#e52320',
  },
  {
    name: 'Kraken',
    company: 'Payward, Inc.',
    scale: '5M+ installs',
    category: 'Finance',
    icon: '/img/apps-using-nitro/kraken.png',
    accent: '#5741d9',
  },
  {
    name: 'AutoZone',
    company: 'AutoZone, Inc.',
    scale: '5M+ installs',
    category: 'Commerce',
    icon: '/img/apps-using-nitro/autozone.png',
    accent: '#f36f21',
  },
  {
    name: 'Expensify',
    company: 'Expensify Inc.',
    scale: '1M+ installs',
    category: 'Finance',
    icon: '/img/apps-using-nitro/expensify.png',
    accent: '#36d36f',
  },
  {
    name: 'Gemini',
    company: 'Gemini Space Station, Inc.',
    scale: '1M+ installs',
    category: 'Finance',
    icon: '/img/apps-using-nitro/gemini.png',
    accent: '#00dcfa',
  },
  {
    name: 'Sleeper',
    company: 'Blitz Studios, Inc.',
    scale: '1M+ installs',
    category: 'Sports',
    icon: '/img/apps-using-nitro/sleeper.png',
    accent: '#111111',
  },
  {
    name: 'SnapCalorie',
    company: 'Perception Labs, Inc.',
    scale: '500K+ installs',
    category: 'Health',
    icon: '/img/apps-using-nitro/snapcalorie.png',
    accent: '#ff6250',
  },
  {
    name: 'Extra',
    company: 'The Aligned Company',
    scale: '100K+ installs',
    category: 'Finance',
    icon: '/img/apps-using-nitro/extra.png',
    accent: '#111111',
  },
  {
    name: 'MyGroove',
    company: 'MyGroove',
    scale: '10K+ installs',
    category: 'Music',
    icon: '/img/apps-using-nitro/mygroove.png',
    accent: '#ff8a00',
  },
  {
    name: 'Omni',
    company: 'Omni Wallet',
    scale: '10K+ installs',
    category: 'Finance',
    icon: '/img/apps-using-nitro/omni.png',
    accent: '#62db73',
  },
  {
    name: 'ScribeWare',
    company: 'ScribeWare',
    scale: '1K+ installs',
    category: 'Productivity',
    icon: '/img/apps-using-nitro/scribeware.png',
    accent: '#3484ff',
  },
  {
    name: 'Juno',
    company: 'SharedGenes, Inc.',
    scale: '50K+ installs',
    category: 'Health',
    icon: '/img/apps-using-nitro/juno.png',
    accent: '#fc5f2b',
  },
];

function AppIcon({ app, size }: { app: App; size: 'large' | 'small' }) {
  const initials = app.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={`${styles.iconFrame} ${size === 'large' ? styles.iconLarge : styles.iconSmall}`}
      style={{ '--app-accent': app.accent } as React.CSSProperties}
      aria-hidden="true"
    >
      {app.icon == null ? (
        <span className={styles.iconFallback}>{initials}</span>
      ) : (
        <img src={app.icon} alt="" loading="lazy" />
      )}
    </div>
  );
}

function FeaturedAppCard({ app }: { app: App }) {
  return (
    <article
      className={styles.featuredCard}
      style={{ '--app-accent': app.accent } as React.CSSProperties}
    >
      <AppIcon app={app} size="large" />
      <div className={styles.cardBody}>
        <span className={styles.appCategory}>{app.category}</span>
        <h3>{app.name}</h3>
        <p>{app.company}</p>
        <span className={styles.scaleBadge}>{app.scale}</span>
      </div>
    </article>
  );
}

function AppCard({ app }: { app: App }) {
  return (
    <article
      className={styles.appCard}
      style={{ '--app-accent': app.accent } as React.CSSProperties}
    >
      <AppIcon app={app} size="small" />
      <div className={styles.compactBody}>
        <h3>{app.name}</h3>
        <p>{app.company}</p>
      </div>
      <span className={styles.compactScale}>{app.scale}</span>
    </article>
  );
}

export default function AppsUsingNitroShowcase() {
  const featuredApps = apps.filter((app) => app.featured);
  const regularApps = apps.filter((app) => !app.featured);

  return (
    <section className={styles.showcase}>
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Production ready</span>
          <h2>Nitro is already running inside apps people use every day.</h2>
          <p>
            From social networks and finance to developer tools, commerce,
            food, connectivity, sports, health, music, and creator tools, Nitro
            powers native code paths in real production apps.
          </p>
        </div>
        <div className={styles.statsGrid} aria-label="Nitro production usage stats">
          <div>
            <strong>18M+</strong>
            <span>npm downloads</span>
          </div>
          <div>
            <strong>600M+</strong>
            <span>combined public app install counts</span>
          </div>
          <div>
            <strong>10</strong>
            <span>product categories</span>
          </div>
        </div>
      </div>

      <div className={styles.featuredGrid}>
        {featuredApps.map((app) => (
          <FeaturedAppCard key={app.name} app={app} />
        ))}
      </div>

      <div className={styles.appGrid}>
        {regularApps.map((app) => (
          <AppCard key={app.name} app={app} />
        ))}
      </div>

      <p className={styles.note}>
        Based on public app data, public native symbols, and open-source notices. App
        names and icons belong to their respective owners; no affiliation or
        endorsement is implied.
      </p>
    </section>
  );
}
