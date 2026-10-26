import React, { useEffect, useId, useRef, useState } from 'react';
import CodeEditor from './CodeEditor';
import { SANDBOX_LANGUAGES, getSandboxClient, languageLabel, outputsMatch } from '../../utils/codeSandbox';
import './CodeSandbox.css';

const INPUT_HINTS = {
  python: 'Read input with input(). In graded exercises call input() without a prompt message: a prompt is printed, so it would count as output.',
  javascript: "Read input with input() (one line per call) or require('fs').readFileSync(0, 'utf8'), and print with console.log().",
};

const CHIPS = {
  passed: { label: 'Passed', tone: 'pass' },
  failed: { label: 'Failed', tone: 'fail' },
  timeout: { label: 'Timed out', tone: 'fail' },
  notRun: { label: 'Not run', tone: 'muted' },
  ran: { label: 'Ran', tone: 'muted' },
  hidden: { label: 'Checked on submit', tone: 'muted' },
  idle: { label: 'Not run yet', tone: 'muted' },
};

const formatDuration = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.max(0, Math.round(ms))} ms`);

const summaryTone = ({ passed, total }) => {
  if (!Number.isFinite(passed) || !Number.isFinite(total) || total === 0) return 'info';
  if (passed === total) return 'pass';
  return passed === 0 ? 'fail' : 'partial';
};

/**
 * Browser code sandbox: editor, stdin, output, and an optional list of test
 * cases. With `onSubmit`, Submit runs every test input (hidden ones included)
 * and hands `{ code, outputs }` to the caller, which sends them to the server
 * for grading and resolves with `{ results, passed, total, message }`.
 *
 * Test cases are `{ input, expectedOutput, isHidden }`; a hidden one has no
 * expectedOutput on the student side. Only render worker output as text.
 */
const CodeSandbox = ({
  language,
  onLanguageChange,
  initialCode = '',
  onCodeChange,
  testCases = [],
  onSubmit,
  submitLabel = 'Submit',
  submitBlockedReason = '',
  submitNote = '',
  previousResult = null,
  ownerId = null,
  sandboxClient,
  editorLabel = 'Code editor',
}) => {
  const [code, setCode] = useState(initialCode);
  const [stdin, setStdin] = useState('');
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState('');
  const [output, setOutput] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [verdicts, setVerdicts] = useState(previousResult?.results || null);
  const [summary, setSummary] = useState(previousResult);
  const [submitError, setSubmitError] = useState('');
  const mounted = useRef(false);
  const activeClient = useRef(null);
  const stdinId = useId();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // A closed dialog must not leave its code running in the background
      activeClient.current?.stop();
    };
  }, []);

  const visibleIndices = testCases.map((test, index) => (test.isHidden ? -1 : index)).filter((index) => index >= 0);
  const hiddenCount = testCases.length - visibleIndices.length;

  const updateCode = (next) => {
    setCode(next);
    onCodeChange?.(next);
  };

  const runInputs = async (inputs) => {
    const client = sandboxClient || getSandboxClient(ownerId);
    activeClient.current = client;
    try {
      return await client.run(language, code, inputs, {
        onStatus: (message) => { if (mounted.current) setStatus(message); },
      });
    } finally {
      activeClient.current = null;
      if (mounted.current) setStatus('');
    }
  };

  const handleRun = async () => {
    if (busy) return;
    setBusy('run');
    try {
      const [result] = await runInputs([stdin]);
      if (mounted.current) setOutput(result);
    } catch (error) {
      if (mounted.current) setOutput({ stdout: '', stderr: error.message, durationMs: 0, status: 'crashed' });
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const handleRunTests = async () => {
    if (busy || visibleIndices.length === 0) return;
    setBusy('tests');
    try {
      const results = await runInputs(visibleIndices.map((index) => testCases[index].input ?? ''));
      if (!mounted.current) return;
      setTestResults(Object.fromEntries(visibleIndices.map((testIndex, position) => [testIndex, results[position]])));
      // The chips now describe this run, not the last submission
      setVerdicts(null);
    } catch (error) {
      if (mounted.current) setOutput({ stdout: '', stderr: error.message, durationMs: 0, status: 'crashed' });
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const handleSubmit = async () => {
    if (!onSubmit || busy || submitBlockedReason || !code.trim()) return;
    setBusy('submit');
    setSubmitError('');
    try {
      const results = testCases.length > 0 ? await runInputs(testCases.map((test) => test.input ?? '')) : [];
      if (!mounted.current) return;
      setTestResults(Object.fromEntries(results.map((result, index) => [index, result])));
      const response = await onSubmit({ code, outputs: results.map((result) => result.stdout) });
      if (!mounted.current) return;
      setVerdicts(Array.isArray(response?.results) ? response.results : null);
      setSummary(response || null);
    } catch (error) {
      if (mounted.current) setSubmitError(error.message || 'Submission failed. Try again.');
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const testState = (index) => {
    const verdict = verdicts?.[index];
    if (typeof verdict === 'boolean') return verdict ? 'passed' : 'failed';
    const result = testResults[index];
    const test = testCases[index];
    if (!result) return test.isHidden ? 'hidden' : 'idle';
    if (result.status === 'timeout') return 'timeout';
    if (result.status !== 'ok') return 'notRun';
    if (test.isHidden) return 'ran';
    return outputsMatch(result.stdout, test.expectedOutput) ? 'passed' : 'failed';
  };

  const visiblePassing = visibleIndices.filter((index) => testState(index) === 'passed').length;
  const submitDisabled = Boolean(busy || submitBlockedReason || !code.trim());

  return (
    <div className="cs-root">
      <div className="cs-toolbar">
        <div className="cs-toolbar-start">
          {onLanguageChange ? (
            <label className="cs-language">
              <span className="sr-only">Language</span>
              <select className="cs-select" value={language} onChange={(event) => onLanguageChange(event.target.value)} disabled={Boolean(busy)}>
                {SANDBOX_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          ) : (
            <span className={`cs-lang-badge cs-lang-${language}`}>{languageLabel(language)}</span>
          )}
          <span className="cs-shortcut"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> runs</span>
        </div>
        <div className="cs-toolbar-actions">
          {busy && (
            <button type="button" className="nb-btn nb-btn-secondary cs-btn" onClick={() => activeClient.current?.stop()}>
              <i className="fa-solid fa-stop" /> Stop
            </button>
          )}
          <button type="button" className="nb-btn nb-btn-primary cs-btn" onClick={handleRun} disabled={Boolean(busy)}>
            <i className="fa-solid fa-play" /> {busy === 'run' ? 'Running…' : 'Run'}
          </button>
          {visibleIndices.length > 0 && (
            <button type="button" className="nb-btn nb-btn-secondary cs-btn" onClick={handleRunTests} disabled={Boolean(busy)}>
              <i className="fa-solid fa-list-check" /> {busy === 'tests' ? 'Testing…' : 'Run tests'}
            </button>
          )}
        </div>
      </div>

      <p className="cs-hint">{INPUT_HINTS[language]}</p>

      <div className="cs-workspace">
        <CodeEditor value={code} onChange={updateCode} language={language} onRun={handleRun} label={editorLabel} />

        <div className="cs-io">
          <label className="cs-panel-label" htmlFor={stdinId}>Input (stdin)</label>
          <textarea
            id={stdinId}
            className="cs-stdin"
            value={stdin}
            onChange={(event) => setStdin(event.target.value)}
            placeholder="Text your program reads, one value per line"
            spellCheck={false}
          />

          <div className="cs-panel-label cs-output-label">
            <span>Output</span>
            {output && !busy && (
              <span className="cs-output-meta">
                {output.status === 'ok' ? formatDuration(output.durationMs) : CHIPS[output.status === 'timeout' ? 'timeout' : 'notRun'].label}
              </span>
            )}
          </div>
          <div className="cs-output" aria-live="polite">
            {busy ? (
              <p className="cs-placeholder">{status || (busy === 'submit' ? 'Running every test…' : 'Running…')}</p>
            ) : output ? (
              <>
                {(output.stdout || !output.stderr) && <pre className="cs-stdout">{output.stdout || '(no output)'}</pre>}
                {output.stderr && <pre className="cs-stderr">{output.stderr}</pre>}
              </>
            ) : (
              <p className="cs-placeholder">Run your code to see its output here.</p>
            )}
          </div>
        </div>
      </div>

      {testCases.length > 0 && (
        <section className="cs-tests" aria-label="Test cases">
          <div className="cs-tests-header">
            <h4>Test cases</h4>
            <span className="cs-tests-count">
              {visibleIndices.length > 0 && `${visiblePassing}/${visibleIndices.length} visible passing`}
              {visibleIndices.length > 0 && hiddenCount > 0 && ' · '}
              {hiddenCount > 0 && `${hiddenCount} hidden`}
            </span>
          </div>
          <ol className="cs-test-list">
            {testCases.map((test, index) => {
              const chip = CHIPS[testState(index)];
              const result = testResults[index];
              return (
                <li key={index} className="cs-test">
                  <div className="cs-test-head">
                    <span className="cs-test-title">
                      Test {index + 1}
                      {test.isHidden && <span className="cs-test-tag"><i className="fa-solid fa-lock" /> Hidden</span>}
                    </span>
                    <span className={`cs-chip cs-chip-${chip.tone}`}>{chip.label}</span>
                  </div>
                  <div className="cs-test-grid">
                    <div>
                      <span className="cs-test-label">Input</span>
                      <pre className="cs-test-pre">{test.input || '(empty)'}</pre>
                    </div>
                    <div>
                      <span className="cs-test-label">Expected</span>
                      {test.isHidden
                        ? <p className="cs-test-hidden">Hidden. Checked when you submit.</p>
                        : <pre className="cs-test-pre">{test.expectedOutput || '(no output)'}</pre>}
                    </div>
                    {result && (
                      <div>
                        <span className="cs-test-label">Your output</span>
                        <pre className="cs-test-pre">{result.stdout || '(no output)'}</pre>
                      </div>
                    )}
                  </div>
                  {result?.stderr && <pre className="cs-stderr cs-test-stderr">{result.stderr}</pre>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {onSubmit && (
        <div className="cs-submit">
          {summary && (
            <div className={`cs-summary cs-summary-${summaryTone(summary)}`} role="status">
              {/* The server's message usually leads with the count already */}
              {Number.isFinite(summary.passed) && Number.isFinite(summary.total) && summary.total > 0
                && !String(summary.message || '').includes(`${summary.passed}/${summary.total}`) && (
                <strong>{summary.passed}/{summary.total} tests passed</strong>
              )}
              {summary.message && <span>{summary.message}</span>}
            </div>
          )}
          {submitError && <div className="cs-error" role="alert"><i className="fa-solid fa-triangle-exclamation" /> {submitError}</div>}
          <div className="cs-submit-bar">
            <p className="cs-submit-note">{submitBlockedReason || submitNote}</p>
            <button type="button" className="nb-btn cs-btn cs-btn-submit" onClick={handleSubmit} disabled={submitDisabled}>
              <i className="fa-solid fa-paper-plane" /> {busy === 'submit' ? 'Submitting…' : submitLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeSandbox;
