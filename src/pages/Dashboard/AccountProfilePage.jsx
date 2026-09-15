import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAvatarUrl } from '../../utils/avatar';
import AccountConnections from './AccountConnections';
import './DashboardOverview.css';

const quickLinksByRole = {
  student: [
    { label: 'My Tasks', path: '/dashboard/tasks', description: 'Check assigned homework and due dates.' },
    { label: 'My Sessions', path: '/dashboard/sessions', description: 'Review upcoming and completed sessions.' },
    { label: 'My Progress', path: '/dashboard/progress', description: 'See exam and learning progress.' },
  ],
  parent: [
    { label: 'Children', path: '/dashboard', description: 'Open your linked student overview.' },
    { label: 'Tasks', path: '/dashboard/tasks', description: 'Review homework for your children.' },
    { label: 'Messages', path: '/dashboard/messages', description: 'Contact instructors.' },
  ],
  instructor: [
    { label: 'Sessions', path: '/dashboard/sessions', description: 'Manage student sessions.' },
    { label: 'Tasks', path: '/dashboard/tasks', description: 'Create and review assignments.' },
    { label: 'Announcements', path: '/dashboard/announcements', description: 'Post updates for students and parents.' },
  ],
  admin: [
    { label: 'Users', path: '/dashboard/users', description: 'Manage platform users.' },
    { label: 'Student Profiles', path: '/dashboard/profiles', description: 'Review student profile records.' },
    { label: 'Audit Logs', path: '/dashboard/audit-logs', description: 'Track important system actions.' },
  ],
};

const AccountProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const userName = user?.FullName || user?.UserName || 'User';
  const role = user?.role || 'student';
  const quickLinks = quickLinksByRole[role] || quickLinksByRole.student;

  /* Stable avatar seed — uses user id so it never changes between renders */
  const avatarSeed = user?._id || user?.UserName || userName;
  const avatarUrl = getAvatarUrl(avatarSeed, userName, 128);

  const details = [
    ['Full name', user?.FullName || 'Not set'],
    ['Username', user?.UserName || 'Not set'],
    ['Email', user?.Email || 'Not set'],
    ['Role', role],
  ];

  return (
    <div className="overview-container" style={{ padding: '2rem 0' }}>
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>

          {/* ── Avatar ── */}
          <div style={{
            width: '96px', height: '96px', borderRadius: '50%',
            border: '3px solid var(--border-color)',
            boxShadow: '4px 4px 0 var(--shadow-color)',
            overflow: 'hidden', flexShrink: 0,
            background: 'var(--bg-tertiary)',
          }}>
            {user?.avatar
              ? <img src={user.avatar} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src={avatarUrl} alt={userName} style={{ width: '100%', height: '100%' }} />
            }
          </div>

          <div style={{ flex: 1, minWidth: '220px' }}>
            <h1 style={{ margin: 0, fontSize: '2rem' }}>{userName}</h1>
            <p style={{ margin: '0.4rem 0 0', color: 'var(--text-muted)', fontWeight: 600 }}>{role.toUpperCase()} ACCOUNT</p>
          </div>
          <button className="nb-btn nb-btn-secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)', gap: '1.5rem' }}>
        <section className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
          <h2 style={{ marginTop: 0 }}>Account Details</h2>
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            {details.map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.8rem',
                  background: 'var(--bg-tertiary)',
                  border: '2px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{label}</span>
                <span style={{ fontWeight: 700, textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
          <h2 style={{ marginTop: 0 }}>Quick Access</h2>
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            {quickLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="task-item"
                style={{ textAlign: 'left', borderLeftColor: 'var(--brand-primary)', cursor: 'pointer' }}
              >
                <div className="task-meta">
                  <h4>{link.label}</h4>
                  <p>{link.description}</p>
                </div>
                <div className="task-status">Open</div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <AccountConnections role={role} />
    </div>
  );
};

export default AccountProfilePage;
