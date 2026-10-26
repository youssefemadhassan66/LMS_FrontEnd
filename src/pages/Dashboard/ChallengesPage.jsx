import React, { useState, useEffect } from 'react';
import { useApiRequest } from '../../hooks/useApiRequest';
import { useAuth } from '../../context/AuthContext';
import CodeSandbox from '../../components/CodeSandbox/CodeSandbox';

const listFromEnvelope = (payload, key) => {
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload)) return payload;
  return [];
};

const ChallengesPage = () => {
  const { request } = useApiRequest();
  const { user } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [currentAttempt, setCurrentAttempt] = useState(null);

  // Filters
  const [type, setType] = useState(''); // coding, puzzle
  const [difficulty, setDifficulty] = useState(''); // easy, medium, hard
  const [searchTag, setSearchTag] = useState('');

  // Sandbox State
  const [puzzleAnswer, setPuzzleAnswer] = useState('');
  const [submittedCode, setSubmittedCode] = useState('');
  const [codeUrl, setCodeUrl] = useState('');
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [showHintModal, setShowHintModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  // Coding challenges: the full challenge (test inputs) and whether it was sent
  const [challengeDetail, setChallengeDetail] = useState(null);
  const [codeSubmitted, setCodeSubmitted] = useState(false);

  useEffect(() => {
    const fetchChallengesAndAttempts = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (type) queryParams.set('type', type);
        if (difficulty) queryParams.set('difficulty', difficulty);
        if (searchTag) queryParams.set('tags', searchTag);
        const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

        const [challengesRes, attemptsRes] = await Promise.all([
          request(`/api/v1/challenges${queryStr}`),
          request('/api/v1/challenges/my-attempts')
        ]);

        if (challengesRes.status === 'success') {
          setChallenges(listFromEnvelope(challengesRes.data, 'challenges'));
        }
        if (attemptsRes.status === 'success') {
          setAttempts(listFromEnvelope(attemptsRes.data, 'attempts'));
        }
      } catch (err) {
        console.error('Failed to load challenges:', err);
      } finally {
        setLoading(false);
      }
    };

    if (!selectedChallenge) {
      fetchChallengesAndAttempts();
    }
  }, [type, difficulty, searchTag, selectedChallenge, request]);

  const handleStartChallenge = async (challenge) => {
    setLoading(true);
    setSelectedChallenge(challenge);
    setSubmissionResult(null);
    setPuzzleAnswer('');
    setSubmittedCode(challenge.codingData?.starterCode || '');
    setCodeUrl('');
    setHintsRevealed(0);
    setCurrentAttempt(null);
    setChallengeDetail(null);
    setCodeSubmitted(false);

    try {
      // The list never carries test cases for students; the challenge itself
      // has every input (hidden tests without their expected output)
      if (challenge.type === 'coding') {
        const detail = await request(`/api/v1/challenges/${challenge._id}`).catch(() => null);
        setChallengeDetail(detail?.data?.challenge || challenge);
      }
      const res = await request(`/api/v1/challenges/${challenge._id}/start`, 'POST');
      if (res.status === 'success') {
        const attempt = res.data?.attempt || res.data;
        setCurrentAttempt(attempt);
        setHintsRevealed(attempt?.hintsUsed || 0);
      }
    } catch (err) {
      setSubmissionResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRevealHintClick = () => {
    const totalHints = selectedChallenge?.codingData?.hints?.length || 0;
    if (hintsRevealed >= totalHints) return;
    setShowHintModal(true);
  };

  const confirmRevealHint = async () => {
    try {
      const res = await request(`/api/v1/challenges/${selectedChallenge._id}/hint`, 'POST');
      if (res.status === 'success') {
        setHintsRevealed((prev) => res.data?.hintNumber || prev + 1);
        setSubmissionResult(null);
      }
    } catch (err) {
      setSubmissionResult({ success: false, message: err.message });
    } finally {
      setShowHintModal(false);
    }
  };

  const handleSubmitPuzzle = async (e) => {
    e.preventDefault();
    if (!puzzleAnswer.trim()) return;

    setSubmitting(true);
    try {
      const res = await request(`/api/v1/challenges/${selectedChallenge._id}/submit-puzzle`, 'POST', {
        selectedAnswer: puzzleAnswer
      });
      if (res.status === 'success') {
        setSubmissionResult({
          success: res.data.isCorrect,
          message: res.data.isCorrect 
            ? `Correct! 🎉 You've been awarded ${res.data.xpAwarded} XP.` 
            : 'Incorrect answer. Try again!'
        });
      }
    } catch (err) {
      setSubmissionResult({ success: false, message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Called by the sandbox after it ran every test input in the browser; the
  // server compares the outputs with the expected ones and grades at once.
  const handleSubmitCode = async ({ code, outputs }) => {
    const testCases = challengeDetail?.codingData?.testCases || [];
    const body = {
      submittedCode: code,
      codeLinks: codeUrl ? [{ name: 'Repository', url: codeUrl }] : [],
      hintsUsed: hintsRevealed,
      // Without test cases there is nothing to compare: an instructor grades it
      ...(testCases.length > 0 ? { outputs } : {}),
    };
    const res = await request(`/api/v1/challenges/${selectedChallenge._id}/submit-code`, 'POST', body);
    setCodeSubmitted(true);
    const attempt = res.data?.attempt || {};
    const testResults = attempt.testResults || {};
    const xp = attempt.xpAwarded ? ` You earned ${attempt.xpAwarded} XP.` : '';
    return {
      results: Array.isArray(testResults.results) ? testResults.results : [],
      passed: testResults.passed,
      total: testResults.total,
      message: attempt.status === 'graded'
        ? `${res.message || 'Graded.'}${xp}`
        : 'Code submitted! An instructor will grade your solution soon.',
    };
  };

  const getChallengeStatus = (challengeId) => {
    const challengeAttempts = attempts.filter(a => a.challenge === challengeId || a.challenge?._id === challengeId);
    if (challengeAttempts.length === 0) return { label: 'START', color: 'var(--brand-primary)', text: '#FFFFFF' };
    
    // Find if there is a correct/solved attempt
    const isSolved = challengeAttempts.some(a => a.status === 'correct' || a.status === 'solved' || (a.status === 'graded' && (a.score ?? 100) >= 100));
    const graded = challengeAttempts.find(a => a.status === 'graded');
    const isPending = challengeAttempts.some(a => a.status === 'pending');

    if (isSolved) return { label: 'SOLVED 🏆', color: 'var(--success)', text: 'var(--text-primary)' };
    if (graded) return { label: `GRADED ${graded.score ?? 0}%`, color: 'var(--warning)', text: 'var(--text-primary)' };
    if (isPending) return { label: 'PENDING GRADE ⏳', color: 'var(--warning)', text: 'var(--text-primary)' };
    return { label: 'FAILED ❌', color: 'var(--error)', text: '#FFFFFF' };
  };

  const getDifficultyBadge = (difficulty) => {
    if (difficulty === 'easy') return <span className="nb-badge nb-badge-peach">Easy</span>;
    if (difficulty === 'medium') return <span className="nb-badge nb-badge-orange">Medium</span>;
    return <span className="nb-badge nb-badge-red">Hard</span>;
  };

  return (
    <div style={{ paddingBottom: '30px' }}>
      {!selectedChallenge ? (
        // ── LIST VIEW ──
        <>
          <div style={{ marginBottom: '2rem' }}>
            <h1 className="page-title">🧩 Coding Sandbox & Puzzles</h1>
            <p className="page-subtitle">Test your problem-solving skills, earn bonus XP, and unlock special badges.</p>
          </div>

          {/* Filters Bar */}
          <div className="glass-panel" style={{
            padding: '1.25rem',
            marginBottom: '2rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.25rem',
            alignItems: 'center'
          }}>
            {/* Search tag */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Search Tag:</label>
              <input
                type="text"
                placeholder="e.g. loops, strings"
                value={searchTag}
                onChange={(e) => setSearchTag(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  border: '2px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontWeight: 600
                }}
              />
            </div>

            {/* Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Type:</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{
                  padding: '0.45rem 1rem',
                  border: '2px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontWeight: 700
                }}
              >
                <option value="">All Types</option>
                <option value="coding">Coding Challenge</option>
                <option value="puzzle">Quick Puzzle</option>
              </select>
            </div>

            {/* Difficulty */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Difficulty:</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                style={{
                  padding: '0.45rem 1rem',
                  border: '2px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontWeight: 700
                }}
              >
                <option value="">All Levels</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-muted)' }}>Loading Sandbox...</p>
            </div>
          ) : challenges.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ fontSize: '2rem' }}>🎮</p>
              <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>No challenges available. Check back later!</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.5rem'
            }}>
              {challenges.map((challenge) => {
                const status = getChallengeStatus(challenge._id);
                return (
                  <div
                    key={challenge._id}
                    className="glass-panel"
                    style={{
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '220px',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleStartChallenge(challenge)}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        {getDifficultyBadge(challenge.difficulty)}
                        <span style={{
                          padding: '0.15rem 0.5rem',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          border: '2px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          background: challenge.type === 'coding' ? 'var(--accent-yellow)' : 'var(--accent-rose)',
                          textTransform: 'uppercase'
                        }}>
                          {challenge.type}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
                        {challenge.title}
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {challenge.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid var(--border-color)', paddingTop: '0.75rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--brand-primary)' }}>
                        ⚡ {challenge.xpReward} XP
                      </span>
                      <button
                        className="nb-btn"
                        style={{
                          background: status.color,
                          color: status.text,
                          padding: '0.4rem 0.85rem',
                          fontSize: '0.72rem',
                          fontWeight: 800
                        }}
                      >
                        {status.label}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        // ── SANDBOX VIEW (DUAL-PANE) ──
        <>
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setSelectedChallenge(null)}
              className="nb-btn nb-btn-secondary"
              style={{ padding: '0.5rem 1rem' }}
            >
              ← Back to List
            </button>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.5rem' }}>
              Solving: {selectedChallenge.title}
            </h1>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: '1.5rem',
            alignItems: 'stretch'
          }}>
            {/* Left Pane: Challenge Info & Hints */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  {getDifficultyBadge(selectedChallenge.difficulty)}
                  <span className="nb-badge">{selectedChallenge.type}</span>
                  <span className="nb-badge nb-badge-peach" style={{ background: 'var(--success)', color: 'white' }}>⚡ {selectedChallenge.xpReward} XP Max</span>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: '1.2rem', marginBottom: '0.5rem' }}>Problem Description</h3>
                  <div style={{
                    fontSize: '0.88rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    background: 'var(--bg-secondary)',
                    padding: '1rem',
                    border: '2px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    {selectedChallenge.description}
                  </div>
                </div>

                {selectedChallenge.tags && selectedChallenge.tags.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Tags:</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                      {selectedChallenge.tags.map(t => (
                        <span key={t} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', border: '1.5px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Hints Drawer */}
              <div style={{ borderTop: '3px solid var(--border-color)', paddingTop: '1.25rem' }}>
                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', margin: '0 0 0.5rem' }}>Need Help? 💡</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
                  Revealing a hint costs a <strong style={{ color: 'var(--error)' }}>20% XP penalty</strong> per hint.
                </p>

                {selectedChallenge.codingData?.hints && selectedChallenge.codingData.hints.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {Array.from({ length: hintsRevealed }).map((_, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem',
                          background: 'var(--accent-yellow)',
                          border: '2px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          fontWeight: 600
                        }}
                      >
                        <strong>Hint #{idx + 1}:</strong> {selectedChallenge.codingData.hints[idx]}
                      </div>
                    ))}

                    {hintsRevealed < selectedChallenge.codingData.hints.length && (
                      <button
                        onClick={handleRevealHintClick}
                        className="nb-btn nb-btn-secondary"
                        style={{ fontSize: '0.78rem', alignSelf: 'flex-start', padding: '0.45rem 1rem' }}
                      >
                        Reveal Hint ({hintsRevealed}/{selectedChallenge.codingData.hints.length})
                      </button>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hints available for this challenge.</p>
                )}
              </div>
            </div>

            {/* Right Pane: Editor / Submission Form */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: '1.2rem', marginBottom: '1rem' }}>
                  Your Solution Workspace
                </h3>

                {submissionResult && (
                  <div style={{
                    padding: '1rem',
                    marginBottom: '1.25rem',
                    background: submissionResult.success ? 'var(--accent-peach)' : 'var(--accent-rose)',
                    border: '2px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)'
                  }}>
                    {submissionResult.message}
                  </div>
                )}

                {selectedChallenge.type === 'puzzle' ? (
                  // puzzle solver form
                  <form onSubmit={handleSubmitPuzzle} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Enter your Answer:</label>
                      <input
                        type="text"
                        placeholder="Write your answer..."
                        value={puzzleAnswer}
                        onChange={(e) => setPuzzleAnswer(e.target.value)}
                        style={{
                          padding: '0.65rem',
                          border: '2px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting || !puzzleAnswer.trim()}
                      className="nb-btn nb-btn-primary"
                      style={{ alignSelf: 'flex-start', opacity: submitting || !puzzleAnswer.trim() ? 0.6 : 1 }}
                    >
                      {submitting ? 'Checking...' : 'Submit Puzzle'}
                    </button>
                  </form>
                ) : (
                  // coding challenge: solved and auto-graded in the browser sandbox
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {challengeDetail ? (
                      <CodeSandbox
                        key={selectedChallenge._id}
                        language={challengeDetail.codingData?.language || 'python'}
                        initialCode={submittedCode}
                        onCodeChange={setSubmittedCode}
                        testCases={challengeDetail.codingData?.testCases || []}
                        onSubmit={handleSubmitCode}
                        submitLabel="Submit solution"
                        submitBlockedReason={
                          codeSubmitted
                            ? 'Submitted. Each challenge takes one submission.'
                            : (!loading && !currentAttempt ? 'This challenge cannot be submitted again.' : '')
                        }
                        submitNote="One submission per challenge: run the tests first. Submitting runs every test, hidden ones included."
                        ownerId={user?._id}
                        editorLabel="Your solution"
                      />
                    ) : (
                      <p style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Loading the challenge…</p>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label htmlFor="challenge-repo-url" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Repository URL (Optional):</label>
                      <input
                        id="challenge-repo-url"
                        type="url"
                        placeholder="GitHub / CodePen link..."
                        value={codeUrl}
                        onChange={(e) => setCodeUrl(e.target.value)}
                        disabled={codeSubmitted}
                        style={{
                          padding: '0.55rem',
                          border: '2px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                <span>Active Attempt: {currentAttempt?._id ? `#${currentAttempt._id.slice(-6)}` : 'Initializing...'}</span>
                <span>Hints Penalty: {hintsRevealed * 20}%</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ⚠️ Hint Warn Confirmation Modal */}
      {showHintModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="glass-panel" style={{
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            background: 'var(--card-bg)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '2.5rem' }}>⚠️</span>
            <h3 style={{ fontFamily: 'var(--font-heading)', margin: '0.5rem 0' }}>Reveal Hint?</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Clicking reveal will show a hint, but it incurs a <strong style={{ color: 'var(--error)' }}>20% XP penalty</strong>. Your maximum possible reward for this attempt will drop!
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button
                onClick={() => setShowHintModal(false)}
                className="nb-btn nb-btn-secondary"
                style={{ padding: '0.5rem 1rem' }}
              >
                No, Go Back
              </button>
              <button
                onClick={confirmRevealHint}
                className="nb-btn nb-btn-primary"
                style={{ padding: '0.5rem 1rem', background: 'var(--brand-primary)', color: '#fff' }}
              >
                Yes, Reveal Hint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChallengesPage;
