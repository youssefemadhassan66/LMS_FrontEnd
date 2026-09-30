import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal/Modal';
import Pagination from '../../components/Pagination/Pagination';
import DateRangeFilter from '../../components/DateRangeFilter/DateRangeFilter';
import { SkeletonCardGrid } from '../../components/Skeleton/Skeleton';
import { useApiRequest } from '../../hooks/useApiRequest';
import { appendDateRange } from '../../utils/dateRangeParams';
import { safeUrl } from '../../utils/safeUrl';

const statusColor = (s) => {
  if (s === 'completed') return '#10b981';
  if (s === 'canceled') return '#ef4444';
  return '#f59e0b';
};

const TasksPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { request, requestFormData } = useApiRequest();
  const role = user?.role || 'student';
  const isAdmin = role === 'admin' || role === 'instructor';
  const isStudent = role === 'student';

  const [tasks, setTasks] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [myStudents, setMyStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Date filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [viewTask, setViewTask] = useState(null);
  const [submitTask, setSubmitTask] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Bulk assignment state
  const [assignMode, setAssignMode] = useState('single');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');

  const emptyForm = { title: '', description: '', dueDate: '', sessionId: '', studentProfileId: '', instructorId: '', status: 'pending', taskLinks: [{ title: '', link: '' }] };
  const [formData, setFormData] = useState(emptyForm);
  
  const [submissionLinks, setSubmissionLinks] = useState([{ name: '', url: '' }]);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState([]);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const base = isAdmin ? '/api/v1/task' : '/api/v1/task/me';
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filter !== 'all') params.set('status', filter);
      appendDateRange(params, 'dueDate', dateFrom, dateTo);
      const data = await request(`${base}?${params.toString()}`);
      const list = data.data?.tasks || data.data?.docs || [];
      setTasks(Array.isArray(list) ? list : [list]);
      setTotalDocs(data.data?.total || data.totalDocs || data.results || list.length);
      setTotalPages(data.data?.totalPages || data.totalPages || 1);
      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [isAdmin, page, limit, filter, dateFrom, dateTo, request]);

  // Instructors & Admins: load their own sessions + student profiles
  const fetchInstructorMeta = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const sessEndpoint = role === 'instructor' ? '/api/v1/session/me' : '/api/v1/session';
      const sessData = await request(sessEndpoint).catch(() => null);
      const sessions = sessData?.data?.docs || sessData?.data?.sessions || [];
      const sessionList = Array.isArray(sessions) ? sessions : [];
      setMySessions(sessionList);

      const seen = new Set();
      const students = [];

      // Fetch student profiles. /all is the list route (the bare collection
      // path has no GET and 404'd, leaving only students who had a session);
      // for an instructor it is already scoped to their assigned students.
      const profileRes = await request('/api/v1/StudentProfile/all?limit=200').catch(() => null);
      const allProfiles = profileRes?.data?.docs || profileRes?.data?.profiles || profileRes?.data || [];
      if (Array.isArray(allProfiles)) {
        allProfiles.forEach(p => {
          if (p && p._id && !seen.has(p._id)) {
            seen.add(p._id);
            students.push(p);
          }
        });
      }

      sessionList.forEach(s => {
        const p = s.studentProfileId;
        if (p && typeof p === 'object' && p._id && !seen.has(p._id)) {
          seen.add(p._id);
          students.push(p);
        }
      });
      setMyStudents(students);
    } catch { /* non-critical */ }
  }, [isAdmin, role, request]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => { fetchInstructorMeta(); }, [fetchInstructorMeta]);

  const handleCreate = async (e) => {
    e.preventDefault(); setFormLoading(true); setFormError(null);
    try {
      const validLinks = formData.taskLinks.filter(l => l.title.trim() || l.link.trim());
      
      if (assignMode === 'bulk') {
        if (!selectedStudentIds || selectedStudentIds.length === 0) {
          setFormError('Please select at least one student for bulk assignment.');
          setFormLoading(false);
          return;
        }
        if (!formData.sessionId) {
          setFormError('Please select a session for bulk assignment.');
          setFormLoading(false);
          return;
        }
        const bulkPayload = {
          title: formData.title,
          description: formData.description,
          dueDate: formData.dueDate,
          sessionIds: [formData.sessionId],
          studentProfileIds: selectedStudentIds,
          ...(validLinks.length > 0 ? { taskLinks: validLinks } : {})
        };
        await request('/api/v1/task/bulk', 'POST', bulkPayload);
      } else {
        const payload = {
          title: formData.title,
          description: formData.description,
          dueDate: formData.dueDate,
          sessionId: formData.sessionId,
          studentProfileId: formData.studentProfileId,
          instructorId: formData.instructorId || user?._id
        };
        if (validLinks.length > 0) payload.taskLinks = validLinks;
        await request('/api/v1/task', 'POST', payload);
      }

      setShowCreate(false);
      setFormData(emptyForm);
      setSelectedStudentIds([]);
      setAssignMode('single');
      await fetchTasks();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault(); setFormLoading(true); setFormError(null);
    try {
      const payload = {};
      if (formData.title) payload.title = formData.title;
      if (formData.description) payload.description = formData.description;
      if (formData.dueDate) payload.dueDate = formData.dueDate;
      if (formData.status) payload.status = formData.status;
      const validLinks = formData.taskLinks.filter(l => l.title.trim() || l.link.trim());
      if (validLinks.length > 0) payload.taskLinks = validLinks;
      await request(`/api/v1/task/${editTask._id}`, 'PATCH', payload);
      setEditTask(null); await fetchTasks();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const resetSubmitModal = () => {
    setSubmitTask(null);
    setSubmissionLinks([{ name: '', url: '' }]);
    setSubmissionNote('');
    setSubmissionFiles([]);
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault(); setFormLoading(true); setFormError(null);
    try {
      const validLinks = submissionLinks.filter(l => l.url.trim());
      if (validLinks.length === 0 && submissionFiles.length === 0) {
        setFormError('Please add at least one link or file');
        setFormLoading(false);
        return;
      }
      // Ensure name always has a value so backend validation passes
      const normalizedLinks = validLinks.map(l => ({
        name: l.name.trim() || 'Submission',
        url: l.url.trim(),
      }));

      // Backend expects studentProfileId when we already have the profile id on the task.
      const payload = {
        taskId: submitTask._id,
        studentProfileId: submitTask.studentProfileId?._id || submitTask.studentProfileId,
        Task_links: normalizedLinks,
        note: submissionNote,
      };

      const created = await request('/api/v1/submission', 'POST', payload);
      const submissionId = created?.data?.submission?._id;

      // Upload any attached files to the freshly created submission.
      if (submissionId && submissionFiles.length > 0) {
        const fd = new FormData();
        submissionFiles.forEach(f => fd.append('files', f));
        try {
          await requestFormData(`/api/v1/submission/${submissionId}/files`, 'POST', fd);
        } catch (fileErr) {
          // The submission was created; only the file upload failed. Don't trap
          // the student in the modal (re-submitting would 400 "already exists").
          resetSubmitModal();
          await fetchTasks();
          alert(`Task submitted, but file upload failed: ${fileErr.message}\nYou can still add files from the Submissions page.`);
          return;
        }
      }

      resetSubmitModal();
      await fetchTasks();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try { await request(`/api/v1/task/${taskId}`, 'PATCH', { status: newStatus }); await fetchTasks(); }
    catch (err) { alert(err.message); }
  };

  const handleDelete = async () => {
    setFormLoading(true); setFormError(null);
    try { await request(`/api/v1/task/${deleteTask._id}`, 'DELETE'); setDeleteTask(null); await fetchTasks(); }
    catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const openEdit = (t) => {
    setFormData({ title: t.title || '', description: t.description || '', dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 16) : '', sessionId: t.sessionId?._id || t.sessionId || '', studentProfileId: t.studentProfileId?._id || t.studentProfileId || '', instructorId: t.instructorId?._id || t.instructorId || '', status: t.status || 'pending', taskLinks: t.taskLinks?.length > 0 ? t.taskLinks.map(l => ({ title: l.title || '', link: l.link || '' })) : [{ title: '', link: '' }] });
    setFormError(null); setEditTask(t);
  };

  const openSubmit = (t) => {
    setSubmissionLinks([{ name: '', url: '' }]);
    setSubmissionNote('');
    setSubmissionFiles([]);
    setFormError(null);
    setSubmitTask(t);
  };

  const updateLink = (i, field, value) => { const u = [...formData.taskLinks]; u[i] = { ...u[i], [field]: value }; setFormData({ ...formData, taskLinks: u }); };
  const addLink = () => setFormData({ ...formData, taskLinks: [...formData.taskLinks, { title: '', link: '' }] });
  const removeLink = (i) => { const u = formData.taskLinks.filter((_, idx) => idx !== i); setFormData({ ...formData, taskLinks: u.length ? u : [{ title: '', link: '' }] }); };

  const updateSubmissionLink = (i, field, value) => { const u = [...submissionLinks]; u[i] = { ...u[i], [field]: value }; setSubmissionLinks(u); };
  const addSubmissionLink = () => setSubmissionLinks([...submissionLinks, { name: '', url: '' }]);
  const removeSubmissionLink = (i) => { const u = submissionLinks.filter((_, idx) => idx !== i); setSubmissionLinks(u.length ? u : [{ name: '', url: '' }]); };

  const MAX_SUBMISSION_FILES = 5;
  const addSubmissionFiles = (fileList) => {
    const picked = Array.from(fileList || []);
    if (picked.length === 0) return;
    setSubmissionFiles(prev => {
      const combined = [...prev, ...picked];
      if (combined.length > MAX_SUBMISSION_FILES) setFormError(`You can attach up to ${MAX_SUBMISSION_FILES} files.`);
      return combined.slice(0, MAX_SUBMISSION_FILES);
    });
  };
  const removeSubmissionFile = (i) => setSubmissionFiles(prev => prev.filter((_, idx) => idx !== i));
  const formatFileSize = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const filteredTasks = tasks.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (studentFilter) {
      const name = t.studentProfileId?.user?.FullName || '';
      if (!name.toLowerCase().includes(studentFilter.toLowerCase())) return false;
    }
    return true;
  });
  const isOverdue = (d) => d && new Date(d) < new Date();
  const counts = { all: tasks.length, pending: tasks.filter(t => t.status === 'pending').length, completed: tasks.filter(t => t.status === 'completed').length, canceled: tasks.filter(t => t.status === 'canceled').length };

  const renderFormFields = (isEdit) => (
    <>
      <div className="modal-form-group">
        <label className="modal-label">Title</label>
        <input className="modal-input" required placeholder="Task title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
      </div>
      <div className="modal-form-group">
        <label className="modal-label">Description</label>
        <textarea className="modal-textarea" required placeholder="Task description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
      </div>
      <div className="modal-row modal-row-2">
        <div className="modal-form-group">
          <label className="modal-label">Due Date</label>
          <input className="modal-input" type="datetime-local" required={!isEdit} value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
        </div>
        <div className="modal-form-group">
          <label className="modal-label">Status</label>
          <select className="modal-select" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
      </div>
      {!isEdit && (
        <>
          <div className="modal-form-group">
            <label className="modal-label">Assignment Mode</label>
            <div className="modal-segmented-control">
              <button
                type="button"
                className={`modal-segmented-btn ${assignMode === 'single' ? 'active' : ''}`}
                onClick={() => setAssignMode('single')}
              >
                <i className="fa-solid fa-user" /> Single Student
              </button>
              <button
                type="button"
                className={`modal-segmented-btn ${assignMode === 'bulk' ? 'active' : ''}`}
                onClick={() => setAssignMode('bulk')}
              >
                <i className="fa-solid fa-users-gear" /> Bulk Students
              </button>
            </div>
          </div>

          <div className="modal-row modal-row-2">
            <div className="modal-form-group">
              <label className="modal-label">Session</label>
              {mySessions.length > 0 ? (
                <select className="modal-select" required value={formData.sessionId} onChange={e => setFormData({ ...formData, sessionId: e.target.value })}>
                  <option value="">Choose a session</option>
                  {mySessions.map(s => (
                    <option key={s._id} value={s._id}>{s.title || s._id}</option>
                  ))}
                </select>
              ) : (
                <input className="modal-input" required placeholder="Session ObjectId" value={formData.sessionId} onChange={e => setFormData({ ...formData, sessionId: e.target.value })} />
              )}
            </div>

            {assignMode === 'single' && (
              <div className="modal-form-group">
                <label className="modal-label">Student</label>
                {myStudents.length > 0 ? (
                  <select className="modal-select" required value={formData.studentProfileId} onChange={e => setFormData({ ...formData, studentProfileId: e.target.value })}>
                    <option value="">Choose a student</option>
                    {myStudents.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.user?.FullName || p.user?.UserName || p._id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="modal-input" required placeholder="Student Profile ObjectId" value={formData.studentProfileId} onChange={e => setFormData({ ...formData, studentProfileId: e.target.value })} />
                )}
              </div>
            )}
          </div>

          {assignMode === 'bulk' && (
            <div className="modal-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="modal-label" style={{ margin: 0 }}>
                  Select Students ({selectedStudentIds.length} of {myStudents.length} Selected)
                </label>
              </div>

              <div className="bulk-student-container">
                <div className="bulk-student-header">
                  <input
                    type="text"
                    className="bulk-student-search"
                    placeholder="Search students by name..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                  />
                  <button
                    type="button"
                    className="modal-add-btn"
                    onClick={() => {
                      if (selectedStudentIds.length === myStudents.length) {
                        setSelectedStudentIds([]);
                      } else {
                        setSelectedStudentIds(myStudents.map(p => p._id));
                      }
                    }}
                  >
                    <i className="fa-solid fa-check-double" /> {selectedStudentIds.length === myStudents.length ? 'Deselect All' : `Select All (${myStudents.length})`}
                  </button>
                </div>

                <div className="bulk-student-grid">
                  {myStudents
                    .filter(p => {
                      if (!studentSearch.trim()) return true;
                      const name = p.user?.FullName || p.user?.UserName || '';
                      return name.toLowerCase().includes(studentSearch.toLowerCase());
                    })
                    .map(p => {
                      const isSelected = selectedStudentIds.includes(p._id);
                      const name = p.user?.FullName || p.user?.UserName || 'Student';
                      const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'ST';
                      return (
                        <div
                          key={p._id}
                          className={`student-card-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedStudentIds(prev => prev.filter(id => id !== p._id));
                            } else {
                              setSelectedStudentIds(prev => [...prev, p._id]);
                            }
                          }}
                        >
                          <div className="student-card-avatar">{initials}</div>
                          <div className="student-card-info">
                            <span className="student-card-name">{name}</span>
                            {p.grade && <span className="student-card-meta">Grade {p.grade}</span>}
                          </div>
                          <div className="student-card-check">
                            {isSelected && <i className="fa-solid fa-check" />}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <div className="modal-form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <label className="modal-label" style={{ margin: 0 }}>Resource Links</label>
          <button type="button" onClick={addLink} className="modal-add-btn">+ Add Link</button>
        </div>
        {formData.taskLinks.map((link, i) => (
          <div key={i} className="modal-link-row">
            <input className="modal-input" placeholder="Title" value={link.title} onChange={e => updateLink(i, 'title', e.target.value)} />
            <input className="modal-input" style={{ flex: 2 }} placeholder="https://..." type="url" value={link.link} onChange={e => updateLink(i, 'link', e.target.value)} />
            {formData.taskLinks.length > 1 && <button type="button" onClick={() => removeLink(i)} className="modal-link-remove">✕</button>}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div style={{ padding: '2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Tasks & Assignments</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>{tasks.length} total tasks</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setFormData({ ...emptyForm, instructorId: user?._id || '' }); setFormError(null); setShowCreate(true); }} className="modal-btn modal-btn-primary" style={{ width: 'auto', padding: '0.65rem 1.4rem' }}><i className="fa-solid fa-plus" /> Create Task</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'pending', 'completed', 'canceled'].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }} style={{
            padding: '0.5rem 1rem', background: filter === f ? 'var(--brand-primary)' : 'var(--bg-tertiary)',
            color: filter === f ? 'white' : 'var(--text-secondary)',
            border: filter === f ? 'none' : '1px solid var(--border-color)',
            borderRadius: '100px', fontWeight: '600', cursor: 'pointer', fontSize: '0.82rem', textTransform: 'capitalize', transition: 'all 0.15s ease',
          }}>{f} ({counts[f]})</button>
        ))}
        {isAdmin && (
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
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
      <div style={{ marginBottom: '1.5rem' }}>
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); setPage(1); }}
        />
      </div>

      {loading && <SkeletonCardGrid count={6} minWidth={370} />}
      {error && <p style={{ color: 'var(--error)' }}>{error}</p>}
      {!loading && filteredTasks.length === 0 && <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', borderRadius: '1rem' }}><h3>No {filter !== 'all' ? filter : ''} tasks found</h3></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(370px, 1fr))', gap: '1.5rem' }}>
        {filteredTasks.map(task => (
          <div key={task._id} className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', borderTop: `3px solid ${statusColor(task.status)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, flex: 1 }}>{task.title}</h3>
              <span className="modal-badge" style={{ background: statusColor(task.status) + '18', color: statusColor(task.status), textTransform: 'capitalize', marginLeft: '0.5rem' }}>{task.status}</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{task.description}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span><i className="fa-solid fa-calendar-days" style={{ color: '#6366f1', marginRight: '0.3rem' }} />Due: <strong style={{ color: isOverdue(task.dueDate) && task.status !== 'completed' ? '#ef4444' : 'var(--text-primary)' }}>{task.dueDate ? new Date(task.dueDate).toLocaleString() : 'N/A'}</strong></span>
              {task.sessionId?.title && <span><i className="fa-solid fa-book-open" style={{ color: '#3b82f6', marginRight: '0.3rem' }} />{task.sessionId.title}</span>}
              {task.instructorId?.FullName && <span><i className="fa-solid fa-chalkboard-user" style={{ color: '#f59e0b', marginRight: '0.3rem' }} />{task.instructorId.FullName}</span>}
              {isAdmin && task.studentProfileId?.user?.FullName && (
                <span 
                  style={{ color: 'var(--brand-primary)', cursor: 'pointer', textDecoration: 'underline' }} 
                  onClick={() => navigate(`/dashboard/child/${task.studentProfileId._id}`)}
                  title="View student profile"
                >
                  <i className="fa-solid fa-graduation-cap" style={{ color: '#10b981', marginRight: '0.3rem' }} />{task.studentProfileId.user.FullName}
                </span>
              )}
            </div>
            {task.taskLinks?.length > 0 && <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>{task.taskLinks.map((l, i) => <a key={i} href={safeUrl(l.link)} target="_blank" rel="noreferrer" className="modal-chip" style={{ color: 'var(--brand-primary)', fontSize: '0.78rem' }}><i className="fa-solid fa-link" /> {l.title || 'Resource'}</a>)}</div>}
            <div style={{ display: 'flex', gap: '0.35rem', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '2px solid var(--border-color)' }}>
              <button onClick={() => setViewTask(task)} style={{ flex: 1, padding: '0.45rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', boxShadow: '2px 2px 0px 0px var(--shadow-color)', transition: 'all 0.1s ease' }}><i className="fa-solid fa-eye" /> View</button>

              {isStudent && task.status === 'pending' && (
                <button onClick={() => openSubmit(task)} style={{ flex: 1, padding: '0.45rem', background: 'var(--success)', color: '#fff', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', boxShadow: '2px 2px 0px 0px var(--shadow-color)', transition: 'all 0.1s ease' }}><i className="fa-solid fa-paper-plane" /> Submit</button>
              )}

              {isAdmin && (
                <>
                  {task.status === 'pending' && <button onClick={() => handleStatusChange(task._id, 'completed')} style={{ flex: 1, padding: '0.45rem', background: 'var(--success)', color: '#fff', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', boxShadow: '2px 2px 0px 0px var(--shadow-color)', transition: 'all 0.1s ease' }}><i className="fa-solid fa-circle-check" /> Done</button>}
                  <button onClick={() => openEdit(task)} style={{ padding: '0.45rem 0.55rem', background: 'var(--info)', color: '#fff', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', boxShadow: '2px 2px 0px 0px var(--shadow-color)', transition: 'all 0.1s ease' }}><i className="fa-solid fa-pen-to-square" /></button>
                  <button onClick={() => { setFormError(null); setDeleteTask(task); }} style={{ padding: '0.45rem 0.55rem', background: 'var(--error)', color: '#fff', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', boxShadow: '2px 2px 0px 0px var(--shadow-color)', transition: 'all 0.1s ease' }}><i className="fa-solid fa-trash" /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {!loading && filteredTasks.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(n) => { setLimit(n); setPage(1); }}
          total={totalDocs}
        />
      )}

      {/* VIEW MODAL */}
      <Modal isOpen={!!viewTask} onClose={() => setViewTask(null)} title={viewTask?.title || 'Task Details'} size="lg">
        {viewTask && (
          <>
            <div className="modal-detail-grid">
              <div className="modal-detail-item"><div className="detail-label">Status</div><span className="modal-badge" style={{ background: statusColor(viewTask.status) + '18', color: statusColor(viewTask.status), textTransform: 'capitalize' }}>{viewTask.status}</span></div>
              <div className="modal-detail-item"><div className="detail-label">Due Date</div><div className="detail-value" style={{ color: isOverdue(viewTask.dueDate) && viewTask.status !== 'completed' ? '#ef4444' : '' }}>{viewTask.dueDate ? new Date(viewTask.dueDate).toLocaleString() : '—'}</div></div>
              <div className="modal-detail-item"><div className="detail-label">Session</div><div className="detail-value">{viewTask.sessionId?.title || '—'}</div></div>
              <div className="modal-detail-item"><div className="detail-label">Instructor</div><div className="detail-value">{viewTask.instructorId?.FullName || '—'}</div></div>
            </div>
            <div className="modal-section-label">Description</div>
            <p style={{ color: 'var(--text-secondary)' }}>{viewTask.description}</p>
            {viewTask.taskLinks?.length > 0 && (<><div className="modal-section-label">Resources</div><div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>{viewTask.taskLinks.map((l, i) => <a key={i} href={safeUrl(l.link)} target="_blank" rel="noreferrer" className="modal-chip" style={{ color: 'var(--brand-primary)' }}><i className="fa-solid fa-link" /> {l.title || 'Link'}</a>)}</div></>)}
            {role === 'admin' && (
              <div className="modal-detail-grid" style={{ marginTop: '1rem' }}>
                <div className="modal-detail-item"><div className="detail-label">Task ID</div><div className="detail-value mono">{viewTask._id}</div></div>
                <div className="modal-detail-item"><div className="detail-label">Created</div><div className="detail-value">{viewTask.createdAt ? new Date(viewTask.createdAt).toLocaleString() : '—'}</div></div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* CREATE MODAL */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setSelectedStudentIds([]); setAssignMode('single'); }} title={assignMode === 'bulk' ? 'Create Bulk Tasks' : 'Create New Task'} size="lg">
        <form onSubmit={handleCreate}>
          {formError && <div className="modal-error"><i className="fa-solid fa-triangle-exclamation" /> {formError}</div>}
          {renderFormFields(false)}
          <button type="submit" disabled={formLoading} className="modal-btn modal-btn-primary" style={{ marginTop: '1rem' }}>
            {formLoading ? 'Assigning...' : <><i className="fa-solid fa-plus" /> {assignMode === 'bulk' ? `Assign Tasks to ${selectedStudentIds.length} Student(s)` : 'Create Task'}</>}
          </button>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal isOpen={!!editTask} onClose={() => setEditTask(null)} title={`Edit — ${editTask?.title}`} size="lg">
        <form onSubmit={handleUpdate}>{formError && <div className="modal-error"><i className="fa-solid fa-triangle-exclamation" /> {formError}</div>}{renderFormFields(true)}<button type="submit" disabled={formLoading} className="modal-btn modal-btn-info">{formLoading ? 'Saving...' : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}</button></form>
      </Modal>

      {/* SUBMIT MODAL */}
      <Modal isOpen={!!submitTask} onClose={resetSubmitModal} title={`Submit — ${submitTask?.title}`} size="lg">
        <form onSubmit={handleSubmitTask}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Submit your completed work by adding links (project, GitHub repo, etc.) and/or attaching files.
          </p>

          {formError && <div className="modal-error"><i className="fa-solid fa-triangle-exclamation" /> {formError}</div>}

          <div className="modal-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label className="modal-label" style={{ margin: 0 }}>Submission Links</label>
              <button type="button" onClick={addSubmissionLink} className="modal-add-btn">+ Add Link</button>
            </div>
            {submissionLinks.map((link, i) => (
              <div key={i} className="modal-link-row">
                <input className="modal-input" placeholder="Name (e.g., GitHub, Live Demo)" value={link.name} onChange={e => updateSubmissionLink(i, 'name', e.target.value)} />
                <input className="modal-input" style={{ flex: 2 }} placeholder="https://..." type="url" value={link.url} onChange={e => updateSubmissionLink(i, 'url', e.target.value)} />
                {submissionLinks.length > 1 && <button type="button" onClick={() => removeSubmissionLink(i)} className="modal-link-remove">✕</button>}
              </div>
            ))}
          </div>

          <div className="modal-form-group">
            <label className="modal-label">Attach Files (Optional)</label>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem',
              background: 'var(--bg-tertiary)', border: '2px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)', cursor: submissionFiles.length >= MAX_SUBMISSION_FILES ? 'not-allowed' : 'pointer',
              boxShadow: '2px 2px 0px 0px var(--shadow-color)', transition: 'all 0.1s ease',
              opacity: submissionFiles.length >= MAX_SUBMISSION_FILES ? 0.6 : 1,
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem',
                background: 'var(--brand-primary)', color: '#fff', border: '2px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.78rem',
                textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
              }}><i className="fa-solid fa-paperclip" /> Choose Files</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {submissionFiles.length > 0 ? `${submissionFiles.length} of ${MAX_SUBMISSION_FILES} selected` : 'Select one or more files'}
              </span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,video/*,.mblok,.sb3"
                disabled={submissionFiles.length >= MAX_SUBMISSION_FILES}
                onChange={(e) => { addSubmissionFiles(e.target.files); e.target.value = ''; }}
                style={{ display: 'none' }}
              />
            </label>
            <p className="modal-hint">Up to {MAX_SUBMISSION_FILES} files, 10MB each. Images, PDFs, videos, and Scratch/mBlock projects (.sb3, .mblok) are supported.</p>
            {submissionFiles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                {submissionFiles.map((file, i) => (
                  <div key={`${file.name}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 600, minWidth: 0 }}>
                      <i className="fa-solid fa-file" style={{ color: 'var(--brand-primary)', marginRight: '0.4rem' }} />{file.name}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {formatFileSize(file.size)}</span>
                    </span>
                    <button type="button" onClick={() => removeSubmissionFile(i)} className="modal-link-remove">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-form-group">
            <label className="modal-label">Notes (Optional)</label>
            <textarea className="modal-textarea" placeholder="Any additional notes about your submission..." value={submissionNote} onChange={e => setSubmissionNote(e.target.value)} style={{ minHeight: '80px' }} />
          </div>

          <button type="submit" disabled={formLoading} className="modal-btn modal-btn-success" style={{ marginTop: '0.5rem' }}>
            {formLoading ? 'Submitting...' : <><i className="fa-solid fa-circle-check" /> Submit Task</>}
          </button>
        </form>
      </Modal>

      {/* DELETE MODAL */}
      <Modal isOpen={!!deleteTask} onClose={() => setDeleteTask(null)} title="Delete Task" size="sm">
        <div className="modal-warning-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
        <p className="modal-warning-text">Delete <strong>"{deleteTask?.title}"</strong>?</p>
        <p className="modal-warning-sub">This will also affect linked submissions. This action is permanent.</p>
        {formError && <div className="modal-error"><i className="fa-solid fa-triangle-exclamation" /> {formError}</div>}
        <div className="modal-actions">
          <button onClick={() => setDeleteTask(null)} className="modal-btn modal-btn-ghost">Cancel</button>
          <button onClick={handleDelete} disabled={formLoading} className="modal-btn modal-btn-danger">{formLoading ? 'Deleting...' : <><i className="fa-solid fa-trash" /> Delete</>}</button>
        </div>
      </Modal>
    </div>
  );
};

export default TasksPage;
