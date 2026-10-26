import React, { useState, useEffect } from 'react';
import { useApiRequest } from '../../hooks/useApiRequest';
import { useAuth } from '../../context/AuthContext';
import { SkeletonCardGrid } from '../../components/Skeleton/Skeleton';
import './DashboardOverview.css';
import './Insights.css';
import './Gamification.css';

const LIMIT = 20;
const GRADES = ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];

const PERIODS = [
  { value: 'all_time', label: 'All time' },
  { value: 'monthly', label: 'This month' },
  { value: 'weekly', label: 'This week' },
];

// What the server sorts by for each metric (LeaderboardService): XP, coding
// challenges solved, or the longest streak. Weekly and monthly boards always
// rank XP earned in that window.
const METRICS = [
  { value: 'xp', label: 'XP', score: (r) => `${r.xp ?? 0} XP` },
  { value: 'challenges', label: 'Coding challenges', score: (r) => `${r.challengesSolved ?? 0} solved` },
  {
    value: 'streak',
    label: 'Best streak',
    score: (r) => {
      const days = Math.max(r.longestStreak ?? 0, r.currentStreak ?? 0);
      return `${days} day${days === 1 ? '' : 's'}`;
    },
  },
];

const initialsOf = (name = '') =>
  name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').toUpperCase().slice(0, 2) || '?';

