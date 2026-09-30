import React from 'react';
import Logo from '../Logo/Logo';
import './PageLoader.css';

/**
 * The loading screen shown while a page's code or data is on its way.
 *
 *   <PageLoader label="Tasks" />        inside the dashboard content area
 *   <PageLoader fullScreen />           before the app knows who is signed in
 *
 * Announced once through a polite live region, so a screen reader hears
 * "Loading Tasks" without it interrupting anything already being read.
 */
const PageLoader = ({ label, fullScreen = false }) => (
  <div
    className={`page-loader${fullScreen ? ' page-loader--full' : ''}`}
    role="status"
    aria-live="polite"
  >
    <div className="page-loader__body">
      <span className="page-loader__mark" aria-hidden="true">
        <Logo size="lg" variant="mark" />
      </span>
      <span className="page-loader__text">{label ? `Loading ${label}` : 'Loading'}</span>
      <span className="page-loader__track" aria-hidden="true">
        <span className="page-loader__bar" />
      </span>
    </div>
  </div>
);

export default PageLoader;
