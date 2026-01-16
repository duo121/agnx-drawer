import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Translate, {translate} from '@docusaurus/Translate';
import styles from './index.module.css';

function HeroSection() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            AGNX <span className={styles.highlight}>Drawer</span>
          </h1>
          <p className={styles.heroTagline}>
            <Translate id="homepage.tagline">
              AI-Powered Diagram Creation Tool
            </Translate>
          </p>
          <p className={styles.heroDescription}>
            <Translate id="homepage.description">
              Create professional diagrams through natural language. 
              Describe what you want, AI generates it instantly.
            </Translate>
          </p>
          <div className={styles.heroButtons}>
            <Link className={styles.btnPrimary} to="/docs">
              <Translate id="homepage.getStarted">Get Started</Translate>
              <span className={styles.arrow}>→</span>
            </Link>
            <Link className={styles.btnSecondary} href="https://agnx-drawer.vercel.app/">
              <Translate id="homepage.tryDemo">Live Demo</Translate>
            </Link>
            <Link className={styles.btnGhost} href="https://github.com/duo121/agnx-drawer">
              <svg className={styles.githubIcon} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              GitHub
            </Link>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.mockup}>
            <div className={styles.mockupHeader}>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
            </div>
            <div className={styles.mockupContent}>
              <div className={styles.chatBubble}>
                <Translate id="homepage.prompt">
                  "Create an AWS architecture diagram with EC2, RDS, and S3"
                </Translate>
              </div>
              <div className={styles.diagramPreview}>
                <svg viewBox="0 0 200 120" className={styles.diagramSvg}>
                  <rect x="10" y="40" width="40" height="40" rx="4" fill="#FF9900"/>
                  <text x="30" y="65" textAnchor="middle" fill="white" fontSize="8">EC2</text>
                  <rect x="80" y="40" width="40" height="40" rx="4" fill="#3B48CC"/>
                  <text x="100" y="65" textAnchor="middle" fill="white" fontSize="8">RDS</text>
                  <rect x="150" y="40" width="40" height="40" rx="4" fill="#E25444"/>
                  <text x="170" y="65" textAnchor="middle" fill="white" fontSize="8">S3</text>
                  <line x1="50" y1="60" x2="80" y2="60" stroke="#666" strokeWidth="2"/>
                  <line x1="120" y1="60" x2="150" y2="60" stroke="#666" strokeWidth="2"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

const features = [
  {
    icon: '🤖',
    titleId: 'feature.ai.title',
    title: 'AI-Powered',
    descId: 'feature.ai.desc',
    desc: 'Natural language to diagram. Just describe it.',
  },
  {
    icon: '🎨',
    titleId: 'feature.engine.title',
    title: 'Dual Engine',
    descId: 'feature.engine.desc',
    desc: 'Draw.io for professional, Excalidraw for sketches.',
  },
  {
    icon: '☁️',
    titleId: 'feature.cloud.title',
    title: 'Cloud Ready',
    descId: 'feature.cloud.desc',
    desc: 'AWS, GCP, Azure icons built-in.',
  },
  {
    icon: '🔌',
    titleId: 'feature.provider.title',
    title: '10+ Providers',
    descId: 'feature.provider.desc',
    desc: 'OpenAI, Claude, Gemini, DeepSeek...',
  },
  {
    icon: '💻',
    titleId: 'feature.platform.title',
    title: 'Cross-Platform',
    descId: 'feature.platform.desc',
    desc: 'Web, Desktop, MCP integration.',
  },
  {
    icon: '🚀',
    titleId: 'feature.deploy.title',
    title: 'Easy Deploy',
    descId: 'feature.deploy.desc',
    desc: 'Vercel, Cloudflare, Docker ready.',
  },
];

function FeaturesSection() {
  return (
    <section className={styles.features}>
      <div className={styles.container}>
        <h2 className={styles.sectionTitle}>
          <Translate id="homepage.features">Features</Translate>
        </h2>
        <div className={styles.featureGrid}>
          {features.map((f, i) => (
            <div key={i} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3><Translate id={f.titleId}>{f.title}</Translate></h3>
              <p><Translate id={f.descId}>{f.desc}</Translate></p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AcknowledgmentSection() {
  return (
    <section className={styles.acknowledgment}>
      <div className={styles.container}>
        <div className={styles.ackCard}>
          <h2>🙏 <Translate id="homepage.ack.title">Acknowledgments</Translate></h2>
          <p>
            <Translate id="homepage.ack.text">
              This project is built upon next-ai-draw-io by @DayuanJiang.
              We are deeply grateful for the original author's open-source contribution.
            </Translate>
          </p>
          <a href="https://github.com/DayuanJiang/next-ai-draw-io" className={styles.ackLink}>
            <Translate id="homepage.ack.link">View Original Project</Translate> →
          </a>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title="AI Diagram Tool"
      description="AI-Powered Diagram Creation Tool">
      <HeroSection />
      <main>
        <FeaturesSection />
        <AcknowledgmentSection />
      </main>
    </Layout>
  );
}
