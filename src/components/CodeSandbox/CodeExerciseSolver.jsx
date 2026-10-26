import React, { useEffect, useState } from 'react';
import CodeSandbox from './CodeSandbox';
import { useApiRequest } from '../../hooks/useApiRequest';
import { useCodeDraft } from '../../hooks/useCodeDraft';
import { readDraft } from '../../utils/codeSandbox';

const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);

// Newest of: the unsent draft on this device, the code last submitted, the starter code
const pickInitialCode = (draft, submission, starterCode) => {
  const submitted = submission?.code?.source;
  const submittedAt = Date.parse(submission?.code?.submittedAt || '') || 0;
  if (draft && (!submitted || draft.savedAt > submittedAt)) return draft.code;
  return submitted ?? starterCode ?? '';
};

const previousResultOf = (submission) => {
  const code = submission?.code;
  if (!code?.source) return null;
  const when = code.submittedAt ? ` on ${new Date(code.submittedAt).toLocaleString()}` : '';
  return {
    results: Array.isArray(code.results) ? code.results : [],
    passed: code.passed,
    total: code.total,
    message: `Your last submission${when}.`,
  };
};

/**
 * Student side of a task's code exercise: loads the test inputs (hidden
 * expected outputs are never sent) and the previous submission, runs the code
 * in the browser sandbox and submits the outputs for server-side grading.
 */
const CodeExerciseSolver = ({ task, ownerId, onSubmitted }) => {
  const { request } = useApiRequest();
  const draft = useCodeDraft();
  const [state, setState] = useState({ loading: true, error: null, exercise: null, submission: null });
  const draftKey = `task:${ownerId || 'anonymous'}:${task._id}`;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [taskResponse, submissionResponse] = await Promise.all([
          request(`/api/v1/task/me/${task._id}`),
          request(`/api/v1/submission/me?task=${encodeURIComponent(task._id)}`).catch(() => null),
        ]);
        if (cancelled) return;
        const submissions = submissionResponse?.data?.submissions || [];
        setState({
          loading: false,
          error: null,
          exercise: taskResponse?.data?.task?.codeExercise || null,
          submission: submissions.find((submission) => sameId(submission.task, task._id)) || null,
        });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error.message, exercise: null, submission: null });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [request, task._id]);

  if (state.loading) {
    return <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loading the exercise…</p>;
  }
  if (state.error || !state.exercise?.language) {
    return (
      <div className="modal-error">
        <i className="fa-solid fa-triangle-exclamation" /> {state.error || 'This task has no code exercise.'}
      </div>
    );
  }

  const { exercise, submission } = state;
  let blockedReason = '';
  if (task.status === 'canceled') blockedReason = 'This task was canceled, so it can no longer be submitted.';
  else if (submission?.status === 'Reviewed') blockedReason = 'Your instructor has reviewed this submission, so it can no longer be changed.';

  const submit = async ({ code, outputs }) => {
    const response = await request(`/api/v1/submission/task/${task._id}/code`, 'POST', { code, outputs });
    draft.discard(draftKey);
    const result = response?.data?.submission?.code || {};
    onSubmitted?.();
    return {
      results: Array.isArray(result.results) ? result.results : [],
      passed: result.passed,
      total: result.total,
      message: response?.message || '',
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {task.description && (
        <p style={{ margin: 0, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{task.description}</p>
      )}
      <CodeSandbox
        language={exercise.language}
        initialCode={pickInitialCode(readDraft(draftKey), submission, exercise.starterCode)}
        onCodeChange={(code) => draft.save(draftKey, code)}
        testCases={exercise.testCases || []}
        onSubmit={submit}
        submitLabel="Submit solution"
        submitBlockedReason={blockedReason}
        submitNote="Submitting runs every test again, hidden ones included. You can resubmit until your instructor reviews it."
        previousResult={previousResultOf(submission)}
        ownerId={ownerId}
        editorLabel="Your solution"
      />
    </div>
  );
};

export default CodeExerciseSolver;
