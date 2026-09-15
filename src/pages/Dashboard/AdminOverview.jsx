import { useNavigate } from 'react-router-dom';
import React from 'react';
import useFetchData from '../../hooks/useFetchData';
import { useAuth } from '../../context/AuthContext';
import NextSessionCountdown from '../../components/NextSessionCountdown/NextSessionCountdown';
import { SkeletonStatsGrid, SkeletonRow } from '../../components/Skeleton/Skeleton';
import './DashboardOverview.css';

/* ── Role badge ── */
const RoleBadge = ({ role }) => {
  const cfg = {
    admin:      { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444',  label: 'Admin' },
    instructor: { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6',  label: 'Instructor' },
    student:    { bg: 'rgba(16,185,129,0.12)',  color: '#10b981',  label: 'Student' },
    parent:     { bg: 'rgba(139,92,246,0.12)',  color: '#8b5cf6',  label: 'Parent' },
  };
  const c = cfg[role] || cfg.student;
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.2rem 0.65rem',
      borderRadius: 'var(--radius-sm)',
      background: c.bg,
      color: c.color,
      fontWeight: 700,
      fontSize: '0.72rem',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      border: `1px solid ${c.color}33`,
    }}>{c.label}</span>
  );
};

/* ── Stat card ── */
const StatCard = ({ icon, iconBg, iconColor, value, label, loading, accent }) => (
  <div className="stat-card" style={{ borderTop: `4px solid ${accent || 'var(--brand-primary)'}` }}>
    <div className="stat-icon" style={{ background: iconBg, color: iconColor || 'var(--text-primary)' }}>
      <i className={icon} />
    </div>
    <div className="stat-info">
      <h3>{loading ? <span style={{ opacity: 0.4 }}>—</span> : value}</h3>
      <p>{label}</p>
    </div>
  </div>
);

/* ── Quick action item ── */
const ActionItem = ({ icon, title, desc, onClick, accent }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '1rem 1.25rem',
      background: 'var(--card-bg)',
      border: '2px solid var(--border-color)',
      borderLeft: `5px solid ${accent}`,
      borderRadius: 'var(--radius-sm)',
      boxShadow: '3px 3px 0 var(--shadow-color)',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-2px,-2px)'; e.currentTarget.style.boxShadow = '5px 5px 0 var(--shadow-color)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '3px 3px 0 var(--shadow-color)'; }}
  >
    <div style={{
      width: 40, height: 40, borderRadius: 'var(--radius-sm)',
      background: `${accent}18`, color: accent,
      border: `2px solid ${accent}33`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1rem', flexShrink: 0,
    }}>
      <i className={icon} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{desc}</div>
    </div>
    <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }} />
  </div>
);

