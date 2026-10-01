import React, { useCallback, useEffect, useState } from 'react';
import { useApiRequest } from '../../hooks/useApiRequest';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

const GamificationWidget = () => {
  const { user } = useAuth();
  const { request } = useApiRequest();
  const { socket } = useSocket();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await request('/api/v1/gamification/me');
      if (res.status === 'success' && res.data) {
        setProfile(res.data);
      }
    } catch (err) {
      console.error('Failed to load gamification profile:', err);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [fetchProfile, user]);

  useEffect(() => {
    if (!socket) return;

    const handleXpEarned = (data) => {
      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          xp: data.totalXP,
          level: data.level
        };
      });
    };

    const handleLevelUp = (data) => {
      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          level: data.newLevel,
          xp: data.totalXP
        };
      });
    };

    const handleBadgeUnlocked = () => {
      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          badgeCount: (prev.badgeCount || 0) + 1
        };
      });
    };

    socket.on('xp:earned', handleXpEarned);
    socket.on('level:up', handleLevelUp);
    socket.on('badge:unlocked', handleBadgeUnlocked);

    return () => {
      socket.off('xp:earned', handleXpEarned);
      socket.off('level:up', handleLevelUp);
      socket.off('badge:unlocked', handleBadgeUnlocked);
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="xp-widget is-loading" aria-hidden="true" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '6px 12px',
        background: 'var(--bg-secondary)',
        border: '2px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        height: '40px',
        opacity: 0.7
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}><i className="fa-solid fa-trophy" style={{ color: 'var(--text-muted)' }} /></span>
      </div>
    );
  }

  if (!profile) return null;

  // 100 XP per level
  const currentXPInLevel = profile.xp % 100;
  const progressPercent = Math.min(100, Math.max(0, currentXPInLevel));

  return (
    <div className="xp-widget" data-tour="xp" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '4px 12px',
      background: 'var(--card-bg)',
      border: '2px solid var(--border-color)',
      borderRadius: 'var(--radius-sm)',
      boxShadow: '2px 2px 0px 0px var(--shadow-color)',
      height: '40px',
      fontFamily: 'var(--font-body)',
      userSelect: 'none'
    }}>
      {/* Level Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontWeight: 800,
        fontSize: '0.82rem',
        color: 'var(--text-primary)',
        textTransform: 'uppercase',
      }}>
        <i className="fa-solid fa-trophy" style={{ fontSize: '0.9rem', color: 'var(--warning, #eab308)' }} />
        <span>LVL {profile.level}</span>
      </div>

      {/* XP Bar */}
      <div className="xp-widget__bar" style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '90px',
        gap: '2px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.65rem',
          fontWeight: 700,
          color: 'var(--text-muted)'
        }}>
          <span>{currentXPInLevel}/100 XP</span>
        </div>
        <div className="nb-progress" style={{ height: '8px', border: '1.5px solid var(--border-color)' }}>
          <div
            className="nb-progress-fill"
            style={{
              width: `${progressPercent}%`,
              background: 'var(--brand-primary)',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
      </div>

      {/* Streak Fire */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 700,
          fontSize: '0.82rem',
          color: 'var(--text-primary)'
        }}
        title={`Current streak: ${profile.currentStreak} days (Record: ${profile.longestStreak} days)`}
      >
        <i className="fa-solid fa-fire" style={{ fontSize: '0.9rem', color: 'var(--accent-orange, #f97316)' }} />
        <span>{profile.currentStreak}d</span>
      </div>

      {/* Badges Indicator */}
      <div
        className="xp-widget__badges"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 700,
          fontSize: '0.82rem',
          color: 'var(--text-primary)'
        }}
        title={`${profile.badgeCount} Badges earned`}
      >
        <i className="fa-solid fa-medal" style={{ fontSize: '0.9rem', color: 'var(--accent-rose, #ec4899)' }} />
        <span>{profile.badgeCount}</span>
      </div>
    </div>
  );
};

export default GamificationWidget;
