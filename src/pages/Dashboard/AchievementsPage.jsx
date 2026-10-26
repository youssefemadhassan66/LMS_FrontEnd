import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApiRequest } from '../../hooks/useApiRequest';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import Pagination from '../../components/Pagination/Pagination';
import { SkeletonStatsGrid } from '../../components/Skeleton/Skeleton';
import { timeAgo } from '../../utils/timeAgo';
import { xpReason } from '../../components/Gamification/xpReasons';
import './DashboardOverview.css';
import './Insights.css';
import './Gamification.css';

const XP_PER_LEVEL = 100;

const STATS = [
  { key: 'tasksSubmitted', label: 'Tasks handed in', icon: 'fa-solid fa-paper-plane', tone: 'var(--data-tasks)' },
  { key: 'tasksOnTime', label: 'On time', icon: 'fa-solid fa-clock', tone: 'var(--data-ontime)' },
  { key: 'perfectScores', label: 'Perfect scores', icon: 'fa-solid fa-star', tone: 'var(--data-review)' },
  { key: 'sessionsAttended', label: 'Classes attended', icon: 'fa-solid fa-calendar-check', tone: 'var(--data-attendance)' },
  { key: 'puzzlesSolved', label: 'Puzzles solved', icon: 'fa-solid fa-puzzle-piece', tone: 'var(--data-score)' },
  { key: 'challengesSolved', label: 'Coding challenges', icon: 'fa-solid fa-code', tone: 'var(--data-score)' },
  { key: 'examsAbovePassing', label: 'Exams passed', icon: 'fa-solid fa-graduation-cap', tone: 'var(--data-exams)' },
];

const listFromEnvelope = (payload, key) => {
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload)) return payload;
  return [];
};

