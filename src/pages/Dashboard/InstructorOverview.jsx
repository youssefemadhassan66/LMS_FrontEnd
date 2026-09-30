import React from 'react';
import useFetchData from '../../hooks/useFetchData';
import { useAuth } from '../../context/AuthContext';
import NextSessionCountdown from '../../components/NextSessionCountdown/NextSessionCountdown';
import './DashboardOverview.css';
import CountUp from '../../components/Motion/CountUp';

const InstructorOverview = () => {
  const { user } = useAuth();
  const instructorName = user?.FullName?.split(' ')[0] || 'Instructor';

  // Instructor-scoped endpoints — each returns only data for this instructor's students
  const { data: sessions, loading: sessionsLoading } = useFetchData('/api/v1/session/me');
  const { data: tasks, loading: tasksLoading } = useFetchData('/api/v1/task');
  const { data: submissions, loading: subsLoading } = useFetchData('/api/v1/submission');
  const { data: reviews, loading: reviewsLoading } = useFetchData('/api/v1/sessionReview');

  const sessionList = Array.isArray(sessions) ? sessions : (sessions?.docs || sessions?.sessions || []);
  const taskList = Array.isArray(tasks) ? tasks : (tasks?.docs || tasks?.tasks || []);
  const submissionList = Array.isArray(submissions) ? submissions : (submissions?.docs || submissions?.submissions || []);
  const reviewList = Array.isArray(reviews) ? reviews : (reviews?.docs || reviews?.reviews || []);

  // Derived stats
  // Submissions waiting for the instructor to grade: anything submitted but not yet reviewed.
  // 'Pending' in this schema means "student hasn't submitted yet" — that's the student's queue, not the instructor's.
  const awaitingReview = submissionList.filter(s => ['Completed', 'Resubmitted', 'Late submission'].includes(s.status));
  const reviewedSubs = submissionList.filter(s => s.status === 'Reviewed');
  const upcomingSessions = sessionList.filter(s => s.status === 'pending' && new Date(s.date) > new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
  const pendingTasks = taskList.filter(t => t.status === 'pending');
  const completedTasks = taskList.filter(t => t.status === 'completed');
  const completionRate = taskList.length > 0 ? Math.round((completedTasks.length / taskList.length) * 100) : 0;

  // Review averages
  const avgOverall = reviewList.length > 0 ? (reviewList.reduce((sum, r) => sum + (r.overAllRating || 0), 0) / reviewList.length).toFixed(1) : '—';

  return (
    <div className="overview-container">
      <div>
        <h1 className="page-title">Welcome, {instructorName}! <i className="fa-solid fa-chalkboard-user" style={{ color: 'var(--brand-primary)' }} /></h1>
        <p className="page-subtitle">Here's an overview of your teaching activity.</p>
      </div>

      {/* ══════ NEXT SESSION COUNTDOWN ══════ */}
      {upcomingSessions.length > 0 && (
        <NextSessionCountdown session={upcomingSessions[0]} role="instructor" />
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-yellow)' }}><i className="fa-solid fa-calendar-days" /></div>
          <div className="stat-info">
            <h3><CountUp value={sessionsLoading ? '...' : sessionList.length} /></h3>
            <p>Total Sessions</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-peach)' }}><i className="fa-solid fa-pen-to-square" /></div>
          <div className="stat-info">
            <h3><CountUp value={tasksLoading ? '...' : taskList.length} /></h3>
            <p>Tasks Assigned</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--brand-primary)', color: '#FFFFFF' }}><i className="fa-solid fa-inbox" /></div>
          <div className="stat-info">
            <h3>{subsLoading ? '...' : `${awaitingReview.length} / ${submissionList.length}`}</h3>
            <p>Awaiting Review</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-orange)' }}><i className="fa-solid fa-chart-line" /></div>
          <div className="stat-info">
            <h3><CountUp value={tasksLoading ? '...' : completionRate} suffix={tasksLoading ? '' : '%'} /></h3>
            <p>Task Completion</p>
          </div>
        </div>
      </div>

      {/* Second Stats Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-rose)' }}><i className="fa-solid fa-star" /></div>
          <div className="stat-info">
            <h3>{reviewsLoading ? '...' : avgOverall}</h3>
            <p>Avg Rating</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-yellow)' }}><i className="fa-solid fa-circle-check" /></div>
          <div className="stat-info">
            <h3><CountUp value={tasksLoading ? '...' : completedTasks.length} /></h3>
            <p>Completed Tasks</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-orange)' }}><i className="fa-solid fa-hourglass-half" /></div>
          <div className="stat-info">
            <h3><CountUp value={tasksLoading ? '...' : pendingTasks.length} /></h3>
            <p>Pending Tasks</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-peach)' }}><i className="fa-solid fa-book-open" /></div>
          <div className="stat-info">
            <h3><CountUp value={reviewsLoading ? '...' : reviewList.length} /></h3>
            <p>Reviews Given</p>
          </div>
        </div>
      </div>

      {/* Progress Tracker */}
      <div style={{
        background: 'var(--card-bg)',
        border: 'var(--card-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        padding: '1.25rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', margin: 0, fontWeight: 400 }}>Task Completion</h2>
          <span style={{
            display: 'inline-flex',
            padding: '0.2rem 0.6rem',
            background: completionRate >= 75 ? 'var(--accent-yellow)' : completionRate >= 40 ? 'var(--accent-orange)' : 'var(--brand-primary)',
            color: completionRate >= 75 ? 'var(--text-primary)' : 'var(--text-primary)',
            border: '2px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            fontWeight: '700',
          }}>{completionRate}%</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${completionRate}%` }}></div>
        </div>
      </div>

      <div className="dashboard-main-row">
        {/* Upcoming Sessions */}
        <div className="courses-section">
          <div className="section-header">
            <h2>Upcoming Sessions</h2>
            <span style={{ 
              fontSize: '0.72rem', 
              padding: '0.15rem 0.5rem',
              background: 'var(--accent-yellow)',
              border: '2px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '700'
            }}>{upcomingSessions.length} UPCOMING</span>
          </div>

          {/* Next Session Highlight */}
          {upcomingSessions.length > 0 && (
            <div style={{
              background: 'var(--brand-primary)',
              color: '#FFFFFF',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: '3px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '1rem'
            }}>
              <p style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.3rem', opacity: 0.9 }}>▶ Next Session</p>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', margin: '0 0 0.2rem', color: '#FFFFFF' }}>{upcomingSessions[0].title}</h3>
              <p style={{ fontSize: '0.82rem', margin: 0, opacity: 0.9 }}>
                {new Date(upcomingSessions[0].date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                {' · '}
                {new Date(upcomingSessions[0].date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}

          <div className="course-list">
            {sessionsLoading ? <p style={{ color: 'var(--text-muted)' }}>Loading sessions...</p> :
             upcomingSessions.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No upcoming sessions.</p> :
             upcomingSessions.slice(1, 6).map(session => (
              <div key={session._id} className="course-item">
                <div className="course-img" style={{ background: 'var(--accent-yellow)' }}>
                  {new Date(session.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                </div>
                <div className="course-details">
                  <h4>{session.title}</h4>
                  <p>{session.description?.slice(0, 60) || 'No description'}</p>
                  <p style={{ fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submissions list — show awaiting-review first, fall back to most recent */}
        <div className="tasks-section">
          <div className="section-header">
            <h2>Recent Submissions</h2>
            <span style={{
              fontSize: '0.72rem',
              padding: '0.15rem 0.5rem',
              background: awaitingReview.length > 0 ? 'var(--accent-orange)' : 'var(--accent-yellow)',
              border: '2px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '700'
            }}>{awaitingReview.length} TO GRADE</span>
          </div>
          <ul className="task-list">
            {subsLoading ? <li className="task-item"><div className="task-meta"><h4>Loading...</h4></div></li> :
             submissionList.length === 0 ? (
              <li style={{
                padding: '1.5rem',
                textAlign: 'center',
                background: 'var(--bg-tertiary)',
                border: '2px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '2px 2px 0px 0px var(--shadow-color)'
              }}>
                <i className="fa-solid fa-envelope-open" style={{ fontSize: '1.5rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }} />
                <p style={{ color: 'var(--text-muted)', fontWeight: '600', margin: 0, fontSize: '0.85rem' }}>No submissions yet.</p>
              </li>
             ) :
             // show awaiting-review first, then any others, so the panel is always populated when data exists
             [...awaitingReview, ...reviewedSubs].slice(0, 6).map(sub => {
              const studentName = sub.studentProfileId?.user?.FullName || sub.studentProfileId?.user?.UserName;
              const badgeBg = sub.status === 'Reviewed' ? 'var(--accent-yellow)'
                : sub.status === 'Late submission' ? 'var(--brand-primary)'
                : 'var(--accent-orange)';
              const badgeColor = sub.status === 'Late submission' ? '#FFFFFF' : 'var(--text-primary)';
              return (
                <li key={sub._id} className="task-item upcoming">
                  <div className="task-meta">
                    <h4>{sub.task?.title || 'Submission'}</h4>
                    <p>
                      {studentName ? `${studentName} · ` : ''}
                      {sub.SubmissionDate ? `Submitted ${new Date(sub.SubmissionDate).toLocaleDateString()}` : 'Not yet submitted'}
                    </p>
                  </div>
                  <div className="task-status" style={{ background: badgeBg, color: badgeColor }}>{sub.status}</div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InstructorOverview;
