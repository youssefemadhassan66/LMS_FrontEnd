import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CodeExerciseFields from '../CodeExerciseFields';
import CodeExerciseSolver from '../CodeExerciseSolver';
import { codeExerciseFromTask, codeExercisePayload, emptyCodeExercise } from '../../../utils/codeSandbox';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../hooks/useApiRequest', () => ({
  useApiRequest: () => ({ request: mocks.request }),
}));

vi.mock('../../../utils/codeSandbox', async (importOriginal) => ({
  ...(await importOriginal()),
  getSandboxClient: () => ({ run: mocks.run, stop: vi.fn(), isRunning: () => false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.run.mockImplementation(async (_language, _code, inputs) => inputs.map((input) => ({ stdout: `${Number(input) * 2}\n`, stderr: '', status: 'ok', timedOut: false, durationMs: 1 })));
});

describe('code exercise form helpers', () => {
  it('fills the form from a staff task and turns it back into the API payload', () => {
    const form = codeExerciseFromTask({
      codeExercise: { language: 'javascript', starterCode: '// go', testCases: [{ input: '1', expectedOutput: '2', isHidden: true }] },
    });
    expect(form).toEqual({ enabled: true, language: 'javascript', starterCode: '// go', testCases: [{ input: '1', expectedOutput: '2', isHidden: true }] });
    expect(codeExercisePayload(form)).toEqual({ language: 'javascript', starterCode: '// go', testCases: [{ input: '1', expectedOutput: '2', isHidden: true }] });
    expect(codeExerciseFromTask({ title: 'Essay' }).enabled).toBe(false);
  });
});

describe('CodeExerciseFields', () => {
  const Harness = ({ onState }) => {
    const [value, setValue] = useState(emptyCodeExercise());
    onState(value);
    return <CodeExerciseFields value={value} onChange={setValue} />;
  };

  it('reveals language, starter code and test rows when enabled, and edits them', () => {
    let state;
    render(<Harness onState={(value) => { state = value; }} />);
    expect(screen.queryByLabelText('Language')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: /Code exercise/ }));
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'javascript' } });
    fireEvent.change(screen.getByLabelText('Input (stdin)'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Expected output'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Test/ }));
    fireEvent.click(screen.getAllByRole('checkbox', { name: /Hidden from students/ })[1]);

    expect(state.enabled).toBe(true);
    expect(state.language).toBe('javascript');
    expect(state.testCases).toEqual([
      { input: '3', expectedOutput: '6', isHidden: false },
      { input: '', expectedOutput: '', isHidden: true },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Remove test 1' }));
    expect(state.testCases).toEqual([{ input: '', expectedOutput: '', isHidden: true }]);
  });
});

describe('CodeExerciseSolver', () => {
  const task = { _id: 'task1', title: 'Double it', description: 'Print twice the number', status: 'pending' };

  const serve = ({ submission = null } = {}) => {
    mocks.request.mockImplementation(async (url, method) => {
      if (url === '/api/v1/task/me/task1') {
        return {
          data: {
            task: {
              _id: 'task1',
              codeExercise: {
                language: 'python',
                starterCode: 'n = int(input())\n',
                testCases: [{ input: '2', expectedOutput: '4', isHidden: false }, { input: '5', isHidden: true }],
              },
            },
          },
        };
      }
      if (url.startsWith('/api/v1/submission/me')) return { data: { submissions: submission ? [submission] : [] } };
      if (url === '/api/v1/submission/task/task1/code' && method === 'POST') {
        return {
          message: 'All tests passed — task completed!',
          data: { submission: { code: { language: 'python', passed: 2, total: 2, results: [true, true] } } },
        };
      }
      throw new Error(`unexpected request ${url}`);
    });
  };

  it('loads the test inputs and submits the code with one output per test', async () => {
    serve();
    const onSubmitted = vi.fn();
    render(<CodeExerciseSolver task={task} ownerId="student1" onSubmitted={onSubmitted} />);

    const editor = await screen.findByLabelText('Your solution');
    expect(editor.value).toBe('n = int(input())\n');
    expect(mocks.request).toHaveBeenCalledWith('/api/v1/submission/me?task=task1');

    fireEvent.click(screen.getByRole('button', { name: /Submit solution/ }));
    await screen.findByText('2/2 tests passed');

    expect(mocks.run).toHaveBeenCalledWith('python', 'n = int(input())\n', ['2', '5'], expect.any(Object));
    expect(mocks.request).toHaveBeenCalledWith('/api/v1/submission/task/task1/code', 'POST', { code: 'n = int(input())\n', outputs: ['4\n', '10\n'] });
    expect(onSubmitted).toHaveBeenCalled();
  });

  it('reopens the code last submitted and blocks changes after an instructor review', async () => {
    serve({
      submission: {
        task: { _id: 'task1' },
        status: 'Reviewed',
        code: { language: 'python', source: 'print(int(input()) * 2)', passed: 2, total: 2, results: [true, true], submittedAt: '2026-10-01T10:00:00.000Z' },
      },
    });
    render(<CodeExerciseSolver task={task} ownerId="student1" />);

    const editor = await screen.findByLabelText('Your solution');
    expect(editor.value).toBe('print(int(input()) * 2)');
    expect(screen.getByRole('button', { name: /Submit solution/ }).disabled).toBe(true);
    expect(screen.getByText(/has reviewed this submission/)).toBeTruthy();
    expect(screen.getByText('2/2 tests passed')).toBeTruthy();
  });

  it('prefers an unsent draft that is newer than the last submission', async () => {
    serve({
      submission: { task: 'task1', status: 'Completed', code: { source: 'old', submittedAt: '2020-01-01T00:00:00.000Z' } },
    });
    localStorage.setItem('algogambit:code-draft:task:student1:task1', JSON.stringify({ code: 'newer draft', savedAt: Date.now() }));
    render(<CodeExerciseSolver task={task} ownerId="student1" />);
    await waitFor(() => expect(screen.getByLabelText('Your solution').value).toBe('newer draft'));
  });
});
