import React, { useState, useEffect } from 'react';
import { useApiRequest } from '../../hooks/useApiRequest';
import { safeUrl } from '../../utils/safeUrl';
import { SANDBOX_LANGUAGES, isSandboxLanguage } from '../../utils/codeSandbox';

const InstructorChallengesPage = () => {
  const { request } = useApiRequest();
  const [challenges, setChallenges] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('grading'); // grading, manage
  
  // Grading states
  const [gradingAttempt, setGradingAttempt] = useState(null);
  const [score, setScore] = useState(100);
  const [feedback, setFeedback] = useState('');
  const [gradingSubmitting, setGradingSubmitting] = useState(false);

  // Manage states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('coding'); // coding, puzzle
  const [difficulty, setDifficulty] = useState('easy'); // easy, medium, hard
  const [xpReward, setXpReward] = useState(50);
  const [timeLimit, setTimeLimit] = useState(0);
  const [tagsInput, setTagsInput] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Puzzle Specific Form Fields
  const [questionType, setQuestionType] = useState('multiple_choice'); // multiple_choice, fill_blank
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [options, setOptions] = useState(['', '']);

  // Coding Specific Form Fields
  const [codeLanguage, setCodeLanguage] = useState('python');
  const [starterCode, setStarterCode] = useState('');
  const [hints, setHints] = useState(['']);
  const [testCases, setTestCases] = useState([{ input: 'default', expectedOutput: 'default', isHidden: false }]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [challengesRes, attemptsRes] = await Promise.all([
        request('/api/v1/challenges'),
        request('/api/v1/challenges/attempts')
      ]);

      if (challengesRes.status === 'success') {
        setChallenges(challengesRes.data?.challenges || challengesRes.data || []);
      }
      if (attemptsRes.status === 'success') {
        setAttempts(attemptsRes.data?.attempts || attemptsRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load instructor data:', err);
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
    setCodeLanguage('python');
    setStarterCode('');
    setHints(['']);
    setTestCases([{ input: 'default', expectedOutput: 'default', isHidden: false }]);
    setEditingChallenge(null);
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
      setQuestionType(challenge.puzzleData.questionType);
      setCorrectAnswer(challenge.puzzleData.correctAnswer || '');
      setOptions(challenge.puzzleData.options || ['', '']);
    } else if (challenge.type === 'coding' && challenge.codingData) {
      // Challenges from before the sandbox have no language; they ran as Python
      setCodeLanguage(isSandboxLanguage(challenge.codingData.language) ? challenge.codingData.language : 'python');
      setStarterCode(challenge.codingData.starterCode || '');
      setHints(challenge.codingData.hints && challenge.codingData.hints.length > 0 ? challenge.codingData.hints : ['']);
      setTestCases(challenge.codingData.testCases || [{ input: 'default', expectedOutput: 'default', isHidden: false }]);
    }
    setShowCreateForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this challenge?')) return;
    try {
      await request(`/api/v1/challenges/${id}`, 'DELETE');
      fetchData();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleCreateOrUpdateChallenge = async (e) => {
    e.preventDefault();

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
      body.puzzleData = {
        questionType,
        correctAnswer: correctAnswer.trim(),
        ...(questionType === 'multiple_choice' ? { options: options.filter(o => o.trim() !== '') } : {})
      };
    } else {
      body.codingData = {
        language: codeLanguage,
        starterCode,
        hints: hints.filter(h => h.trim() !== ''),
        testCases: testCases.filter(tc => tc.input.trim() !== '' && tc.expectedOutput.trim() !== '')
      };
    }

    try {
      let res;
      if (editingChallenge) {
        res = await request(`/api/v1/challenges/${editingChallenge._id}`, 'PATCH', body);
      } else {
        res = await request('/api/v1/challenges', 'POST', body);
      }

      if (res.status === 'success') {
        setShowCreateForm(false);
        resetForm();
        fetchData();
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
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
        setGradingAttempt(null);
        setFeedback('');
        setScore(100);
        fetchData();
      }
    } catch (err) {
      alert(`Grading failed: ${err.message}`);
    } finally {
      setGradingSubmitting(false);
    }
  };

  // Puzzle option handlers
  const addOptionField = () => setOptions([...options, '']);
  const removeOptionField = (index) => setOptions(options.filter((_, idx) => idx !== index));
  const updateOptionValue = (val, index) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  // Coding hint handlers
  const addHintField = () => setHints([...hints, '']);
  const removeHintField = (index) => setHints(hints.filter((_, idx) => idx !== index));
  const updateHintValue = (val, index) => {
    const updated = [...hints];
    updated[index] = val;
    setHints(updated);
  };

  // Coding testcase handlers
  const addTestCase = () => setTestCases([...testCases, { input: '', expectedOutput: '', isHidden: false }]);
  const removeTestCase = (index) => setTestCases(testCases.filter((_, idx) => idx !== index));
  const updateTestCase = (field, val, index) => {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: val };
    setTestCases(updated);
  };

  // Filters for grading desk
  const pendingAttempts = attempts.filter(a => a.status === 'pending');

  return (
    <div style={{ paddingBottom: '30px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">👨‍🏫 Instructor Challenge Desk</h1>
        <p className="page-subtitle">Manage coding puzzles, review student attempts, and grade submissions.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={() => { setActiveTab('grading'); setGradingAttempt(null); }}
          className="nb-btn"
          style={{
            background: activeTab === 'grading' ? 'var(--brand-primary)' : 'var(--card-bg)',
            color: activeTab === 'grading' ? '#FFFFFF' : 'var(--text-primary)'
          }}
        >
          📝 Grading Desk ({pendingAttempts.length})
        </button>
        <button
          onClick={() => { setActiveTab('manage'); setShowCreateForm(false); }}
          className="nb-btn"
          style={{
            background: activeTab === 'manage' ? 'var(--brand-primary)' : 'var(--card-bg)',
            color: activeTab === 'manage' ? '#FFFFFF' : 'var(--text-primary)'
          }}
        >
          🛠️ Manage Challenges ({challenges.length})
        </button>
      </div>

      {loading && !gradingAttempt && !showCreateForm ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-muted)' }}>Loading Desk...</p>
        </div>
      ) : activeTab === 'grading' ? (
        // ── GRADING DESK ──
        <>
          {gradingAttempt ? (
            // Grade editor subview
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
              {/* Student Submission Card */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <button onClick={() => setGradingAttempt(null)} className="nb-btn nb-btn-secondary" style={{ padding: '0.45rem 1rem' }}>
                    ← Back to Grading List
                  </button>
                  <span className="nb-badge">
                    Attempt #{gradingAttempt._id.slice(-6)}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', margin: 0 }}>Submission Details</h3>
                  <p style={{ fontSize: '0.88rem', margin: 0 }}>
                    <strong>Student:</strong> {gradingAttempt.studentProfileId?.user?.FullName || 'Unknown Student'}
                  </p>
                  <p style={{ fontSize: '0.88rem', margin: 0 }}>
                    <strong>Challenge:</strong> {gradingAttempt.challenge?.title || 'Unknown Challenge'}
                  </p>
                  <p style={{ fontSize: '0.88rem', margin: 0 }}>
                    <strong>Hints Used:</strong> {gradingAttempt.hintsUsed || 0}
                  </p>
                  <p style={{ fontSize: '0.88rem', margin: 0 }}>
                    <strong>Time Spent:</strong> {Math.floor((gradingAttempt.timeSpent || 0) / 60)}m {((gradingAttempt.timeSpent || 0) % 60)}s
                  </p>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Submitted Code:</h4>
                  <pre style={{
                    padding: '1rem',
                    background: 'var(--bg-secondary)',
                    border: '2px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {gradingAttempt.submittedCode || '// No code submitted'}
                  </pre>
                </div>

                {gradingAttempt.codeLinks && gradingAttempt.codeLinks.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Submission Links:</h4>
                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', margin: 0 }}>
                      {gradingAttempt.codeLinks.map((link, idx) => (
                        <li key={idx}>
                          <a href={safeUrl(link.url)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 600 }}>
                            {link.name || 'Repository Link'}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Grading Input Form */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: '1.25rem', marginBottom: '1rem' }}>Grade Submission</h3>
                <form onSubmit={handleSubmitGrade} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Score (0 - 100):</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      style={{
                        padding: '0.55rem',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)'
                      }}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Written Feedback:</label>
                    <textarea
                      rows={6}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Add helpful grading comments..."
                      style={{
                        padding: '0.65rem',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={gradingSubmitting}
                    className="nb-btn nb-btn-primary"
                    style={{ alignSelf: 'flex-start', opacity: gradingSubmitting ? 0.6 : 1 }}
                  >
                    {gradingSubmitting ? 'Submitting Grade...' : 'Post Final Grade'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            // Attempts List
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              {pendingAttempts.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '2rem' }}>🎉</p>
                  <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>All attempts have been graded! Zero pending.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
                  <thead>
                    <tr style={{ borderBottom: '3px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Student</th>
                      <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Challenge</th>
                      <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Difficulty</th>
                      <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>Hints Used</th>
                      <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>Submitted</th>
                      <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingAttempts.map((attempt) => (
                      <tr key={attempt._id} style={{ borderBottom: '2px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem', fontWeight: 700 }}>
                          {attempt.studentProfileId?.user?.FullName || 'Unknown Student'}
                        </td>
                        <td style={{ padding: '1rem', fontWeight: 600 }}>
                          {attempt.challenge?.title || 'Unknown Challenge'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span className="nb-badge nb-badge-orange">
                            {attempt.challenge?.difficulty || 'easy'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', fontWeight: 700, textAlign: 'right' }}>
                          {attempt.hintsUsed || 0}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                          {new Date(attempt.completedAt || attempt.startedAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => setGradingAttempt(attempt)}
                            className="nb-btn nb-btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem', fontWeight: 800 }}
                          >
                            Review & Grade
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      ) : (
        // ── MANAGE CHALLENGES ──
        <>
          {showCreateForm ? (
            // Challenge Creation Desk Form
            <div className="glass-panel" style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 400 }}>
                  {editingChallenge ? 'Edit Challenge' : 'Create New Challenge'}
                </h3>
                <button onClick={() => { setShowCreateForm(false); resetForm(); }} className="nb-btn nb-btn-secondary" style={{ padding: '0.45rem 1rem' }}>
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdateChallenge} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Title */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Challenge Title:</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Reverse a String"
                      style={{ padding: '0.55rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600 }}
                      required
                    />
                  </div>

                  {/* Type */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Challenge Type:</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      disabled={!!editingChallenge} // backend type conversion can be risky
                      style={{ padding: '0.55rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700 }}
                    >
                      <option value="coding">Coding Challenge</option>
                      <option value="puzzle">Quick Puzzle</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Problem Description:</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Write a clear problem description. Supports markdown..."
                    style={{ padding: '0.65rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', resize: 'vertical' }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {/* Difficulty */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Difficulty:</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      style={{ padding: '0.55rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700 }}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  {/* XP Reward */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>XP Reward:</label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={xpReward}
                      onChange={(e) => setXpReward(e.target.value)}
                      style={{ padding: '0.55rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700 }}
                      required
                    />
                  </div>

                  {/* Time limit */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Time Limit (min):</label>
                    <input
                      type="number"
                      min="0"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                      style={{ padding: '0.55rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      title="Set to 0 for unlimited time"
                    />
                  </div>

                  {/* Status */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Active Status:</label>
                    <select
                      value={isActive ? 'true' : 'false'}
                      onChange={(e) => setIsActive(e.target.value === 'true')}
                      style={{ padding: '0.55rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700 }}
                    >
                      <option value="true">Active (Visible)</option>
                      <option value="false">Inactive (Draft)</option>
                    </select>
                  </div>
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Tags (comma-separated):</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="e.g. recursion, strings, algorithms"
                    style={{ padding: '0.55rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  />
                </div>

                {/* ─── PUZZLE SPECIFIC SUB-FORM ─── */}
                {type === 'puzzle' && (
                  <div style={{ background: 'var(--bg-secondary)', padding: '1rem', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', margin: 0 }}>Puzzle Configurations</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Question Type:</label>
                        <select
                          value={questionType}
                          onChange={(e) => setQuestionType(e.target.value)}
                          style={{ padding: '0.45rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontWeight: 700 }}
                        >
                          <option value="multiple_choice">Multiple Choice (MCQ)</option>
                          <option value="fill_blank">Fill in the Blank</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Correct Answer (Exact Match):</label>
                        <input
                          type="text"
                          value={correctAnswer}
                          onChange={(e) => setCorrectAnswer(e.target.value)}
                          placeholder="Correct solution text..."
                          style={{ padding: '0.45rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontWeight: 600 }}
                          required
                        />
                      </div>
                    </div>

                    {questionType === 'multiple_choice' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>MCQ Option List (Provide 2 to 6 options):</label>
                        {options.map((opt, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateOptionValue(e.target.value, idx)}
                              placeholder={`Option #${idx + 1}`}
                              style={{ flex: 1, padding: '0.4rem', border: '1.5px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--card-bg)' }}
                              required
                            />
                            {options.length > 2 && (
                              <button type="button" onClick={() => removeOptionField(idx)} style={{ background: 'var(--error)', color: '#fff', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        {options.length < 6 && (
                          <button type="button" onClick={addOptionField} className="nb-btn nb-btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem', alignSelf: 'flex-start', marginTop: '0.25rem' }}>
                            + Add Option Option
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── CODING SPECIFIC SUB-FORM ─── */}
                {type === 'coding' && (
                  <div style={{ background: 'var(--bg-secondary)', padding: '1rem', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', margin: 0 }}>Coding configurations</h4>

                    {/* Language the student's browser sandbox runs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '260px' }}>
                      <label htmlFor="challenge-language" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Language:</label>
                      <select
                        id="challenge-language"
                        value={codeLanguage}
                        onChange={(e) => setCodeLanguage(e.target.value)}
                        style={{ padding: '0.45rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontWeight: 700 }}
                      >
                        {SANDBOX_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </div>
                    
                    {/* Starter Code */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Starter Code Template:</label>
                      <textarea
                        rows={6}
                        value={starterCode}
                        onChange={(e) => setStarterCode(e.target.value)}
                        placeholder="function solve() {\n  // Starter code here\n}"
                        style={{ padding: '0.5rem', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: '0.8rem', background: 'var(--card-bg)' }}
                      />
                    </div>

                    {/* Hints (Max 5) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Hints (Max 5):</label>
                      {hints.map((hint, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={hint}
                            onChange={(e) => updateHintValue(e.target.value, idx)}
                            placeholder={`Hint #${idx + 1}`}
                            style={{ flex: 1, padding: '0.4rem', border: '1.5px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--card-bg)' }}
                          />
                          {hints.length > 1 && (
                            <button type="button" onClick={() => removeHintField(idx)} style={{ background: 'var(--error)', color: '#fff', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      {hints.length < 5 && (
                        <button type="button" onClick={addHintField} className="nb-btn nb-btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem', alignSelf: 'flex-start', marginTop: '0.25rem' }}>
                          + Add Hint Field
                        </button>
                      )}
                    </div>

                    {/* Test cases (Min 1) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Test Cases (Minimum 1):</label>
                      {testCases.map((tc, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 40px', gap: '0.5rem', alignItems: 'center', background: 'var(--card-bg)', padding: '0.5rem', border: '1.5px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                          <textarea
                            rows={2}
                            value={tc.input}
                            onChange={(e) => updateTestCase('input', e.target.value, idx)}
                            placeholder="Input (stdin)"
                            aria-label={`Test ${idx + 1} input`}
                            spellCheck={false}
                            style={{ padding: '0.35rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                            required
                          />
                          <textarea
                            rows={2}
                            value={tc.expectedOutput}
                            onChange={(e) => updateTestCase('expectedOutput', e.target.value, idx)}
                            placeholder="Expected output"
                            aria-label={`Test ${idx + 1} expected output`}
                            spellCheck={false}
                            style={{ padding: '0.35rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                            required
                          />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', cursor: 'pointer', userSelect: 'none' }}>
                            <input
                              type="checkbox"
                              checked={tc.isHidden}
                              onChange={(e) => updateTestCase('isHidden', e.target.checked, idx)}
                            />
                            Hidden?
                          </label>
                          {testCases.length > 1 ? (
                            <button type="button" onClick={() => removeTestCase(idx)} style={{ background: 'var(--error)', color: '#fff', border: 'none', padding: '0.25rem', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer' }}>
                              ×
                            </button>
                          ) : <div />}
                        </div>
                      ))}
                      <button type="button" onClick={addTestCase} className="nb-btn nb-btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem', alignSelf: 'flex-start', marginTop: '0.25rem' }}>
                        + Add Test Case
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" className="nb-btn nb-btn-primary" style={{ alignSelf: 'flex-start' }}>
                  {editingChallenge ? 'Update Challenge' : 'Publish Challenge'}
                </button>
              </form>
            </div>
          ) : (
            // Challenge List View
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', margin: 0 }}>Active Challenges & Problems</h3>
                <button onClick={() => { resetForm(); setShowCreateForm(true); }} className="nb-btn nb-btn-primary">
                  + Add Challenge
                </button>
              </div>

              {challenges.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No challenges created yet. Click "Add Challenge" to publish one!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {challenges.map((c) => (
                    <div
                      key={c._id}
                      style={{
                        padding: '1rem',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
                          {c.title} {c.isActive === false && <span style={{ color: 'var(--error)', fontSize: '0.72rem' }}>(Draft)</span>}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Type: <strong style={{ textTransform: 'capitalize' }}>{c.type}</strong> • XP: <strong>{c.xpReward}</strong> • Diff: <strong style={{ textTransform: 'capitalize' }}>{c.difficulty}</strong>
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={() => handleEdit(c)} className="nb-btn nb-btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.72rem', fontWeight: 800 }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(c._id)} className="nb-btn" style={{ padding: '0.45rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, background: 'var(--error)', color: '#fff' }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InstructorChallengesPage;
