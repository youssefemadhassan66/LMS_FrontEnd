import React, { useState, useEffect, useMemo } from 'react';
import { useApiRequest } from '../../hooks/useApiRequest';
import { safeUrl } from '../../utils/safeUrl';
import { timeAgo } from '../../utils/timeAgo';
import Modal from '../../components/Modal/Modal';
import { SkeletonCardGrid } from '../../components/Skeleton/Skeleton';
import './DashboardOverview.css';
import './Insights.css';
import './Gamification.css';
import logger from '../../utils/logger';

const DIFFICULTY = {
  easy: { label: 'Easy', className: 'gm-easy' },
  medium: { label: 'Medium', className: 'gm-medium' },
  hard: { label: 'Hard', className: 'gm-hard' },
};

const TYPE = {
  coding: { label: 'Coding', icon: 'fa-solid fa-code' },
  puzzle: { label: 'Puzzle', icon: 'fa-solid fa-puzzle-piece' },
};

const QUICK_SCORES = [100, 90, 75, 50, 25, 0];
const emptyTestCase = () => ({ input: '', expectedOutput: '', isHidden: false });

const initialsOf = (name = '') =>
  name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').toUpperCase().slice(0, 2) || '?';

const DiffChip = ({ difficulty }) => {
  const d = DIFFICULTY[difficulty] || DIFFICULTY.easy;
  return <span className={`gm-chip ${d.className}`}>{d.label}</span>;
};

