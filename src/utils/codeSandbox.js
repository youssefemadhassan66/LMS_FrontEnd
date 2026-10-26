// Main-thread client for the code sandbox worker (public/sandbox/sandbox-worker.js).
//
// Code runs in a Web Worker so an infinite loop cannot freeze the page. Each
// test case gets a time limit; when it runs out the worker is terminated (the
// only way to stop a busy worker) and a fresh one is created on the next run.
// The server never runs code: graded work sends the stdout of every test case
// and the backend compares it with the expected outputs.

export const SANDBOX_LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
];

export const MAX_TEST_CASES = 20;

const OUTPUT_LIMIT = 64 * 1024;
const TEST_TIMEOUT_MS = 5000;
// The first Python run downloads and compiles the interpreter (~13 MB)
const START_TIMEOUT_MS = 120000;

export const isSandboxLanguage = (language) => SANDBOX_LANGUAGES.some((item) => item.value === language);

export const languageLabel = (language) => SANDBOX_LANGUAGES.find((item) => item.value === language)?.label || 'Python';

// Must stay identical to normalizeOutput in Backend/Utilities/codeGrader.js so a
// visible test that passes here also passes on the server.
export const normalizeOutput = (text) =>
  String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n+$/, '');

export const outputsMatch = (actual, expected) => normalizeOutput(actual) === normalizeOutput(expected);

const resultFromWorker = (result) => ({
  stdout: String(result?.stdout ?? '').slice(0, OUTPUT_LIMIT),
  stderr: String(result?.stderr ?? '').slice(0, OUTPUT_LIMIT),
  durationMs: Number(result?.durationMs) || 0,
  timedOut: false,
  status: 'ok',
});

const failedResult = (status, message) => ({
  stdout: '',
  stderr: message,
  durationMs: 0,
  timedOut: status === 'timeout',
  status,
});

/**
 * run(language, code, inputs) resolves to one result per input, in order:
 * { stdout, stderr, durationMs, timedOut, status: 'ok' | 'timeout' | 'skipped' | 'crashed' | 'stopped' }.
 * It never rejects for problems in the user's code; only for misuse.
 */
export const createSandboxClient = ({
  workerUrl = '/sandbox/sandbox-worker.js',
  testTimeoutMs = TEST_TIMEOUT_MS,
  startTimeoutMs = START_TIMEOUT_MS,
  createWorker = (url) => new Worker(url, { type: 'module' }),
} = {}) => {
  // One worker per language: once a worker has run user code its network APIs
  // are gone, so it could never download Pyodide afterwards.
  const workers = new Map();
  let nextId = 0;
  let active = null;

  const discard = (language, worker) => {
    worker.terminate();
    if (workers.get(language) === worker) workers.delete(language);
  };

  const run = (language, code, inputs, { onStatus, onResult } = {}) => {
    if (!isSandboxLanguage(language)) return Promise.reject(new Error(`Unsupported language: ${language}`));
    if (!Array.isArray(inputs) || inputs.length === 0) return Promise.reject(new Error('Nothing to run'));
    if (active) return Promise.reject(new Error('The sandbox is already running code'));

    if (!workers.has(language)) workers.set(language, createWorker(workerUrl));
    const worker = workers.get(language);
    const id = ++nextId;
    const results = inputs.map(() => null);

    return new Promise((resolve) => {
      let timer = null;
      let started = false;

      const arm = (ms) => {
        clearTimeout(timer);
        timer = setTimeout(() => abort('timeout'), ms);
      };

      const settle = () => {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        active = null;
        onStatus?.('');
        resolve(results.map((result) => result || failedResult('skipped', 'Not run.')));
      };

      // Give up on this worker. The test that was running gets the reason,
      // the ones after it never ran.
      const abort = (status, message) => {
        discard(language, worker);
        let reason = message || 'The sandbox stopped unexpectedly.';
        if (status === 'stopped') reason = 'Stopped.';
        if (status === 'timeout') {
          reason = started
            ? `Time limit exceeded (${Math.round(testTimeoutMs / 1000)} s). Check for an infinite loop.`
            : 'The sandbox took too long to start. Check your connection and try again.';
        }
        const firstMissing = results.findIndex((result) => result === null);
        results.forEach((result, index) => {
          if (result) return;
          results[index] = index === firstMissing
            ? failedResult(status, reason)
            : failedResult('skipped', status === 'timeout' ? 'Not run: an earlier test timed out.' : 'Not run.');
        });
        settle();
      };

      function onMessage({ data }) {
        if (!data || data.id !== id) return;
        if (data.type === 'status') {
          onStatus?.(String(data.message || ''));
        } else if (data.type === 'test-start') {
          started = true;
          arm(testTimeoutMs);
        } else if (data.type === 'test-done') {
          const index = Number(data.index);
          if (Number.isInteger(index) && index >= 0 && index < results.length) {
            results[index] = resultFromWorker(data.result);
            onResult?.(index, results[index]);
          }
          arm(testTimeoutMs);
        } else if (data.type === 'done') {
          settle();
        } else if (data.type === 'error') {
          abort('crashed', String(data.message || ''));
        }
      }

      function onError(event) {
        event?.preventDefault?.();
        abort('crashed', 'The code sandbox could not start. Reload the page and try again.');
      }

      active = { stop: () => abort('stopped') };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      arm(startTimeoutMs);
      worker.postMessage({ type: 'run', id, language, code: String(code), inputs: inputs.map((input) => String(input ?? '')) });
    });
  };

  return {
    run,
    isRunning: () => Boolean(active),
    // Ends the current run; its unfinished tests resolve as 'stopped'/'skipped'
    stop: () => active?.stop(),
    dispose: () => {
      active?.stop();
      for (const [language, worker] of workers) discard(language, worker);
    },
  };
};