const LeaderboardPage = () => {
  const { user } = useAuth();
  const { request } = useApiRequest();
  const [rows, setRows] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const [period, setPeriod] = useState('all_time');
  const [metric, setMetric] = useState('xp');
  const [grade, setGrade] = useState('');

  const effectiveMetric = period === 'all_time' ? metric : 'xp';
  const metricDef = METRICS.find((m) => m.value === effectiveMetric);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ period, metric: effectiveMetric, page: String(page), limit: String(LIMIT) });
        if (grade) params.set('grade', grade);
        const res = await request(`/api/v1/leaderboard?${params}`);
        if (!alive) return;
        // The list comes back at the top level ({ leaderboard, myRank,
        // totalStudents }), not under `data`.
        const body = res?.leaderboard ? res : (res?.data || {});
        setRows(Array.isArray(body.leaderboard) ? body.leaderboard : []);
        setMyRank(body.myRank ?? null);
        setTotal(body.totalStudents ?? 0);
      } catch (err) {
        if (alive) setError(err.message || 'Could not load the leaderboard.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [period, effectiveMetric, grade, page, request]);

  const changeFilter = (setter) => (value) => { setter(value); setPage(1); };

  const isMe = (row) => row.userId && user?._id && String(row.userId) === String(user._id);
  const meRow = rows.find(isMe);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const podium = page === 1 ? rows.slice(0, 3) : [];
  const rest = page === 1 ? rows.slice(3) : rows;
  const isStudent = user?.role === 'student';

  return (
    <div className="overview-container">
      <div className="ins-head">
        <div className="ins-head__text">
          <h1 className="page-title">Leaderboard</h1>
          <p className="page-subtitle">
            {period === 'all_time'
              ? 'Who has earned the most since they joined.'
              : `Who earned the most XP ${period === 'weekly' ? 'in the last 7 days' : 'in the last 30 days'}. A fresh start for everyone.`}
          </p>
        </div>
      </div>

      <div className="ins-toolbar">
        <div className="ins-seg" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.value} type="button" aria-pressed={period === p.value} onClick={() => changeFilter(setPeriod)(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="ins-seg" role="group" aria-label="Rank by">
          {METRICS.map((m) => (
            <button key={m.value} type="button" aria-pressed={effectiveMetric === m.value}
              disabled={period !== 'all_time' && m.value !== 'xp'}
              title={period !== 'all_time' && m.value !== 'xp' ? 'Weekly and monthly boards rank by XP' : undefined}
              onClick={() => changeFilter(setMetric)(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
        <select className="gm-input" style={{ width: 'auto', padding: '0.45rem 0.8rem', fontSize: '0.85rem', fontWeight: 700 }}
          value={grade} onChange={(e) => changeFilter(setGrade)(e.target.value)} aria-label="Grade">
          <option value="">All grades</option>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {error && <p style={{ color: 'var(--error)', margin: 0 }}>{error}</p>}

      {loading ? (
        <SkeletonCardGrid count={3} minWidth={200} gap="1rem" />
      ) : rows.length === 0 ? (
        <div className="ins-panel ins-empty">
          <i className="fa-solid fa-ranking-star" />
          <strong>No one on this board yet</strong>
          <p>
            {grade || period !== 'all_time'
              ? 'Try another period or grade.'
              : 'Students appear here as soon as they earn XP.'}
          </p>
        </div>
      ) : (
        <>
          {podium.length > 0 && (
            <div className="gm-podium" aria-label="Top three">
              {podium.map((row, i) => (
                <div key={row.studentProfileId || row.userId || i} className={`gm-podium__place is-${i + 1}${isMe(row) ? ' is-me' : ''}`}>
                  <span className="gm-podium__avatar" aria-hidden="true">
                    {i === 0 && <i className="fa-solid fa-crown" />}
                    {initialsOf(row.studentName)}
                  </span>
                  <span className="gm-podium__name">{row.studentName}</span>
                  <span className="gm-podium__sub">{row.grade || 'No grade'} · Level {row.level || 1}</span>
                  <div className="gm-podium__block">
                    <span className="gm-podium__rank">{row.rank ?? i + 1}</span>
                    <span className="gm-podium__score">{metricDef.score(row)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <section className="ins-panel" aria-label="Rankings">
              <ol className="gm-ranks">
                {rest.map((row, i) => {
                  const rank = row.rank ?? (page === 1 ? i + 4 : (page - 1) * LIMIT + i + 1);
                  return (
                    <li key={row.studentProfileId || row.userId || rank}>
                      <div className={`gm-rank${isMe(row) ? ' is-me' : ''}`}>
                        <span className="gm-rank__num">#{rank}</span>
                        <span className="gm-rank__who tone-student">
                          <span className="ins-avatar" aria-hidden="true">{initialsOf(row.studentName)}</span>
                          <span className="ins-person__text">
                            <strong>{row.studentName}{isMe(row) ? ' (you)' : ''}</strong>
                            <small>{row.grade || 'No grade'} · Level {row.level || 1}</small>
                          </span>
                        </span>
                        <span className="gm-rank__facts">
                          <span title="Current streak"><i className="fa-solid fa-fire" style={{ color: 'var(--gm-streak)' }} />{row.currentStreak || 0}</span>
                          <span title="Badges"><i className="fa-solid fa-medal" style={{ color: 'var(--gm-badge)' }} />{row.badgeCount ?? 0}</span>
                        </span>
                        <span className="gm-rank__score">{metricDef.score(row)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {totalPages > 1 && (
            <div className="gm-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="nb-btn nb-btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <i className="fa-solid fa-chevron-left" /> Previous
              </button>
              <span className="ins-count">Page {page} of {totalPages}</span>
              <button type="button" className="nb-btn nb-btn-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Where the signed-in student stands on this board. Sticky in the
          content column, so it never slides under the sidebar. */}
      {isStudent && !loading && (
        <div className="gm-me-bar">
          <div>
            <i className="fa-solid fa-location-crosshairs" style={{ fontSize: '1.3rem', color: 'var(--brand-primary)' }} aria-hidden="true" />
            {myRank ? (
              <span><strong>#{myRank}</strong> of {total} {total === 1 ? 'student' : 'students'}</span>
            ) : (
              <span>You are not on this board yet. Earn some XP to join it.</span>
            )}
          </div>
          {meRow && <span className="gm-rank__score">{metricDef.score(meRow)}</span>}
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;
