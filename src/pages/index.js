import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { HomepageFeatures, Overview } from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import styles from './index.module.css';

function HomepageHeader() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <img src="img/KISS.svg" alt="KISS State"
          style={{ width: 160, height: 130 }} />
        <br />
        <img src="img/react.svg" alt="React" style={{ width: 62, height: 42 }} />
        <img src="img/StateManagement.svg" alt="State Management for React" style={{ width: 360, height: 40 }} />
        <Heading as="h1" className="hero__title" style={{ marginTop: 20 }}>
          Built for AI agents
        </Heading>
        <Link
          className="button button--primary button--lg"
          style={{ marginTop: 5, alignItems: 'center' }}
          to={`/react/intro`}>
          <span style={{ display: 'inline-block', transform: 'translateY(-6px)' }}>
            Get Started &nbsp;<span style={{
              fontSize: 30,
              display: 'inline-block',
              transform: 'translateY(2px)'
            }}>»</span>
          </span>
        </Link>
      </div>
    </header>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Kiss: React state management for AI agents`}
      description="React state management, built for AI coding agents. Your agent writes structured, testable code, and a linter checks its work. You can still read every line.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <Overview />
      </main>
    </Layout>
  );
}
