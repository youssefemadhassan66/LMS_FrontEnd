import React from 'react';
import CodeEditor from './CodeEditor';
import { MAX_TEST_CASES, SANDBOX_LANGUAGES, emptyTestCase } from '../../utils/codeSandbox';
import './CodeSandbox.css';

/**
 * Optional code exercise on a task form. `value` comes from
 * emptyCodeExercise() / codeExerciseFromTask(); the parent turns it into the
 * API payload with codeExercisePayload().
 */
const CodeExerciseFields = ({ value, onChange }) => {
  const update = (patch) => onChange({ ...value, ...patch });
  const updateTest = (index, patch) => update({
    testCases: value.testCases.map((test, i) => (i === index ? { ...test, ...patch } : test)),
  });
  const removeTest = (index) => {
    const remaining = value.testCases.filter((_, i) => i !== index);
    update({ testCases: remaining.length ? remaining : [emptyTestCase()] });
  };

  return (
    <div className="modal-form-group">
      <label className="modal-checkbox">
        <input type="checkbox" checked={value.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
        <span>
          <strong>Code exercise</strong> — students solve it in the code sandbox and it is graded automatically
        </span>
      </label>

      {value.enabled && (
        <div className="cx-body">
          <div className="modal-row modal-row-2">
            <div>
              <label className="modal-label" htmlFor="cx-language">Language</label>
              <select id="cx-language" className="modal-select" value={value.language} onChange={(event) => update({ language: event.target.value })}>
                {SANDBOX_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <span className="modal-label">Starter code (optional)</span>
            <CodeEditor
              value={value.starterCode}
              onChange={(starterCode) => update({ starterCode })}
              language={value.language}
              label="Starter code"
              minHeight="8rem"
            />
          </div>

          <div className="cx-tests-header">
            <span className="modal-label" style={{ margin: 0 }}>Test cases ({value.testCases.length}/{MAX_TEST_CASES})</span>
            {value.testCases.length < MAX_TEST_CASES && (
              <button type="button" className="modal-add-btn" onClick={() => update({ testCases: [...value.testCases, emptyTestCase()] })}>
                + Add Test
              </button>
            )}
          </div>

          {value.testCases.map((test, index) => (
            <div key={index} className="cx-test">
              <div className="cx-test-head">
                <span>Test {index + 1}</span>
                <span className="cx-test-actions">
                  <label className="cx-hidden-toggle">
                    <input type="checkbox" checked={test.isHidden} onChange={(event) => updateTest(index, { isHidden: event.target.checked })} />
                    Hidden from students
                  </label>
                  {value.testCases.length > 1 && (
                    <button type="button" className="modal-link-remove" onClick={() => removeTest(index)} aria-label={`Remove test ${index + 1}`}>✕</button>
                  )}
                </span>
              </div>
              <div className="modal-row modal-row-2">
                <div>
                  <label className="modal-label" htmlFor={`cx-input-${index}`}>Input (stdin)</label>
                  <textarea
                    id={`cx-input-${index}`}
                    className="modal-textarea cx-mono"
                    value={test.input}
                    onChange={(event) => updateTest(index, { input: event.target.value })}
                    placeholder="Leave empty if the program reads nothing"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label className="modal-label" htmlFor={`cx-expected-${index}`}>Expected output</label>
                  <textarea
                    id={`cx-expected-${index}`}
                    className="modal-textarea cx-mono"
                    value={test.expectedOutput}
                    onChange={(event) => updateTest(index, { expectedOutput: event.target.value })}
                    placeholder="Exactly what the program should print"
                    spellCheck={false}
                    required
                  />
                </div>
              </div>
            </div>
          ))}

          <p className="modal-hint" style={{ margin: 0 }}>
            Each input is given to the program as stdin and what it prints is compared with the expected output.
            Trailing spaces and blank lines at the end are ignored. Students see every input, but never the
            expected output of a hidden test.
          </p>
        </div>
      )}
    </div>
  );
};

export default CodeExerciseFields;
