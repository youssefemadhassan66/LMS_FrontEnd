import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApiRequest } from './useApiRequest';
import logger from '../utils/logger';

/**
 * Schedule hook — builds schedule entries from sessions + tasks.
 * Fetches directly from /api/v1/session and /api/v1/task with sort and fields.
 */

function sessionToEntry(session) {
  const startAt = session.date ? new Date(session.date).toISOString() : null;
  if (!startAt) return null;
  const endAt = new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString();
  
  const instructorObj = session.instructorId && typeof session.instructorId === 'object'
    ? session.instructorId
    : null;
  const studentObj = session.studentProfileId && typeof session.studentProfileId === 'object'
    ? session.studentProfileId
    : null;

  const instructorName = instructorObj?.FullName || instructorObj?.UserName || 'Instructor';
  const studentName = studentObj?.user?.FullName || studentObj?.user?.UserName || studentObj?.FullName || 'Student';

  return {
    _id: session._id,
    entryType: 'session',
    title: session.title || 'Untitled Session',
    subject: session.title || 'Untitled Session',
    description: session.description || '',
    startAt,
    endAt,
    status: session.status || 'pending',
    meetingLink: session.meetingLink || '',
    notes: session.notes || null,
    instructorName,
    studentName,
    instructorId: session.instructorId,
    studentProfileId: session.studentProfileId,
    sessionId: session._id,
    taskId: null,
  };
}

function taskToEntry(task) {
  const endAt = task.dueDate ? new Date(task.dueDate).toISOString() : null;
  if (!endAt) return null;
  const startAt = new Date(new Date(endAt).getTime() - 30 * 60 * 1000).toISOString();

  const instructorObj = task.instructorId && typeof task.instructorId === 'object'
    ? task.instructorId
    : null;
  const studentObj = task.studentProfileId && typeof task.studentProfileId === 'object'
    ? task.studentProfileId
    : null;

  const instructorName = instructorObj?.FullName || instructorObj?.UserName || 'Instructor';
  const studentName = studentObj?.user?.FullName || studentObj?.user?.UserName || studentObj?.FullName || 'Student';

  return {
    _id: task._id,
    entryType: 'task_due',
    title: task.title || 'Task Due',
    subject: task.title || 'Task Due',
    description: task.description || '',
    startAt,
    endAt,
    status: task.status || 'pending',
    meetingLink: '',
    notes: task.description || null,
    instructorName,
    studentName,
    instructorId: task.instructorId,
    studentProfileId: task.studentProfileId,
    sessionId: null,
    taskId: task._id,
  };
}

function filterToWeek(entries, start, end) {
  const s = start.getTime();
  const e = end.getTime();
  return entries.filter(entry => {
    if (!entry?.startAt) return false;
    const t = new Date(entry.startAt).getTime();
    return t >= s && t <= e;
  });
}

function extractList(responseData) {
  if (!responseData) return [];
  const d = responseData.data ?? responseData;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    if (Array.isArray(d.docs)) return d.docs;
    if (Array.isArray(d.sessions)) return d.sessions;
    if (Array.isArray(d.tasks)) return d.tasks;
    if (Array.isArray(d.data)) return d.data;
    if (Array.isArray(d.results)) return d.results;
  }
  return [];
}

const useScheduleApi = () => {
  const { user } = useAuth();
  const { request } = useApiRequest();
  const role = (user?.role || '').toLowerCase();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conflicts, setConflicts] = useState([]);

  const abortRef = useRef(null);

  const fetchWeek = useCallback(async (start, end) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const isAdmin      = role === 'admin';
      const isInstructor = role === 'instructor';

      const sessionBase = (isAdmin || isInstructor) ? '/api/v1/session' : '/api/v1/session/me';
      const taskBase    = (isAdmin || isInstructor) ? '/api/v1/task'    : '/api/v1/task/me';

      const sessionParams = new URLSearchParams({ page: '1', limit: '500', sort: 'date' });
      const taskParams    = new URLSearchParams({ page: '1', limit: '500', sort: 'dueDate' });

      logger.log('[Schedule] Fetching:', sessionBase, taskBase, '| role:', role);

      const [sessionsRes, tasksRes] = await Promise.allSettled([
        request(`${sessionBase}?${sessionParams.toString()}`),
        request(`${taskBase}?${taskParams.toString()}`),
      ]);

      logger.log('[Schedule] sessions:', sessionsRes.status, sessionsRes.status === 'fulfilled' ? sessionsRes.value : sessionsRes.reason);
      logger.log('[Schedule] tasks:', tasksRes.status, tasksRes.status === 'fulfilled' ? tasksRes.value : tasksRes.reason);

      const sessionList = sessionsRes.status === 'fulfilled' ? extractList(sessionsRes.value) : [];
      const taskList    = tasksRes.status === 'fulfilled'    ? extractList(tasksRes.value)    : [];

      logger.log('[Schedule] sessionList:', sessionList.length, '| taskList:', taskList.length);

      const sessionEntries = sessionList.map(sessionToEntry).filter(Boolean);
      const taskEntries    = taskList.map(taskToEntry).filter(Boolean);

      logger.log('[Schedule] transformed — sessions:', sessionEntries.length, '| tasks:', taskEntries.length);

      const allTransformed = [...sessionEntries, ...taskEntries];
      const weekEntries = filterToWeek(allTransformed, start, end);

      logger.log('[Schedule] after week filter:', weekEntries.length, '| week:', start.toISOString(), '→', end.toISOString());

      // Show all if nothing in current week but data exists
      if (weekEntries.length === 0 && allTransformed.length > 0) {
        logger.log('[Schedule] Nothing in current week — showing all entries');
        setEntries(allTransformed);
      } else {
        setEntries(weekEntries);
      }
      setConflicts([]);

    } catch (err) {
      if (err.name === 'AbortError') return;
      logger.error('[Schedule] Error:', err);
      setError(err.message || 'Could not load schedule.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [request, role]);

  const getEntry = useCallback(async (id) => {
    try {
      const data = await request(`/api/v1/session/${id}`);
      const s = data.data ?? data;
      return sessionToEntry(s) ?? s;
    } catch {
      const data = await request(`/api/v1/task/${id}`);
      const t = data.data ?? data;
      return taskToEntry(t) ?? t;
    }
  }, [request]);

  const clearConflicts = useCallback(() => setConflicts([]), []);

  return {
    entries, loading, error, conflicts,
    fetchWeek, getEntry, clearConflicts, setEntries,
  };
};

export default useScheduleApi;