const AchievementsPage = () => {
  const { request } = useApiRequest();
  const { socket } = useSocket();
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalHistory, setTotalHistory] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfileAndBadges = useCallback(async () => {
    const [profRes, badgeRes] = await Promise.all([
      request('/api/v1/gamification/me'),
      request('/api/v1/gamification/me/badges'),
    ]);
    if (profRes.status === 'success') setProfile(profRes.data);
    if (badgeRes.status === 'success') setBadges(listFromEnvelope(badgeRes.data, 'badges'));
  }, [request]);

  const fetchHistory = useCallback(async () => {
    const res = await request(`/api/v1/gamification/me/history?page=${page}&limit=${limit}`);
    if (res.status === 'success') {
      const feed = Array.isArray(res.data) ? res.data : [];
      const total = res.total ?? res.results ?? feed.length;
      const pageSize = res.limit ?? limit;
      setHistory(feed);
      setTotalPages(res.totalPages || Math.max(1, Math.ceil(total / pageSize)));
      setTotalHistory(total);
    }
  }, [request, page, limit]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([fetchProfileAndBadges(), fetchHistory()]);
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load achievements.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch the feed when page / limit changes
  useEffect(() => {
    fetchHistory().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  // Live updates via socket
  useEffect(() => {
    if (!socket) return;

    const onXp = (data) => {
      setProfile((prev) => (prev ? { ...prev, xp: data.totalXP, level: data.level } : prev));
      // Prepend to the feed only on the first page to keep ordering sane
      setHistory((prev) => {
        if (page !== 1) return prev;
        return [{
          amount: data.amount,
          reason: data.reason,
          awardedAt: new Date().toISOString(),
          _id: `live-${Date.now()}`,
        }, ...prev].slice(0, limit);
      });
    };

    const onBadge = (data) => {
      setProfile((prev) => (prev ? { ...prev, badgeCount: (prev.badgeCount || 0) + 1 } : prev));
      setBadges((prev) => [{
        _id: `live-${Date.now()}`,
        unlockedAt: new Date().toISOString(),
        badge: {
          name: data.name,
          icon: data.icon,
          rarity: data.rarity,
          xpReward: data.xpReward,
          description: 'Newly unlocked!',
        },
      }, ...prev]);
    };

    socket.on('xp:earned', onXp);
    socket.on('badge:unlocked', onBadge);
    return () => {
      socket.off('xp:earned', onXp);
      socket.off('badge:unlocked', onBadge);
    };
  }, [socket, page, limit]);

  if (loading) {
    return (
      <div className="overview-container">
        <h1 className="page-title">My achievements</h1>
        <p className="page-subtitle">Loading your level, badges and XP…</p>
        <SkeletonStatsGrid count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="overview-container">
        <h1 className="page-title">My achievements</h1>
        <div className="ins-panel ins-empty">
          <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--error)' }} />
          <strong>Could not load your achievements</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const xp = profile?.xp ?? 0;
  const xpInLevel = xp % XP_PER_LEVEL;
  const toNext = profile?.xpToNextLevel ?? XP_PER_LEVEL - xpInLevel;
  const stats = profile?.stats || {};
  const streak = profile?.currentStreak ?? 0;
  // The record is only written when a streak ends, so a streak still running
  // can be longer than it.
  const best = Math.max(profile?.longestStreak ?? 0, streak);
  const firstName = (user?.FullName || '').split(/\s+/)[0];

  return (
    <div className="overview-container">
      <div className="ins-head">
        <div className="ins-head__text">
          <h1 className="page-title">My achievements</h1>
          <p className="page-subtitle">Your level, your badges and every bit of XP you have earned.</p>
        </div>
        <Link to="/dashboard/challenges" className="nb-btn nb-btn-primary">
          <i className="fa-solid fa-puzzle-piece" style={{ marginRight: '0.4rem' }} />
          Earn more XP
        </Link>
      </div>

      {profile && (
        <section className="gm-hero" aria-label="Your level">
          <div className="gm-ring" style={{ '--pct': xpInLevel }} role="img"
            aria-label={`Level ${profile.level}, ${xpInLevel} of ${XP_PER_LEVEL} XP towards the next level`}>
            <strong>{profile.level}</strong>
            <span>Level</span>
          </div>
          <div className="gm-hero__main">
            <h2>{toNext} XP to level {profile.level + 1}{firstName ? `, ${firstName}` : ''}</h2>
            <p>{xp > 0 ? `${xp} XP earned so far. Keep going!` : 'Hand in a task or solve a puzzle to earn your first XP.'}</p>
            <div className="gm-hero__bar"><span style={{ width: `${Math.min(100, xpInLevel)}%` }} /></div>
            <ul className="gm-hero__facts">
              <li style={{ '--tone': 'var(--gm-streak)' }}>
                <i className="fa-solid fa-fire" />
                <span><strong>{streak} day{streak === 1 ? '' : 's'}</strong> streak</span>
              </li>
              <li style={{ '--tone': 'var(--gm-gold)' }}>
                <i className="fa-solid fa-crown" />
                <span>Best <strong>{best} day{best === 1 ? '' : 's'}</strong></span>
              </li>
              <li style={{ '--tone': 'var(--gm-badge)' }}>
                <i className="fa-solid fa-medal" />
                <span><strong>{badges.length}</strong> badge{badges.length === 1 ? '' : 's'}</span>
              </li>
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="stats-title" style={{ display: 'grid', gap: '0.85rem' }}>
        <h2 id="stats-title" className="ins-section-title"><i className="fa-solid fa-chart-simple" /> What you have done</h2>
        <div className="gm-stats">
          {STATS.map((s) => {
            const value = stats[s.key] ?? 0;
            return (
              <div key={s.key} className={`gm-stat${value ? '' : ' is-zero'}`} style={{ '--tone': s.tone }}>
                <i className={s.icon} />
                <div><strong>{value}</strong><span>{s.label}</span></div>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="badges-title" style={{ display: 'grid', gap: '0.85rem' }}>
        <h2 id="badges-title" className="ins-section-title"><i className="fa-solid fa-medal" /> Badges</h2>
        {badges.length === 0 ? (
          <div className="ins-panel ins-empty">
            <i className="fa-solid fa-medal" />
            <strong>Your first badge is waiting</strong>
            <p>Hand in tasks, come to class and solve challenges to unlock badges.</p>
          </div>
        ) : (
          <div className="gm-badges">
            {badges.map((entry, i) => {
              const b = entry.badge || {};
              const rarity = (b.rarity || 'common').toLowerCase();
              return (
                <div key={entry._id || `${b.name}-${i}`} className={`gm-badge gm-rarity-${rarity}`}
                  title={entry.unlockedAt ? `Unlocked ${new Date(entry.unlockedAt).toLocaleDateString()}` : undefined}>
                  <span className="gm-badge__icon" aria-hidden="true">{b.icon || '🏅'}</span>
                  <strong>{b.name}</strong>
                  {b.description && <small>{b.description}</small>}
                  <span className="gm-chip" style={{ marginTop: '0.35rem', textTransform: 'capitalize' }}>{rarity}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="ins-panel" aria-labelledby="feed-title">
        <div className="ins-panel__head">
          <h2 id="feed-title" style={{ '--tone': 'var(--gm-streak)' }}><i className="fa-solid fa-bolt" />Recent XP</h2>
          {totalHistory > 0 && <span className="ins-panel__meta">{totalHistory} award{totalHistory === 1 ? '' : 's'}</span>}
        </div>
        {history.length === 0 ? (
          <div className="ins-empty">
            <i className="fa-solid fa-bolt" />
            <p>No XP yet. Every task, class and challenge adds to this list.</p>
          </div>
        ) : (
          <>
            <ul className="gm-feed">
              {history.map((item, i) => {
                const r = xpReason(item.reason);
                return (
                  <li key={item._id || `${item.awardedAt}-${item.reason}-${i}`}>
                    <span className="gm-feed__icon" style={{ '--tone': r.tone }}><i className={r.icon} /></span>
                    <span className="gm-feed__text">
                      <strong>{r.label}</strong>
                      <small title={item.awardedAt ? new Date(item.awardedAt).toLocaleString() : undefined}>{timeAgo(item.awardedAt)}</small>
                    </span>
                    <span className="gm-feed__xp">+{item.amount} XP</span>
                  </li>
                );
              })}
            </ul>
            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                total={totalHistory}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(n) => { setLimit(n); setPage(1); }}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default AchievementsPage;
