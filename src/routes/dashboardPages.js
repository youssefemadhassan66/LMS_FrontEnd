import { lazy } from 'react';

// Dashboard pages are code-split, and each chunk used to be fetched only once
// its link was clicked. On a real connection that is most of a second in which
// the old page stays up and nothing reacts to the click. Keeping the import
// functions here lets the layout warm them in the background after sign-in.

const lazyPage = (factory) => {
  const Page = lazy(factory);
  Page.preload = factory;
  return Page;
};

export const DashboardIndex = lazyPage(() => import('../pages/Dashboard/DashboardIndex'));
export const SessionsPage = lazyPage(() => import('../pages/Dashboard/SessionsPage'));
export const TasksPage = lazyPage(() => import('../pages/Dashboard/TasksPage'));
export const SubmissionsPage = lazyPage(() => import('../pages/Dashboard/SubmissionsPage'));
export const ReviewsPage = lazyPage(() => import('../pages/Dashboard/ReviewsPage'));
export const ExternalCoursesPage = lazyPage(() => import('../pages/Dashboard/ExternalCoursesPage'));
export const UsersPage = lazyPage(() => import('../pages/Dashboard/UsersPage'));
export const StudentProfilesPage = lazyPage(() => import('../pages/Dashboard/StudentProfilesPage'));
export const ChildDetailsPage = lazyPage(() => import('../pages/Dashboard/ChildDetailsPage'));
export const ProgressPage = lazyPage(() => import('../pages/Dashboard/ProgressPage'));
export const ExamsPage = lazyPage(() => import('../pages/Dashboard/ExamsPage'));
export const MessagesPage = lazyPage(() => import('../pages/Dashboard/MessagesPage'));
export const ChannelsPage = lazyPage(() => import('../pages/Dashboard/ChannelsPage'));
export const AnnouncementsPage = lazyPage(() => import('../pages/Dashboard/AnnouncementsPage'));
export const AuditLogsPage = lazyPage(() => import('../pages/Dashboard/AuditLogsPage'));
export const AccountProfilePage = lazyPage(() => import('../pages/Dashboard/AccountProfilePage'));
export const WeeklySchedulePage = lazyPage(() => import('../pages/Dashboard/WeeklySchedulePage'));
export const LeaderboardPage = lazyPage(() => import('../pages/Dashboard/LeaderboardPage'));
export const ChallengesPage = lazyPage(() => import('../pages/Dashboard/ChallengesPage'));
export const InstructorChallengesPage = lazyPage(() => import('../pages/Dashboard/InstructorChallengesPage'));
export const NotificationsPage = lazyPage(() => import('../pages/Dashboard/NotificationsPage'));
export const LessonViewPage = lazyPage(() => import('../pages/Dashboard/LessonViewPage'));
export const AchievementsPage = lazyPage(() => import('../pages/Dashboard/AchievementsPage'));
export const CanvasPage = lazyPage(() => import('../pages/Dashboard/CanvasPage'));
export const CanvasBoardPage = lazyPage(() => import('../pages/Dashboard/CanvasBoardPage'));

// Sidebar targets. The heavy whiteboard (CanvasBoardPage) is deliberately not
// here: it is only reachable from inside a session, not from the sidebar.
const PAGES_BY_PATH = {
  '/dashboard': DashboardIndex,
  '/dashboard/schedule': WeeklySchedulePage,
  '/dashboard/sessions': SessionsPage,
  '/dashboard/tasks': TasksPage,
  '/dashboard/submissions': SubmissionsPage,
  '/dashboard/exams': ExamsPage,
  '/dashboard/canvas': CanvasPage,
  '/dashboard/reviews': ReviewsPage,
  '/dashboard/external': ExternalCoursesPage,
  '/dashboard/announcements': AnnouncementsPage,
  '/dashboard/notifications': NotificationsPage,
  '/dashboard/channels': ChannelsPage,
  '/dashboard/messages': MessagesPage,
  '/dashboard/progress': ProgressPage,
  '/dashboard/leaderboard': LeaderboardPage,
  '/dashboard/achievements': AchievementsPage,
  '/dashboard/challenges': ChallengesPage,
  '/dashboard/challenges/manage': InstructorChallengesPage,
  '/dashboard/users': UsersPage,
  '/dashboard/profiles': StudentProfilesPage,
  '/dashboard/audit-logs': AuditLogsPage,
  '/dashboard/account': AccountProfilePage,
};

const warmed = new Set();

/** Starts downloading a page's chunk. Safe to call repeatedly. */
export const preloadDashboardPage = (path) => {
  const Page = PAGES_BY_PATH[path];
  if (!Page || warmed.has(path)) return;
  warmed.add(path);
  // A failed prefetch is not an error: the click will simply load it normally.
  Page.preload().catch(() => warmed.delete(path));
};

// Head start given to the page the user actually opened. Warming chunks any
// earlier competes with its code and data on a slow line and makes the first
// load slower, which is the opposite of the point.
const WARM_DELAY_MS = 4000;

/**
 * Warms every page in `paths`, one at a time and only while the browser is
 * idle, after the first page has had time to load.
 */
export const preloadDashboardPages = (paths) => {
  const queue = paths.filter((path) => PAGES_BY_PATH[path] && !warmed.has(path));
  const hasIdle = typeof window !== 'undefined' && 'requestIdleCallback' in window;
  const schedule = hasIdle
    ? (fn) => window.requestIdleCallback(fn, { timeout: 2000 })
    : (fn) => setTimeout(fn, 200);

  let cancelled = false;
  const step = () => {
    if (cancelled || queue.length === 0) return;
    preloadDashboardPage(queue.shift());
    schedule(step);
  };
  const start = setTimeout(() => schedule(step), WARM_DELAY_MS);
  return () => {
    cancelled = true;
    clearTimeout(start);
  };
};
