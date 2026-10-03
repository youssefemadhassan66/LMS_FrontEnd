import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApiRequest } from '../../hooks/useApiRequest';
import './Curriculum.css';
import logger from '../../utils/logger';

const CurriculumPage = () => {
  const { request } = useApiRequest();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCurriculum = async () => {
      try {
        setLoading(true);
        const res = await request('/api/v1/curriculum/courses');
        if (res.status === 'success') {
          setCourses(res.data || []);
        } else {
          setError('Could not retrieve curriculum data.');
        }
      } catch (err) {
        logger.error('Error fetching curriculum:', err);
        setError(err.message || 'Failed to connect to the server.');
      } finally {
        setLoading(false);
      }
    };

    fetchCurriculum();
  }, [request]);

  if (loading) {
    return (
      <div className="curriculum-container" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'petIdle 1s infinite' }}>📚</div>
        <h2>Loading your adventures...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="curriculum-container" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌</div>
        <h2>Oops! Something went wrong</h2>
        <p style={{ color: 'var(--error)', fontWeight: 'bold' }}>{error}</p>
        <button 
          className="nav-btn nav-btn-primary" 
          onClick={() => window.location.reload()}
          style={{ marginTop: '1.5rem', display: 'inline-flex' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="curriculum-container">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">📚 Learning Curriculum</h1>
        <p className="page-subtitle">Embark on interactive Python coding quests, complete puzzles, and level up!</p>
      </div>

      {courses.length === 0 ? (
        <div className="course-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
          <h3>No courses available right now.</h3>
          <p>Check back later or contact your instructor to start your coding adventure!</p>
        </div>
      ) : (
        courses.map((course) => {
          const completedCount = course.completedLessons || 0;
          const totalCount = course.totalLessons || 0;
          const pct = course.percentComplete || 0;

          return (
            <div key={course._id} className="course-card">
              <div className="course-header">
                <div className="course-title-section">
                  <span className="nb-badge nb-badge-peach" style={{ textTransform: 'uppercase', marginRight: '0.5rem' }}>
                    {course.gradeLevel || 'Grades 5-8'}
                  </span>
                  <span className="nb-badge nb-badge-orange" style={{ textTransform: 'uppercase' }}>
                    {course.difficulty || 'Easy'}
                  </span>
                  <h2 style={{ marginTop: '0.75rem', fontSize: '1.75rem' }}>{course.title}</h2>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1rem' }}>
                    {course.description}
                  </p>
                  <div className="course-tags">
                    {course.tags && course.tags.map((t, idx) => (
                      <span key={idx} style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontWeight: 600 }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="course-stats">
                  <div className="progress-text">
                    Progress: {completedCount} / {totalCount} Lessons ({pct}%)
                  </div>
                  <div className="progress-container">
                    <div className="progress-bar" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>

              {/* Modules Grid */}
              <div className="modules-list">
                {course.modules && course.modules.map((mod, modIdx) => (
                  <div key={modIdx} className="module-box">
                    <h3 className="module-title">
                      <span>📦</span> {mod.title}
                    </h3>
                    
                    <div className="lessons-list">
                      {mod.lessons && mod.lessons.map((lesson) => {
                        const isCompleted = lesson.completed;
                        const score = lesson.quizScore;

                        return (
                          <Link 
                            key={lesson._id} 
                            to={`/dashboard/curriculum/lessons/${lesson._id}`}
                            className="lesson-item"
                          >
                            <div className="lesson-info">
                              <span className="lesson-icon">
                                {isCompleted ? (
                                  <span style={{ color: 'var(--success)' }}>✅</span>
                                ) : (
                                  <span>📖</span>
                                )}
                              </span>
                              <span className="lesson-title">{lesson.title}</span>
                            </div>

                            <div className="lesson-meta">
                              <span className="xp-badge">
                                +{lesson.xpReward || 15} XP
                              </span>
                              {isCompleted && typeof score === 'number' && (
                                <span className="score-badge">
                                  Score: {score}%
                                </span>
                              )}
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <i className="fa-solid fa-chevron-right" />
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default CurriculumPage;
