import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApiRequest } from '../../hooks/useApiRequest';
import Modal from '../../components/Modal/Modal';
import ScalePicker from '../../components/ScalePicker/ScalePicker';
import Pagination from '../../components/Pagination/Pagination';
import DateRangeFilter from '../../components/DateRangeFilter/DateRangeFilter';
import { appendDateRange } from '../../utils/dateRangeParams';
import { SkeletonCardGrid } from '../../components/Skeleton/Skeleton';

const RATING_CAPTIONS = {
  0: 'Not rated',
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

const emptyReviewForm = {
  session: '',
  studentProfileId: '',
  Behavior: 3,
  underStanding: 3,
  participation: 3,
  coding: 3,
  notes: '',
};

const ReviewsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { request } = useApiRequest();
  const role = user?.role || 'student';
  const isAdmin = role === 'admin' || role === 'instructor';

  const [studentFilter, setStudentFilter] = useState('');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* Pagination */
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Date filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [sessions, setSessions] = useState([]);
  const [studentProfiles, setStudentProfiles] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [editReview, setEditReview] = useState(null);
  const [formData, setFormData] = useState(emptyReviewForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const base = (role === 'student' || role === 'parent')
        ? '/api/v1/sessionReview/me'
        : '/api/v1/sessionReview';
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      appendDateRange(params, 'createdAt', dateFrom, dateTo);
      const data = await request(`${base}?${params.toString()}`);
      const list = data.data?.docs || data.data?.reviews || data.data;
      const arr = Array.isArray(list) ? list : [];
      setReviews(arr);
      setTotalDocs(data.data?.total || data.totalDocs || data.results || arr.length);
      setTotalPages(data.data?.totalPages || data.totalPages || 1);
      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [role, request, page, limit, dateFrom, dateTo]);

  const fetchSessionsAndProfiles = useCallback(async () => {
    if (!isAdmin) return;
    try {
      // Instructors only see their own sessions and linked students
      const sessionEndpoint = role === 'instructor' ? '/api/v1/session/me' : '/api/v1/session';
      const profileEndpoint = role === 'instructor' ? '/api/v1/session/me/students' : '/api/v1/StudentProfile/all';
      const [sessData, profData] = await Promise.all([
        request(sessionEndpoint),
        request(profileEndpoint),
      ]);
      const sessList = sessData.data?.docs || sessData.data?.sessions || sessData.data;
      setSessions(Array.isArray(sessList) ? sessList : []);
      const profList = profData.data?.students || profData.data?.profiles || profData.data?.docs || profData.data;
      setStudentProfiles(Array.isArray(profList) ? profList : []);
    } catch { /* ignore */ }
  }, [isAdmin, role, request]);

  useEffect(() => {
    fetchReviews();
    fetchSessionsAndProfiles();
  }, [fetchReviews, fetchSessionsAndProfiles]);

  const filteredReviews = reviews.filter(review => {
    if (!studentFilter) return true;
    const name = review.studentProfileId?.user?.FullName || '';
    return name.toLowerCase().includes(studentFilter.toLowerCase());
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      await request('/api/v1/sessionReview', 'POST', {
        session: formData.session,
        studentProfileId: formData.studentProfileId,
        Behavior: Number(formData.Behavior),
        underStanding: Number(formData.underStanding),
        participation: Number(formData.participation),
        coding: Number(formData.coding),
        notes: formData.notes,
      });
      setShowCreate(false);
      setFormData(emptyReviewForm);
      await fetchReviews();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      await request(`/api/v1/sessionReview/${editReview._id}`, 'PATCH', {
        Behavior: Number(formData.Behavior),
        underStanding: Number(formData.underStanding),
        participation: Number(formData.participation),
        coding: Number(formData.coding),
        notes: formData.notes,
      });
      setEditReview(null);
      setFormData(emptyReviewForm);
      await fetchReviews();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const openCreate = () => {
    setFormData(emptyReviewForm);
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = (review) => {
    setFormData({
      session: review.session?._id || review.session || '',
      studentProfileId: review.studentProfileId?._id || review.studentProfileId || '',
      Behavior: review.Behavior ?? 3,
      underStanding: review.underStanding ?? 3,
      participation: review.participation ?? 3,
      coding: review.coding ?? 3,
      notes: review.notes || '',
    });
    setFormError(null);
    setEditReview(review);
  };

  const ratingBar = (value, max = 5) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', maxWidth: '100px' }}>
        <div style={{ height: '100%', width: `${(value / max) * 100}%`, background: 'var(--brand-primary)', borderRadius: '3px' }}></div>
      </div>
      <span style={{ fontSize: '0.85rem', fontWeight: '600', minWidth: '30px' }}>{value}/{max}</span>
    </div>
  );

  const ratingInput = (label, field) => (
    <ScalePicker
      label={label}
      value={formData[field]}
      max={5}
      captions={RATING_CAPTIONS}
      onChange={(score) => setFormData((prev) => ({ ...prev, [field]: score }))}
    />
  );

  return (
    <div style={{ padding: '2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Session Reviews</h1>
          <span style={{ color: 'var(--text-muted)' }}>{filteredReviews.length} reviews</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {isAdmin && (
            <>
              <button
                onClick={openCreate}
                className="modal-btn modal-btn-primary"
                style={{ width: 'auto', padding: '0.65rem 1.4rem' }}
              >
                + Create Review
              </button>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Filter by student name..."
                  value={studentFilter}
                  onChange={e => setStudentFilter(e.target.value)}
                  style={{
                    padding: '0.5rem 1rem 0.5rem 2.2rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '100px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    width: '220px',
                    outline: 'none',
                  }}
                />
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', pointerEvents: 'none' }}>
                  <i className="fa-solid fa-magnifying-glass" />
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {error && <p style={{ color: 'var(--error)' }}>{error}</p>}

      {/* Date filter */}
      <div style={{ marginBottom: '1.25rem' }}>
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); setPage(1); }}
        />
      </div>

      {loading && <SkeletonCardGrid count={6} minWidth={350} gap="1.5rem" />}

      {!loading && filteredReviews.length === 0 && (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <h3>No reviews yet</h3>
          <p style={{ color: 'var(--text-muted)' }}>Session reviews will be listed here.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {filteredReviews.map(review => (
          <div
            key={review._id}
            className="glass-panel"
            style={{
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              border: '3px solid var(--border-color)',
              boxShadow: '4px 4px 0px 0px var(--shadow-color)',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translate(-2px, -2px)';
              e.currentTarget.style.boxShadow = '6px 6px 0px 0px var(--shadow-color)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '4px 4px 0px 0px var(--shadow-color)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.1rem' }}>Session Review</h3>
                {review.session?.title && <p style={{ margin: '0', fontSize: '0.85rem', color: 'var(--text-muted)' }}><i className="fa-solid fa-book-open" style={{ color: '#3b82f6' }} /> {review.session.title}</p>}

                {isAdmin && review.studentProfileId?.user?.FullName && (
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '0.4rem',
                      fontSize: '0.85rem',
                      color: 'var(--brand-primary)',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                    onClick={() => navigate(`/dashboard/child/${review.studentProfileId._id}`)}
                    title="View student profile"
                  >
                    <i className="fa-solid fa-graduation-cap" style={{ color: '#10b981' }} /> {review.studentProfileId.user.FullName}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isAdmin && (
                  <button
                    onClick={() => openEdit(review)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      background: 'var(--bg-tertiary)',
                      border: '2px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      boxShadow: '1px 1px 0px 0px var(--shadow-color)',
                    }}
                    title="Edit review"
                  ><i className="fa-solid fa-pen-to-square" /></button>
                )}
                <div style={{
                  background: 'linear-gradient(135deg, var(--brand-primary), var(--info))',
                  color: 'white',
                  width: '42px', height: '42px',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                }}>
                  {review.overAllRating?.toFixed(1) || '—'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Behavior</span>
                {ratingBar(review.Behavior)}
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Understanding</span>
                {ratingBar(review.underStanding)}
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Participation</span>
                {ratingBar(review.participation)}
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Coding</span>
                {ratingBar(review.coding)}
              </div>
            </div>

            {review.notes && (
              <p style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <i className="fa-solid fa-note-sticky" style={{ color: '#a855f7', marginRight: '0.4rem' }} />{review.notes}
              </p>
            )}

            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
            </p>
          </div>
        ))}
      </div>

      {!loading && filteredReviews.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(n) => { setLimit(n); setPage(1); }}
          total={totalDocs}
        />
      )}

      {/* EDIT REVIEW MODAL */}
      <Modal isOpen={!!editReview} onClose={() => { setEditReview(null); setFormData(emptyReviewForm); }} title="Edit Session Review"
        size="lg"
        subtitle={[
          editReview?.session?.title || editReview?.session,
          editReview?.studentProfileId?.user?.FullName,
        ].filter((part) => typeof part === 'string' && part).join(' · ')}
      >
        <form onSubmit={handleUpdate}>
          {formError && <div className="modal-error">{formError}</div>}
          <div className="modal-section-label">Scores</div>
          <div className="modal-row modal-row-2">
            {ratingInput('Behavior', 'Behavior')}
            {ratingInput('Understanding', 'underStanding')}
            {ratingInput('Participation', 'participation')}
            {ratingInput('Coding', 'coding')}
          </div>
          <div className="modal-form-group">
            <label className="modal-label">Notes</label>
            <textarea className="modal-textarea" placeholder="Additional notes about the student's performance..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ minHeight: '80px' }} />
          </div>
          <button type="submit" disabled={formLoading} className="modal-btn modal-btn-info">
            {formLoading ? 'Saving...' : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
          </button>
        </form>
      </Modal>

      {/* CREATE REVIEW MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Session Review" size="lg">
        <form onSubmit={handleCreate}>
          {formError && <div className="modal-error">{formError}</div>}
          <div className="modal-row modal-row-2">
            <div className="modal-form-group">
              <label className="modal-label">Session</label>
              {sessions.length > 0 ? (
                <select className="modal-select" required value={formData.session} onChange={e => setFormData({ ...formData, session: e.target.value })}>
                  <option value="">Choose a session</option>
                  {sessions.map(s => (
                    <option key={s._id} value={s._id}>
                      {s.title} - {s.date ? new Date(s.date).toLocaleDateString() : 'No date'}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="modal-input" required placeholder="Session ObjectId" value={formData.session} onChange={e => setFormData({ ...formData, session: e.target.value })} />
              )}
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Student</label>
              {studentProfiles.length > 0 ? (
                <select className="modal-select" required value={formData.studentProfileId} onChange={e => setFormData({ ...formData, studentProfileId: e.target.value })}>
                  <option value="">Choose a student</option>
                  {studentProfiles.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.user?.FullName || p.user?.UserName || 'Student'}{p.grade ? ` - Grade ${p.grade}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="modal-input" required placeholder="Student Profile ObjectId" value={formData.studentProfileId} onChange={e => setFormData({ ...formData, studentProfileId: e.target.value })} />
              )}
            </div>
          </div>
          <div className="modal-section-label">Scores</div>
          <div className="modal-row modal-row-2">
            {ratingInput('Behavior', 'Behavior')}
            {ratingInput('Understanding', 'underStanding')}
            {ratingInput('Participation', 'participation')}
            {ratingInput('Coding', 'coding')}
          </div>
          <div className="modal-form-group">
            <label className="modal-label">Notes</label>
            <textarea className="modal-textarea" placeholder="Additional notes about the student's performance..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ minHeight: '80px' }} />
          </div>
          <button type="submit" disabled={formLoading} className="modal-btn modal-btn-primary">
            {formLoading ? 'Creating...' : 'Create Review'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default ReviewsPage;