// One client for the whole tab so Pyodide stays loaded between exercises. It is
// tied to the signed-in user: a worker that ran one person's code is never
// reused for someone else who signs in on the same tab.
let sharedClient = null;
let sharedOwner = null;

export const getSandboxClient = (ownerId = null) => {
  if (!sharedClient || sharedOwner !== ownerId) {
    sharedClient?.dispose();
    sharedClient = createSandboxClient();
    sharedOwner = ownerId;
  }
  return sharedClient;
};

// ─── Drafts ──────────────────────────────────────────────────────────────────
// Unsaved code survives a closed dialog or a reload. Storage can be missing or
// full (private windows, quotas), which only costs the draft.

const DRAFT_PREFIX = 'algogambit:code-draft:';

export const readDraft = (key) => {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    return typeof draft?.code === 'string' ? { code: draft.code, savedAt: Number(draft.savedAt) || 0 } : null;
  } catch {
    return null;
  }
};

export const writeDraft = (key, code) => {
  try {
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ code, savedAt: Date.now() }));
  } catch { /* storage unavailable */ }
};

export const clearDraft = (key) => {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch { /* storage unavailable */ }
};

// ─── Code exercise form state (instructor task forms) ────────────────────────

export const emptyTestCase = () => ({ input: '', expectedOutput: '', isHidden: false });

export const emptyCodeExercise = () => ({
  enabled: false,
  language: 'python',
  starterCode: '',
  testCases: [emptyTestCase()],
});

// Staff task reads include every test case, so the form can be filled from them
export const codeExerciseFromTask = (task) => {
  const exercise = task?.codeExercise;
  if (!exercise?.language) return emptyCodeExercise();
  const testCases = (exercise.testCases || []).map((test) => ({
    input: test.input ?? '',
    expectedOutput: test.expectedOutput ?? '',
    isHidden: Boolean(test.isHidden),
  }));
  return {
    enabled: true,
    language: isSandboxLanguage(exercise.language) ? exercise.language : 'python',
    starterCode: exercise.starterCode || '',
    testCases: testCases.length ? testCases : [emptyTestCase()],
  };
};

export const codeExercisePayload = (form) => ({
  language: form.language,
  starterCode: form.starterCode,
  testCases: form.testCases.map((test) => ({
    input: test.input,
    expectedOutput: test.expectedOutput,
    isHidden: Boolean(test.isHidden),
  })),
});
