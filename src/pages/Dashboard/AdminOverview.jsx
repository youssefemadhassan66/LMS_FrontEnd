import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useFetchData from '../../hooks/useFetchData';
import { useAuth } from '../../context/AuthContext';
import NextSessionCountdown from '../../components/NextSessionCountdown/NextSessionCountdown';
import { SkeletonRow } from '../../components/Skeleton/Skeleton';
import CountUp from '../../components/Motion/CountUp';
import { timeAgo } from '../../utils/timeAgo';
import './DashboardOverview.css';
import './Insights.css';

// The list endpoints page (20 by default) and report no total, so counts
// taken from the first page stopped at 20. One generous page covers a
// school-sized platform.
const ALL = 'page=1&limit=1000';

const listFrom = (data, ...keys) => {
  if (Array.isArray(data)) return data;
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
  return [];
};

const ROLES = [
  { role: 'student', label: 'Students' },
  { role: 'instructor', label: 'Instructors' },
  { role: 'parent', label: 'Parents' },
  { role: 'admin', label: 'Admins' },
];

const initialsOf = (name = '') =>
  name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').toUpperCase().slice(0, 2) || '?';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const StatCard = ({ icon, tone, value, label, hint, suffix, loading }) => (
  <div className="stat-card">
    <div className="stat-icon is-toned" style={{ '--tone': tone }}>
      <i className={icon} />
    </div>
    <div className="stat-info">
      <h3>{loading ? '—' : <CountUp value={value} suffix={suffix} />}</h3>
      <p>{label}</p>
      {hint && <small>{hint}</small>}
    </div>
  </div>
);

