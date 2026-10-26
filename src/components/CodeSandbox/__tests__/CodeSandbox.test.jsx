import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CodeSandbox from '../CodeSandbox';
import CodeViewer from '../CodeViewer';

// Stands in for the worker client: "runs" code by echoing each input upper-cased
const fakeClient = (produce = (input) => ({ stdout: `${input.toUpperCase()}\n`, stderr: '' })) => ({
  run: vi.fn(async (_language, _code, inputs) => inputs.map((input) => ({ durationMs: 4, timedOut: false, status: 'ok', ...produce(input) }))),
  stop: vi.fn(),
  isRunning: () => false,
});

const tests = [
  { input: 'a', expectedOutput: 'A', isHidden: false },
  { input: 'b', expectedOutput: 'wrong', isHidden: false },
  { input: 'secret', isHidden: true },
];

describe('CodeSandbox', () => {
  it('runs the code with the stdin box and shows the output as text', async () => {
    const client = fakeClient(() => ({ stdout: '<img src=x onerror="alert(1)">', stderr: 'warning\n' }));
    const { container } = render(<CodeSandbox language="python" initialCode="print(input())" sandboxClient={client} />);

    fireEvent.change(screen.getByLabelText('Input (stdin)'), { target: { value: 'hi' } });
    fireEvent.click(screen.getByRole('button', { name: /^Run$/ }));

    await screen.findByText('<img src=x onerror="alert(1)">');
    expect(client.run).toHaveBeenCalledWith('python', 'print(input())', ['hi'], expect.any(Object));
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('warning')).toBeTruthy();
  });

  it('runs with Ctrl+Enter from the editor', async () => {
    const client = fakeClient();
    render(<CodeSandbox language="javascript" initialCode="console.log(1)" sandboxClient={client} />);
    fireEvent.keyDown(screen.getByLabelText('Code editor'), { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(client.run).toHaveBeenCalledTimes(1));
  });

  it('indents with spaces on Tab instead of leaving the editor', () => {
    const onCodeChange = vi.fn();
    render(<CodeSandbox language="python" initialCode="x" onCodeChange={onCodeChange} sandboxClient={fakeClient()} />);
    const editor = screen.getByLabelText('Code editor');
    editor.setSelectionRange(0, 0);
    fireEvent.keyDown(editor, { key: 'Tab' });
    expect(onCodeChange).toHaveBeenLastCalledWith('    x');
  });

  it('runs only the visible tests locally and grades them like the server', async () => {
    const client = fakeClient();
    render(<CodeSandbox language="python" initialCode="code" testCases={tests} sandboxClient={client} />);

    fireEvent.click(screen.getByRole('button', { name: /Run tests/ }));
    await screen.findByText('1/2 visible passing · 1 hidden');

    expect(client.run).toHaveBeenCalledWith('python', 'code', ['a', 'b'], expect.any(Object));
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Passed')).toBeTruthy();
    expect(within(items[1]).getByText('Failed')).toBeTruthy();
    expect(within(items[2]).getByText('Checked on submit')).toBeTruthy();
    expect(within(items[2]).getByText(/Hidden\. Checked when you submit/)).toBeTruthy();
  });

  it('submits the stdout of every test, hidden ones included, and shows the server verdict', async () => {
    const client = fakeClient();
    const onSubmit = vi.fn(async () => ({ results: [true, false, true], passed: 2, total: 3, message: '2/3 tests passed. Fix the rest and submit again.' }));
    render(<CodeSandbox language="python" initialCode="solution" testCases={tests} onSubmit={onSubmit} sandboxClient={client} />);

    fireEvent.click(screen.getByRole('button', { name: /Submit/ }));
    // The server's message already carries the count, so it is not repeated
    const summary = await screen.findByRole('status');
    expect(summary.textContent).toBe('2/3 tests passed. Fix the rest and submit again.');

    expect(client.run).toHaveBeenCalledWith('python', 'solution', ['a', 'b', 'secret'], expect.any(Object));
    expect(onSubmit).toHaveBeenCalledWith({ code: 'solution', outputs: ['A\n', 'B\n', 'SECRET\n'] });
    const items = screen.getAllByRole('listitem');
    expect(within(items[2]).getByText('Passed')).toBeTruthy();
    expect(within(items[1]).getByText('Failed')).toBeTruthy();
  });

  it('shows a failed submission and lets the student try again', async () => {
    const onSubmit = vi.fn()
      .mockRejectedValueOnce(new Error('Expected 3 outputs, one per test case'))
      .mockResolvedValueOnce({ results: [true, true, true], passed: 3, total: 3, message: 'All tests passed' });
    render(<CodeSandbox language="python" initialCode="x" testCases={tests} onSubmit={onSubmit} sandboxClient={fakeClient()} />);

    fireEvent.click(screen.getByRole('button', { name: /Submit/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Expected 3 outputs/);

    fireEvent.click(screen.getByRole('button', { name: /Submit/ }));
    await screen.findByText('3/3 tests passed');
  });

  it('keeps Submit disabled when submitting is not allowed', () => {
    render(
      <CodeSandbox
        language="python"
        initialCode="x"
        testCases={tests}
        onSubmit={vi.fn()}
        submitBlockedReason="Your instructor has reviewed this submission."
        sandboxClient={fakeClient()}
      />,
    );
    expect(screen.getByRole('button', { name: /Submit/ }).disabled).toBe(true);
    expect(screen.getByText('Your instructor has reviewed this submission.')).toBeTruthy();
  });

  it('shows the result of the previous submission until the next run', () => {
    render(
      <CodeSandbox
        language="javascript"
        initialCode="x"
        testCases={tests}
        onSubmit={vi.fn()}
        previousResult={{ results: [true, true, false], passed: 2, total: 3, message: 'Your last submission.' }}
        sandboxClient={fakeClient()}
      />,
    );
    expect(screen.getByText('2/3 tests passed')).toBeTruthy();
    expect(within(screen.getAllByRole('listitem')[2]).getByText('Failed')).toBeTruthy();
  });

  it('offers a language picker only when the caller can change it', () => {
    const onLanguageChange = vi.fn();
    const { rerender } = render(<CodeSandbox language="python" onLanguageChange={onLanguageChange} sandboxClient={fakeClient()} />);
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'javascript' } });
    expect(onLanguageChange).toHaveBeenCalledWith('javascript');

    rerender(<CodeSandbox language="javascript" sandboxClient={fakeClient()} />);
    expect(screen.queryByLabelText('Language')).toBeNull();
    expect(screen.getByText('JavaScript')).toBeTruthy();
  });
});

describe('CodeViewer', () => {
  it('shows submitted code as text with line numbers and no way to run it', () => {
    const { container } = render(<CodeViewer code={'print("<b>hi</b>")\nprint(2)'} />);
    expect(screen.getByText('print("<b>hi</b>") print(2)', { normalizer: (text) => text.replace(/\s+/g, ' ').trim() })).toBeTruthy();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('.cs-viewer-gutter').textContent).toBe('1\n2');
  });
});
