import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSandboxClient,
  getSandboxClient,
  normalizeOutput,
  outputsMatch,
  readDraft,
  writeDraft,
  clearDraft,
} from '../codeSandbox';

class FakeWorker {
  constructor() {
    this.listeners = { message: new Set(), error: new Set() };
    this.posted = [];
    this.terminated = false;
  }

  addEventListener(type, handler) {
    this.listeners[type].add(handler);
  }

  removeEventListener(type, handler) {
    this.listeners[type].delete(handler);
  }

  postMessage(message) {
    this.posted.push(message);
  }

  emit(data) {
    for (const handler of [...this.listeners.message]) handler({ data });
  }

  get lastRun() {
    return this.posted[this.posted.length - 1];
  }

  terminate() {
    this.terminated = true;
  }
}

const setup = (options = {}) => {
  const workers = [];
  const client = createSandboxClient({
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    ...options,
  });
  return { client, workers };
};

// Plays the worker's side of one run: every test prints `outputs[i]`
const completeRun = (worker, outputs) => {
  const { id } = worker.lastRun;
  outputs.forEach((stdout, index) => {
    worker.emit({ type: 'test-start', id, index });
    worker.emit({ type: 'test-done', id, index, result: { stdout, stderr: '', durationMs: 3 } });
  });
  worker.emit({ type: 'done', id });
};

describe('normalizeOutput (mirrors Backend/Utilities/codeGrader.js)', () => {
  it('treats CRLF, trailing spaces and trailing blank lines as insignificant', () => {
    expect(normalizeOutput('3  \r\n4\t\r\n\r\n\n')).toBe('3\n4');
    expect(normalizeOutput('a\rb')).toBe('a\nb');
  });

  it('keeps leading whitespace and blank lines between output', () => {
    expect(normalizeOutput('  x\n\n  y\n')).toBe('  x\n\n  y');
  });

  it('turns missing output into an empty string', () => {
    expect(normalizeOutput(undefined)).toBe('');
    expect(normalizeOutput(null)).toBe('');
    expect(normalizeOutput(42)).toBe('42');
  });

  it('compares program output with an expected answer the way the server does', () => {
    expect(outputsMatch('Hello, Ada!\n', 'Hello, Ada!')).toBe(true);
    expect(outputsMatch('hello', 'Hello')).toBe(false);
    expect(outputsMatch(' 3', '3')).toBe(false);
  });
});

