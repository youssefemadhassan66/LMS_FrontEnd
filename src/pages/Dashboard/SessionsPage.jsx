import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal/Modal';
import Pagination from '../../components/Pagination/Pagination';
import DateRangeFilter from '../../components/DateRangeFilter/DateRangeFilter';
import { useApiRequest } from '../../hooks/useApiRequest';
import { appendDateRange } from '../../utils/dateRangeParams';
import { safeUrl } from '../../utils/safeUrl';
import { buildApiUrl } from '../../utils/apiUrl';
import { SkeletonCardList } from '../../components/Skeleton/Skeleton';
import { sanitizeErrorMessage } from '../../utils/errorSanitizer';

/* ─── Warm Status Colors ─── */
const statusColor = (s) => {
  if (s === 'completed') return { bg: 'var(--accent-yellow)', text: 'var(--text-primary)' };
  if (s === 'canceled' || s === 'student canceled') return { bg: 'var(--brand-primary)', text: '#FFFFFF' };
  return { bg: 'var(--accent-orange)', text: 'var(--text-primary)' };   // pending
};

/* ─── Styles (Neo-Brutalist) ─── */
const styles = {
  page: {
    padding: '0',
  },
  /* ── Header ── */
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem',
  },
  title: { fontFamily: 'var(--font-heading)', fontSize: '2rem', margin: 0, fontWeight: 400 },
  subtitle: { color: 'var(--text-muted)', margin: '0.2rem 0 0', fontSize: '0.9rem', fontWeight: 600 },
  createBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
    padding: '0.65rem 1.4rem', background: 'var(--brand-primary)', color: '#FFFFFF',
    border: '3px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
    fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase',
    letterSpacing: '0.04em', boxShadow: 'var(--shadow-sm)',
    cursor: 'pointer', transition: 'all 0.12s ease', fontFamily: 'var(--font-body)',
  },
  headerActions: {
    display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
  },
  exportBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
    padding: '0.65rem 1.1rem', background: 'var(--card-bg)', color: 'var(--text-primary)',
    border: '3px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
    fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase',
    letterSpacing: '0.04em', boxShadow: 'var(--shadow-sm)',
    cursor: 'pointer', transition: 'all 0.12s ease', fontFamily: 'var(--font-body)',
  },

  /* ── Filters ── */
  filtersRow: {
    display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center',
  },
  filterPill: (active) => ({
    padding: '0.4rem 1rem', borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--border-color)',
    background: active ? 'var(--brand-primary)' : 'var(--card-bg)',
    color: active ? '#FFFFFF' : 'var(--text-primary)',
    fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase',
    letterSpacing: '0.04em', cursor: 'pointer',
    boxShadow: active ? 'var(--shadow-sm)' : '2px 2px 0px 0px var(--shadow-color)',
    transition: 'all 0.12s ease', fontFamily: 'var(--font-body)',
    transform: active ? 'translate(-1px, -1px)' : 'none',
  }),
  searchInput: {
    flex: 1, minWidth: '200px', maxWidth: '320px',
    padding: '0.5rem 0.85rem', border: '2px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)', background: 'var(--card-bg)',
    color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 500,
    fontFamily: 'var(--font-body)', outline: 'none',
    boxShadow: '2px 2px 0px 0px var(--shadow-color)',
  },

  /* ── Session Card ── */
  card: {
    background: 'var(--card-bg)', 
    border: '3px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', 
    boxShadow: '4px 4px 0px 0px var(--shadow-color)',
    overflow: 'hidden', 
    transition: 'all 0.2s ease',
  },
  cardHeader: {
    padding: '1.25rem 1.5rem', cursor: 'pointer',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: '1rem', transition: 'background 0.12s ease',
  },
  cardLeft: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 400,
    margin: '0 0 0.3rem', color: 'var(--text-primary)',
  },
  cardDesc: { color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 0.5rem', lineHeight: 1.4 },
  metaRow: { display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, alignItems: 'center' },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: '0.3rem' },
  joinBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.25rem 0.7rem', background: 'var(--success, #10b981)', color: '#FFFFFF',
    border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
    fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.04em', textDecoration: 'none',
    boxShadow: '2px 2px 0px 0px var(--shadow-color)',
  },
  joinBtnDisabled: {
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.25rem 0.7rem', background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
    border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
    fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.04em', textDecoration: 'none',
    cursor: 'not-allowed', opacity: 0.7, font: 'inherit',
  },
  endBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.25rem 0.7rem', background: 'var(--error, #ef4444)', color: '#FFFFFF',
    border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
    fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.04em', cursor: 'pointer', font: 'inherit',
    boxShadow: '2px 2px 0px 0px var(--shadow-color)',
  },
  cardRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 },
  statusBadge: (status) => {
    const c = statusColor(status);
    return {
      padding: '0.25rem 0.7rem', borderRadius: 'var(--radius-sm)',
      border: '2px solid var(--border-color)', background: c.bg, color: c.text,
      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.04em',
    };
  },
  chevron: (expanded) => ({
    width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
    border: '2px solid var(--border-color)', background: 'var(--bg-tertiary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.9rem', transition: 'transform 0.2s ease, background 0.15s ease',
    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
    cursor: 'pointer',
  }),
  actionBtns: { display: 'flex', gap: '0.35rem' },
  actionBtn: () => ({
    padding: '0.3rem 0.5rem', background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)', border: '2px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8rem',
    boxShadow: '1px 1px 0px 0px var(--shadow-color)',
    transition: 'all 0.1s ease',
  }),

  /* ── Expandable Content ── */
  expandedContent: {
    borderTop: '2px solid var(--border-color)',
    padding: '1.25rem 1.5rem', background: 'var(--bg-secondary)',
    animation: 'slideDown 0.25s ease',
  },
  contentGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem',
  },
  contentSection: {
    padding: '1rem', background: 'var(--card-bg)', border: '2px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)', boxShadow: '2px 2px 0px 0px var(--shadow-color)',
  },
  sectionTitle: {
    fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
    margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
  },
  linkItem: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.65rem', borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-tertiary)', border: '2px solid var(--border-color)',
    marginBottom: '0.5rem', textDecoration: 'none', color: 'var(--text-primary)',
    fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.1s ease',
    cursor: 'pointer',
  },
  emptyState: {
    color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.25rem 0',
  },
  summaryBox: {
    padding: '0.75rem', background: 'var(--bg-tertiary)', border: '2px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },

  /* ── AI Summary ── */
  aiSection: {
    marginBottom: '1rem', padding: '1rem', background: 'var(--card-bg)',
    border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
    boxShadow: '2px 2px 0px 0px var(--shadow-color)',
  },
  aiHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap',
  },
  aiText: {
    whiteSpace: 'pre-wrap', fontSize: '0.88rem', color: 'var(--text-secondary)',
    lineHeight: 1.55, margin: 0,
  },
  aiMeta: {
    fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, margin: '0.6rem 0 0',
  },
  aiBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.4rem 0.85rem', background: 'var(--brand-primary)', color: '#fff',
    border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
    fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase',
    letterSpacing: '0.04em', boxShadow: '2px 2px 0px 0px var(--shadow-color)',
    whiteSpace: 'nowrap', fontFamily: 'var(--font-body)',
  },

  /* ── Session Boards (canvas) ── */
  boardsSection: {
    marginBottom: '1rem', padding: '1rem', background: 'var(--card-bg)',
    border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
    boxShadow: '2px 2px 0px 0px var(--shadow-color)',
  },
  boardsRow: {
    display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'stretch',
  },
  boardChip: {
    display: 'flex', flexDirection: 'column', gap: '0.35rem',
    width: '150px', padding: '0', overflow: 'hidden',
    background: 'var(--bg-tertiary)', border: '2px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    color: 'var(--text-primary)', font: 'inherit', textAlign: 'left',
    transition: 'all 0.1s ease',
  },
  boardThumb: {
    height: '78px', width: '100%', objectFit: 'contain', display: 'block',
    background: 'var(--card-bg)', borderBottom: '2px solid var(--border-color)',
  },
  boardThumbEmpty: {
    height: '78px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--card-bg)', borderBottom: '2px solid var(--border-color)',
    color: 'var(--text-muted)', fontSize: '1.35rem',
  },
  boardChipBody: { padding: '0 0.55rem 0.55rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  boardChipTitle: {
    fontSize: '0.8rem', fontWeight: 700, margin: 0,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  boardChipMeta: {
    fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: '0.3rem',
  },
  boardShareDot: (shared) => ({
    display: 'inline-block', width: '0.5rem', height: '0.5rem', flexShrink: 0,
    borderRadius: '50%', border: '1px solid var(--border-color)',
    background: shared ? 'var(--success, #22c55e)' : 'var(--text-muted)',
  }),
};

const SessionsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { request } = useApiRequest();
  const role = user?.role || 'student';
  const isAdmin = role === 'admin' || role === 'instructor';
  const canExportCalendar = ['student', 'parent', 'instructor'].includes(role);

  const [sessions, setSessions] = useState([]);
  const [studentProfiles, setStudentProfiles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Date filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expanded cards
  const [expandedIds, setExpandedIds] = useState(new Set());

  // AI summary generation (instructor/admin)
  const [aiLoadingId, setAiLoadingId] = useState(null);
  const [aiErrors, setAiErrors] = useState({});

  // Canvas boards, keyed by session id and fetched only when a card is
  // expanded. Loading them for every session in the list would be one request
  // per row on a page that already shows twenty.
  // Shape: { status: 'loading' | 'ready' | 'error', docs: [], error: string }
  const [boardsBySession, setBoardsBySession] = useState({});
  const [boardCreatingId, setBoardCreatingId] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [editSession, setEditSession] = useState(null);
  const [deleteSession, setDeleteSession] = useState(null);
  const [endSession, setEndSession] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Bulk session state
  const [assignMode, setAssignMode] = useState('single');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');

  const emptyForm = { title: '', description: '', studentProfileId: '', instructorId: '', date: '', meetingLink: '', notes: '', summary: '', status: 'pending', StudentAttended: true };
  const [formData, setFormData] = useState(emptyForm);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const base = role === 'instructor' ? '/api/v1/session/me' : (isAdmin ? '/api/v1/session' : '/api/v1/session/me');
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      appendDateRange(params, 'date', dateFrom, dateTo);
      const data = await request(`${base}?${params.toString()}`);
      const list = data.data?.docs || data.data?.sessions || [];
      const sessionList = Array.isArray(list) ? list : [list];
      setSessions(sessionList);
      setTotalDocs(data.data?.total || data.totalDocs || data.results || sessionList.length);
      setTotalPages(data.data?.totalPages || data.totalPages || 1);

      // Derived students from existing sessions
      const seen = new Set();
      const students = [];
      sessionList.forEach(s => {
        const p = s.studentProfileId;
        if (p && typeof p === 'object' && p._id && !seen.has(p._id)) {
          seen.add(p._id);
          students.push(p);
        }
      });
      setStudentProfiles(prev => {
        const prevMap = new Map(prev.map(item => [item._id, item]));
        students.forEach(item => prevMap.set(item._id, item));
        return Array.from(prevMap.values());
      });

      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [role, isAdmin, page, limit, statusFilter, dateFrom, dateTo, request]);

  const fetchStudentProfiles = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = role === 'instructor'
        ? await request('/api/v1/student-instructor-assignments/me/students')
        : await request('/api/v1/student-instructor-assignments');
      const nextAssignments = data?.data?.assignments || [];
      const list = role === 'instructor'
        ? (data?.data?.students || [])
        : nextAssignments.map(assignment => assignment.studentProfileId).filter(Boolean);
      setAssignments(nextAssignments);

      // Assignments only ever mention students who already have one, so on
      // their own they cannot answer "who could this session be for". An admin
      // books for anybody, so the roster comes from the profiles endpoint
      // instead — which scopes itself to the caller: every profile for an
      // admin, only the actively assigned ones for an instructor. The default
      // page size there is ten, hence the explicit limit.
      if (role === 'admin') {
        const profileData = await request('/api/v1/StudentProfile/all?limit=500');
        const profiles = profileData?.data?.profiles || [];
        if (Array.isArray(profiles)) list.push(...profiles);
      }

      if (Array.isArray(list) && list.length > 0) {
        setStudentProfiles(prev => {
          const prevMap = new Map(prev.map(item => [item._id, item]));
          list.forEach(item => {
            if (item && item._id) prevMap.set(item._id, item);
          });
          return Array.from(prevMap.values());
        });
      }
    } catch { /* ignore */ }
  }, [isAdmin, request, role]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { fetchStudentProfiles(); }, [fetchStudentProfiles]);

  /* ── Toggle expand ── */
  /* ── Canvas boards attached to a session ── */
  const loadSessionBoards = useCallback(async (sessionId) => {
    setBoardsBySession(prev => ({ ...prev, [sessionId]: { status: 'loading', docs: [] } }));
    try {
      const data = await request(`/api/v1/session-canvas/session/${sessionId}?limit=50`);
      setBoardsBySession(prev => ({
        ...prev,
        [sessionId]: { status: 'ready', docs: data.data?.docs || [] },
      }));
    } catch (err) {
      setBoardsBySession(prev => ({
        ...prev,
        [sessionId]: { status: 'error', docs: [], error: sanitizeErrorMessage(err.message) },
      }));
    }
  }, [request]);

  const handleCreateBoard = async (session) => {
    if (boardCreatingId) return;
    setBoardCreatingId(session._id);
    try {
      const data = await request('/api/v1/session-canvas', 'POST', {
        sessionId: session._id,
        title: `${session.title} — board`,
      });
      navigate(`/dashboard/canvas/${data.data.canvas._id}`);
    } catch (err) {
      setBoardsBySession(prev => ({
        ...prev,
        [session._id]: {
          status: 'error',
          docs: prev[session._id]?.docs || [],
          error: sanitizeErrorMessage(err.message),
        },
      }));
      setBoardCreatingId(null);
    }
  };

  const toggleExpand = (id) => {
    // Decided before the updater runs, not inside it: React can invoke a state
    // updater more than once, and a fetch fired from in there would double up.
    const willExpand = !expandedIds.has(id);

    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    // Fetch on first expand only; re-opening a card reuses what is already there.
    if (willExpand && !boardsBySession[id]) loadSessionBoards(id);
  };

  /* ── Generate / regenerate AI summary (instructor own + admin) ── */
  const handleGenerateAiSummary = async (session) => {
    setAiLoadingId(session._id);
    setAiErrors(prev => ({ ...prev, [session._id]: null }));
    try {
      const data = await request(`/api/v1/session/${session._id}/ai-summary`, 'POST');
      const aiSummary = data.data?.aiSummary;
      setSessions(prev => prev.map(s => (s._id === session._id ? { ...s, aiSummary } : s)));
    } catch (err) {
      setAiErrors(prev => ({ ...prev, [session._id]: err.message }));
    } finally {
      setAiLoadingId(null);
    }
  };

  /* ── Filtered sessions ── */
  const filteredSessions = sessions.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (s.title?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q));
    }
    return true;
  });

  // Count by status
  const counts = {
    all: sessions.length,
    pending: sessions.filter(s => s.status === 'pending').length,
    completed: sessions.filter(s => s.status === 'completed').length,
    canceled: sessions.filter(s => s.status === 'canceled' || s.status === 'student canceled').length,
  };

  /* ── CRUD handlers ── */
  const handleCreate = async (e) => {
    e.preventDefault(); setFormLoading(true); setFormError(null);
    try {
      if (assignMode === 'bulk') {
        if (!selectedStudentIds || selectedStudentIds.length === 0) {
          setFormError('Please select at least one student for bulk session creation.');
          setFormLoading(false);
          return;
        }
        if (!formData.date) {
          setFormError('Please select a Date & Time for the sessions.');
          setFormLoading(false);
          return;
        }
        const bulkPayload = {
          studentProfileIds: selectedStudentIds,
          date: formData.date,
          title: formData.title,
          description: formData.description,
        };
        if (formData.meetingLink) bulkPayload.meetingLink = formData.meetingLink;
        if (formData.notes) bulkPayload.notes = formData.notes;
        if (formData.summary) bulkPayload.summary = formData.summary;
        if (formData.instructorId) bulkPayload.instructorId = formData.instructorId;

        await request('/api/v1/session/bulk', 'POST', bulkPayload);
      } else {
        const payload = {
          title: formData.title,
          description: formData.description,
          studentProfileId: formData.studentProfileId,
          instructorId: formData.instructorId || user?._id,
          date: formData.date,
          StudentAttended: formData.StudentAttended
        };
        if (formData.notes) payload.notes = formData.notes;
        if (formData.summary) payload.summary = formData.summary;
        if (formData.meetingLink) payload.meetingLink = formData.meetingLink;

        await request('/api/v1/session', 'POST', payload);
      }

      setShowCreate(false);
      setFormData(emptyForm);
      setSelectedStudentIds([]);
      setAssignMode('single');
      await fetchSessions();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault(); setFormLoading(true); setFormError(null);
    try {
      const payload = {};
      if (formData.title) payload.title = formData.title;
      if (formData.description) payload.description = formData.description;
      if (formData.summary !== undefined) payload.summary = formData.summary;
      if (formData.notes !== undefined) payload.notes = formData.notes;
      if (formData.meetingLink !== undefined) payload.meetingLink = formData.meetingLink;
      if (formData.status) payload.status = formData.status;
      payload.StudentAttended = formData.StudentAttended;
      await request(`/api/v1/session/${editSession._id}`, 'PATCH', payload);
      setEditSession(null); await fetchSessions();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    setFormLoading(true); setFormError(null);
    try {
      await request(`/api/v1/session/${deleteSession._id}`, 'DELETE');
      setDeleteSession(null); await fetchSessions();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  /* ── End session: clear the meeting link + mark completed so students can no longer join ── */
  const handleEndSession = async () => {
    setFormLoading(true); setFormError(null);
    try {
      await request(`/api/v1/session/${endSession._id}`, 'PATCH', { meetingLink: '', status: 'completed' });
      setEndSession(null); await fetchSessions();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const exportCalendar = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/session/me/calendar.ics'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('access-token') || ''}` },
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Could not export calendar.');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'algogambit-sessions.ics';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(sanitizeErrorMessage(err.message));
    }
  };

  const openEdit = (s) => {
    setFormData({ title: s.title || '', description: s.description || '', studentProfileId: s.studentProfileId?._id || s.studentProfileId || '', instructorId: s.instructorId?._id || s.instructorId || '', date: s.date ? new Date(s.date).toISOString().slice(0, 16) : '', meetingLink: s.meetingLink || '', notes: s.notes || '', summary: s.summary || '', status: s.status || 'pending', StudentAttended: s.StudentAttended !== false });
    setFormError(null); setEditSession(s);
  };

  const assignedInstructors = Array.from(
    new Map(
      assignments
        .map(assignment => assignment.instructorId)
        .filter(Boolean)
        .map(instructor => [instructor._id, instructor]),
    ).values(),
  );

  // Who can be booked, by who is asking. An admin books for any student in the
  // school; an instructor books only for the students assigned to them, which
  // the endpoints above already enforce — /me/students and the profiles
  // endpoint both scope themselves to the caller. Filtering an admin's list by
  // the instructor they picked was the bug: it hid every student who had no
  // assignment yet, including students who had no assignment at all, and left
  // no way to book them a first session.
  const availableStudentProfiles = studentProfiles;

  const renderFormFields = (isEdit) => (
    <>
      {!isEdit && (
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
      )}

      {!isEdit && role === 'admin' && (
        <div className="modal-form-group">
          <label className="modal-label">Assigned Instructor</label>
          <select
            className="modal-select"
            required
            value={formData.instructorId}
            onChange={e => setFormData({ ...formData, instructorId: e.target.value })}
          >
            <option value="">Choose an instructor</option>
            {assignedInstructors.map(instructor => (
              <option key={instructor._id} value={instructor._id}>
                {instructor.FullName || instructor.UserName}
              </option>
            ))}
          </select>
          <p className="modal-hint">The instructor who will run this session.</p>
        </div>
      )}

      <div className="modal-form-group">
        <label className="modal-label">Title</label>
        <input className="modal-input" required placeholder="Session title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
      </div>
      <div className="modal-form-group">
        <label className="modal-label">Description</label>
        <textarea className="modal-textarea" required placeholder="Session description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
      </div>

      {!isEdit && assignMode === 'single' && (
        <div className="modal-form-group">
          <label className="modal-label">Student</label>
          {availableStudentProfiles.length > 0 ? (
            <select className="modal-select" required value={formData.studentProfileId} onChange={e => setFormData({ ...formData, studentProfileId: e.target.value })}>
              <option value="">Choose a student</option>
              {availableStudentProfiles.map(p => (
                <option key={p._id} value={p._id}>
                  {p.user?.FullName || p.user?.UserName || 'Student'}{p.grade ? ` - Grade ${p.grade}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <input className="modal-input" placeholder="ObjectId" required value={formData.studentProfileId} onChange={e => setFormData({ ...formData, studentProfileId: e.target.value })} />
          )}
        </div>
      )}

      {!isEdit && assignMode === 'bulk' && (
        <div className="modal-form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label className="modal-label" style={{ margin: 0 }}>
              Select Students ({selectedStudentIds.length} of {availableStudentProfiles.length} Selected)
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
                  if (selectedStudentIds.length === availableStudentProfiles.length) {
                    setSelectedStudentIds([]);
                  } else {
                    setSelectedStudentIds(availableStudentProfiles.map(p => p._id));
                  }
                }}
              >
                <i className="fa-solid fa-check-double" /> {selectedStudentIds.length === availableStudentProfiles.length ? 'Deselect All' : `Select All (${availableStudentProfiles.length})`}
              </button>
            </div>

            <div className="bulk-student-grid">
              {availableStudentProfiles
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
      <div className="modal-row modal-row-2">
        <div className="modal-form-group">
          <label className="modal-label">Date & Time</label>
          <input className="modal-input" type="datetime-local" required={!isEdit} value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
        </div>
        <div className="modal-form-group">
          <label className="modal-label">Status</label>
          <select className="modal-select" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
            <option value="student canceled">Student Canceled</option>
          </select>
        </div>
      </div>
      <div className="modal-form-group">
        <label className="modal-label">Meeting Link</label>
        <input className="modal-input" type="url" placeholder="https://meet.google.com/... or Zoom link" value={formData.meetingLink} onChange={e => setFormData({ ...formData, meetingLink: e.target.value })} />
        <p className="modal-hint">Shared with the student and parent so they can join the session.</p>
      </div>
      <div className="modal-form-group">
        <label className="modal-checkbox">
          <input type="checkbox" checked={formData.StudentAttended} onChange={e => setFormData({ ...formData, StudentAttended: e.target.checked })} />
          Student Attended
        </label>
      </div>
      <div className="modal-form-group">
        <label className="modal-label">Summary</label>
        <textarea className="modal-textarea" style={{ minHeight: '60px' }} placeholder="Session summary..." value={formData.summary} onChange={e => setFormData({ ...formData, summary: e.target.value })} />
      </div>
      <div className="modal-form-group">
        <label className="modal-label">Notes</label>
        <textarea className="modal-textarea" style={{ minHeight: '60px' }} placeholder="Any notes..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
      </div>
    </>
  );

  return (
    <div style={styles.page}>
      {/* ── CSS Keyframe for expand animation ── */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 600px; }
        }
      `}</style>

      {/* ═══ Header ═══ */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Sessions</h1>
          <p style={styles.subtitle}>{filteredSessions.length} of {sessions.length} sessions</p>
        </div>
        <div style={styles.headerActions}>
          {canExportCalendar && (
            <button
              onClick={exportCalendar}
              style={styles.exportBtn}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-2px, -2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            >
              Export Calendar
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { setFormData({ ...emptyForm, instructorId: role === 'instructor' ? user?._id || '' : '' }); setFormError(null); setShowCreate(true); }}
              style={styles.createBtn}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-2px, -2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            >
              <i className="fa-solid fa-plus" /> Create Session
            </button>
          )}
        </div>
      </div>

      {/* ═══ Filters ═══ */}
      <div style={styles.filtersRow}>
        {['all', 'pending', 'completed', 'canceled'].map(f => (
          <button
            key={f}
            onClick={() => { setStatusFilter(f); setPage(1); }}
            style={styles.filterPill(statusFilter === f)}
            onMouseEnter={e => { if (statusFilter !== f) { e.currentTarget.style.transform = 'translate(-1px, -1px)'; e.currentTarget.style.boxShadow = '3px 3px 0px 0px var(--shadow-color)'; } }}
            onMouseLeave={e => { if (statusFilter !== f) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px 0px var(--shadow-color)'; } }}
          >
            {f === 'all' ? `All (${counts.all})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f]})`}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* ═══ Date filter ═══ */}
      <div style={{ marginBottom: '1.5rem' }}>
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); setPage(1); }}
        />
      </div>

      {/* ═══ Loading / Error / Empty ═══ */}
      {loading && <SkeletonCardList count={4} height={150} />}
      {error && <p style={{ color: 'var(--error)', fontWeight: 600 }}><i className="fa-solid fa-triangle-exclamation" /> {error}</p>}
      {!loading && filteredSessions.length === 0 && (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}><i className="fa-solid fa-calendar-days" /></p>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 400 }}>No sessions found</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'Sessions will appear here once created.'}
          </p>
        </div>
      )}

      {/* ═══ Session Cards ═══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredSessions.map(session => {
          const isExpanded = expandedIds.has(session._id);
          const hasLinks = session.attachmentsLinks?.length > 0;
          const hasVideos = session.recapVideoLinks?.length > 0;
          const hasSummary = !!session.summary;
          const hasNotes = !!session.notes;
          const hasContent = hasLinks || hasVideos || hasSummary || hasNotes;
          const aiSummary = session.aiSummary;
          const hasAi = !!aiSummary?.text;
          const aiBusy = aiLoadingId === session._id;
          const aiErr = aiErrors[session._id];
          const boardState = boardsBySession[session._id];
          const boards = boardState?.docs || [];
          const boardErr = boardState?.error;
          const boardBusy = boardCreatingId === session._id;

          return (
            <div 
              key={session._id} 
              style={styles.card}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translate(-2px, -2px)';
                e.currentTarget.style.boxShadow = '6px 6px 0px 0px var(--shadow-color)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '4px 4px 0px 0px var(--shadow-color)';
              }}
            >
              {/* ── Card Header (Clickable) ── */}
              <div
                style={{
                  ...styles.cardHeader,
                  background: isExpanded ? 'var(--bg-secondary)' : 'transparent',
                }}
                onClick={() => toggleExpand(session._id)}
              >
                <div style={styles.cardLeft}>
                  <h3 style={styles.cardTitle}>{session.title}</h3>
                  <p style={styles.cardDesc}>{session.description}</p>
                  <div style={styles.metaRow}>
                    <span style={styles.metaItem}><i className="fa-solid fa-calendar-days" style={{ color: '#6366f1' }} /> {session.date ? new Date(session.date).toLocaleString() : 'No date'}</span>
                    {session.instructorId?.FullName && <span style={styles.metaItem}><i className="fa-solid fa-chalkboard-user" style={{ color: '#3b82f6' }} /> {session.instructorId.FullName}</span>}
                    {isAdmin && session.studentProfileId?.user?.FullName && (
                      <span 
                        style={{ ...styles.metaItem, color: 'var(--brand-primary)', cursor: 'pointer', textDecoration: 'underline' }} 
                        onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/child/${session.studentProfileId._id}`); }}
                        title="View student profile"
                      >
                        <i className="fa-solid fa-graduation-cap" style={{ color: '#10b981' }} /> {session.studentProfileId.user.FullName}
                      </span>
                    )}
                    <span style={styles.metaItem}>
                      {session.StudentAttended
                        ? <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }} />
                        : <i className="fa-solid fa-circle-xmark" style={{ color: '#ef4444' }} />
                      } Attended: {session.StudentAttended ? 'Yes' : 'No'}
                    </span>
                    {session.meetingLink ? (
                      <a
                        href={safeUrl(session.meetingLink)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={styles.joinBtn}
                        title="Join the session meeting"
                      >
                        <i className="fa-solid fa-video" /> Join Meeting
                      </a>
                    ) : (role === 'student' || role === 'parent') && (
                      <button
                        type="button"
                        disabled
                        onClick={(e) => e.stopPropagation()}
                        style={styles.joinBtnDisabled}
                        title="No meeting link yet"
                      >
                        <i className="fa-solid fa-video" /> Join Meeting
                      </button>
                    )}
                    {isAdmin && session.meetingLink && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFormError(null); setEndSession(session); }}
                        style={styles.endBtn}
                        title="End the session and remove the meeting link"
                      >
                        <i className="fa-solid fa-circle-stop" /> End Session
                      </button>
                    )}
                  </div>
                </div>
                <div style={styles.cardRight}>
                  <span style={styles.statusBadge(session.status)}>{session.status}</span>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {isAdmin && (
                      <div style={styles.actionBtns}>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(session); }}
                          style={styles.actionBtn()}
                          title="Edit"
                        ><i className="fa-solid fa-pen-to-square" /></button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setFormError(null); setDeleteSession(session); }}
                          style={styles.actionBtn()}
                          title="Delete"
                        ><i className="fa-solid fa-trash" /></button>
                      </div>
                    )}
                    <div style={styles.chevron(isExpanded)}>▼</div>
                  </div>
                </div>
              </div>

              {/* ── Expanded Dropdown Content ── */}
              {isExpanded && (
                <div style={styles.expandedContent}>
                  {/* ── AI Session Summary (read-only for all; instructor/admin can generate) ── */}
                  <div style={styles.aiSection}>
                    <div style={styles.aiHeader}>
                      <p style={{ ...styles.sectionTitle, margin: 0 }}>
                        <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#8b5cf6' }} /> AI Session Summary
                      </p>
                      {isAdmin && (
                        <button
                          type="button"
                          disabled={aiBusy}
                          onClick={(e) => { e.stopPropagation(); handleGenerateAiSummary(session); }}
                          style={{ ...styles.aiBtn, opacity: aiBusy ? 0.6 : 1, cursor: aiBusy ? 'not-allowed' : 'pointer' }}
                        >
                          {aiBusy
                            ? <><i className="fa-solid fa-spinner fa-spin" /> Generating…</>
                            : hasAi
                              ? <><i className="fa-solid fa-rotate" /> Regenerate</>
                              : <><i className="fa-solid fa-wand-magic-sparkles" /> Generate Summary</>}
                        </button>
                      )}
                    </div>

                    {aiErr && (
                      <div className="modal-error" style={{ marginBottom: hasAi ? '0.75rem' : 0 }}>
                        <i className="fa-solid fa-triangle-exclamation" /> {aiErr}
                      </div>
                    )}

                    {hasAi ? (
                      <>
                        <p style={styles.aiText}>{aiSummary.text}</p>
                        <p style={styles.aiMeta}>
                          <i className="fa-solid fa-robot" /> {aiSummary.model || 'AI'}
                          {aiSummary.generatedAt ? ` · ${new Date(aiSummary.generatedAt).toLocaleString()}` : ''}
                        </p>
                      </>
                    ) : (
                      !aiErr && (
                        <p style={styles.emptyState}>
                          {isAdmin ? 'No summary yet — generate a parent-friendly recap from this session.' : 'No summary yet.'}
                        </p>
                      )
                    )}
                  </div>

                  {/* ── Canvas boards attached to this session ── */}
                  <div style={styles.boardsSection}>
                    <div style={styles.aiHeader}>
                      <p style={{ ...styles.sectionTitle, margin: 0 }}>
                        <i className="fa-solid fa-pen-ruler" style={{ color: '#a855f7' }} /> Session Boards
                      </p>
                      {isAdmin && (
                        <button
                          type="button"
                          disabled={boardBusy}
                          onClick={(e) => { e.stopPropagation(); handleCreateBoard(session); }}
                          style={{ ...styles.aiBtn, opacity: boardBusy ? 0.6 : 1, cursor: boardBusy ? 'not-allowed' : 'pointer' }}
                        >
                          {boardBusy
                            ? <><i className="fa-solid fa-spinner fa-spin" /> Creating…</>
                            : <><i className="fa-solid fa-plus" /> New Board</>}
                        </button>
                      )}
                    </div>

                    {boardErr && (
                      <div className="modal-error" style={{ marginBottom: boards.length ? '0.75rem' : 0 }}>
                        <i className="fa-solid fa-triangle-exclamation" /> {boardErr}
                      </div>
                    )}

                    {boardState?.status === 'loading' ? (
                      <p style={styles.emptyState}>
                        <i className="fa-solid fa-circle-notch fa-spin" /> Loading boards…
                      </p>
                    ) : boards.length > 0 ? (
                      <div style={styles.boardsRow}>
                        {boards.map(board => (
                          <button
                            key={board._id}
                            type="button"
                            style={styles.boardChip}
                            title={board.title}
                            onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/canvas/${board._id}`); }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px, -1px)'; e.currentTarget.style.boxShadow = '2px 2px 0px 0px var(--shadow-color)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            {board.thumbnail
                              ? <img src={board.thumbnail} alt="" style={styles.boardThumb} />
                              : <div style={styles.boardThumbEmpty}><i className="fa-solid fa-pen-ruler" /></div>}
                            <div style={styles.boardChipBody}>
                              <p style={styles.boardChipTitle}>{board.title}</p>
                              <span style={styles.boardChipMeta}>
                                {isAdmin && <span style={styles.boardShareDot(board.isShared)} />}
                                {isAdmin ? (board.isShared ? 'Shared' : 'Private') : `${board.elementCount ?? 0} shapes`}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      !boardErr && (
                        <p style={styles.emptyState}>
                          {isAdmin
                            ? 'No boards yet — create one to sketch during this session.'
                            : 'No boards shared for this session yet.'}
                        </p>
                      )
                    )}
                  </div>

                  {!hasContent ? (
                    <p style={styles.emptyState}>No additional resources attached to this session.</p>
                  ) : (
                    <div style={styles.contentGrid}>
                      {/* Recap Videos */}
                      {hasVideos && (
                        <div style={styles.contentSection}>
                          <p style={styles.sectionTitle}><i className="fa-solid fa-play" style={{ color: '#ef4444' }} /> Recap Videos</p>
                          {session.recapVideoLinks.map((v, i) => (
                            <a
                              key={i}
                              href={safeUrl(v.link)}
                              target="_blank"
                              rel="noreferrer"
                              style={styles.linkItem}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-yellow)'; e.currentTarget.style.transform = 'translate(-1px, -1px)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.transform = 'none'; }}
                            >
                              <span style={{ fontSize: '1.1rem' }}><i className="fa-solid fa-play" /></span>
                              <span>{v.title || `Video ${i + 1}`}</span>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Attachments / Files */}
                      {hasLinks && (
                        <div style={styles.contentSection}>
                          <p style={styles.sectionTitle}><i className="fa-solid fa-paperclip" style={{ color: '#f59e0b' }} /> Files & Attachments</p>
                          {session.attachmentsLinks.map((a, i) => (
                            <a
                              key={i}
                              href={safeUrl(a.attachmentLink)}
                              target="_blank"
                              rel="noreferrer"
                              style={styles.linkItem}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-peach)'; e.currentTarget.style.transform = 'translate(-1px, -1px)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.transform = 'none'; }}
                            >
                              <span style={{ fontSize: '1.1rem' }}><i className="fa-solid fa-file" /></span>
                              <span>{a.title || `Attachment ${i + 1}`}</span>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Summary */}
                      {hasSummary && (
                        <div style={styles.contentSection}>
                          <p style={styles.sectionTitle}><i className="fa-solid fa-clipboard-list" style={{ color: '#3b82f6' }} /> Session Summary</p>
                          <div style={styles.summaryBox}>{session.summary}</div>
                        </div>
                      )}

                      {/* Notes */}
                      {hasNotes && (
                        <div style={styles.contentSection}>
                          <p style={styles.sectionTitle}><i className="fa-solid fa-pen-to-square" style={{ color: '#a855f7' }} /> Notes</p>
                          <div style={styles.summaryBox}>{session.notes}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!loading && filteredSessions.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(n) => { setLimit(n); setPage(1); }}
          total={totalDocs}
        />
      )}

      {/* ═══ CREATE ═══ */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setSelectedStudentIds([]); setAssignMode('single'); }} title={assignMode === 'bulk' ? 'Create Bulk Sessions' : 'Create New Session'} size="lg">
        <form onSubmit={handleCreate}>
          {formError && <div className="modal-error"><i className="fa-solid fa-triangle-exclamation" /> {formError}</div>}
          {renderFormFields(false)}
          <button type="submit" disabled={formLoading} className="modal-btn modal-btn-primary" style={{ marginTop: '1rem' }}>
            {formLoading ? 'Creating...' : <><i className="fa-solid fa-plus" /> {assignMode === 'bulk' ? `Assign Sessions to ${selectedStudentIds.length} Student(s)` : 'Create Session'}</>}
          </button>
        </form>
      </Modal>

      {/* ═══ EDIT ═══ */}
      <Modal isOpen={!!editSession} onClose={() => setEditSession(null)} title={`Edit — ${editSession?.title}`} size="lg">
        <form onSubmit={handleUpdate}>
          {formError && <div className="modal-error"><i className="fa-solid fa-triangle-exclamation" /> {formError}</div>}
          {renderFormFields(true)}
          <button type="submit" disabled={formLoading} className="modal-btn modal-btn-info">{formLoading ? 'Saving...' : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}</button>
        </form>
      </Modal>

      {/* ═══ DELETE ═══ */}
      <Modal isOpen={!!deleteSession} onClose={() => setDeleteSession(null)} title="Delete Session" size="sm">
        <div className="modal-warning-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
        <p className="modal-warning-text">Delete <strong>"{deleteSession?.title}"</strong>?</p>
        <p className="modal-warning-sub">This action is permanent and cannot be undone.</p>
        {formError && <div className="modal-error"><i className="fa-solid fa-triangle-exclamation" /> {formError}</div>}
        <div className="modal-actions">
          <button onClick={() => setDeleteSession(null)} className="modal-btn modal-btn-ghost">Cancel</button>
          <button onClick={handleDelete} disabled={formLoading} className="modal-btn modal-btn-danger">{formLoading ? 'Deleting...' : <><i className="fa-solid fa-trash" /> Delete</>}</button>
        </div>
      </Modal>

      {/* ═══ END SESSION ═══ */}
      <Modal isOpen={!!endSession} onClose={() => setEndSession(null)} title="End Session" size="sm">
        <div className="modal-warning-icon"><i className="fa-solid fa-circle-stop" /></div>
        <p className="modal-warning-text">End <strong>"{endSession?.title}"</strong>?</p>
        <p className="modal-warning-sub">The meeting link will be removed and students can no longer join. The session will be marked completed.</p>
        {formError && <div className="modal-error"><i className="fa-solid fa-triangle-exclamation" /> {formError}</div>}
        <div className="modal-actions">
          <button onClick={() => setEndSession(null)} className="modal-btn modal-btn-ghost">Cancel</button>
          <button onClick={handleEndSession} disabled={formLoading} className="modal-btn modal-btn-danger">{formLoading ? 'Ending...' : <><i className="fa-solid fa-circle-stop" /> End Session</>}</button>
        </div>
      </Modal>
    </div>
  );
};

export default SessionsPage;
