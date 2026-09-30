import React, { useState, useEffect } from 'react';
import { useApiRequest } from '../../hooks/useApiRequest';
import { useAuth } from '../../context/AuthContext';

const LeaderboardPage = () => {
  const { user } = useAuth();
  const { request } = useApiRequest();
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [period, setPeriod] = useState('all-time'); // weekly, monthly, all-time
  const [metric, setMetric] = useState('xp'); // xp, challenges, streak
  const [grade, setGrade] = useState(''); // Grade 6, Grade 8, etc.

  const limit = 10;
  const apiPeriod = period === 'all-time' ? 'all_time' : period;

  const fetchLeaderboard = React.useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        period: apiPeriod,
        metric,
        page: page.toString(),
        limit: limit.toString()
      });
      if (grade) {
        queryParams.append('grade', grade);
      }

      const res = await request(`/api/v1/leaderboard?${queryParams.toString()}`);
      if (res.status === 'success' && res.data) {
        const rows = (res.data.leaderboard || []).map((student) => ({
          ...student,
          earnedXP: student.earnedXP ?? student.xp ?? 0,
          badgesCount: student.badgesCount ?? student.badgeCount ?? 0,
        }));
        setLeaderboard(rows);
        // Calculate total pages
        const total = res.totalStudents || 0;
        setTotalPages(Math.ceil(total / limit) || 1);
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, [apiPeriod, metric, grade, page, request]);

  const fetchMyRank = React.useCallback(async () => {
    if (user?.role !== 'student') return;
    try {
      const res = await request(`/api/v1/leaderboard/my-rank?period=${apiPeriod}&metric=${metric}`);
      if (res.status === 'success') {
        const rankData = res.data || {};
        const score = metric === 'xp'
          ? rankData.score ?? rankData.earnedXP ?? rankData.xp ?? 0
          : metric === 'challenges'
            ? rankData.score ?? rankData.challengesSolved ?? 0
            : rankData.score ?? rankData.currentStreak ?? rankData.longestStreak ?? 0;
        setMyRank({ ...rankData, score });
      }
    } catch {
      // Silently fail if student doesn't have a rank yet
      setMyRank(null);
    }
  }, [apiPeriod, metric, user, request]);

  useEffect(() => {
    fetchLeaderboard();
    fetchMyRank();
  }, [fetchLeaderboard, fetchMyRank]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setPage(1);
  }, [period, metric, grade]);

  // Extract top 3 for the podium
  const topThree = leaderboard.slice(0, 3);
  const remainingStudents = leaderboard.slice(3);

  // Map 1st, 2nd, 3rd to podium order (2nd on left, 1st center, 3rd right)
  const podiumOrder = [];
  if (topThree[1]) podiumOrder.push({ ...topThree[1], displayRank: 2 });
  if (topThree[0]) podiumOrder.push({ ...topThree[0], displayRank: 1 });
  if (topThree[2]) podiumOrder.push({ ...topThree[2], displayRank: 3 });

  const getMetricLabel = () => {
    if (metric === 'xp') return 'XP';
    if (metric === 'challenges') return 'Puzzles';
    return 'Days';
  };

  const _getMetricValue = (item) => {
    if (metric === 'xp') return `${item.score ?? item.earnedXP ?? item.xp ?? 0} XP`;
    if (metric === 'challenges') return `${item.score ?? item.challengesSolved ?? 0} Puzzles`;
    return `🔥 ${item.currentStreak || 0} Days`;
  };

  const getLeaderboardMetricValue = (item) => {
    if (metric === 'xp') return `${item.score ?? item.earnedXP ?? item.xp ?? 0} XP`;
    if (metric === 'challenges') return `${item.score ?? item.challengesSolved ?? 0} Puzzles`;
    return `${item.score ?? item.currentStreak ?? item.longestStreak ?? 0} Days`;
  };

  return (
    <div style={{ paddingBottom: '20px', position: 'relative' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">
          <i className="fa-solid fa-trophy" aria-hidden="true" style={{ color: 'var(--warning)', marginRight: '0.6rem' }} />
          Leaderboard
        </h1>
        <p className="page-subtitle">Compete with your peers, solve coding challenges, and earn XP to rise to the top!</p>
      </div>

      {/* ⚡ Filters Panel */}
      <div className="glass-panel" style={{
        padding: '1.25rem',
        marginBottom: '2rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5rem',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Metric Scope */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            {['all-time', 'monthly', 'weekly'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '0.5rem 1rem',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                  background: period === p ? 'var(--brand-primary)' : 'var(--card-bg)',
                  color: period === p ? '#FFFFFF' : 'var(--text-primary)',
                  borderRight: p !== 'weekly' ? '2px solid var(--border-color)' : 'none',
                  cursor: 'pointer'
                }}
              >
                {p.replace('-', ' ')}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            {['xp', 'challenges', 'streak'].map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                style={{
                  padding: '0.5rem 1rem',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                  background: metric === m ? 'var(--success)' : 'var(--card-bg)',
                  color: metric === m ? 'var(--text-primary)' : 'var(--text-primary)',
                  borderRight: m !== 'streak' ? '2px solid var(--border-color)' : 'none',
                  cursor: 'pointer'
                }}
              >
                {m === 'xp' ? 'XP' : m === 'challenges' ? 'Challenges' : 'Streaks'}
              </button>
            ))}
          </div>
        </div>

        {/* Grade Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Filter Grade:</label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            style={{
              padding: '0.45rem 1rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              border: '2px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="">All Grades</option>
            <option value="Grade 5">Grade 5</option>
            <option value="Grade 6">Grade 6</option>
            <option value="Grade 7">Grade 7</option>
            <option value="Grade 8">Grade 8</option>
            <option value="Grade 9">Grade 9</option>
            <option value="Grade 10">Grade 10</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-muted)' }}>Loading Rankings...</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <i className="fa-solid fa-ranking-star" aria-hidden="true" style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
          <p style={{ fontWeight: 700, margin: '0 0 0.25rem' }}>No rankings yet</p>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Try another period or grade, or check back once students have earned XP.</p>
        </div>
      ) : (
        <>
          {/* 🏅 Olympic Podium Layout */}
          {page === 1 && topThree.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
              gap: '1.5rem',
              marginBottom: '3rem',
              marginTop: '1.5rem',
              flexWrap: 'wrap'
            }}>
              {podiumOrder.map((student) => {
                const isFirst = student.displayRank === 1;
                const isSecond = student.displayRank === 2;
                
                // Color themes
                const podiumColor = isFirst ? '#FCD34D' : isSecond ? '#E2E8F0' : '#FDBA74';
                const textColor = '#1C1917';
                const height = isFirst ? '200px' : isSecond ? '160px' : '130px';

                return (
                  <div
                    key={student.studentName}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      width: '180px'
                    }}
                  >
                    {/* Avatar Bubble */}
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'var(--card-bg)',
                      border: '3px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.5rem',
                      marginBottom: '0.75rem',
                      position: 'relative'
                    }}>
                      {student.studentName.slice(0, 2).toUpperCase()}
                      <span style={{
                        position: 'absolute',
                        top: '-10px',
                        right: '-5px',
                        fontSize: '1.2rem'
                      }}>
                        {isFirst ? '👑' : student.displayRank === 2 ? '🥈' : '🥉'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.15rem', textAlign: 'center', fontFamily: 'var(--font-heading)' }}>
                      {student.studentName}
                    </h4>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, margin: '0 0 0.5rem' }}>
                      {student.grade || 'No Grade'} • LVL {student.level || 1}
                    </p>

                    {/* Pedestal Block */}
                    <div style={{
                      width: '100%',
                      height: height,
                      background: podiumColor,
                      color: textColor,
                      border: '3px solid var(--border-color)',
                      boxShadow: 'var(--shadow-md)',
                      borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '1rem',
                      textAlign: 'center'
                    }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-heading)' }}>
                        {student.displayRank}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>
                        {getLeaderboardMetricValue(student)}
                      </span>
                      <span style={{ fontSize: '0.68rem', opacity: 0.8, fontWeight: 700, marginTop: '4px' }}>
                        <i className="fa-solid fa-medal" aria-hidden="true" /> {student.badgesCount || 0} Badges
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 📊 Ranking Table */}
          <div className="glass-panel" style={{ overflow: 'hidden', marginBottom: '2rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
              <thead>
                <tr style={{ borderBottom: '3px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Rank</th>
                  <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Student</th>
                  <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Grade</th>
                  <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Level</th>
                  <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>Streak</th>
                  <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>Badges</th>
                  <th style={{ padding: '1rem', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right' }}>{getMetricLabel()}</th>
                </tr>
              </thead>
              <tbody>
                {(page === 1 ? remainingStudents : leaderboard).map((student, idx) => {
                  const actualRank = page === 1 ? idx + 4 : (page - 1) * limit + idx + 1;
                  return (
                    <tr
                      key={student.studentName + '-' + actualRank}
                      style={{
                        borderBottom: '2px solid var(--border-color)',
                        background: user?.FullName === student.studentName ? 'var(--brand-light)' : 'transparent',
                        transition: 'background 0.1s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = user?.FullName === student.studentName ? 'var(--brand-light)' : 'transparent'; }}
                    >
                      <td style={{ padding: '1rem', fontWeight: 800 }}>#{actualRank}</td>
                      <td style={{ padding: '1rem', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: 'var(--accent-orange)', border: '2px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 800
                          }}>
                            {student.studentName.slice(0, 2).toUpperCase()}
                          </div>
                          {student.studentName}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{student.grade || '—'}</td>
                      <td style={{ padding: '1rem' }}>
                        <span className="nb-badge nb-badge-orange">LVL {student.level || 1}</span>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 700, textAlign: 'right' }}>🔥 {student.currentStreak || 0}</td>
                      <td style={{ padding: '1rem', fontWeight: 700, textAlign: 'right' }}>🎖️ {student.badgesCount || 0}</td>
                      <td style={{ padding: '1rem', fontWeight: 800, textAlign: 'right', color: 'var(--brand-primary)' }}>
                        {getLeaderboardMetricValue(student)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="nb-btn nb-btn-secondary"
                style={{ opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                ◀ Prev
              </button>
              <span style={{ alignSelf: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="nb-btn nb-btn-secondary"
                style={{ opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next ▶
              </button>
            </div>
          )}
        </>
      )}

      {/* 📌 Sticky User Rank Bar (Students only) */}
      {user?.role === 'student' && myRank && (
        // Sticky inside the content column rather than fixed to the window:
        // the fixed version assumed a 260px sidebar and slid underneath it
        // (and under the collapsed one), covering Log out.
        <div style={{
          position: 'sticky',
          bottom: '1rem',
          marginTop: '1.5rem',
          background: 'var(--card-bg)',
          border: 'var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'var(--shadow-sm)',
          zIndex: 20,
          fontFamily: 'var(--font-body)'
        }}
        className="sticky-rank-bar"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <i className="fa-solid fa-bullseye" aria-hidden="true" style={{ fontSize: '1.4rem', color: 'var(--brand-primary)' }} />
            <div>
              <p style={{ margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>Your Rank</p>
              <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>#{myRank.rank || '—'}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>Score ({getMetricLabel()})</p>
            <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--brand-primary)' }}>
              {metric === 'xp' ? `${myRank.score || 0} XP` : metric === 'challenges' ? `${myRank.score || 0} Puzzles` : `🔥 ${myRank.score || 0} Days`}
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

export default LeaderboardPage;
