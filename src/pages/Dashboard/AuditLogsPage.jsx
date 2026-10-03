import React, { useMemo, useState } from 'react';
import useFetchData from '../../hooks/useFetchData';
import { SkeletonTableRows } from '../../components/Skeleton/Skeleton';
import useMediaQuery from '../../hooks/useMediaQuery';
import { timeAgo } from '../../utils/timeAgo';
import './DashboardOverview.css';
import './Insights.css';

const PAGE_SIZE = 100;

const getLogs = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.logs)) return data.logs;
  if (Array.isArray(data?.docs)) return data.docs;
  return [];
};

// The events an admin actually comes to this page for. Everything else keeps
// its raw action name, which is still readable ("update_session").
const ACTION_LABELS = {
  login: 'Signed in',
  login_failed: 'Failed sign-in',
  signup: 'Signed up',
  approve_user: 'Approved account',
  reject_user: 'Rejected account',
  bootstrap_admin: 'First admin created',
  bootstrap_admin_denied: 'Bootstrap refused',
};

// Why a sign-in failed, spelled out. The API deliberately returns one generic
// message to whoever is trying; the reason is only ever shown here.
const FAILURE_REASONS = {
  unknown_email: 'No account with that email',
  wrong_password: 'Wrong password',
  account_pending: 'Correct password, account still awaiting approval',
  account_rejected: 'Correct password, account was rejected',
  invalid_secret: 'Wrong bootstrap secret',
  admin_already_exists: 'An admin already exists',
};

const ACTION_TONES = {
  login: 'var(--success)',
  signup: 'var(--info)',
  approve_user: 'var(--success)',
  login_failed: 'var(--error)',
  reject_user: 'var(--error)',
  bootstrap_admin_denied: 'var(--error)',
  bootstrap_admin: 'var(--warning)',
};

const CATEGORIES = [
  { id: 'all', label: 'All events', actions: null },
  { id: 'signin', label: 'Sign-ins', actions: ['login'] },
  { id: 'failed', label: 'Failed sign-ins', actions: ['login_failed', 'bootstrap_admin_denied'] },
  { id: 'signup', label: 'Sign-ups', actions: ['signup'] },
  { id: 'approvals', label: 'Approvals', actions: ['approve_user', 'reject_user'] },
];

// Meta keys already shown in words. Anything else is worth the details view.
const SHOWN_META = new Set(['userAgent', 'reason', 'subjectEmail', 'subjectName']);

const labelFor = (action) => ACTION_LABELS[action] || action;

// An event with no actor is not an error: a failed sign-in for an address that
// does not exist has nobody to attribute it to, and the attempted address is
// the whole point of the record.
const actorNameFor = (log) => {
  if (log.actor?.FullName) return log.actor.FullName;
  if (log.actorEmail) return 'No account';
  return 'Unknown';
};

const actorDetailFor = (log) => log.actor?.Email || log.actorEmail || log.actorRole || '-';

/** "Chrome on Windows" from a user-agent string; scripts are named as such. */
const deviceFrom = (ua = '') => {
  if (!ua) return '';
  if (/^(node|curl|axios|python|postman|insomnia|okhttp)/i.test(ua)) return 'Script or API client';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
      : /Firefox\//.test(ua) ? 'Firefox'
        : /Chrome\//.test(ua) ? 'Chrome'
          : /Safari\//.test(ua) ? 'Safari' : '';
  const os = /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
      : /Windows/.test(ua) ? 'Windows'
        : /Mac OS X/.test(ua) ? 'macOS'
          : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' on ') || 'Unknown device';
};

