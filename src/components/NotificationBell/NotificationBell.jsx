import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { normalizeAppLink } from '../../utils/appLinks';
import { notificationIcon } from '../../utils/notificationIcons';
import useMediaQuery from '../../hooks/useMediaQuery';

const NotificationBell = () => {
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllRead
  } = useSocket();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [now] = useState(() => Date.now());
  const isMobile = useMediaQuery('(max-width: 720px)');
  // Where the panel's top edge sits when it is pinned to the viewport.
  // Measured off the bell each time it opens; the header is sticky, so the
  // value stays correct while the page scrolls.
  const [anchorTop, setAnchorTop] = useState(0);

  const toggleOpen = (e) => {
    setAnchorTop(e.currentTarget.getBoundingClientRect().bottom + 8);
    setOpen(o => !o);
  };

  const handleClick = (notif) => {
    if (!notif.isRead) markAsRead(notif._id);
    if (notif.link) {
      navigate(normalizeAppLink(notif.link));
      setOpen(false);
    }
  };

  // Fetch full list when dropdown opens
  useEffect(() => { if (open) fetchNotifications(); }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={toggleOpen}
        style={{
          position: 'relative', background: 'var(--bg-tertiary)', border: '2px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)', width: '40px', height: '40px', display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.15rem',
          boxShadow: '2px 2px 0px 0px var(--shadow-color)', transition: 'all 0.12s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px, -1px)'; e.currentTarget.style.boxShadow = '3px 3px 0px 0px var(--shadow-color)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px 0px var(--shadow-color)'; }}
        title="Notifications"
      >
        <i className="fa-solid fa-bell" style={{ color: 'var(--text-primary)' }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-5px', right: '-5px', minWidth: '18px', height: '18px',
            borderRadius: '50%', background: 'var(--error)', color: '#fff', fontSize: '0.65rem',
            fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--card-bg)',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          // The bell is not the last item in the header (the theme toggle and
          // avatar sit to its right), so a fixed-width panel anchored to the
          // bell's right edge ran off the left of a phone screen. On mobile,
          // pin it to the viewport instead of to the bell.
          ...(isMobile
            ? { position: 'fixed', top: `${anchorTop}px`, left: '0.5rem', right: '0.5rem' }
            : { position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '360px' }),
          background: 'var(--card-bg)', border: '3px solid var(--border-color)',
          borderRadius: 'var(--radius-md)', boxShadow: '6px 6px 0px 0px var(--shadow-color)',
          zIndex: 1000, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '0.75rem 1rem', borderBottom: '3px solid var(--border-color)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 400 }}>Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: 'none', border: 'none', color: 'var(--brand-primary)',
                  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline',
                  opacity: unreadCount > 0 ? 1 : 0.5,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: isMobile ? 'min(320px, 45vh)' : '320px', overflowY: 'auto' }}>
            {loading ? (
              <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</p>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}><i className="fa-solid fa-bell-slash" /></p>
                <p style={{ fontSize: '0.85rem' }}>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 5).map(notif => (
                <div
                  key={notif._id}
                  onClick={() => handleClick(notif)}
                  style={{
                    padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)',
                    cursor: notif.link ? 'pointer' : 'default', display: 'flex', gap: '0.65rem',
                    alignItems: 'flex-start', transition: 'background 0.12s ease',
                    background: notif.isRead ? 'transparent' : 'rgba(59,130,246,0.05)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = notif.isRead ? 'transparent' : 'rgba(59,130,246,0.05)'; }}
                >
                  <span style={{
                    flexShrink: 0, marginTop: '0.1rem', width: '28px', height: '28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)',
                    border: '1.5px solid var(--border-color)', fontSize: '0.85rem',
                    color: notificationIcon(notif.type).color,
                  }}>
                    <i className={notificationIcon(notif.type).icon} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: notif.isRead ? 500 : 700, color: 'var(--text-primary)' }}>
                      {notif.title}
                    </p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {notif.message}
                    </p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {timeAgo(notif.createdAt)}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-primary)',
                      flexShrink: 0, marginTop: '0.3rem',
                    }} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer View All Link */}
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '3px solid var(--border-color)',
            textAlign: 'center',
            background: 'var(--bg-secondary)',
          }}>
            <button
              onClick={() => {
                navigate('/dashboard/notifications');
                setOpen(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand-primary)',
                fontFamily: 'var(--font-heading)',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
