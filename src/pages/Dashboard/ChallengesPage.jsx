import React, { useEffect, useMemo, useState } from 'react';
import { useApiRequest } from '../../hooks/useApiRequest';
import Modal from '../../components/Modal/Modal';
import { SkeletonCardGrid } from '../../components/Skeleton/Skeleton';
import './DashboardOverview.css';
import './Insights.css';
import './Gamification.css';
import logger from '../../utils/logger';

const listFromEnvelope = (payload, key) => {
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload)) return payload;
  return [];
};

const DIFFICULTY = {
  easy: { label: 'Easy', className: 'gm-easy' },
  medium: { label: 'Medium', className: 'gm-medium' },
  hard: { label: 'Hard', className: 'gm-hard' },
};

const TYPE = {
  coding: { label: 'Coding', icon: 'fa-solid fa-code' },
  puzzle: { label: 'Puzzle', icon: 'fa-solid fa-puzzle-piece' },
};

// Must match HINT_PENALTY_PERCENT on the server: each hint takes 20% off the
// reward, up to 80%.
const HINT_PENALTY = 20;
const MAX_PENALTY = 80;

// Every challenge allows one attempt. Its state decides what a card offers:
// a fresh one can be started, an open one resumed, a finished one only viewed.
const stateOf = (attempt) => {
  if (!attempt) return 'new';
  if (attempt.status === 'in_progress') return 'wip';
  if (attempt.status === 'pending') return 'wait';
  if (attempt.status === 'correct' || (attempt.status === 'graded' && attempt.score > 0)) return 'won';
  return 'lost';
};

const ORDER = { wip: 0, new: 1, wait: 2, won: 3, lost: 4 };

const StatusPill = ({ state, attempt }) => {
  if (state === 'new') return <span className="gm-status is-action">Start <i className="fa-solid fa-arrow-right" /></span>;
  if (state === 'wip') return <span className="gm-status is-action">Continue <i className="fa-solid fa-arrow-right" /></span>;
  if (state === 'wait') return <span className="gm-status is-wait"><i className="fa-solid fa-hourglass-half" />Waiting for a grade</span>;
  if (state === 'won') return <span className="gm-status is-won"><i className="fa-solid fa-circle-check" />Solved{attempt?.xpAwarded ? ` · +${attempt.xpAwarded} XP` : ''}</span>;
  return <span className="gm-status is-lost"><i className="fa-solid fa-circle-xmark" />Not solved</span>;
};

const Chips = ({ challenge }) => {
  const diff = DIFFICULTY[challenge.difficulty] || DIFFICULTY.easy;
  const type = TYPE[challenge.type] || TYPE.puzzle;
  return (
    <>
      <span className={`gm-chip ${diff.className}`}>{diff.label}</span>
      <span className="gm-chip is-plain"><i className={type.icon} />{type.label}</span>
    </>
  );
};

