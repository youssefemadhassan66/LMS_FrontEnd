import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApiRequest } from '../../hooks/useApiRequest';
import Pagination from '../../components/Pagination/Pagination';
import Modal from '../../components/Modal/Modal';
import ScalePicker from '../../components/ScalePicker/ScalePicker';
import DateRangeFilter from '../../components/DateRangeFilter/DateRangeFilter';
import { appendDateRange } from '../../utils/dateRangeParams';
import { safeUrl } from '../../utils/safeUrl';
import { SkeletonCardGrid } from '../../components/Skeleton/Skeleton';

// The bands the old slider printed under its track: 0 Fair, 5 Good,
// 7 Very good, 10 Full mark.
const SCORE_CAPTIONS = Object.fromEntries(
  Array.from({ length: 11 }, (_, score) => [
    score,
    score === 10 ? 'Full mark' : score >= 7 ? 'Very good' : score >= 5 ? 'Good' : 'Fair',
  ]),
);

const statusStyles = {
  Completed: { bg: 'rgba(16,185,129,0.1)', color: 'var(--success)' },
  Pending: { bg: 'rgba(245,158,11,0.1)', color: 'var(--warning)' },
  Reviewed: { bg: 'rgba(59,130,246,0.1)', color: 'var(--info)' },
  Resubmitted: { bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6' },
  'Late submission': { bg: 'rgba(239,68,68,0.1)', color: 'var(--error)' },
};

const SubmissionsPage = () => {
  const { user } = useAuth();
  const { request, requestFormData } = useApiRequest();
  const role = user?.role || 'student';
  const isAdmin = role === 'admin' || role === 'instructor';
  const canUpload = role === 'student';
  const canDeleteFiles = role === 'student' || role === 'instructor' || role === 'admin';

  const [uploadingId, setUploadingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [studentFilter, setStudentFilter] = useState('');

  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewScore, setReviewScore] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const [updateTarget, setUpdateTarget] = useState(null);
  const [updateLinks, setUpdateLinks] = useState([{ name: '', url: '' }]);
  const [updateNote, setUpdateNote] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  /* Data + pagination */
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Date filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const base = (role === 'student' || role === 'parent') ? '/api/v1/submission/me' : '/api/v1/submission';
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      appendDateRange(params, 'createdAt', dateFrom, dateTo);
      const data = await request(`${base}?${params.toString()}`);
      const list = data.data?.docs || data.data?.submissions || data.data || [];
      const arr = Array.isArray(list) ? list : [];
      setAllSubmissions(arr);
      setTotalDocs(data.data?.total || data.totalDocs || data.results || arr.length);
      setTotalPages(data.data?.totalPages || data.totalPages || 1);
      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [role, request, page, limit, dateFrom, dateTo]);

  useEffect(() => { refetch(); }, [refetch]);

  const submissions = allSubmissions.filter(sub => {
    if (!studentFilter) return true;
    const name = sub.studentProfileId?.user?.FullName || sub.student?.FullName || '';
    return name.toLowerCase().includes(studentFilter.toLowerCase());
  });

  const handleUpload = async (submissionId, files) => {
    if (!files || files.length === 0) return;
    if (files.length > 5) {
      setActionError('You can upload up to 5 files at once.');
      return;
    }

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));

    setUploadingId(submissionId);
    setActionError(null);
    try {
      await requestFormData(`/api/v1/submission/${submissionId}/files`, 'POST', formData);
      await refetch();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const isBeforeDue = (sub) => {
    const due = sub.task?.dueDate;
    return due && new Date(due) > new Date();
  };

  const openUpdate = (sub) => {
    const existing = sub.Task_links?.length > 0
      ? sub.Task_links.map(l => ({ name: l.name || '', url: l.url || '' }))
      : [{ name: '', url: '' }];
    setUpdateLinks(existing);
    setUpdateNote(sub.note || '');
    setUpdateError(null);
    setUpdateTarget(sub);
  };

  const handleUpdateSubmission = async (e) => {
    e.preventDefault();
    const validLinks = updateLinks.filter(l => l.name.trim() && l.url.trim());
    if (validLinks.length === 0) {
      setUpdateError('Please add at least one link with a name and URL.');
      return;
    }
    setUpdateLoading(true);
    setUpdateError(null);
    try {
      await request(`/api/v1/submission/${updateTarget._id}/submit`, 'PATCH', {
        Task_links: validLinks,
        note: updateNote,
      });
      setUpdateTarget(null);
      await refetch();
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdateLoading(false);
    }
  };

  const openReview = (sub) => {
    setReviewTarget(sub);
    setReviewScore(sub.review?.score ?? 5);
    setReviewComment(sub.review?.comment || '');
    setReviewError(null);
  };

  const handleReview = async (e) => {
    e.preventDefault();
    setReviewLoading(true);
    setReviewError(null);
    try {
      await request(`/api/v1/submission/${reviewTarget._id}/review`, 'PATCH', {
        score: Number(reviewScore),
        comment: reviewComment,
      });
      setReviewTarget(null);
      await refetch();
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteFile = async (submissionId, publicId) => {
    if (!publicId) return;
    setUploadingId(submissionId);
    setActionError(null);
    try {
      await request(`/api/v1/submission/${submissionId}/files?publicId=${encodeURIComponent(publicId)}`, 'DELETE');
      await refetch();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div style={{ padding: '2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Submissions</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>{submissions.length} total</p>
        </div>
        {isAdmin && (
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
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', pointerEvents: 'none' }}><i className="fa-solid fa-magnifying-glass" /></span>
          </div>
        )}
      </div>

      {/* Date filter */}
      <div style={{ marginBottom: '1.25rem' }}>
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); setPage(1); }}
        />
      </div>

      {loading && <SkeletonCardGrid count={6} minWidth={360} />}
      {error && <p style={{ color: 'var(--error)' }}>{error}</p>}
      {actionError && <div className="modal-error" style={{ marginBottom: '1rem' }}>{actionError}</div>}

      {!loading && submissions.length === 0 && (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <h3>No submissions found</h3>
          <p style={{ color: 'var(--text-muted)' }}>Submissions will appear here once tasks are submitted.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
        {submissions.map((sub) => {
          const st = statusStyles[sub.status] || statusStyles.Pending;
          const attachments = sub.fileAttachments || [];
          const links = sub.Task_links || [];

          return (
            <section key={sub._id} className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.05rem' }}>{sub.task?.title || 'Untitled task'}</h3>
                  {isAdmin && (sub.studentProfileId?.user?.FullName || sub.student?.FullName) && (
                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                      <i className="fa-solid fa-graduation-cap" style={{ color: '#10b981' }} /> {sub.studentProfileId?.user?.FullName || sub.student?.FullName}
                    </p>
                  )}
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Submitted: {sub.SubmissionDate ? new Date(sub.SubmissionDate).toLocaleDateString() : '-'}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
                  <span style={{ padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-md)', background: st.bg, color: st.color, fontWeight: 700, fontSize: '0.8rem' }}>
                    {sub.status}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => openReview(sub)}
                      style={{
                        padding: '0.3rem 0.7rem',
                        background: 'var(--brand-primary)',
                        color: '#fff',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        boxShadow: '2px 2px 0px 0px var(--shadow-color)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {sub.review?.score !== undefined ? <><i className="fa-solid fa-pen-to-square" /> Edit Score</> : <><i className="fa-solid fa-star" /> Give Score</>}
                    </button>
                  )}
                  {role === 'student' && isBeforeDue(sub) && (
                    <button
                      onClick={() => openUpdate(sub)}
                      style={{
                        padding: '0.3rem 0.7rem',
                        background: 'var(--accent-yellow)',
                        color: 'var(--text-primary)',
                        border: '2px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        boxShadow: '2px 2px 0px 0px var(--shadow-color)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <><i className="fa-solid fa-pen-to-square" /> Update</>
                    </button>
                  )}
                  {role === 'student' && sub.task?.dueDate && !isBeforeDue(sub) && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--error)', fontWeight: 700 }}>
                      Deadline passed
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 }}>Score</div>
                  <div style={{ fontWeight: 700 }}>{sub.review?.score !== undefined ? `${sub.review.score}/10` : '-'}</div>
                </div>
                <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 }}>Rating</div>
                  <div style={{ fontWeight: 700 }}>{sub.review?.rating || '-'}</div>
                </div>
              </div>

              {(sub.note || sub.review?.comment) && (
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{sub.note || sub.review?.comment}</p>
              )}

              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Links</h4>
                {links.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No links submitted.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {links.map((link, index) => (
                      <a key={`${link.url}-${index}`} href={safeUrl(link.url)} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>
                        {link.name || link.url}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Files</h4>
                {attachments.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No files uploaded.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {attachments.map((file) => (
                      <div key={file.publicId || file.url} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', padding: '0.6rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                        <a href={safeUrl(file.url)} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.name || file.format || 'Attachment'}
                        </a>
                        {canDeleteFiles && file.publicId && (
                          <button className="modal-btn modal-btn-danger" style={{ padding: '0.35rem 0.55rem', width: 'auto' }} disabled={uploadingId === sub._id} onClick={() => handleDeleteFile(sub._id, file.publicId)}>
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canUpload && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '2px solid var(--border-color)' }}>
                  <label className="modal-label">Upload files</label>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem',
                    background: 'var(--bg-tertiary)', border: '2px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)', cursor: uploadingId === sub._id ? 'not-allowed' : 'pointer',
                    boxShadow: '2px 2px 0px 0px var(--shadow-color)', transition: 'all 0.1s ease',
                    opacity: uploadingId === sub._id ? 0.6 : 1,
                  }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem',
                      background: 'var(--brand-primary)', color: '#fff', border: '2px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.78rem',
                      textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                    }}><i className="fa-solid fa-paperclip" /> Choose Files</span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Drop or browse files
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,video/*,.mblok,.sb3"
                      disabled={uploadingId === sub._id}
                      onChange={(event) => handleUpload(sub._id, event.target.files)}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <p className="modal-hint">Up to 5 files, 10MB each. Images, PDFs, videos, and Scratch/mBlock projects (.sb3, .mblok) are supported.</p>
                  {uploadingId === sub._id && <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Uploading...</p>}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {!loading && submissions.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(n) => { setLimit(n); setPage(1); }}
          total={totalDocs}
        />
      )}

      {/* UPDATE SUBMISSION MODAL */}
      <Modal
        isOpen={!!updateTarget}
        onClose={() => setUpdateTarget(null)}
        title="Update Submission"
        subtitle={updateTarget?.task?.title}
      >
        {updateTarget?.task?.dueDate && (
          <p className="modal-due">
            <i className="fa-solid fa-clock" aria-hidden="true" /> Due {new Date(updateTarget.task.dueDate).toLocaleString()}
          </p>
        )}

        <form onSubmit={handleUpdateSubmission}>
          {updateError && <div className="modal-error" style={{ marginBottom: '1rem' }}>{updateError}</div>}

          <div className="modal-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label className="modal-label" style={{ margin: 0 }}>Submission Links</label>
              <button
                type="button"
                onClick={() => setUpdateLinks([...updateLinks, { name: '', url: '' }])}
                className="modal-add-btn"
              >+ Add Link</button>
            </div>
            {updateLinks.map((link, i) => (
              <div key={i} className="modal-link-row">
                <input
                  className="modal-input"
                  placeholder="Name (e.g., GitHub)"
                  value={link.name}
                  onChange={e => { const u = [...updateLinks]; u[i] = { ...u[i], name: e.target.value }; setUpdateLinks(u); }}
                />
                <input
                  className="modal-input"
                  style={{ flex: 2 }}
                  placeholder="https://..."
                  type="url"
                  value={link.url}
                  onChange={e => { const u = [...updateLinks]; u[i] = { ...u[i], url: e.target.value }; setUpdateLinks(u); }}
                />
                {updateLinks.length > 1 && (
                  <button
                    type="button"
                    className="modal-link-remove"
                    onClick={() => { const u = updateLinks.filter((_, idx) => idx !== i); setUpdateLinks(u.length ? u : [{ name: '', url: '' }]); }}
                  >✕</button>
                )}
              </div>
            ))}
          </div>

          <div className="modal-form-group" style={{ marginTop: '1rem' }}>
            <label className="modal-label">Notes (Optional)</label>
            <textarea
              className="modal-textarea"
              placeholder="Any additional notes..."
              value={updateNote}
              onChange={e => setUpdateNote(e.target.value)}
              style={{ minHeight: '70px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="button" className="modal-btn modal-btn-ghost" onClick={() => setUpdateTarget(null)}>
              Cancel
            </button>
            <button type="submit" disabled={updateLoading} className="modal-btn modal-btn-primary" style={{ flex: 1 }}>
              {updateLoading ? 'Saving...' : <><i className="fa-solid fa-floppy-disk" /> Save Update</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* REVIEW MODAL */}
      <Modal
        isOpen={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title="Grade Submission"
        size="sm"
        subtitle={[reviewTarget?.task?.title, reviewTarget?.studentProfileId?.user?.FullName].filter(Boolean).join(' · ')}
      >
        <form onSubmit={handleReview}>
          {reviewError && <div className="modal-error" style={{ marginBottom: '1rem' }}>{reviewError}</div>}

          <ScalePicker
            label="Score"
            value={reviewScore}
            max={10}
            captions={SCORE_CAPTIONS}
            onChange={setReviewScore}
          />

          <div className="modal-form-group" style={{ marginTop: '1rem' }}>
            <label className="modal-label">Comment (optional)</label>
            <textarea
              className="modal-textarea"
              placeholder="Feedback for the student..."
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              style={{ minHeight: '80px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="button" className="modal-btn modal-btn-ghost" onClick={() => setReviewTarget(null)}>
              Cancel
            </button>
            <button type="submit" disabled={reviewLoading} className="modal-btn modal-btn-primary" style={{ flex: 1 }}>
              {reviewLoading ? 'Saving...' : <><i className="fa-solid fa-floppy-disk" /> Save Grade</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SubmissionsPage;
