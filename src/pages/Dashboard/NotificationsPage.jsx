import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import Pagination from '../../components/Pagination/Pagination';
import { SkeletonCardGrid } from '../../components/Skeleton/Skeleton';
import { normalizeAppLink } from '../../utils/appLinks';
import { notificationIcon } from '../../utils/notificationIcons';
import logger from '../../utils/logger';

const NotificationsPage = () => {
  const {
    fetchNotifications,
    markAsRead,
    markAllRead,
    unreadCount,
  } = useSocket();
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());

  const [notificationsList, setNotificationsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchNotifications({ page, limit });
      setNotificationsList(res.data || []);
      setTotalDocs(res.total || 0);
      setTotalPages(res.totalPages || 1);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, limit, fetchNotifications]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      // Update local state to reflect read status
      setNotificationsList((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      logger.error(err);
    }
  };

  const handleMarkSingleRead = async (e, id) => {
    e.stopPropagation(); // Avoid triggering navigation from card click
    try {
      await markAsRead(id);
      setNotificationsList((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      logger.error(err);
    }
  };

  const handleCardClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await markAsRead(notif._id);
        setNotificationsList((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
        );
      } catch (err) {
        logger.error(err);
      }
    }
    if (notif.link) {
      navigate(normalizeAppLink(notif.link));
    }
  };

  const typeDetails = (type) => {
    const details = {
      schedule_reminder: { border: '3px solid var(--accent-orange, #f97316)', bg: 'var(--accent-orange, #f59e0b10)' },
      new_session: { border: '3px solid var(--brand-primary, #2563eb)', bg: 'var(--brand-light, #3b82f610)' },
      schedule_updated: { border: '3px solid var(--info, #3b82f6)', bg: 'var(--accent-blue, #60a5fa10)' },
      new_task: { border: '3px solid var(--accent-rose, #ec4899)', bg: 'var(--accent-rose, #ec489910)' },
      xp_earned: { border: '3px solid var(--warning, #eab308)', bg: 'var(--accent-yellow, #eab30810)' },
      level_up: { border: '3px solid var(--success, #22c55e)', bg: 'var(--accent-peach, #22c55e10)' },
      badge_unlocked: { border: '3px solid var(--accent-rose, #ec4899)', bg: 'var(--accent-rose, #ec489910)' },
      new_submission: { border: '3px solid var(--success, #14b8a6)', bg: 'var(--accent-peach, #14b8a610)' },
      new_message: { border: '3px solid var(--brand-primary, #6366f1)', bg: 'var(--brand-light, #6366f110)' },
    };
    return details[type] || { border: '3px solid var(--border-color)', bg: 'var(--bg-secondary)' };
  };

  const timeAgo = (date) => {
    const diff = now - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div style={{ padding: '2rem 0' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>Notifications</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
            You have <strong style={{ color: 'var(--brand-primary)' }}>{unreadCount}</strong> unread notifications
          </p>
        </div>
        <button
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
          className="nb-btn nb-btn-secondary"
          style={{
            opacity: unreadCount === 0 ? 0.5 : 1,
            cursor: unreadCount === 0 ? 'not-allowed' : 'pointer',
            padding: '0.55rem 1.25rem'
          }}
        >
          <i className="fa-solid fa-envelope-open" /> Mark all read
        </button>
      </div>

      {/* Loading & Errors */}
      {loading && <SkeletonCardGrid count={6} minWidth={350} />}
      {error && <p style={{ color: 'var(--error)', fontWeight: 600 }}>{error}</p>}

      {/* List content */}
      {!loading && notificationsList.length === 0 ? (
        <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', borderRadius: 'var(--radius-md)' }}>
          <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>🔕</p>
          <h3>All caught up!</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>No notifications to display at this time.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {notificationsList.map((notif) => {
            const styling = typeDetails(notif.type);
            return (
              <div
                key={notif._id}
                onClick={() => handleCardClick(notif)}
                className="glass-panel"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  gap: '1.25rem',
                  alignItems: 'center',
                  cursor: notif.link ? 'pointer' : 'default',
                  borderLeft: notif.isRead ? styling.border : `8px solid var(--brand-primary)`,
                  background: notif.isRead ? 'var(--card-bg)' : styling.bg,
                  borderRadius: 'var(--radius-md)',
                  position: 'relative',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translate(-2px, -2px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
              >
                {/* Type Icon */}
                <div style={{
                  fontSize: '1.35rem',
                  width: '50px',
                  height: '50px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '2px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: notificationIcon(notif.type).color,
                  boxShadow: '2px 2px 0px 0px var(--shadow-color)'
                }}>
                  <i className={notificationIcon(notif.type).icon} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.05rem',
                      fontWeight: notif.isRead ? 600 : 800,
                      color: 'var(--text-primary)'
                    }}>
                      {notif.title}
                    </h3>
                    {!notif.isRead && (
                      <span className="nb-badge nb-badge-red" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                        New
                      </span>
                    )}
                  </div>
                  <p style={{
                    margin: '0.35rem 0 0 0',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: 1.4
                  }}>
                    {notif.message}
                  </p>
                  <p style={{
                    margin: '0.5rem 0 0 0',
                    color: 'var(--text-muted)',
                    fontSize: '0.78rem',
                    fontWeight: 500
                  }}>
                    <i className="fa-regular fa-clock" style={{ marginRight: '0.3rem' }} />
                    {timeAgo(notif.createdAt)}
                  </p>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  {!notif.isRead && (
                    <button
                      onClick={(e) => handleMarkSingleRead(e, notif._id)}
                      title="Mark as read"
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        boxShadow: '2px 2px 0px 0px var(--shadow-color)',
                        transition: 'all 0.1s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px, -1px)'; e.currentTarget.style.boxShadow = '3px 3px 0px 0px var(--shadow-color)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px 0px var(--shadow-color)'; }}
                    >
                      <i className="fa-solid fa-check" style={{ color: 'var(--success)' }} />
                    </button>
                  )}
                  {notif.link && (
                    <div
                      style={{
                        background: 'var(--brand-primary)',
                        color: '#fff',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9rem',
                        boxShadow: '2px 2px 0px 0px var(--shadow-color)',
                      }}
                    >
                      <i className="fa-solid fa-arrow-right" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && notificationsList.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(n) => { setLimit(n); setPage(1); }}
          total={totalDocs}
        />
      )}
    </div>
  );
};

export default NotificationsPage;
