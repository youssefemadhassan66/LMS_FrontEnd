import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useFetchData from '../../hooks/useFetchData';
import { useApiRequest } from '../../hooks/useApiRequest';
import NextSessionCountdown from '../../components/NextSessionCountdown/NextSessionCountdown';
import './DashboardOverview.css';

const DashboardOverview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { request } = useApiRequest();
  
  // Profile
  const { data: profileData, loading: profileLoading, refetch: refetchProfile } = useFetchData('/api/v1/StudentProfile/me');
  // Pending parent link requests for student
  const {
    data: pendingRequestsRaw,
    loading: pendingRequestsLoading,
    error: pendingRequestsError,
    refetch: refetchPendingRequests,
  } = useFetchData('/api/v1/StudentProfile/me/parent-requests');

  const pendingRequests = Array.isArray(pendingRequestsRaw) ? pendingRequestsRaw : (pendingRequestsRaw?.data || []);
  const [parentRequestAction, setParentRequestAction] = useState(null);
  const [parentRequestFeedback, setParentRequestFeedback] = useState(null);

  const handleParentRequest = async (parentId, action) => {
    if (parentRequestAction) return;

    setParentRequestAction({ parentId, action });
    setParentRequestFeedback(null);

    try {
      const response = await request(`/api/v1/StudentProfile/me/parent-requests/${parentId}/${action}`, 'POST');
      const refreshes = [refetchPendingRequests()];
      if (action === 'accept') refreshes.push(refetchProfile());
      await Promise.all(refreshes);

      setParentRequestFeedback({
        type: 'success',
        message: response?.message || (action === 'accept' ? 'Parent link request accepted.' : 'Parent link request declined.'),
      });
    } catch (err) {
      setParentRequestFeedback({
        type: 'error',
        message: err.message || `Failed to ${action} the parent link request.`,
      });
    } finally {
      setParentRequestAction(null);
    }
  };

  const showParentRequestPanel = pendingRequestsLoading || pendingRequestsError || parentRequestFeedback || pendingRequests.length > 0;
  // Stats endpoints — useFetchData returns result.data from API
  // API returns: { status: "success", data: { stats: {...} } }
  // So useFetchData returns: { stats: {...} }
  const { data: taskStats, loading: taskStatsLoading } = useFetchData('/api/v1/task/me/stats');
  const { data: subStats } = useFetchData('/api/v1/submission/me/stats');
  const { data: reviewStats } = useFetchData('/api/v1/sessionReview/me/stats');
  // Recent data
  const { data: tasksRaw } = useFetchData('/api/v1/task/me');
  const { data: sessionsRaw } = useFetchData('/api/v1/session/me');
  // External courses
  const { data: extCoursesRaw } = useFetchData('/api/v1/external-course/my-course');
  const { data: extHwRaw } = useFetchData('/api/v1/external-hw/my');

  const studentName = user?.FullName?.split(' ')[0] || user?.name || "Student";
  
  // Normalize profile
  const profile = Array.isArray(profileData) ? profileData[0] : (profileData?.docs?.[0] || profileData);
  const grade = profile?.grade || "N/A";

  // Normalize stats — useFetchData strips the outer { status, data } wrapper
  const ts = taskStats?.stats || taskStats || {};
  const ss = subStats?.stats || subStats || {};
  const rs = reviewStats?.stats || reviewStats || {};

  // Normalize lists
  const tasks = Array.isArray(tasksRaw) ? tasksRaw : (tasksRaw?.tasks || tasksRaw?.docs || []);
  const sessions = Array.isArray(sessionsRaw) ? sessionsRaw : (sessionsRaw?.sessions || sessionsRaw?.docs || []);
  const extCourses = Array.isArray(extCoursesRaw) ? extCoursesRaw : (extCoursesRaw?.courses || extCoursesRaw?.docs || []);
  const extHws = Array.isArray(extHwRaw) ? extHwRaw : (extHwRaw?.docs || []);

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const upcomingSessions = sessions
    .filter(s => s.status === 'pending' && new Date(s.date) > new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);
  const pendingExtHws = extHws.filter(hw => hw.status === 'Pending');

  const isLoading = profileLoading || taskStatsLoading;

  // Completion percentage for the progress tracker
  const completionRate = ts.completionRate !== undefined ? Math.round(ts.completionRate) : 0;

  // Rating bar helper — Neo-Brutalist style
  const ratingBar = (label, value, max = 5) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
      <span style={{ 
        fontSize: '0.78rem', 
        color: 'var(--text-muted)', 
        minWidth: '95px', 
        fontWeight: '700', 
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
      }}>{label}</span>
      <div style={{ 
        flex: 1, 
        height: '12px', 
        background: 'var(--bg-tertiary)', 
        border: '2px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)', 
        overflow: 'hidden' 
      }}>
        <div style={{ 
          height: '100%', 
          width: `${(value / max) * 100}%`, 
          background: 'var(--brand-primary)',
          borderRadius: 'var(--radius-sm)', 
          transition: 'width 0.5s ease' 
        }}></div>
      </div>
      <span style={{ 
        fontSize: '0.82rem', 
        fontWeight: '700', 
        minWidth: '38px', 
        textAlign: 'right',
        fontFamily: 'var(--font-heading)'
      }}>{typeof value === 'number' ? value.toFixed(1) : '—'}/{max}</span>
    </div>
  );

  return (
    <div className="overview-container">
      {/* ══════ HEADER ══════ */}
      <div>
        <h1 className="page-title">Welcome back, {isLoading ? "..." : studentName}! <i className="fa-solid fa-hand-wave" style={{ color: 'var(--brand-primary)' }} /></h1>
        <p className="page-subtitle">Here is what's happening with your learning. <span style={{
          display: 'inline-flex',
          padding: '0.15rem 0.5rem',
          background: 'var(--accent-yellow)',
          border: '2px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.78rem',
          fontWeight: '700',
          marginLeft: '0.4rem'
        }}>Grade: {grade}</span></p>
      </div>

      {/* ══════ PENDING PARENT LINK REQUESTS BANNER ══════ */}
      {showParentRequestPanel && (
        <div aria-busy={Boolean(parentRequestAction)} style={{
          background: 'rgba(139,92,246,0.12)',
          border: '2px solid #8b5cf6',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          boxShadow: '3px 3px 0px 0px #8b5cf6',
        }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontFamily: 'var(--font-heading)' }}>
            <i className="fa-solid fa-people-roof" /> Parent Link Requests{pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}
          </h3>

          {parentRequestFeedback && (
            <div
              role={parentRequestFeedback.type === 'error' ? 'alert' : 'status'}
              style={{
                marginBottom: pendingRequests.length > 0 ? '1rem' : 0,
                padding: '0.7rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                border: `2px solid ${parentRequestFeedback.type === 'error' ? 'var(--error)' : '#10b981'}`,
                background: parentRequestFeedback.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.1)',
                color: parentRequestFeedback.type === 'error' ? 'var(--error)' : '#047857',
                fontWeight: 700,
              }}
            >
              <i className={`fa-solid ${parentRequestFeedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />{' '}
              {parentRequestFeedback.message}
            </div>
          )}

          {pendingRequestsLoading && <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Checking for parent link requests…</p>}
          {pendingRequestsError && !pendingRequestsLoading && (
            <div role="alert" style={{ color: 'var(--error)', fontWeight: 700 }}>
              <i className="fa-solid fa-circle-exclamation" /> {pendingRequestsError}
            </div>
          )}

          {pendingRequests.length > 0 && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 550 }}>
              Accept only if you recognize the parent. Acceptance gives them access to your learning progress.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingRequests.map((p) => {
              const pid = p._id || p;
              const isAccepting = parentRequestAction?.parentId === pid && parentRequestAction.action === 'accept';
              const isRejecting = parentRequestAction?.parentId === pid && parentRequestAction.action === 'reject';
              const actionsDisabled = Boolean(parentRequestAction);
              const parentName = typeof p === 'object' ? (p.FullName || p.UserName || 'Parent') : 'Parent';
              const parentDetails = typeof p === 'object' ? (p.Email || (p.UserName ? `@${p.UserName}` : '')) : '';
              return (
                <div key={pid} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--card-bg)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '2px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}>
                  <div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{parentName}</strong>
                    {parentDetails && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({parentDetails})</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleParentRequest(pid, 'accept')}
                      disabled={actionsDisabled}
                      style={{
                        padding: '0.4rem 1rem',
                        background: '#10b981',
                        color: 'white',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: '700',
                        cursor: actionsDisabled ? 'not-allowed' : 'pointer',
                        fontSize: '0.82rem',
                        boxShadow: '2px 2px 0px 0px var(--shadow-color)',
                        opacity: actionsDisabled && !isAccepting ? 0.55 : 1,
                      }}
                    >
                      {isAccepting ? 'Accepting…' : '✓ Accept'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleParentRequest(pid, 'reject')}
                      disabled={actionsDisabled}
                      style={{
                        padding: '0.4rem 1rem',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: '700',
                        cursor: actionsDisabled ? 'not-allowed' : 'pointer',
                        fontSize: '0.82rem',
                        boxShadow: '2px 2px 0px 0px var(--shadow-color)',
                        opacity: actionsDisabled && !isRejecting ? 0.55 : 1,
                      }}
                    >
                      {isRejecting ? 'Declining…' : '✕ Decline'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════ NEXT SESSION COUNTDOWN ══════ */}
      {upcomingSessions.length > 0 && (
        <NextSessionCountdown session={upcomingSessions[0]} role="student" />
      )}

      {/* ══════ BENTO STATS ROW 1 ══════ */}
      <div className="stats-grid">
         <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--accent-yellow)' }}><i className="fa-solid fa-list-check" /></div>
            <div className="stat-info">
               <h3>{ts.totalTasks ?? '—'}</h3>
               <p>Total Tasks</p>
            </div>
         </div>
         <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--accent-peach)' }}><i className="fa-solid fa-circle-check" /></div>
            <div className="stat-info">
               <h3>{ts.completedTasks ?? '—'}</h3>
               <p>Completed</p>
            </div>
         </div>
         <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--accent-orange)' }}><i className="fa-solid fa-hourglass-half" /></div>
            <div className="stat-info">
               <h3>{ts.pendingTasks ?? '—'}</h3>
               <p>Pending Tasks</p>
            </div>
         </div>
         <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--brand-primary)', color: '#FFFFFF' }}><i className="fa-solid fa-trophy" /></div>
            <div className="stat-info">
               <h3>{ts.completionRate !== undefined ? `${Math.round(ts.completionRate)}%` : '—'}</h3>
               <p>Completion Rate</p>
            </div>
         </div>
      </div>

      {/* ══════ BENTO STATS ROW 2 — Submissions ══════ */}
      <div className="stats-grid">
         <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--accent-rose)' }}><i className="fa-solid fa-file-lines" /></div>
            <div className="stat-info">
               <h3>{ss.totalSubmissions ?? '—'}</h3>
               <p>Total Submissions</p>
            </div>
         </div>
         <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--accent-yellow)' }}><i className="fa-solid fa-inbox" /></div>
            <div className="stat-info">
               <h3>{ss.reviewed ?? '—'}</h3>
               <p>Reviewed</p>
            </div>
         </div>
         <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--accent-orange)' }}><i className="fa-solid fa-paper-plane" /></div>
            <div className="stat-info">
               <h3>{ss.pending ?? '—'}</h3>
               <p>Awaiting Review</p>
            </div>
         </div>
         <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--brand-primary)', color: '#FFFFFF' }}><i className="fa-solid fa-triangle-exclamation" /></div>
            <div className="stat-info">
               <h3>{ss.late ?? '—'}</h3>
               <p>Late Submissions</p>
            </div>
         </div>
      </div>

      {/* ══════ PROGRESS TRACKER (Colorful Neo-Brutalist bar) ══════ */}
      <div style={{
        background: 'var(--card-bg)',
        border: 'var(--card-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        padding: '1.25rem',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ 
            fontFamily: 'var(--font-heading)',
            fontSize: '1.15rem',
            margin: 0,
            fontWeight: 400
          }}>Progress Tracker</h2>
          <span style={{
            display: 'inline-flex',
            padding: '0.2rem 0.6rem',
            background: completionRate >= 75 ? 'var(--accent-yellow)' : completionRate >= 40 ? 'var(--accent-orange)' : 'var(--brand-primary)',
            color: completionRate >= 75 ? 'var(--text-primary)' : 'var(--text-primary)',
            border: '2px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            fontWeight: '700',
            letterSpacing: '0.04em',
          }}>{completionRate}% COMPLETE</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${completionRate}%` }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>
            {ts.completedTasks ?? 0} of {ts.totalTasks ?? 0} tasks completed
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>
            {ts.pendingTasks ?? 0} remaining
          </span>
        </div>
      </div>

      {/* ══════ BENTO MAIN ROW ══════ */}
      <div className="dashboard-main-row">
        {/* ══════ SESSION REVIEW AVERAGES ══════ */}
        <div className="courses-section">
          <div className="section-header">
            <h2>Performance Ratings</h2>
            <span style={{ 
              fontSize: '0.75rem', 
              padding: '0.15rem 0.5rem',
              background: 'var(--accent-yellow)',
              border: '2px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '700'
            }}>{rs.Count ?? 0} REVIEWS</span>
          </div>
          
          <div style={{ padding: '0.25rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: 'var(--radius-sm)',
                background: 'var(--brand-primary)',
                border: '3px solid var(--border-color)',
                boxShadow: '4px 4px 0px 0px var(--shadow-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: '700', fontSize: '1.4rem',
                fontFamily: 'var(--font-heading)',
              }}>
                {rs.avgOverall !== undefined ? rs.avgOverall.toFixed(1) : '—'}
              </div>
              <div style={{ marginLeft: '1rem' }}>
                <p style={{ fontFamily: 'var(--font-heading)', fontWeight: '400', fontSize: '1.15rem', margin: 0 }}>Overall Average</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0, fontWeight: '600' }}>out of 5.0</p>
              </div>
            </div>
            {ratingBar('Behavior', rs.avgBehavior || 0)}
            {ratingBar('Understanding', rs.avgUnderstanding || 0)}
            {ratingBar('Participation', rs.avgParticipation || 0)}
            {ratingBar('Coding', rs.avgCoding || 0)}
          </div>
        </div>

        {/* ══════ UPCOMING (Next Lesson Card) ══════ */}
        <div className="tasks-section">
          <div className="section-header">
            <h2>Upcoming</h2>
            <Link to="/dashboard/sessions" className="view-all-btn">Sessions →</Link>
          </div>

          {/* Next Lesson Highlight */}
          {upcomingSessions.length > 0 && (
            <div
              onClick={() => navigate('/dashboard/sessions')}
              style={{
                background: 'var(--accent-yellow)',
                color: 'var(--text-primary)',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                border: '3px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: '1rem',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-2px, -2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            >
              <p style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.3rem', color: 'var(--brand-primary)' }}>▶ Next Lesson</p>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', margin: '0 0 0.2rem', color: 'var(--text-primary)' }}>{upcomingSessions[0].title}</h3>
              <p style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-secondary)' }}>
                {new Date(upcomingSessions[0].date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
          )}

          {/* Upcoming Sessions */}
          {upcomingSessions.length > 1 && (
            <>
              <h4 style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '700', fontFamily: 'var(--font-body)' }}>Sessions</h4>
              <ul className="task-list">
                {upcomingSessions.slice(1).map(s => (
                  <li key={s._id} className="task-item upcoming" onClick={() => navigate('/dashboard/sessions')}>
                    <div className="task-meta">
                      <h4>{s.title}</h4>
                      <p>{new Date(s.date).toLocaleDateString()}</p>
                    </div>
                    <div className="task-status">{new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Pending Tasks */}
          {pendingTasks.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0 0.5rem' }}>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '700', fontFamily: 'var(--font-body)' }}>Pending Tasks</h4>
                <Link to="/dashboard/tasks" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-primary)', textDecoration: 'underline' }}>View All</Link>
              </div>
              <ul className="task-list">
                {pendingTasks.slice(0, 5).map(t => {
                  const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
                  return (
                    <li key={t._id} className={`task-item ${isOverdue ? 'overdue' : 'pending'}`} onClick={() => navigate('/dashboard/tasks')}>
                      <div className="task-meta">
                        <h4>{t.title}</h4>
                        <p>{t.sessionId?.title || 'Task'}</p>
                      </div>
                      <div className="task-status">{isOverdue ? 'Overdue' : new Date(t.dueDate).toLocaleDateString()}</div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Pending External HW */}
          {pendingExtHws.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0 0.5rem' }}>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '700', fontFamily: 'var(--font-body)' }}>External Homework</h4>
                <Link to="/dashboard/external" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-primary)', textDecoration: 'underline' }}>View All</Link>
              </div>
              <ul className="task-list">
                {pendingExtHws.slice(0, 4).map(hw => {
                  const isOverdue = hw.dueDate && new Date(hw.dueDate) < new Date();
                  return (
                    <li key={hw._id} className={`task-item ${isOverdue ? 'overdue' : 'pending'}`} onClick={() => navigate('/dashboard/external')}>
                      <div className="task-meta">
                        <h4>{hw.title || 'Untitled'}</h4>
                        <p>{hw.externalCourse?.subject || 'External'}</p>
                      </div>
                      <div className="task-status">{isOverdue ? 'Overdue' : (hw.dueDate ? new Date(hw.dueDate).toLocaleDateString() : '—')}</div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {upcomingSessions.length === 0 && pendingTasks.length === 0 && pendingExtHws.length === 0 && (
            <div style={{ 
              padding: '1.5rem', 
              textAlign: 'center', 
              background: 'var(--bg-tertiary)', 
              border: '2px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '2px 2px 0px 0px var(--shadow-color)'
            }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: '1.5rem', color: 'var(--success)', marginBottom: '0.35rem', display: 'block' }} />
              <p style={{ color: 'var(--text-muted)', fontWeight: '600', margin: 0, fontSize: '0.85rem' }}>No upcoming items — you're all caught up!</p>
            </div>
          )}
        </div>
      </div>

      {/* ══════ EXTERNAL COURSES BENTO ══════ */}
      {extCourses.length > 0 && (
        <div style={{
          background: 'var(--card-bg)',
          border: 'var(--card-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)',
          padding: '1.25rem',
          transition: 'transform 0.12s ease, box-shadow 0.12s ease'
        }}>
          <div className="section-header">
            <h2>Active Modules</h2>
            <Link to="/dashboard/external" className="view-all-btn">View All →</Link>
          </div>
          <div className="dash-cards">
            {extCourses.slice(0, 6).map(c => (
              <div key={c._id} style={{
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)',
                border: '2px solid var(--border-color)',
                borderTop: `4px solid ${c.color || 'var(--brand-primary)'}`,
                boxShadow: '2px 2px 0px 0px var(--shadow-color)',
                transition: 'all 0.12s ease',
                cursor: 'pointer'
              }}
              onClick={() => navigate('/dashboard/external')}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-2px, -2px)'; e.currentTarget.style.boxShadow = '4px 4px 0px 0px var(--shadow-color)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px 0px var(--shadow-color)'; }}
              >
                <h4 style={{ margin: '0 0 0.2rem', fontSize: '0.95rem', fontFamily: 'var(--font-heading)', fontWeight: 400 }}>{c.subject}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0, fontWeight: '600' }}>{c.teacher || ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
