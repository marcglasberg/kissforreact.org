import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';
import Link from "@docusaurus/Link";
import {useState} from "react";
import OverviewContent from './OverviewContent'; // Import our MDX wrapper component instead

const FeatureList = [];

function Feature({Svg, title, page, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img"/>
      </div>
      <div className={styles.getStartedTextAndLogo}>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
      <div style={{display: 'flex', justifyContent: 'center'}}>
        <Link
          className="button button--primary button--lg"
          style={{marginBottom: 50}}
          to={`/${page}/intro`}>
          Get Started
        </Link>
      </div>
    </div>
  );
}

export function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row" style={{display: 'flex', justifyContent: 'center'}}>
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function Overview(page) {
  const [activeTab, setActiveTab] = useState('react');

  return (
    <div>
      <section className={styles.features}>

        <div className="container">          <div className={styles.overview}>
            <OverviewContent />
          </div>

          <div style={{height: 40}}></div>
          <center>
            <iframe
              src="https://codesandbox.io/embed/j57yz5?view=split&module=%2Fsrc%2FApp.tsx&hidenavigation=1&fontsize=12.0&editorsize=75&previewwindow=browser"
              style={{
                maxWidth: '90%',
                width: '680px',
                height: '450px',
                border: '3px solid #AAA',
                borderRadius: '4px'
              }}
              title="counter-async-redux-example"
              sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
            />
          </center>

          <div style={{
            display: 'flex',
            width: '100%',
            maxWidth: 670,
            margin: '20px auto 0 auto',
            justifyContent: 'right'
          }}>
            <Link
              className="button button--primary button--lg"
              style={{marginBottom: 5, alignItems: 'center'}}
              to={`/${activeTab}/intro`}>
              <span style={{display: 'inline-block', transform: 'translateY(-6px)'}}>
                Get Started &nbsp;<span style={{
                fontSize: 30,
                display: 'inline-block',
                transform: 'translateY(2px)'
              }}>»</span>
              </span>
            </Link>
          </div>
          <p>&nbsp;</p>
        </div>
      </section>
    </div>
  );
}