const placeFrom = (ip) => {
  if (!ip) return '—';
  if (/^(::1$|127\.|::ffff:127\.)/.test(ip)) return 'Local (this server)';
  return ip.replace(/^::ffff:/, '');
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const dayLabel = (date) => {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
};

/** Consecutive logs that share a calendar day, newest first as given. */
const groupByDay = (logs) => {
  const groups = [];
  for (const log of logs) {
    const date = log.createdAt ? new Date(log.createdAt) : null;
    const key = date ? date.toDateString() : 'unknown';
    const last = groups[groups.length - 1];
    if (last?.key === key) last.logs.push(log);
    else groups.push({ key, label: date ? dayLabel(date) : 'No date', logs: [log] });
  }
  return groups;
};

const timeOf = (log) =>
  log.createdAt ? new Date(log.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—';

const ActionChip = ({ action }) => (
  <span className="audit-chip" style={{ '--tone': ACTION_TONES[action] || 'var(--text-muted)' }}>
    {labelFor(action)}
  </span>
);

// The reason lives in meta, but an admin scanning the page should not have to
// open the JSON to learn why a sign-in was refused.
const EventNotes = ({ log }) => {
  const reason = FAILURE_REASONS[log.meta?.reason];
  const subject = log.meta?.subjectEmail ? (log.meta.subjectName || log.meta.subjectEmail) : null;
  return (
    <>
      {reason && <div className="audit-sub">{reason}</div>}
      {subject && <div className="audit-sub">{subject}</div>}
    </>
  );
};

const ExtraDetails = ({ log }) => {
  const extra = Object.entries(log.meta || {}).filter(([key]) => !SHOWN_META.has(key));
  const hasTarget = log.targetModel && log.targetId && log.targetId !== log.actor?._id;
  if (!extra.length && !hasTarget) return null;
  return (
    <details className="audit-details">
      <summary>Details</summary>
      <dl>
        {hasTarget && (
          <>
            <dt>{log.targetModel}</dt>
            <dd>{log.targetId}</dd>
          </>
        )}
        {extra.map(([key, value]) => (
          <React.Fragment key={key}>
            <dt>{key}</dt>
            <dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
          </React.Fragment>
        ))}
      </dl>
    </details>
  );
};

const AuditLogsPage = () => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  // Fixed when the page opens, so the summary does not drift between renders.
  const [openedAt] = useState(() => Date.now());
  const isMobile = useMediaQuery('(max-width: 720px)');
  const { data, loading, error } = useFetchData(`/api/v1/audit-logs?sort=-createdAt&limit=${PAGE_SIZE}`);
  const logs = getLogs(data);

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((entry) => [
    entry.id,
    entry.actions ? logs.filter((log) => entry.actions.includes(log.action)).length : logs.length,
  ])), [logs]);

  // A quick read of the last day, before anyone scrolls.
  const summary = useMemo(() => {
    const dayAgo = openedAt - 24 * 3600 * 1000;
    const recent = logs.filter((log) => new Date(log.createdAt).getTime() >= dayAgo);
    return {
      signIns: recent.filter((log) => log.action === 'login').length,
      people: new Set(recent.filter((log) => log.action === 'login').map((log) => log.actor?._id || log.actorEmail)).size,
      failed: recent.filter((log) => log.action === 'login_failed' || log.action === 'bootstrap_admin_denied').length,
      signUps: recent.filter((log) => log.action === 'signup').length,
    };
  }, [logs, openedAt]);

  const filteredLogs = useMemo(() => {
    const actions = CATEGORIES.find((entry) => entry.id === category)?.actions;
    const inCategory = actions ? logs.filter((log) => actions.includes(log.action)) : logs;

    const needle = query.trim().toLowerCase();
    if (!needle) return inCategory;

    return inCategory.filter((log) => {
      const actor = `${log.actor?.FullName || ''} ${log.actor?.Email || ''} ${log.actorEmail || ''}`;
      const subject = `${log.meta?.subjectEmail || ''} ${log.meta?.subjectName || ''}`;
      // Search the readable label too, so "failed" finds login_failed.
      const haystack =
        `${log.action || ''} ${labelFor(log.action)} ${log.targetModel || ''} ${log.targetId || ''} ${log.actorRole || ''} ${actor} ${subject} ${log.ip || ''}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [logs, query, category]);

  const days = useMemo(() => groupByDay(filteredLogs), [filteredLogs]);

  return (
    <div className="overview-container">
      <div className="ins-head">
        <div className="ins-head__text">
          <h1 className="page-title">Audit log</h1>
          <p className="page-subtitle">
            Sign-ins, sign-ups and account approvals. Showing the latest {PAGE_SIZE} events.
          </p>
        </div>
      </div>

      {!loading && logs.length > 0 && (
        <section aria-labelledby="audit-last-day">
          <h2 id="audit-last-day" className="audit-summary-title">Last 24 hours</h2>
          <div className="audit-summary">
            <div className="audit-stat" style={{ '--tone': 'var(--success)' }}>
              <i className="fa-solid fa-right-to-bracket" />
              <div>
                <strong>{summary.signIns}</strong>
                <span>sign-ins</span>
                {summary.people > 0 && <small>by {summary.people} {summary.people === 1 ? 'person' : 'people'}</small>}
              </div>
            </div>
            <div className={`audit-stat${summary.failed ? ' is-alert' : ''}`} style={{ '--tone': summary.failed ? 'var(--error)' : 'var(--text-muted)' }}>
              <i className={summary.failed ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-shield-halved'} />
              <div>
                <strong>{summary.failed}</strong>
                <span>failed sign-ins</span>
                {summary.failed > 0 && <small>worth a look</small>}
              </div>
            </div>
            <div className="audit-stat" style={{ '--tone': 'var(--info)' }}>
              <i className="fa-solid fa-user-plus" />
              <div>
                <strong>{summary.signUps}</strong>
                <span>new sign-ups</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="ins-toolbar">
        <label className="ins-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, emails, actions or IPs"
            aria-label="Search the audit log"
          />
        </label>
        <div className="ins-seg audit-filters" role="group" aria-label="Kind of event">
          {CATEGORIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setCategory(entry.id)}
              aria-pressed={entry.id === category}
            >
              {entry.label}
              {!loading && <span className="audit-count" aria-hidden="true">{counts[entry.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: 'var(--error)', margin: 0 }}>{error}</p>}

      {!loading && filteredLogs.length === 0 && (
        <div className="ins-panel ins-empty">
          <i className="fa-solid fa-clipboard-list" />
          <strong>No audit logs found</strong>
          <p>
            {query || category !== 'all'
              ? 'No events match. Try another search or filter.'
              : 'Important system events will appear here.'}
          </p>
        </div>
      )}

      {!isMobile && (loading || filteredLogs.length > 0) && (
        <div className="ins-panel audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Who</th>
                <th scope="col">What happened</th>
                <th scope="col">From</th>
              </tr>
            </thead>
            {loading && <tbody><SkeletonTableRows rows={8} cols={4} /></tbody>}
            {!loading && days.map((day) => (
              <tbody key={day.key}>
                <tr className="audit-day">
                  <th scope="rowgroup" colSpan={4}>
                    {day.label}
                    <span>{day.logs.length} event{day.logs.length === 1 ? '' : 's'}</span>
                  </th>
                </tr>
                {day.logs.map((log) => (
                  <tr key={log._id}>
                    <td className="audit-time" title={log.createdAt ? new Date(log.createdAt).toLocaleString() : undefined}>
                      {timeOf(log)}
                      <div className="audit-sub">{timeAgo(log.createdAt)}</div>
                    </td>
                    <td>
                      <div className="audit-name">{actorNameFor(log)}</div>
                      <div className="audit-sub">{actorDetailFor(log)}</div>
                    </td>
                    <td>
                      <ActionChip action={log.action} />
                      <EventNotes log={log} />
                      <ExtraDetails log={log} />
                    </td>
                    <td>
                      <div>{placeFrom(log.ip)}</div>
                      <div className="audit-sub">{deviceFrom(log.meta?.userAgent)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

      {/* Phones: one card per event, under the same day headings. */}
      {isMobile && loading && (
        <div className="ins-panel ins-empty"><p>Loading audit log…</p></div>
      )}

      {isMobile && !loading && days.map((day) => (
        <section key={day.key} className="audit-day-group" aria-label={day.label}>
          <h2 className="audit-day-title">{day.label}<span>{day.logs.length}</span></h2>
          {day.logs.map((log) => (
            <article key={log._id} className="audit-card">
              <div className="audit-card__top">
                <ActionChip action={log.action} />
                <span className="audit-sub">{timeOf(log)}</span>
              </div>
              <div>
                <div className="audit-name">{actorNameFor(log)}</div>
                <div className="audit-sub">{actorDetailFor(log)}</div>
                <EventNotes log={log} />
              </div>
              <div className="audit-sub">
                <i className="fa-solid fa-location-dot" aria-hidden="true" /> {placeFrom(log.ip)}
                {log.meta?.userAgent ? ` · ${deviceFrom(log.meta.userAgent)}` : ''}
              </div>
              <ExtraDetails log={log} />
            </article>
          ))}
        </section>
      ))}
    </div>
  );
};

export default AuditLogsPage;
