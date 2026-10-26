import React from 'react';
import './CodeSandbox.css';

/**
 * Read-only source with line numbers. Used for other people's code (a
 * student's submission seen by an instructor), so it renders text only and
 * deliberately offers no way to run it.
 */
const CodeViewer = ({ code = '', label = 'Submitted code', maxHeight = '320px' }) => {
  const source = code || '';
  const lineCount = source.split('\n').length;
  return (
    <div className="cs-viewer" style={{ maxHeight }} role="region" aria-label={label} tabIndex={0}>
      <div className="cs-viewer-gutter" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => index + 1).join('\n')}
      </div>
      <pre className="cs-viewer-code"><code>{source}</code></pre>
    </div>
  );
};

export default CodeViewer;
