import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import CodeSandbox from '../../components/CodeSandbox/CodeSandbox';
import { useCodeDraft } from '../../hooks/useCodeDraft';
import { isSandboxLanguage, languageLabel, readDraft } from '../../utils/codeSandbox';

const STARTER_CODE = {
  python: 'name = input()\nprint(f"Hello, {name}!")\n',
  javascript: 'const name = input();\nconsole.log(`Hello, ${name}!`);\n',
};

const LANGUAGE_KEY = 'algogambit:sandbox-language';

const readLanguage = () => {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return isSandboxLanguage(saved) ? saved : 'python';
  } catch {
    return 'python';
  }
};

const CodeSandboxPage = () => {
  const { user } = useAuth();
  const ownerId = user?._id || null;
  const [language, setLanguage] = useState(readLanguage);
  // Bumped by "Reset" so the editor remounts with the starter code
  const [resetCount, setResetCount] = useState(0);
  const draft = useCodeDraft();

  // Drafts are per user and per language: one browser may be shared
  const draftKey = `playground:${ownerId || 'anonymous'}:${language}`;
  const initialCode = readDraft(draftKey)?.code ?? STARTER_CODE[language];

  const changeLanguage = (next) => {
    draft.flush();
    setLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch { /* storage unavailable */ }
  };

  const reset = () => {
    draft.discard(draftKey);
    setResetCount((count) => count + 1);
  };

  return (
    <div style={{ padding: '2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Code Sandbox</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
            Write and run Python or JavaScript right in your browser. Your code stays on this device.
          </p>
        </div>
        <button type="button" onClick={reset} className="nb-btn nb-btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
          <i className="fa-solid fa-rotate-left" /> Reset code
        </button>
      </div>

      <div className="glass-panel cs-panel">
        <CodeSandbox
          key={`${language}:${resetCount}`}
          language={language}
          onLanguageChange={changeLanguage}
          initialCode={initialCode}
          onCodeChange={(code) => draft.save(draftKey, code)}
          ownerId={ownerId}
          editorLabel={`${languageLabel(language)} code`}
        />
      </div>
    </div>
  );
};

export default CodeSandboxPage;
