import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { HomepageFeatures, Overview } from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';
import styles from './index.module.css';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <img src="img/KISS.svg" alt="KISS State"
          style={{ width: 160, height: 130 }} />
        <br />
        <img src="img/react.svg" alt="React" style={{ width: 62, height: 42 }} />
        <img src="img/StateManagement.svg" alt="State Management for React" style={{ width: 360, height: 40 }} />
        <Heading as="h1" className="hero__title" />
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
        <p style={{ fontSize: '1.5rem', marginBottom: 0 }}>{siteConfig.customFields.subTagline}</p>
      </div>
    </header>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Kiss`}
      description="State management that is simple to learn and easy to use; Handles complex applications with millions of users; Testable.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <Overview />
      </main>
    </Layout>
  );
}