const AdminOverview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.FullName?.split(' ')[0] || 'Admin';

  const { data: usersData, loading: usersLoading } = useFetchData(`/api/v1/user?${ALL}`);
  const { data: profilesData, loading: profilesLoading } = useFetchData('/api/v1/StudentProfile/all');
  const { data: sessionsData, loading: sessionsLoading } = useFetchData(`/api/v1/session?${ALL}`);
  const { data: tasksData, loading: tasksLoading } = useFetchData(`/api/v1/task?${ALL}`);
  const { data: submissionsData } = useFetchData(`/api/v1/submission?${ALL}`);
  const { data: approvalsData } = useFetchData('/api/v1/user/pending-approvals');

  const users = listFrom(usersData, 'users', 'docs');
  const profiles = listFrom(profilesData, 'profiles', 'docs');
  const sessions = listFrom(sessionsData, 'docs', 'sessions');
  const tasks = listFrom(tasksData, 'tasks', 'docs');
  const submissions = listFrom(submissionsData, 'submissions', 'docs');
  const approvals = listFrom(approvalsData, 'users');

  const countBy = (role) => users.filter((u) => u.role === role).length;
  const roleCounts = ROLES.map((entry) => ({ ...entry, count: countBy(entry.role) }));
  const students = roleCounts[0].count;

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const upcomingSessions = sessions
    .filter((s) => s.status === 'pending' && new Date(s.date) > now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const sessionsThisWeek = upcomingSessions.filter((s) => new Date(s.date) <= weekAhead).length;

  const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const ungraded = submissions.filter((s) => s.status !== 'Reviewed').length;

  const recentUsers = [...users]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  const openUser = (u) => {
    const profile = u.role === 'student'
      ? profiles.find((p) => (p.user?._id || p.user) === u._id)
      : null;
    navigate(profile ? `/dashboard/child/${profile._id}` : '/dashboard/users');
  };

  return (
    <div className="overview-container">
      <div className="ins-head">
        <div className="ins-head__text">
          <h1 className="page-title">{greeting()}, {firstName}</h1>
          <p className="page-subtitle">
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            {' · '}Here is how AlgoGambit is doing today.
          </p>
        </div>
        <button className="nb-btn nb-btn-primary" onClick={() => navigate('/dashboard/users')}>
          <i className="fa-solid fa-user-plus" style={{ marginRight: '0.4rem' }} />
          Add user
        </button>
      </div>

      {/* Where an admin goes most, with a count when something is waiting. */}
      <nav className="quick-actions" aria-label="Shortcuts">
        <Link to="/dashboard/users" className="quick-action">
          <span className="quick-action__icon" style={{ background: 'var(--data-tasks)' }}><i className="fa-solid fa-users" /></span>
          <span className="quick-action__text">
            <strong>People</strong>
            <small>{approvals.length ? `${approvals.length} to approve` : 'Add and edit accounts'}</small>
          </span>
          {approvals.length > 0 && <span className="quick-action__count" aria-label={`${approvals.length} waiting`}>{approvals.length}</span>}
        </Link>
        <Link to="/dashboard/sessions" className="quick-action">
          <span className="quick-action__icon" style={{ background: 'var(--data-attendance)' }}><i className="fa-solid fa-calendar-days" /></span>
          <span className="quick-action__text">
            <strong>Sessions</strong>
            <small>{sessionsThisWeek ? `${sessionsThisWeek} this week` : 'Plan and run classes'}</small>
          </span>
        </Link>
        <Link to="/dashboard/submissions" className="quick-action">
          <span className="quick-action__icon" style={{ background: 'var(--data-review)' }}><i className="fa-solid fa-inbox" /></span>
          <span className="quick-action__text">
            <strong>Submissions</strong>
            <small>{ungraded ? `${ungraded} to grade` : 'Nothing to grade'}</small>
          </span>
          {ungraded > 0 && <span className="quick-action__count" aria-label={`${ungraded} to grade`}>{ungraded}</span>}
        </Link>
        <Link to="/dashboard/progress" className="quick-action">
          <span className="quick-action__icon" style={{ background: 'var(--data-score)' }}><i className="fa-solid fa-chart-line" /></span>
          <span className="quick-action__text">
            <strong>Progress reports</strong>
            <small>Student by student</small>
          </span>
        </Link>
      </nav>

      {upcomingSessions.length > 0 && (
        <NextSessionCountdown session={upcomingSessions[0]} role="admin" />
      )}

      <div className="stats-grid">
        <StatCard icon="fa-solid fa-graduation-cap" tone="var(--data-exams)" value={students} label="Students"
          hint={`${users.length} accounts in all`} loading={usersLoading} />
        <StatCard icon="fa-solid fa-calendar-check" tone="var(--data-attendance)" value={upcomingSessions.length} label="Sessions ahead"
          hint={`${sessionsThisWeek} this week`} loading={sessionsLoading} />
        <StatCard icon="fa-solid fa-hourglass-half" tone="var(--data-review)" value={pendingTasks} label="Open tasks"
          hint={`${tasks.length} set in all`} loading={tasksLoading} />
        <StatCard icon="fa-solid fa-circle-check" tone="var(--data-tasks)" value={completionRate} label="Tasks completed"
          suffix="%" hint={`${completedTasks} of ${tasks.length}`} loading={tasksLoading} />
      </div>

      <details className="more-stats">
        <summary>More numbers</summary>
        <div className="stats-grid">
          <StatCard icon="fa-solid fa-chalkboard-user" tone="var(--data-tasks)" value={countBy('instructor')} label="Instructors" loading={usersLoading} />
          <StatCard icon="fa-solid fa-people-roof" tone="var(--data-score)" value={countBy('parent')} label="Parents" loading={usersLoading} />
          <StatCard icon="fa-solid fa-id-card" tone="var(--data-exams)" value={profiles.length} label="Student profiles" loading={profilesLoading} />
          <StatCard icon="fa-solid fa-calendar-days" tone="var(--data-attendance)" value={sessions.length} label="Sessions in all" loading={sessionsLoading} />
        </div>
      </details>

      <div className="ins-main">
        <section className="ins-panel" aria-labelledby="recent-users">
          <div className="ins-panel__head">
            <h2 id="recent-users"><i className="fa-solid fa-user-clock" />Newest accounts</h2>
            <Link to="/dashboard/users" className="ins-link">All users <i className="fa-solid fa-arrow-right" /></Link>
          </div>

          {usersLoading ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={3} />)}
            </div>
          ) : recentUsers.length === 0 ? (
            <div className="ins-empty">
              <i className="fa-solid fa-user-plus" />
              <strong>No accounts yet</strong>
              <p>People you add or who sign up show here.</p>
            </div>
          ) : (
            <ul className="ins-people">
              {recentUsers.map((u) => (
                <li key={u._id}>
                  <button type="button" className={`ins-person tone-${u.role}`} onClick={() => openUser(u)}>
                    <span className="ins-avatar" aria-hidden="true">{initialsOf(u.FullName)}</span>
                    <span className="ins-person__text">
                      <strong>{u.FullName}</strong>
                      <small>{u.Email}</small>
                    </span>
                    <span className="ins-person__when" title={u.createdAt ? new Date(u.createdAt).toLocaleString() : undefined}>
                      {timeAgo(u.createdAt)}
                    </span>
                    <span className="ins-chip">{u.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ins-panel" aria-labelledby="platform-health" style={{ '--tone': 'var(--data-tasks)' }}>
          <div className="ins-panel__head">
            <h2 id="platform-health"><i className="fa-solid fa-heart-pulse" />Platform health</h2>
          </div>

          {/* Progress, not a fault: a low share mid-term is normal, so the
              bar stays in the brand colour and only turns green near done. */}
          <div className="ins-figure">
            <span>Tasks completed</span>
            <strong>{tasksLoading ? '—' : `${completionRate}%`}</strong>
          </div>
          <div className="ins-bar" style={{ '--tone': completionRate >= 75 ? 'var(--success)' : 'var(--data-tasks)' }}>
            <span style={{ width: `${completionRate}%` }} />
          </div>
          <div className="ins-figure-foot">
            <span>{completedTasks} done</span>
            <span>{pendingTasks} open</span>
          </div>

          <hr className="ins-divider" />

          <div className="ins-figure">
            <span>Who uses AlgoGambit</span>
            <strong>{usersLoading ? '—' : users.length}</strong>
          </div>
          <div className="ins-mix" role="img"
            aria-label={roleCounts.map((r) => `${r.count} ${r.label.toLowerCase()}`).join(', ')}>
            {roleCounts.filter((r) => r.count > 0).map((r) => (
              <span key={r.role} className={`tone-${r.role}`} style={{ flexGrow: r.count }} title={`${r.label}: ${r.count}`} />
            ))}
          </div>
          <ul className="ins-legend">
            {roleCounts.map((r) => (
              <li key={r.role} className={`tone-${r.role}`}>
                {r.label}
                <strong>{usersLoading ? '—' : r.count}</strong>
              </li>
            ))}
          </ul>

          <hr className="ins-divider" />

          <Link to="/dashboard/audit-logs" className="ins-link">
            <i className="fa-solid fa-shield-halved" /> Review recent sign-ins in the audit log
          </Link>
        </section>
      </div>
    </div>
  );
};

export default AdminOverview;
