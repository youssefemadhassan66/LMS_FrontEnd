import React from 'react';
import useFetchData from '../../hooks/useFetchData';
import { getAvatarUrl } from '../../utils/avatar';

/**
 * Who this account is linked to, from the account owner's side:
 *   student    → their parents and instructors
 *   parent     → their children, and each child's instructors
 *   instructor → their assigned students, and each student's parents
 *
 * Every role reads links the backend already scopes to the signed-in user, so
 * nobody can see a connection that is not theirs. Admins manage links rather
 * than hold them, so they get no section.
 */

const ENDPOINTS = {
  student: '/api/v1/StudentProfile/me',
  parent: '/api/v1/StudentProfile/me',
  instructor: '/api/v1/student-instructor-assignments/me/students',
};

const displayName = (person) => person?.FullName || person?.UserName || 'Unnamed user';
const names = (people = []) => people.map(displayName).join(', ');

// Normalise each role's response into titled groups of rows.
const buildGroups = (role, data) => {
  if (role === 'student') {
    const profile = Array.isArray(data) ? data[0] : data;
    return [
      {
        title: 'Parents',
        empty: 'No parent is linked to your account yet.',
        rows: (profile?.parents || []).map((person) => ({ person })),
      },
      {
        title: 'Instructors',
        empty: 'No instructor is assigned to you yet.',
        rows: (profile?.instructors || []).map((person) => ({ person })),
      },
    ];
  }

  if (role === 'parent') {
    const children = Array.isArray(data) ? data : data ? [data] : [];
    return [
      {
        title: 'Children',
        empty: 'No child is linked to your account yet.',
        rows: children.map((profile) => ({
          person: profile.user,
          meta: profile.grade,
          related: profile.instructors?.length
            ? `Instructors: ${names(profile.instructors)}`
            : 'No instructor assigned yet',
        })),
      },
    ];
  }

  if (role === 'instructor') {
    const students = data?.students || [];
    return [
      {
        title: 'Students',
        empty: 'No student is assigned to you yet.',
        rows: students.map((profile) => ({
          person: profile.user,
          meta: profile.grade,
          related: profile.parents?.length
            ? `Parents: ${names(profile.parents)}`
            : 'No parent linked',
        })),
      },
    ];
  }

  return [];
};

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.85rem',
  padding: '0.75rem 0.8rem',
  background: 'var(--bg-tertiary)',
  border: '2px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)',
  minWidth: 0,
};

const PersonRow = ({ person, meta, related }) => {
  const name = displayName(person);
  return (
    <li style={rowStyle}>
      <img
        src={getAvatarUrl(person?._id || name, name, 64)}
        alt=""
        width="40"
        height="40"
        style={{ borderRadius: '50%', border: '2px solid var(--border-color)', flexShrink: 0 }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800 }}>{name}</span>
          {meta && <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>{meta}</span>}
        </div>
        {person?.Email && (
          <a
            href={`mailto:${person.Email}`}
            style={{ color: 'var(--brand-primary)', fontSize: '0.85rem', fontWeight: 600, overflowWrap: 'anywhere' }}
          >
            {person.Email}
          </a>
        )}
        {related && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.15rem' }}>{related}</div>
        )}
      </div>
    </li>
  );
};

const AccountConnections = ({ role }) => {
  const endpoint = ENDPOINTS[role];
  const { data, loading, error, refetch } = useFetchData(endpoint, { skip: !endpoint });

  if (!endpoint) return null;

  const groups = buildGroups(role, data);

  return (
    <section
      className="glass-panel"
      aria-labelledby="account-connections-title"
      aria-busy={loading}
      style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', marginTop: '1.5rem' }}
    >
      <h2 id="account-connections-title" style={{ marginTop: 0 }}>Connections</h2>

      {loading && (
        <p style={{ color: 'var(--text-muted)', fontWeight: 600, margin: '1rem 0 0' }}>Loading your connections…</p>
      )}

      {!loading && error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', color: 'var(--error)', fontWeight: 700 }}>
          <span>Could not load your connections.</span>
          {refetch && (
            <button type="button" className="nb-btn nb-btn-secondary" onClick={() => refetch()}>
              Retry
            </button>
          )}
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
          {groups.map((group) => (
            <div key={group.title} style={{ minWidth: 0 }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>
                {group.title}
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginLeft: '0.4rem' }}>{group.rows.length}</span>
              </h3>
              {group.rows.length ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.75rem' }}>
                  {group.rows.map((row, index) => (
                    <PersonRow key={row.person?._id || index} {...row} />
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>{group.empty}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default AccountConnections;