const AdminOverview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const adminName = user?.FullName?.split(' ')[0] || 'Admin';

  const { data: usersData,    loading: usersLoading }    = useFetchData('/api/v1/user');
  const { data: profilesData, loading: profilesLoading } = useFetchData('/api/v1/StudentProfile/all');
  const { data: sessionsData, loading: sessionsLoading } = useFetchData('/api/v1/session');
  const { data: tasksData,    loading: tasksLoading }    = useFetchData('/api/v1/task');

  const users    = Array.isArray(usersData)    ? usersData    : (usersData?.docs    || usersData?.users    || []);
  const profiles = Array.isArray(profilesData) ? profilesData : (profilesData?.docs || profilesData?.profiles || []);
  const sessions = Array.isArray(sessionsData) ? sessionsData : (sessionsData?.docs || sessionsData?.sessions || []);
  const tasks    = Array.isArray(tasksData)    ? tasksData    : (tasksData?.docs    || tasksData?.tasks    || []);

  const students    = users.filter(u => u.role === 'student');
  const instructors = users.filter(u => u.role === 'instructor');
  const parents     = users.filter(u => u.role === 'parent');

  const upcomingSessions = sessions
    .filter(s => s.status === 'pending' && new Date(s.date) > new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const pendingTasks    = tasks.filter(t => t.status === 'pending').length;
  const completedTasks  = tasks.filter(t => t.status === 'completed').length;
  const completionRate  = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  /* Recent users — last 6 */
  const recentUsers = [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

  return (
    <div className="overview-container">

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">
            Admin Panel
            <i className="fa-solid fa-shield-halved" style={{ color: 'var(--brand-primary)', fontSize: '1.6rem', marginLeft: '0.5rem', verticalAlign: 'middle' }} />
          </h1>
          <p className="page-subtitle">Welcome back, {adminName}. Here's your platform at a glance.</p>
        </div>
        <button
          className="nb-btn nb-btn-primary"
          onClick={() => navigate('/dashboard/users')}
          style={{ alignSelf: 'flex-start' }}
        >
          <i className="fa-solid fa-user-plus" style={{ marginRight: '0.4rem' }} />
          Add User
        </button>
      </div>

      {/* ── Next session countdown ── */}
      {upcomingSessions.length > 0 && (
        <NextSessionCountdown session={upcomingSessions[0]} role="admin" />
      )}

      {/* ── Stats row 1 — Users ── */}
      <div className="stats-grid">
        <StatCard icon="fa-solid fa-users"          iconBg="rgba(99,102,241,0.12)"  iconColor="#6366f1" value={users.length}       label="Total Users"   loading={usersLoading}    accent="#6366f1" />
        <StatCard icon="fa-solid fa-graduation-cap" iconBg="rgba(16,185,129,0.12)"  iconColor="#10b981" value={students.length}    label="Students"      loading={usersLoading}    accent="#10b981" />
        <StatCard icon="fa-solid fa-chalkboard-user"iconBg="rgba(59,130,246,0.12)"  iconColor="#3b82f6" value={instructors.length} label="Instructors"   loading={usersLoading}    accent="#3b82f6" />
        <StatCard icon="fa-solid fa-people-roof"    iconBg="rgba(139,92,246,0.12)"  iconColor="#8b5cf6" value={parents.length}     label="Parents"       loading={usersLoading}    accent="#8b5cf6" />
      </div>

      {/* ── Stats row 2 — Platform ── */}
      <div className="stats-grid">
        <StatCard icon="fa-solid fa-id-card"        iconBg="rgba(245,158,11,0.12)"  iconColor="#f59e0b" value={profiles.length}    label="Student Profiles" loading={profilesLoading} accent="#f59e0b" />
        <StatCard icon="fa-solid fa-calendar-days"  iconBg="rgba(59,130,246,0.12)"  iconColor="#3b82f6" value={sessions.length}    label="Total Sessions"   loading={sessionsLoading} accent="#3b82f6" />
        <StatCard icon="fa-solid fa-list-check"     iconBg="rgba(16,185,129,0.12)"  iconColor="#10b981" value={completedTasks}     label="Completed Tasks"  loading={tasksLoading}    accent="#10b981" />
        <StatCard icon="fa-solid fa-hourglass-half" iconBg="rgba(245,158,11,0.12)"  iconColor="#f59e0b" value={pendingTasks}       label="Pending Tasks"    loading={tasksLoading}    accent="#f59e0b" />
      </div>

      {/* ── Task completion bar ── */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>
            <i className="fa-solid fa-chart-line" style={{ color: '#10b981', marginRight: '0.5rem' }} />
            Platform Task Completion
          </h2>
          <span style={{
            padding: '0.2rem 0.7rem',
            background: completionRate >= 75 ? 'rgba(16,185,129,0.12)' : completionRate >= 40 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
            color: completionRate >= 75 ? '#10b981' : completionRate >= 40 ? '#f59e0b' : '#ef4444',
            border: '2px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            fontWeight: 800,
          }}>{completionRate}%</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{
            width: `${completionRate}%`,
            background: completionRate >= 75 ? '#10b981' : completionRate >= 40 ? '#f59e0b' : '#ef4444',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          <span>{completedTasks} completed</span>
          <span>{pendingTasks} pending</span>
        </div>
      </div>

      {/* ── Main row ── */}
      <div className="dashboard-main-row">

        {/* ── Recent Users ── */}
        <div className="courses-section">
          <div className="section-header">
            <h2>Recent Users</h2>
            <button
              onClick={() => navigate('/dashboard/users')}
              className="view-all-btn"
            >
              View All <i className="fa-solid fa-arrow-right" style={{ marginLeft: '0.25rem' }} />
            </button>
          </div>

          {usersLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={3} />)}
            </div>
          ) : recentUsers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No users yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentUsers.map(u => {
                const initials = (u.FullName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                const isStudent = u.role === 'student';
                const profile = isStudent ? profiles.find(p => (p.user?._id || p.user) === u._id) : null;

                return (
                  <div
                    key={u._id}
                    onClick={() => profile ? navigate(`/dashboard/child/${profile._id}`) : navigate('/dashboard/users')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-tertiary)',
                      border: '2px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: '2px 2px 0 var(--shadow-color)',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px,-1px)'; e.currentTarget.style.boxShadow = '3px 3px 0 var(--shadow-color)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0 var(--shadow-color)'; }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 'var(--radius-sm)',
                      background: 'var(--brand-primary)',
                      color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '0.78rem',
                      border: '2px solid var(--border-color)',
                      flexShrink: 0,
                      fontFamily: 'var(--font-heading)',
                    }}>
                      {initials}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.FullName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {u.Email}
                      </div>
                    </div>

                    {/* Role badge */}
                    <RoleBadge role={u.role} />

                    {/* Status dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: u.isActive !== false ? '#10b981' : '#ef4444',
                      flexShrink: 0,
                    }} title={u.isActive !== false ? 'Active' : 'Inactive'} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div className="tasks-section">
          <div className="section-header">
            <h2>Quick Actions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <ActionItem
              icon="fa-solid fa-user-plus"
              accent="#6366f1"
              title="Manage Users"
              desc="Add or edit students, instructors, and parents"
              onClick={() => navigate('/dashboard/users')}
            />
            <ActionItem
              icon="fa-solid fa-calendar-plus"
              accent="#3b82f6"
              title="Manage Sessions"
              desc="Schedule and review teaching sessions"
              onClick={() => navigate('/dashboard/sessions')}
            />
            <ActionItem
              icon="fa-solid fa-id-card"
              accent="#f59e0b"
              title="Student Profiles"
              desc="View and edit student academic records"
              onClick={() => navigate('/dashboard/profiles')}
            />
            <ActionItem
              icon="fa-solid fa-inbox"
              accent="#10b981"
              title="All Submissions"
              desc="Review and grade pending homework"
              onClick={() => navigate('/dashboard/submissions')}
            />
            <ActionItem
              icon="fa-solid fa-list-check"
              accent="#ec4899"
              title="All Tasks"
              desc="Manage assignments across all sessions"
              onClick={() => navigate('/dashboard/tasks')}
            />
            <ActionItem
              icon="fa-solid fa-shield-halved"
              accent="#8b5cf6"
              title="Audit Logs"
              desc="Track system-wide activity and changes"
              onClick={() => navigate('/dashboard/audit-logs')}
            />
          </div>
        </div>
      </div>

      {/* ── Role distribution ── */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', margin: '0 0 1.25rem', fontWeight: 700 }}>
          <i className="fa-solid fa-chart-pie" style={{ color: '#6366f1', marginRight: '0.5rem' }} />
          User Distribution
        </h2>
        <div className="dash-stats is-trio">
          {[
            { label: 'Students',    count: students.length,    total: users.length, color: '#10b981', icon: 'fa-solid fa-graduation-cap' },
            { label: 'Instructors', count: instructors.length, total: users.length, color: '#3b82f6', icon: 'fa-solid fa-chalkboard-user' },
            { label: 'Parents',     count: parents.length,     total: users.length, color: '#8b5cf6', icon: 'fa-solid fa-people-roof' },
          ].map(item => {
            const pct = item.total > 0 ? Math.round((item.count / item.total) * 100) : 0;
            return (
              <div key={item.label} style={{
                padding: '1rem',
                background: 'var(--bg-tertiary)',
                border: '2px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '2px 2px 0 var(--shadow-color)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <i className={item.icon} style={{ color: item.color, fontSize: '1rem' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {usersLoading ? '—' : item.count}
                </div>
                <div style={{ height: 4, background: 'var(--border-color)', borderRadius: 99, marginTop: '0.6rem', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem', fontWeight: 600 }}>{pct}% of users</div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default AdminOverview;