describe('sandbox client', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the code and every input, and resolves one result per input in order', async () => {
    const { client, workers } = setup();
    const statuses = [];
    const pending = client.run('python', 'print(input())', ['1', '2'], { onStatus: (message) => statuses.push(message) });

    const [worker] = workers;
    expect(worker.lastRun).toMatchObject({ type: 'run', language: 'python', code: 'print(input())', inputs: ['1', '2'] });
    worker.emit({ type: 'status', id: worker.lastRun.id, message: 'Loading Python…' });
    completeRun(worker, ['1\n', '2\n']);

    const results = await pending;
    expect(results.map((result) => result.stdout)).toEqual(['1\n', '2\n']);
    expect(results.every((result) => result.status === 'ok' && result.timedOut === false)).toBe(true);
    expect(statuses).toContain('Loading Python…');
    expect(client.isRunning()).toBe(false);
  });

  it('ignores messages that belong to another run', async () => {
    const { client, workers } = setup();
    const pending = client.run('javascript', 'x', ['a']);
    const [worker] = workers;
    worker.emit({ type: 'done', id: 999 });
    expect(client.isRunning()).toBe(true);
    completeRun(worker, ['ok']);
    await expect(pending).resolves.toHaveLength(1);
  });

  it('keeps a separate worker per language and reuses it between runs', async () => {
    const { client, workers } = setup();

    const first = client.run('python', 'a', ['']);
    completeRun(workers[0], ['']);
    await first;

    const second = client.run('javascript', 'b', ['']);
    expect(workers).toHaveLength(2);
    completeRun(workers[1], ['']);
    await second;

    const third = client.run('python', 'c', ['']);
    expect(workers).toHaveLength(2);
    completeRun(workers[0], ['']);
    await third;
  });

  it('times a test out, terminates the worker, skips the rest, and starts fresh next time', async () => {
    vi.useFakeTimers();
    const { client, workers } = setup({ testTimeoutMs: 5000 });
    const pending = client.run('python', 'while True: pass', ['1', '2', '3']);
    const [worker] = workers;
    const { id } = worker.lastRun;

    worker.emit({ type: 'test-start', id, index: 0 });
    worker.emit({ type: 'test-done', id, index: 0, result: { stdout: 'fine\n', stderr: '' } });
    worker.emit({ type: 'test-start', id, index: 1 });
    vi.advanceTimersByTime(4999);
    expect(worker.terminated).toBe(false);
    vi.advanceTimersByTime(1);

    const results = await pending;
    expect(worker.terminated).toBe(true);
    expect(results[0]).toMatchObject({ status: 'ok', stdout: 'fine\n' });
    expect(results[1]).toMatchObject({ status: 'timeout', timedOut: true, stdout: '' });
    expect(results[1].stderr).toMatch(/Time limit exceeded/);
    expect(results[2]).toMatchObject({ status: 'skipped' });

    const next = client.run('python', 'print(1)', ['']);
    expect(workers).toHaveLength(2);
    completeRun(workers[1], ['1\n']);
    await expect(next).resolves.toMatchObject([{ status: 'ok', stdout: '1\n' }]);
  });

  it('gives a slow first load its own, longer allowance', async () => {
    vi.useFakeTimers();
    const { client, workers } = setup({ testTimeoutMs: 5000, startTimeoutMs: 60000 });
    const pending = client.run('python', 'print(1)', ['']);
    vi.advanceTimersByTime(30000);
    expect(workers[0].terminated).toBe(false);
    vi.advanceTimersByTime(30000);
    const [result] = await pending;
    expect(result.status).toBe('timeout');
    expect(result.stderr).toMatch(/took too long to start/);
  });

  it('reports a crashed runtime on the test that was running and discards the worker', async () => {
    const { client, workers } = setup();
    const pending = client.run('python', 'x', ['1', '2']);
    const [worker] = workers;
    const { id } = worker.lastRun;
    worker.emit({ type: 'test-start', id, index: 0 });
    worker.emit({ type: 'error', id, message: 'The sandbox crashed: RangeError' });

    const results = await pending;
    expect(results[0]).toMatchObject({ status: 'crashed', stderr: 'The sandbox crashed: RangeError' });
    expect(results[1].status).toBe('skipped');
    expect(worker.terminated).toBe(true);
  });

  it('refuses a second run while one is in progress, and can stop the current one', async () => {
    const { client, workers } = setup();
    const pending = client.run('javascript', 'for(;;){}', ['']);
    await expect(client.run('javascript', 'x', [''])).rejects.toThrow(/already running/);

    client.stop();
    const [result] = await pending;
    expect(result.status).toBe('stopped');
    expect(workers[0].terminated).toBe(true);
  });

  it('rejects languages the sandbox cannot run', async () => {
    const { client } = setup();
    await expect(client.run('ruby', 'puts 1', [''])).rejects.toThrow(/Unsupported language/);
  });
});

describe('shared client', () => {
  it('is reused for the same user and replaced when another user signs in', () => {
    const first = getSandboxClient('user-a');
    expect(getSandboxClient('user-a')).toBe(first);
    expect(getSandboxClient('user-b')).not.toBe(first);
  });
});

describe('drafts', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a draft and clears it', () => {
    writeDraft('task:1', 'print(1)');
    expect(readDraft('task:1')).toMatchObject({ code: 'print(1)' });
    clearDraft('task:1');
    expect(readDraft('task:1')).toBeNull();
  });

  it('treats unavailable storage as no draft', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(readDraft('task:1')).toBeNull();
    spy.mockRestore();
  });
});