/** Minutes and seconds left on a timed attempt, counted from when it started. */
const Countdown = ({ startedAt, minutes }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const end = new Date(startedAt).getTime() + minutes * 60 * 1000;
  const left = Math.max(0, Math.round((end - now) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <span className={`gm-timer${left < 60 ? ' is-low' : ''}`} role="timer" aria-label={`${Math.ceil(left / 60)} minutes left`}>
      <i className="fa-solid fa-stopwatch" />{left === 0 ? 'Time is up' : `${mm}:${ss}`}
    </span>
  );
};

/** How a finished attempt went, with the student's own answer. */
const Result = ({ challenge, attempt }) => {
  const state = stateOf(attempt);
  const graded = attempt.status === 'graded';
  const view = {
    won: { tone: 'var(--success)', icon: 'fa-solid fa-trophy', title: graded ? `Scored ${attempt.score}/100` : 'Solved!',
      text: 'Nice work. The XP is already on your level bar.' },
    wait: { tone: 'var(--warning)', icon: 'fa-solid fa-hourglass-half', title: 'Sent to your teacher',
      text: 'Your teacher will check your code and grade it. You will get a notification with your score.' },
    lost: { tone: 'var(--text-muted)', icon: 'fa-solid fa-seedling', title: graded ? `Scored ${attempt.score ?? 0}/100` : 'Not this time',
      text: 'Each challenge has one try. Every attempt is practice: pick another one to keep earning XP.' },
  }[state];
  if (!view) return null;

  return (
    <div>
      <div className="gm-result" style={{ '--tone': view.tone }}>
        <i className={view.icon} aria-hidden="true" />
        <strong>{view.title}</strong>
        {attempt.xpAwarded > 0 && <span className="gm-xp-pill"><i className="fa-solid fa-bolt" />+{attempt.xpAwarded} XP</span>}
        <p>{view.text}</p>
      </div>

      {attempt.feedback && (
        <div className="gm-answer">
          <strong>Feedback from your teacher</strong>
          <p style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-wrap' }}>{attempt.feedback}</p>
        </div>
      )}

      {challenge.type === 'puzzle' && attempt.selectedAnswer != null && (
        <div className="gm-answer">Your answer: <strong>{attempt.selectedAnswer}</strong></div>
      )}
      {challenge.type === 'coding' && attempt.submittedCode && (
        <div className="gm-answer">
          <strong>Your code</strong>
          <pre>{attempt.submittedCode}</pre>
        </div>
      )}
    </div>
  );
};

const ChallengesPage = () => {
  const { request } = useApiRequest();
  const [challenges, setChallenges] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  // Filters, all applied in the browser.
  const [query, setQuery] = useState('');
  const [show, setShow] = useState('todo');
  const [type, setType] = useState('');
  const [difficulty, setDifficulty] = useState('');

  // The open challenge
  const [selected, setSelected] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const [answer, setAnswer] = useState('');
  const [code, setCode] = useState('');
  const [codeUrl, setCodeUrl] = useState('');
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [showHintModal, setShowHintModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [challengesRes, attemptsRes] = await Promise.all([
          request('/api/v1/challenges?limit=200'),
          request('/api/v1/challenges/my-attempts'),
        ]);
        if (!alive) return;
        if (challengesRes.status === 'success') setChallenges(listFromEnvelope(challengesRes.data, 'challenges'));
        if (attemptsRes.status === 'success') setAttempts(listFromEnvelope(attemptsRes.data, 'attempts'));
      } catch (err) {
        logger.error('Failed to load challenges:', err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [request, reload]);

  const attemptFor = useMemo(() => {
    const map = new Map();
    attempts.forEach((a) => map.set(a.challenge?._id || a.challenge, a));
    return (id) => map.get(id);
  }, [attempts]);

  const summary = useMemo(() => {
    const finished = attempts.map((a) => stateOf(a));
    return {
      solved: finished.filter((s) => s === 'won').length,
      waiting: finished.filter((s) => s === 'wait').length,
      xp: attempts.reduce((sum, a) => sum + (a.xpAwarded || 0), 0),
    };
  }, [attempts]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return challenges
      .map((c) => ({ challenge: c, attempt: attemptFor(c._id), state: stateOf(attemptFor(c._id)) }))
      .filter(({ challenge, state }) => {
        if (show === 'todo' && !(state === 'new' || state === 'wip')) return false;
        if (show === 'done' && (state === 'new' || state === 'wip')) return false;
        if (type && challenge.type !== type) return false;
        if (difficulty && challenge.difficulty !== difficulty) return false;
        if (!needle) return true;
        return `${challenge.title} ${challenge.description} ${(challenge.tags || []).join(' ')}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => ORDER[a.state] - ORDER[b.state]);
  }, [challenges, attemptFor, query, show, type, difficulty]);

  const todoCount = challenges.filter((c) => ['new', 'wip'].includes(stateOf(attemptFor(c._id)))).length;

  const openChallenge = async (challenge) => {
    const existing = attemptFor(challenge._id);
    setSelected(challenge);
    setAttempt(existing || null);
    setOpenError('');
    setSubmitError('');
    setAnswer('');
    setCode(challenge.codingData?.starterCode || '');
    setCodeUrl('');
    setHintsRevealed(existing?.hintsUsed || 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Finished attempts are only shown, never restarted: the server allows one.
    const state = stateOf(existing);
    if (state !== 'new' && state !== 'wip') return;

    setOpening(true);
    try {
      const res = await request(`/api/v1/challenges/${challenge._id}/start`, 'POST');
      if (res.status === 'success') {
        const started = res.data?.attempt || res.data;
        setAttempt(started);
        setHintsRevealed(started?.hintsUsed || 0);
      }
    } catch (err) {
      setOpenError(err.message || 'Could not open this challenge.');
    } finally {
      setOpening(false);
    }
  };

  const closeChallenge = () => {
    setSelected(null);
    setAttempt(null);
    setReload((n) => n + 1);
  };

  const confirmRevealHint = async () => {
    try {
      const res = await request(`/api/v1/challenges/${selected._id}/hint`, 'POST');
      if (res.status === 'success') setHintsRevealed((prev) => res.data?.hintNumber || prev + 1);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setShowHintModal(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const isPuzzle = selected.type === 'puzzle';
    if (isPuzzle ? !answer.trim() : !(code.trim() || codeUrl.trim())) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = isPuzzle
        ? await request(`/api/v1/challenges/${selected._id}/submit-puzzle`, 'POST', { selectedAnswer: answer.trim() })
        : await request(`/api/v1/challenges/${selected._id}/submit-code`, 'POST', {
          submittedCode: code,
          codeLinks: codeUrl ? [{ name: 'Repository', url: codeUrl }] : [],
          hintsUsed: hintsRevealed,
        });
      if (res.status === 'success') {
        const done = res.data?.attempt || {};
        setAttempt({
          ...attempt,
          ...done,
          status: done.status || (isPuzzle ? (res.data?.isCorrect ? 'correct' : 'incorrect') : 'pending'),
          xpAwarded: done.xpAwarded ?? res.data?.xpAwarded ?? 0,
          selectedAnswer: isPuzzle ? answer.trim() : done.selectedAnswer,
          submittedCode: isPuzzle ? done.submittedCode : code,
        });
      }
    } catch (err) {
      setSubmitError(err.message || 'Could not send your answer. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ══════ One challenge ══════ */
  if (selected) {
    const state = stateOf(attempt);
    const finished = attempt && state !== 'new' && state !== 'wip';
    const hints = selected.codingData?.hints || [];
    const examples = (selected.codingData?.testCases || []).filter((t) => !t.isHidden);
    const options = selected.puzzleData?.options || [];
    const isChoice = selected.type === 'puzzle' && (selected.puzzleData?.questionType === 'multiple_choice' || options.length > 0);
    const penalty = Math.min(hintsRevealed * HINT_PENALTY, MAX_PENALTY);
    const maxXp = Math.max(Math.floor(selected.xpReward * (1 - penalty / 100)), 1);

    return (
      <div className="overview-container">
        <div className="ins-head">
          <div className="ins-head__text">
            <button type="button" className="ins-back" onClick={closeChallenge}>
              <i className="fa-solid fa-arrow-left" /> All challenges
            </button>
            <h1 className="page-title">{selected.title}</h1>
            <div className="gm-chips">
              <Chips challenge={selected} />
              <span className="gm-chip" style={{ '--tone': 'var(--gm-xp)' }}><i className="fa-solid fa-bolt" />{selected.xpReward} XP</span>
              {selected.timeLimit > 0 && <span className="gm-chip is-plain"><i className="fa-regular fa-clock" />{selected.timeLimit} min</span>}
            </div>
          </div>
          {!finished && attempt?.startedAt && selected.timeLimit > 0 && (
            <Countdown startedAt={attempt.startedAt} minutes={selected.timeLimit} />
          )}
        </div>

        <div className="gm-solve">
          <section className="ins-panel" aria-labelledby="problem-title">
            <div className="ins-panel__head">
              <h2 id="problem-title"><i className="fa-solid fa-book-open" />The problem</h2>
            </div>
            <p className="gm-problem">{selected.description}</p>

            {examples.length > 0 && (
              <>
                <h3 className="gm-label">Example{examples.length > 1 ? 's' : ''}</h3>
                {examples.map((t, i) => (
                  <dl key={i} className="gm-example">
                    <dt>Input</dt><dd>{t.input}</dd>
                    <dt>Output</dt><dd>{t.expectedOutput}</dd>
                  </dl>
                ))}
              </>
            )}

            {selected.tags?.length > 0 && (
              <>
                <h3 className="gm-label">Topics</h3>
                <div className="gm-tags">{selected.tags.map((t) => <span key={t}>{t}</span>)}</div>
              </>
            )}

            {selected.type === 'coding' && hints.length > 0 && (
              <>
                <h3 className="gm-label">Hints</h3>
                {Array.from({ length: hintsRevealed }).map((_, i) => (
                  <div key={i} className="gm-hint"><i className="fa-solid fa-lightbulb" /><span><strong>Hint {i + 1}:</strong> {hints[i]}</span></div>
                ))}
                {!finished && hintsRevealed < hints.length && (
                  <button type="button" className="nb-btn nb-btn-secondary" style={{ marginTop: hintsRevealed ? '0.75rem' : 0 }}
                    onClick={() => setShowHintModal(true)}>
                    <i className="fa-regular fa-lightbulb" style={{ marginRight: '0.4rem' }} />
                    Show a hint ({hintsRevealed}/{hints.length})
                  </button>
                )}
                {hintsRevealed > 0 && (
                  <p className="ins-panel__meta" style={{ margin: '0.6rem 0 0' }}>
                    Hints used: {hintsRevealed}. This attempt can now earn up to {maxXp} XP.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="ins-panel" aria-labelledby="answer-title">
            <div className="ins-panel__head">
              <h2 id="answer-title" style={{ '--tone': 'var(--success)' }}>
                <i className={finished ? 'fa-solid fa-flag-checkered' : 'fa-solid fa-pen'} />
                {finished ? 'How it went' : 'Your answer'}
              </h2>
            </div>

            {opening && <p className="ins-panel__meta">Getting your attempt ready…</p>}
            {openError && (
              <div className="gm-notice" style={{ background: 'color-mix(in srgb, var(--error) 12%, transparent)' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--error)' }} />
                <span>{openError}</span>
              </div>
            )}

            {finished && <Result challenge={selected} attempt={attempt} />}

            {!finished && !opening && !openError && (
              <form onSubmit={submit}>
                <div className="gm-notice">
                  <i className="fa-solid fa-circle-info" />
                  <span>
                    {selected.type === 'puzzle'
                      ? <>You get <strong>one try</strong>. Check your answer before you send it.</>
                      : <>You get <strong>one try</strong>. Your teacher grades the code and you earn XP for the score.</>}
                  </span>
                </div>

                {selected.type === 'puzzle' && isChoice && (
                  <fieldset className="gm-options">
                    <legend className="gm-label" style={{ marginTop: 0 }}>Pick one</legend>
                    {options.map((option, i) => (
                      <label key={option} className="gm-option">
                        <input type="radio" name="puzzle-answer" value={option}
                          checked={answer === option} onChange={() => setAnswer(option)} />
                        <span className="gm-option__key" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                        <span>{option}</span>
                      </label>
                    ))}
                  </fieldset>
                )}

                {selected.type === 'puzzle' && !isChoice && (
                  <label className="gm-field">
                    <span>Your answer</span>
                    <input className="gm-input" value={answer} onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your answer" autoComplete="off" />
                  </label>
                )}

                {selected.type === 'coding' && (
                  <>
                    <label className="gm-field">
                      <span>Your code</span>
                      <textarea className="gm-code" value={code} onChange={(e) => setCode(e.target.value)}
                        spellCheck={false} rows={12} />
                    </label>
                    <label className="gm-field">
                      <span>Link to your code (optional)</span>
                      <input className="gm-input" type="url" value={codeUrl} onChange={(e) => setCodeUrl(e.target.value)}
                        placeholder="https://github.com/…" />
                    </label>
                  </>
                )}

                {submitError && <p style={{ color: 'var(--error)', fontWeight: 600, margin: '0 0 0.75rem' }}>{submitError}</p>}

                <div className="gm-actions" style={{ marginTop: '1rem' }}>
                  <button type="submit" className="nb-btn nb-btn-primary"
                    disabled={submitting || (selected.type === 'puzzle' ? !answer.trim() : !(code.trim() || codeUrl.trim()))}>
                    {submitting ? 'Sending…' : selected.type === 'puzzle' ? 'Check my answer' : 'Send to my teacher'}
                  </button>
                  <small>Worth up to {maxXp} XP</small>
                </div>
              </form>
            )}
          </section>
        </div>

        <Modal isOpen={showHintModal} onClose={() => setShowHintModal(false)} title="Show a hint?"
          subtitle={`Each hint takes ${HINT_PENALTY}% off the XP for this challenge.`} size="sm">
          <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)' }}>
            With this hint the most you can earn drops to{' '}
            <strong>{Math.max(Math.floor(selected.xpReward * (1 - Math.min((hintsRevealed + 1) * HINT_PENALTY, MAX_PENALTY) / 100)), 1)} XP</strong>.
          </p>
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn-ghost" onClick={() => setShowHintModal(false)}>Keep trying</button>
            <button type="button" className="modal-btn modal-btn-primary" onClick={confirmRevealHint}>Show the hint</button>
          </div>
        </Modal>
      </div>
    );
  }

  /* ══════ All challenges ══════ */
  return (
    <div className="overview-container">
      <div className="ins-head">
        <div className="ins-head__text">
          <h1 className="page-title">Challenges</h1>
          <p className="page-subtitle">Quick puzzles and coding problems. Each one earns XP, and you get one try, so take your time.</p>
        </div>
      </div>

      {!loading && challenges.length > 0 && (
        <div className="gm-summary">
          <div className="gm-sum" style={{ '--tone': 'var(--success)' }}>
            <i className="fa-solid fa-circle-check" />
            <div><strong>{summary.solved}<small style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}> / {challenges.length}</small></strong><span>solved</span></div>
          </div>
          <div className="gm-sum" style={{ '--tone': 'var(--gm-xp)' }}>
            <i className="fa-solid fa-bolt" />
            <div><strong>{summary.xp}</strong><span>XP from challenges</span></div>
          </div>
          <div className="gm-sum" style={{ '--tone': 'var(--warning)' }}>
            <i className="fa-solid fa-hourglass-half" />
            <div><strong>{summary.waiting}</strong><span>waiting for a grade</span></div>
          </div>
        </div>
      )}

      <div className="ins-toolbar">
        <label className="ins-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or topic" aria-label="Search challenges" />
        </label>
        <div className="ins-seg" role="group" aria-label="Show">
          {[['todo', `To do${loading ? '' : ` (${todoCount})`}`], ['done', 'Done'], ['all', 'All']].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={show === value} onClick={() => setShow(value)}>{label}</button>
          ))}
        </div>
        <div className="ins-seg" role="group" aria-label="Type">
          {[['', 'Any type'], ['puzzle', 'Puzzles'], ['coding', 'Coding']].map(([value, label]) => (
            <button key={value || 'any'} type="button" aria-pressed={type === value} onClick={() => setType(value)}>{label}</button>
          ))}
        </div>
        <div className="ins-seg" role="group" aria-label="Difficulty">
          {[['', 'Any level'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([value, label]) => (
            <button key={value || 'any'} type="button" aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>{label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <SkeletonCardGrid count={6} minWidth={290} gap="1rem" />
      ) : challenges.length === 0 ? (
        <div className="ins-panel ins-empty">
          <i className="fa-solid fa-puzzle-piece" />
          <strong>No challenges yet</strong>
          <p>Your teachers have not added any. Check back soon.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="ins-panel ins-empty">
          <i className={show === 'todo' ? 'fa-solid fa-champagne-glasses' : 'fa-solid fa-magnifying-glass'} />
          <strong>{show === 'todo' && !query && !type && !difficulty ? 'All done!' : 'Nothing matches'}</strong>
          <p>
            {show === 'todo' && !query && !type && !difficulty
              ? 'You have tried every challenge. New ones appear here when your teachers add them.'
              : 'Try another search or filter.'}
          </p>
        </div>
      ) : (
        <div className="gm-cards">
          {shown.map(({ challenge, attempt: a, state }) => {
            const diff = DIFFICULTY[challenge.difficulty] || DIFFICULTY.easy;
            const done = state !== 'new' && state !== 'wip';
            return (
              <button key={challenge._id} type="button" className={`gm-card ${diff.className}${done ? ' is-done' : ''}`}
                onClick={() => openChallenge(challenge)}>
                <span className="gm-card__top">
                  <span className={`gm-chip ${diff.className}`}>{diff.label}</span>
                  <span className="gm-card__type"><i className={(TYPE[challenge.type] || TYPE.puzzle).icon} />{(TYPE[challenge.type] || TYPE.puzzle).label}</span>
                </span>
                <span className="gm-card__title">{challenge.title}</span>
                <span className="gm-card__desc">{challenge.description}</span>
                <span className="gm-card__foot">
                  <span className="gm-card__meta">
                    <span className="gm-xp-pill"><i className="fa-solid fa-bolt" />{challenge.xpReward} XP</span>
                    {challenge.timeLimit > 0 && <span><i className="fa-regular fa-clock" /> {challenge.timeLimit} min</span>}
                  </span>
                  <StatusPill state={state} attempt={a} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChallengesPage;
