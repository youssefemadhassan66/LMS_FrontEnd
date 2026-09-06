import React, { useMemo, useState } from 'react';
import useFetchData from '../../hooks/useFetchData';
import { SkeletonTableRows } from '../../components/Skeleton/Skeleton';
import useMediaQuery from '../../hooks/useMediaQuery';

const getLogs = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.logs)) return data.logs;
  if (Array.isArray(data?.docs)) return data.docs;
  return [];
};

const cardFieldLabelStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

// One label/value pair inside a mobile log card. `breakAll` is for the ids and
// addresses that have no spaces to wrap at.
const CardField = ({ label, children, breakAll }) => (
  <div style={{ display: 'grid', gap: '0.1rem' }}>
    <span style={cardFieldLabelStyle}>{label}</span>
    <span
      style={{
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        overflowWrap: breakAll ? 'anywhere' : 'break-word',
      }}
    >
      {children}
    </span>
  </div>
);

const AuditLogsPage = () => {
  const [query, setQuery] = useState('');
  const isMobile = useMediaQuery('(max-width: 720px)');
  const { data, loading, error } = useFetchData('/api/v1/audit-logs?sort=-createdAt&limit=100');
  const logs = getLogs(data);

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((log) => {
      const actor = `${log.actor?.FullName || ''} ${log.actor?.Email || ''}`;
      const haystack = `${log.action || ''} ${log.targetModel || ''} ${log.targetId || ''} ${log.actorRole || ''} ${actor}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [logs, query]);

  return (
    <div style={{ padding: '2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>Audit Logs</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>{filteredLogs.length} of {logs.length} events</p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search action, actor, model..."
          style={{
            flex: '1 1 260px',
            minWidth: 0,
            padding: '0.65rem 0.85rem',
            border: '2px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--card-bg)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {error && <p style={{ color: 'var(--error)' }}>{error}</p>}

      {!loading && filteredLogs.length === 0 && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>No audit logs found</h3>
          <p style={{ color: 'var(--text-muted)' }}>Important system events will appear here.</p>
        </div>
      )}

      {!isMobile && (loading || filteredLogs.length > 0) && (
      <div className="glass-panel" style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ padding: '0.8rem' }}>Time</th>
              <th style={{ padding: '0.8rem' }}>Actor</th>
              <th style={{ padding: '0.8rem' }}>Action</th>
              <th style={{ padding: '0.8rem' }}>Target</th>
              <th style={{ padding: '0.8rem' }}>IP</th>
              <th style={{ padding: '0.8rem' }}>Meta</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonTableRows rows={8} cols={6} />}
            {!loading && filteredLogs.map((log) => (
              <tr key={log._id} style={{ borderBottom: '1px solid var(--border-color)', verticalAlign: 'top' }}>
                <td style={{ padding: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                </td>
                <td style={{ padding: '0.8rem' }}>
                  <div style={{ fontWeight: 700 }}>{log.actor?.FullName || 'Unknown'}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{log.actor?.Email || log.actorRole || '-'}</div>
                </td>
                <td style={{ padding: '0.8rem' }}>
                  <span className="modal-chip">{log.action}</span>
                </td>
                <td style={{ padding: '0.8rem' }}>
                  <div>{log.targetModel || '-'}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.targetId || ''}</div>
                </td>
                <td style={{ padding: '0.8rem', color: 'var(--text-muted)' }}>{log.ip || '-'}</td>
                <td style={{ padding: '0.8rem', maxWidth: '320px' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {log.meta ? JSON.stringify(log.meta, null, 2) : '-'}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* Phones: six columns cannot fit, and the pretty-printed meta JSON in
          the last one stretched every row far past the screen. One card per
          event instead, with the JSON collapsed behind a disclosure so a row
          is only as tall as its summary. */}
      {isMobile && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {loading && (
            <div
              className="glass-panel"
              style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}
            >
              Loading audit logs...
            </div>
          )}

          {!loading && filteredLogs.map((log) => (
            <div
              key={log._id}
              className="glass-panel"
              style={{ borderRadius: 'var(--radius-md)', padding: '0.9rem 1rem', display: 'grid', gap: '0.6rem' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <span className="modal-chip">{log.action}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                </span>
              </div>

              <div style={{ display: 'grid', gap: '0.1rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
                  {log.actor?.FullName || 'Unknown'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', overflowWrap: 'anywhere' }}>
                  {log.actor?.Email || log.actorRole || '-'}
                </span>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <CardField label="Target" breakAll>
                  {log.targetModel || '-'}
                  {log.targetId ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}> · {log.targetId}</span>
                  ) : null}
                </CardField>
                <CardField label="IP" breakAll>{log.ip || '-'}</CardField>
              </div>

              {log.meta && (
                <details>
                  <summary style={{ ...cardFieldLabelStyle, cursor: 'pointer' }}>Details</summary>
                  <pre
                    style={{
                      margin: '0.4rem 0 0',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      fontSize: '0.72rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {JSON.stringify(log.meta, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
