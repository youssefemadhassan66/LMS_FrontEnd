import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiRequest } from '../../hooks/useApiRequest';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import './GamificationWidget.css';
import logger from '../../utils/logger';

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
      logger.error('Failed to load gamification profile:', err);
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
      <div className="xp-widget is-loading" aria-hidden="true">
        <i className="fa-solid fa-trophy" />
      </div>
    );
  }

  if (!profile) return null;

  // 100 XP per level
  const currentXPInLevel = profile.xp % 100;
  const progressPercent = Math.min(100, Math.max(0, currentXPInLevel));
  const streak = profile.currentStreak || 0;
  const best = Math.max(profile.longestStreak || 0, streak);

  return (
    <Link
      to="/dashboard/achievements"
      className="xp-widget"
      data-tour="xp"
      aria-label={`Level ${profile.level}, ${currentXPInLevel} of 100 XP, ${streak} day streak, ${profile.badgeCount || 0} badges. Open my achievements`}
    >
      <span className="xp-widget__level">
        <i className="fa-solid fa-trophy" aria-hidden="true" />
        <span>Lv {profile.level}</span>
      </span>

      <span className="xp-widget__bar" aria-hidden="true">
        <span className="xp-widget__xp">{currentXPInLevel}/100 XP</span>
        <span className="xp-widget__track"><span style={{ width: `${progressPercent}%` }} /></span>
      </span>

      <span className="xp-widget__streak" title={`Streak: ${streak} day${streak === 1 ? '' : 's'} (best ${best})`} aria-hidden="true">
        <i className="fa-solid fa-fire" />
        <span>{streak}</span>
      </span>

      <span className="xp-widget__badges" title={`${profile.badgeCount || 0} badges`} aria-hidden="true">
        <i className="fa-solid fa-medal" />
        <span>{profile.badgeCount || 0}</span>
      </span>
    </Link>
  );
};

export default GamificationWidget;