const InstructorChallengesPage = () => {
  const { request } = useApiRequest();
  const [challenges, setChallenges] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('grading'); // grading, manage
  const [notice, setNotice] = useState(null); // { tone, text }

  // Grading
  const [gradingAttempt, setGradingAttempt] = useState(null);
  const [score, setScore] = useState(100);
  const [feedback, setFeedback] = useState('');
  const [gradingSubmitting, setGradingSubmitting] = useState(false);

  // Create / edit
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('coding'); // coding, puzzle
  const [difficulty, setDifficulty] = useState('easy'); // easy, medium, hard
  const [xpReward, setXpReward] = useState(50);
  const [timeLimit, setTimeLimit] = useState(0);
  const [tagsInput, setTagsInput] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [questionType, setQuestionType] = useState('multiple_choice'); // multiple_choice, fill_blank
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [options, setOptions] = useState(['', '']);

  const [starterCode, setStarterCode] = useState('');
  const [hints, setHints] = useState(['']);
  const [testCases, setTestCases] = useState([emptyTestCase()]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [challengesRes, attemptsRes] = await Promise.all([
        request('/api/v1/challenges?limit=200'),
        request('/api/v1/challenges/attempts')
      ]);

      if (challengesRes.status === 'success') {
        setChallenges(challengesRes.data?.challenges || challengesRes.data || []);
      }
      if (attemptsRes.status === 'success') {
        setAttempts(attemptsRes.data?.attempts || attemptsRes.data || []);
      }
    } catch (err) {
      logger.error('Failed to load instructor data:', err);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('coding');
    setDifficulty('easy');
    setXpReward(50);
    setTimeLimit(0);
    setTagsInput('');
    setIsActive(true);
    setQuestionType('multiple_choice');
    setCorrectAnswer('');
    setOptions(['', '']);
    setStarterCode('');
    setHints(['']);
    setTestCases([emptyTestCase()]);
    setEditingChallenge(null);
    setFormError('');
  };

  const handleEdit = (challenge) => {
    resetForm();
    setEditingChallenge(challenge);
    setTitle(challenge.title);
    setDescription(challenge.description);
    setType(challenge.type);
    setDifficulty(challenge.difficulty);
    setXpReward(challenge.xpReward);
    setTimeLimit(challenge.timeLimit || 0);
    setTagsInput(challenge.tags ? challenge.tags.join(', ') : '');
    setIsActive(challenge.isActive !== false);

    if (challenge.type === 'puzzle' && challenge.puzzleData) {
      setQuestionType(challenge.puzzleData.questionType || 'multiple_choice');
      // The server never sends the answer back, so it is typed again.
      setCorrectAnswer(challenge.puzzleData.correctAnswer || '');
      setOptions(challenge.puzzleData.options?.length ? challenge.puzzleData.options : ['', '']);
    } else if (challenge.type === 'coding' && challenge.codingData) {
      setStarterCode(challenge.codingData.starterCode || '');
      setHints(challenge.codingData.hints && challenge.codingData.hints.length > 0 ? challenge.codingData.hints : ['']);
      setTestCases(challenge.codingData.testCases?.length ? challenge.codingData.testCases : [emptyTestCase()]);
    }
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await request(`/api/v1/challenges/${deleting._id}`, 'DELETE');
      setNotice({ tone: 'var(--success)', text: `“${deleting.title}” was deleted.` });
      fetchData();
    } catch (err) {
      setNotice({ tone: 'var(--error)', text: `Could not delete: ${err.message}` });
    } finally {
      setDeleting(null);
    }
  };

  const handleCreateOrUpdateChallenge = async (e) => {
    e.preventDefault();
    setFormError('');

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const body = {
      title,
      description,
      type,
      difficulty,
      xpReward: Number(xpReward),
      timeLimit: Number(timeLimit),
      tags,
      isActive
    };

    if (type === 'puzzle') {
      const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
      if (questionType === 'multiple_choice' && !cleanOptions.includes(correctAnswer.trim())) {
        setFormError('The correct answer must be one of the options, written the same way.');
        return;
      }
      body.puzzleData = {
        questionType,
        correctAnswer: correctAnswer.trim(),
        ...(questionType === 'multiple_choice' ? { options: cleanOptions } : {})
      };
    } else {
      body.codingData = {
        starterCode,
        hints: hints.filter(h => h.trim() !== ''),
        testCases: testCases.filter(tc => tc.input.trim() !== '' && tc.expectedOutput.trim() !== '')
      };
      if (body.codingData.testCases.length === 0) {
        setFormError('Add at least one test case with an input and an expected output.');
        return;
      }
    }

    setSaving(true);
    try {
      const res = editingChallenge
        ? await request(`/api/v1/challenges/${editingChallenge._id}`, 'PATCH', body)
        : await request('/api/v1/challenges', 'POST', body);

      if (res.status === 'success') {
        setNotice({ tone: 'var(--success)', text: editingChallenge ? `“${title}” was updated.` : `“${title}” is ${isActive ? 'live for students' : 'saved as a draft'}.` });
        setShowCreateForm(false);
        resetForm();
        fetchData();
      }
    } catch (err) {
      setFormError(err.message || 'Could not save the challenge.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitGrade = async (e) => {
    e.preventDefault();
    if (!gradingAttempt) return;

    setGradingSubmitting(true);
    try {
      const res = await request(`/api/v1/challenges/attempts/${gradingAttempt._id}/grade`, 'PATCH', {
        score: Number(score),
        feedback
      });

      if (res.status === 'success') {
        const name = gradingAttempt.studentProfileId?.user?.FullName || 'The student';
        setNotice({ tone: 'var(--success)', text: `Grade sent. ${name} scored ${score}/100.` });
        setGradingAttempt(null);
        setFeedback('');
        setScore(100);
        fetchData();
      }
    } catch (err) {
      setNotice({ tone: 'var(--error)', text: `Could not save the grade: ${err.message}` });
    } finally {
      setGradingSubmitting(false);
    }
  };

  const updateAt = (list, setList, index, value) => {
    const updated = [...list];
    updated[index] = value;
    setList(updated);
  };

  const pendingAttempts = attempts.filter(a => a.status === 'pending');

  // How each challenge is doing with students.
  const statsFor = useMemo(() => {
    const map = new Map();
    attempts.forEach((a) => {
      const id = a.challenge?._id || a.challenge;
      const entry = map.get(id) || { tried: 0, solved: 0 };
      if (a.status !== 'in_progress') entry.tried += 1;
      if (a.status === 'correct' || (a.status === 'graded' && a.score > 0)) entry.solved += 1;
      map.set(id, entry);
    });
    return (id) => map.get(id) || { tried: 0, solved: 0 };
  }, [attempts]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setGradingAttempt(null);
    setShowCreateForm(false);
    setNotice(null);
  };

  return (
    <div className="overview-container">
      <div className="ins-head">
        <div className="ins-head__text">
          <h1 className="page-title">Challenge desk</h1>
          <p className="page-subtitle">Grade coding answers and write the puzzles and problems students solve for XP.</p>
        </div>
        {activeTab === 'manage' && !showCreateForm && (
          <button type="button" onClick={() => { resetForm(); setShowCreateForm(true); }} className="nb-btn nb-btn-primary">
            <i className="fa-solid fa-plus" style={{ marginRight: '0.4rem' }} />New challenge
          </button>
        )}
      </div>

      <div className="ins-seg" role="tablist" aria-label="Desk" style={{ alignSelf: 'flex-start' }}>
        <button type="button" role="tab" aria-selected={activeTab === 'grading'} aria-pressed={activeTab === 'grading'} onClick={() => switchTab('grading')}>
          <i className="fa-solid fa-inbox" style={{ marginRight: '0.4rem' }} />To grade
          {!loading && <span className="audit-count">{pendingAttempts.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'manage'} aria-pressed={activeTab === 'manage'} onClick={() => switchTab('manage')}>
          <i className="fa-solid fa-puzzle-piece" style={{ marginRight: '0.4rem' }} />Challenges
          {!loading && <span className="audit-count">{challenges.length}</span>}
        </button>
      </div>

      {notice && (
        <div className="gm-notice" style={{ margin: 0, background: `color-mix(in srgb, ${notice.tone} 12%, transparent)` }} role="status">
          <i className={notice.tone === 'var(--error)' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-check'} style={{ color: notice.tone }} />
          <span style={{ flex: 1 }}>{notice.text}</span>
          <button type="button" className="socket-toast__close" style={{ margin: '-0.35rem -0.35rem 0 0' }} aria-label="Dismiss" onClick={() => setNotice(null)}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {loading && !gradingAttempt && !showCreateForm ? (
        <SkeletonCardGrid count={3} minWidth={290} gap="1rem" />
      ) : activeTab === 'grading' ? (
        gradingAttempt ? (
          /* ══════ One answer to grade ══════ */
          <>
            <button type="button" className="ins-back" style={{ alignSelf: 'flex-start', marginBottom: '-0.75rem' }} onClick={() => setGradingAttempt(null)}>
              <i className="fa-solid fa-arrow-left" /> Everything to grade
            </button>
            <div className="gm-solve">
              <section className="ins-panel" aria-labelledby="submission-title">
                <div className="ins-panel__head">
                  <h2 id="submission-title"><i className="fa-solid fa-code" />{gradingAttempt.challenge?.title || 'Challenge'}</h2>
                  <DiffChip difficulty={gradingAttempt.challenge?.difficulty} />
                </div>
                <div className="ins-person tone-student" style={{ cursor: 'default', padding: '0 0 0.85rem' }}>
                  <span className="ins-avatar" aria-hidden="true">{initialsOf(gradingAttempt.studentProfileId?.user?.FullName)}</span>
                  <span className="ins-person__text">
                    <strong>{gradingAttempt.studentProfileId?.user?.FullName || 'Unknown student'}</strong>
                    <small>
                      Sent {timeAgo(gradingAttempt.completedAt || gradingAttempt.updatedAt)}
                      {' · '}{gradingAttempt.hintsUsed || 0} hint{gradingAttempt.hintsUsed === 1 ? '' : 's'} used
                    </small>
                  </span>
                </div>

                <h3 className="gm-label" style={{ marginTop: 0 }}>Their code</h3>
                <pre className="gm-code" style={{ minHeight: 0, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {gradingAttempt.submittedCode || 'No code pasted. See the links below.'}
                </pre>

                {gradingAttempt.codeLinks?.length > 0 && (
                  <>
                    <h3 className="gm-label">Links</h3>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {gradingAttempt.codeLinks.map((link, idx) => (
                        <li key={idx}>
                          <a href={safeUrl(link.url)} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                            {link.name || 'Repository'} <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.75rem' }} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              <section className="ins-panel" aria-labelledby="grade-title">
                <div className="ins-panel__head">
                  <h2 id="grade-title" style={{ '--tone': 'var(--success)' }}><i className="fa-solid fa-marker" />Your grade</h2>
                </div>
                <form onSubmit={handleSubmitGrade}>
                  <label className="gm-field">
                    <span>Score out of 100</span>
                    <input className="gm-input" type="number" min="0" max="100" value={score}
                      onChange={(e) => setScore(e.target.value)} required style={{ maxWidth: '9rem', fontWeight: 800 }} />
                  </label>
                  <div className="gm-tags" style={{ marginTop: '-0.4rem', marginBottom: '1rem' }} role="group" aria-label="Quick scores">
                    {QUICK_SCORES.map((s) => (
                      <button key={s} type="button" className="gm-chip" onClick={() => setScore(s)}
                        style={{ border: 0, cursor: 'pointer', '--tone': Number(score) === s ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="ins-panel__meta" style={{ margin: '0 0 1rem' }}>
                    The student earns {Math.max(Math.floor((gradingAttempt.challenge?.xpReward || 0) * (Number(score) || 0) / 100 * (1 - Math.min((gradingAttempt.hintsUsed || 0) * 0.2, 0.8))), Number(score) > 0 ? 1 : 0)} XP for this score
                    {gradingAttempt.hintsUsed ? ', after the hint penalty' : ''}.
                  </p>
                  <label className="gm-field">
                    <span>Feedback for the student</span>
                    <textarea className="gm-input" rows={6} value={feedback} onChange={(e) => setFeedback(e.target.value)}
                      placeholder="What went well, and one thing to try next time" style={{ resize: 'vertical' }} />
                  </label>
                  <button type="submit" disabled={gradingSubmitting} className="nb-btn nb-btn-primary">
                    {gradingSubmitting ? 'Sending…' : 'Send grade'}
                  </button>
                </form>
              </section>
            </div>
          </>
        ) : pendingAttempts.length === 0 ? (
          <div className="ins-panel ins-empty">
            <i className="fa-solid fa-mug-hot" />
            <strong>Nothing to grade</strong>
            <p>Coding answers appear here as students send them. Puzzles are marked automatically.</p>
          </div>
        ) : (
          /* ══════ Waiting to be graded ══════ */
          <section className="ins-panel" aria-label="Waiting to be graded">
            <ul className="ins-people">
              {[...pendingAttempts]
                .sort((a, b) => new Date(a.completedAt || a.updatedAt) - new Date(b.completedAt || b.updatedAt))
                .map((attempt) => (
                  <li key={attempt._id}>
                    <button type="button" className="ins-person tone-student" onClick={() => { setGradingAttempt(attempt); setScore(100); setFeedback(''); setNotice(null); }}>
                      <span className="ins-avatar" aria-hidden="true">{initialsOf(attempt.studentProfileId?.user?.FullName)}</span>
                      <span className="ins-person__text">
                        <strong>{attempt.studentProfileId?.user?.FullName || 'Unknown student'}</strong>
                        <small>{attempt.challenge?.title || 'Challenge'} · sent {timeAgo(attempt.completedAt || attempt.updatedAt)}</small>
                      </span>
                      <DiffChip difficulty={attempt.challenge?.difficulty} />
                      <span className="gm-status is-action">Grade <i className="fa-solid fa-arrow-right" /></span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )
      ) : showCreateForm ? (
        /* ══════ Create or edit ══════ */
        <section className="ins-panel" style={{ maxWidth: 860 }} aria-labelledby="form-title">
          <div className="ins-panel__head">
            <h2 id="form-title"><i className={editingChallenge ? 'fa-solid fa-pen' : 'fa-solid fa-plus'} />{editingChallenge ? 'Edit challenge' : 'New challenge'}</h2>
            <button type="button" className="ins-link" onClick={() => { setShowCreateForm(false); resetForm(); }}>Cancel</button>
          </div>

          <form onSubmit={handleCreateOrUpdateChallenge}>
            <div className="ins-grid-2" style={{ gap: '0 1rem' }}>
              <label className="gm-field">
                <span>Title</span>
                <input className="gm-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Reverse a string" required minLength={3} />
              </label>
              <div className="gm-field">
                <span>Kind</span>
                <div className="ins-seg" role="group" aria-label="Kind">
                  {Object.entries(TYPE).map(([value, t]) => (
                    <button key={value} type="button" aria-pressed={type === value} disabled={!!editingChallenge}
                      title={editingChallenge ? 'The kind cannot change after a challenge is created' : undefined}
                      onClick={() => setType(value)}>
                      <i className={t.icon} style={{ marginRight: '0.35rem' }} />{t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label className="gm-field">
              <span>The problem</span>
              <textarea className="gm-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain exactly what to do, in words a student can follow" required minLength={10} style={{ resize: 'vertical' }} />
            </label>

            <div className="ins-grid-2" style={{ gap: '0 1rem' }}>
              <div className="gm-field">
                <span>Difficulty</span>
                <div className="ins-seg" role="group" aria-label="Difficulty">
                  {Object.entries(DIFFICULTY).map(([value, d]) => (
                    <button key={value} type="button" aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>{d.label}</button>
                  ))}
                </div>
              </div>
              <div className="gm-field">
                <span>Visible to students</span>
                <div className="ins-seg" role="group" aria-label="Visibility">
                  <button type="button" aria-pressed={isActive} onClick={() => setIsActive(true)}>Live</button>
                  <button type="button" aria-pressed={!isActive} onClick={() => setIsActive(false)}>Draft</button>
                </div>
              </div>
              <label className="gm-field">
                <span>XP reward</span>
                <input className="gm-input" type="number" min="1" max="500" value={xpReward} onChange={(e) => setXpReward(e.target.value)} required />
              </label>
              <label className="gm-field">
                <span>Time limit in minutes (0 for none)</span>
                <input className="gm-input" type="number" min="0" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
              </label>
            </div>

            <label className="gm-field">
              <span>Topics, separated by commas</span>
              <input className="gm-input" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="e.g. loops, strings" />
            </label>

            {type === 'puzzle' && (
              <fieldset className="ins-note" style={{ display: 'block', margin: '0.5rem 0 1rem' }}>
                <legend className="gm-label" style={{ margin: 0, padding: '0 0.35rem' }}>Puzzle</legend>
                <div className="gm-field">
                  <span>Answer style</span>
                  <div className="ins-seg" role="group" aria-label="Answer style">
                    <button type="button" aria-pressed={questionType === 'multiple_choice'} onClick={() => setQuestionType('multiple_choice')}>Pick an option</button>
                    <button type="button" aria-pressed={questionType === 'fill_blank'} onClick={() => setQuestionType('fill_blank')}>Type the answer</button>
                  </div>
                </div>

                {questionType === 'multiple_choice' && (
                  <div className="gm-field">
                    <span>Options (2 to 6)</span>
                    {options.map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className="gm-option__key" aria-hidden="true">{String.fromCharCode(65 + idx)}</span>
                        <input className="gm-input" value={opt} onChange={(e) => updateAt(options, setOptions, idx, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`} required aria-label={`Option ${String.fromCharCode(65 + idx)}`} />
                        {options.length > 2 && (
                          <button type="button" className="socket-toast__close" style={{ margin: 0 }} aria-label={`Remove option ${String.fromCharCode(65 + idx)}`}
                            onClick={() => setOptions(options.filter((_, i) => i !== idx))}>
                            <i className="fa-solid fa-xmark" />
                          </button>
                        )}
                      </div>
                    ))}
                    {options.length < 6 && (
                      <button type="button" className="ins-link" style={{ justifySelf: 'start' }} onClick={() => setOptions([...options, ''])}>
                        <i className="fa-solid fa-plus" /> Add an option
                      </button>
                    )}
                  </div>
                )}

                <label className="gm-field" style={{ marginBottom: 0 }}>
                  <span>Correct answer{questionType === 'multiple_choice' ? ' (exactly as one option is written)' : ''}</span>
                  <input className="gm-input" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} required
                    placeholder={editingChallenge ? 'Type the answer again to save' : 'The answer students must give'} />
                </label>
                {editingChallenge && (
                  <p className="ins-panel__meta" style={{ margin: '0.4rem 0 0' }}>
                    Answers are kept secret, even from this page, so type it again when you edit.
                  </p>
                )}
              </fieldset>
            )}

            {type === 'coding' && (
              <fieldset className="ins-note" style={{ display: 'block', margin: '0.5rem 0 1rem' }}>
                <legend className="gm-label" style={{ margin: 0, padding: '0 0.35rem' }}>Coding</legend>
                <label className="gm-field">
                  <span>Starter code (optional)</span>
                  <textarea className="gm-code" style={{ minHeight: 140 }} value={starterCode} onChange={(e) => setStarterCode(e.target.value)}
                    placeholder={'def solve():\n    # students start here\n    pass'} spellCheck={false} />
                </label>

                <div className="gm-field">
                  <span>Hints (up to 5, each costs 20% of the XP)</span>
                  {hints.map((hint, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input className="gm-input" value={hint} onChange={(e) => updateAt(hints, setHints, idx, e.target.value)}
                        placeholder={`Hint ${idx + 1}`} aria-label={`Hint ${idx + 1}`} />
                      {hints.length > 1 && (
                        <button type="button" className="socket-toast__close" style={{ margin: 0 }} aria-label={`Remove hint ${idx + 1}`}
                          onClick={() => setHints(hints.filter((_, i) => i !== idx))}>
                          <i className="fa-solid fa-xmark" />
                        </button>
                      )}
                    </div>
                  ))}
                  {hints.length < 5 && (
                    <button type="button" className="ins-link" style={{ justifySelf: 'start' }} onClick={() => setHints([...hints, ''])}>
                      <i className="fa-solid fa-plus" /> Add a hint
                    </button>
                  )}
                </div>

                <div className="gm-field" style={{ marginBottom: 0 }}>
                  <span>Test cases (at least one). Visible ones are shown to students as examples.</span>
                  {testCases.map((tc, idx) => (
                    <div key={idx} className="ins-grid-2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto auto', gap: '0.5rem', alignItems: 'center' }}>
                      <input className="gm-input" value={tc.input} onChange={(e) => updateAt(testCases, setTestCases, idx, { ...tc, input: e.target.value })}
                        placeholder="Input" aria-label={`Test ${idx + 1} input`} />
                      <input className="gm-input" value={tc.expectedOutput} onChange={(e) => updateAt(testCases, setTestCases, idx, { ...tc, expectedOutput: e.target.value })}
                        placeholder="Expected output" aria-label={`Test ${idx + 1} expected output`} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={!!tc.isHidden} onChange={(e) => updateAt(testCases, setTestCases, idx, { ...tc, isHidden: e.target.checked })} />
                        Hidden
                      </label>
                      {testCases.length > 1 ? (
                        <button type="button" className="socket-toast__close" style={{ margin: 0 }} aria-label={`Remove test ${idx + 1}`}
                          onClick={() => setTestCases(testCases.filter((_, i) => i !== idx))}>
                          <i className="fa-solid fa-xmark" />
                        </button>
                      ) : <span style={{ width: 32 }} />}
                    </div>
                  ))}
                  <button type="button" className="ins-link" style={{ justifySelf: 'start' }} onClick={() => setTestCases([...testCases, emptyTestCase()])}>
                    <i className="fa-solid fa-plus" /> Add a test case
                  </button>
                </div>
              </fieldset>
            )}

            {formError && <p style={{ color: 'var(--error)', fontWeight: 600, margin: '0 0 0.75rem' }}>{formError}</p>}

            <div className="gm-actions">
              <button type="submit" className="nb-btn nb-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editingChallenge ? 'Save changes' : isActive ? 'Publish' : 'Save draft'}
              </button>
              <button type="button" className="nb-btn nb-btn-secondary" onClick={() => { setShowCreateForm(false); resetForm(); }}>Cancel</button>
            </div>
          </form>
        </section>
      ) : challenges.length === 0 ? (
        <div className="ins-panel ins-empty">
          <i className="fa-solid fa-puzzle-piece" />
          <strong>No challenges yet</strong>
          <p>Write a quick puzzle or a coding problem. Students earn XP for solving it.</p>
          <button type="button" className="nb-btn nb-btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => { resetForm(); setShowCreateForm(true); }}>
            New challenge
          </button>
        </div>
      ) : (
        /* ══════ All challenges ══════ */
        <section className="ins-panel" aria-label="Challenges">
          <ul className="ins-people">
            {challenges.map((c) => {
              const s = statsFor(c._id);
              const t = TYPE[c.type] || TYPE.puzzle;
              return (
                <li key={c._id}>
                  <div className="ins-person" style={{ cursor: 'default', flexWrap: 'wrap' }}>
                    <span className="ins-avatar" style={{ '--tone': 'var(--data-score)', borderRadius: 10 }} aria-hidden="true"><i className={t.icon} /></span>
                    <span className="ins-person__text" style={{ minWidth: 180 }}>
                      <strong>{c.title}{c.isActive === false ? ' · Draft' : ''}</strong>
                      <small>
                        {t.label} · {c.xpReward} XP{c.timeLimit ? ` · ${c.timeLimit} min` : ''}
                        {' · '}{s.tried ? `${s.solved} of ${s.tried} solved` : 'No answers yet'}
                      </small>
                    </span>
                    <DiffChip difficulty={c.difficulty} />
                    <span className="gm-actions" style={{ gap: '0.5rem' }}>
                      <button type="button" className="nb-btn nb-btn-secondary" onClick={() => handleEdit(c)}>Edit</button>
                      <button type="button" className="socket-toast__close" style={{ margin: 0 }} aria-label={`Delete ${c.title}`} title="Delete"
                        onClick={() => setDeleting(c)}>
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title="Delete this challenge?"
        subtitle={deleting?.title} size="sm">
        <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)' }}>
          Students will no longer see it. XP already earned from it stays with them.
        </p>
        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn-ghost" onClick={() => setDeleting(null)}>Keep it</button>
          <button type="button" className="modal-btn modal-btn-danger" onClick={confirmDelete}>Delete</button>
        </div>
      </Modal>
    </div>
  );
};

export default InstructorChallengesPage;
