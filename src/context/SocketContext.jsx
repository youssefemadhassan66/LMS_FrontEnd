import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useApiRequest } from '../hooks/useApiRequest';
import { getSocketUrl } from '../utils/apiUrl';
import { normalizeAppLink } from '../utils/appLinks';
import { notificationIcon } from '../utils/notificationIcons';
import { xpReason } from '../components/Gamification/xpReasons';
import logger from '../utils/logger';
import './SocketToasts.css';

const SocketContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const { request } = useApiRequest();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [toasts, setToasts] = useState([]);

  // The connection effect below depends on this, not on `user`. AuthContext
  // rebuilds the user object from the /auth/me response on every hydration and
  // every token refresh, so depending on the object itself tore down and
  // rebuilt the whole socket each time — dropping notifications in the gap.
  // The role is the only field the effect actually reads.
  const userRole = user?.role;

  // Centralized Notification States
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const addToast = (toast) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...toast, id, link: normalizeAppLink(toast.link) }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await request('/api/v1/notifications/unread-count');
      setUnreadCount(res.data?.unreadCount ?? 0);
    } catch { /* silently handle */ }
  }, [token, request]);

  const fetchNotifications = useCallback(async (query = {}) => {
    if (!token) return { data: [], total: 0, totalPages: 1 };
    setLoading(true);
    try {
      const queryString = new URLSearchParams(query).toString();
      const url = `/api/v1/notifications${queryString ? `?${queryString}` : ''}`;
      const res = await request(url);
      const list = Array.isArray(res.data) ? res.data.map((n) => ({
        ...n,
        link: normalizeAppLink(n.link),
      })) : [];
      // Overwrite global recent notifications only for page 1 or initial load
      if (!query.page || query.page === 1) {
        setNotifications(list);
      }
      return {
        data: list,
        total: res.total || list.length,
        totalPages: res.totalPages || 1
      };
    } catch (err) {
      logger.error('Failed to fetch notifications:', err);
      return { data: [], total: 0, totalPages: 1 };
    } finally {
      setLoading(false);
    }
  }, [token, request]);

  const markAsRead = useCallback(async (id) => {
    try {
      await request(`/api/v1/notifications/${id}/read`, 'PATCH');
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      logger.error('Failed to mark notification as read:', err);
    }
  }, [request]);

  const markAllRead = useCallback(async () => {
    try {
      await request('/api/v1/notifications/read-all', 'PATCH');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      logger.error('Failed to mark all notifications as read:', err);
    }
  }, [request]);

  // Fetch initial unread count on login
  useEffect(() => {
    if (token) {
      fetchUnreadCount();
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // Wait for the user as well as the token. On a page load the token comes
    // from storage first and the user a moment later; connecting before that
    // meant tearing the socket down mid-handshake when the role arrived, which
    // the browser reports as "WebSocket is closed before the connection is
    // established".
    if (!token || !userRole) return;

    const backendUrl = getSocketUrl();
    
    const newSocket = io(backendUrl, {
      auth: {
        token: token
      },
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setSocket(newSocket);
    });

    // Without these, a failed handshake was completely silent from the app's
    // side: nothing logged, `socket` stayed null forever, and the only clue was
    // the raw WebSocket error the browser itself prints. A rejected handshake
    // (expired token, deactivated account) and an unroutable /socket.io/ path
    // looked identical — like nothing had happened at all.
    newSocket.on('connect_error', (err) => {
      logger.error(
        `Socket.io connection failed (${newSocket.io.engine?.transport?.name ?? 'unknown transport'}):`,
        err.message,
      );
    });

    newSocket.on('disconnect', (reason) => {
      logger.log('Socket.io disconnected:', reason);
      // "io server disconnect" means the server dropped us deliberately — an
      // expired access token, or an account that is no longer active. The
      // client does not auto-reconnect from that state, and it should not:
      // reconnecting needs a fresh token, which arrives as a new `token` value
      // and re-runs this effect.
      if (reason === 'io server disconnect') setSocket(null);
    });

    // Handle generic notifications
    newSocket.on('notification', (notif) => {
      const normalizedNotif = {
        ...notif,
        link: normalizeAppLink(notif.link),
      };
      // 1. Increment count
      setUnreadCount((prev) => prev + 1);

      // 2. Prepend
      setNotifications((prev) => [normalizedNotif, ...prev]);

      // 3. Optional Toast: Suppress gamification toasts for student role to avoid duplication
      const isStudent = userRole === 'student';
      const isGamification = ['xp_earned', 'level_up', 'badge_unlocked'].includes(normalizedNotif.type);

      if (!(isStudent && isGamification)) {
        const details = notificationIcon(normalizedNotif.type);
        addToast({
          type: 'notification',
          title: normalizedNotif.title,
          message: normalizedNotif.message,
          icon: details.icon,
          tone: details.color,
          link: normalizedNotif.link
        });
      }
    });

    // Gamification toasts open My achievements, where the XP, level and
    // badge are shown in full.
    newSocket.on('xp:earned', (data) => {
      addToast({
        type: 'xp',
        title: `+${data.amount} XP`,
        message: xpReason(data.reason).label,
        icon: 'fa-solid fa-bolt',
        tone: 'var(--brand-primary)',
        link: '/dashboard/achievements',
        data
      });
    });

    newSocket.on('level:up', (data) => {
      addToast({
        type: 'level',
        title: `Level ${data.newLevel}!`,
        message: 'You levelled up. Keep it going!',
        icon: 'fa-solid fa-crown',
        tone: 'var(--data-review)',
        link: '/dashboard/achievements',
        data
      });
    });

    newSocket.on('badge:unlocked', (data) => {
      const rarity = data.rarity ? `${data.rarity[0].toUpperCase()}${data.rarity.slice(1)} badge` : 'New badge';
      addToast({
        type: 'badge',
        title: `Badge unlocked: ${data.name}`,
        message: data.xpReward ? `${rarity} · +${data.xpReward} XP` : rarity,
        icon: 'fa-solid fa-medal',
        tone: 'var(--data-score)',
        link: '/dashboard/achievements',
        data
      });
    });

    return () => {
      newSocket.removeAllListeners();
      newSocket.disconnect();
      setSocket(null);
    };
  }, [token, userRole]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllRead,
      }}
    >
      {children}

      {/* Floating toasts, newest at the bottom */}
      <div className="socket-toasts" aria-live="polite">
        {toasts.map((toast) => {
          const body = (
            <>
              <span className="socket-toast__icon" aria-hidden="true">
                {typeof toast.icon === 'string' && toast.icon.startsWith('fa-')
                  ? <i className={toast.icon} />
                  : toast.icon}
              </span>
              <span className="socket-toast__text">
                <strong>{toast.title}</strong>
                {toast.message && <span>{toast.message}</span>}
              </span>
            </>
          );
          return (
            <div key={toast.id} className={`socket-toast is-${toast.type || 'notification'}`}
              style={{ '--tone': toast.tone || 'var(--brand-primary)' }}>
              {toast.link ? (
                <button type="button" className="socket-toast__main"
                  onClick={() => { navigate(toast.link); removeToast(toast.id); }}>
                  {body}
                </button>
              ) : (
                <div className="socket-toast__main">{body}</div>
              )}
              <button type="button" className="socket-toast__close" aria-label="Dismiss"
                onClick={() => removeToast(toast.id)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          );
        })}
      </div>
    </SocketContext.Provider>
  );
};
