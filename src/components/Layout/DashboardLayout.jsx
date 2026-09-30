import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../NotificationBell/NotificationBell';
import Pet from '../Pet/Pet';
import Logo from '../Logo/Logo';
import { getAvatarUrl } from '../../utils/avatar';
import GamificationWidget from '../Gamification/GamificationWidget';
import useScrollReveal from '../../hooks/useScrollReveal';
import PageStage from '../Loading/PageStage';
import { preloadDashboardPages } from '../../routes/dashboardPages';
import './DashboardLayout.css';
import '../../pages/Dashboard/Dashboard.css';
// Must load after DashboardLayout.css: it overrides inline styles on the
// dashboard pages, which no ordinary media query can reach.
import './DashboardMobile.css';

const navConfig = {
  student: [
    { to: '/dashboard', icon: 'fa-solid fa-house', label: 'Overview', end: true },
    { to: '/dashboard/schedule', icon: 'fa-solid fa-table-cells', label: 'Schedule' },
    { to: '/dashboard/sessions', icon: 'fa-solid fa-calendar-days', label: 'My Sessions' },
    { to: '/dashboard/tasks', icon: 'fa-solid fa-list-check', label: 'My Tasks' },
    { to: '/dashboard/submissions', icon: 'fa-solid fa-paper-plane', label: 'Submissions' },
    { to: '/dashboard/exams', icon: 'fa-solid fa-pen-to-square', label: 'My Exams' },
    { to: '/dashboard/canvas', icon: 'fa-solid fa-pen-ruler', label: 'Canvas' },
    { to: '/dashboard/reviews', icon: 'fa-solid fa-star', label: 'My Reviews' },
    { to: '/dashboard/external', icon: 'fa-solid fa-globe', label: 'External Courses' },
    { to: '/dashboard/announcements', icon: 'fa-solid fa-bullhorn', label: 'Announcements' },
    { to: '/dashboard/notifications', icon: 'fa-solid fa-bell', label: 'Notifications' },
    { to: '/dashboard/channels', icon: 'fa-solid fa-people-group', label: 'Learning Team' },
    { to: '/dashboard/messages', icon: 'fa-solid fa-message', label: 'Messages' },
    { to: '/dashboard/progress', icon: 'fa-solid fa-chart-line', label: 'My Progress' },
    { to: '/dashboard/leaderboard', icon: 'fa-solid fa-trophy', label: 'Leaderboard' },
    { to: '/dashboard/achievements', icon: 'fa-solid fa-medal', label: 'Achievements' },
    { to: '/dashboard/challenges', icon: 'fa-solid fa-gamepad', label: 'Challenges' },
  ],
  parent: [
    { to: '/dashboard', icon: 'fa-solid fa-children', label: 'Children', end: true },
    { to: '/dashboard/schedule', icon: 'fa-solid fa-table-cells', label: 'Schedule' },
    { to: '/dashboard/sessions', icon: 'fa-solid fa-calendar-days', label: 'Sessions' },
    { to: '/dashboard/tasks', icon: 'fa-solid fa-list-check', label: 'Tasks' },
    { to: '/dashboard/submissions', icon: 'fa-solid fa-paper-plane', label: 'Submissions' },
    { to: '/dashboard/exams', icon: 'fa-solid fa-pen-to-square', label: 'Exams' },
    { to: '/dashboard/canvas', icon: 'fa-solid fa-pen-ruler', label: 'Canvas' },
    { to: '/dashboard/external', icon: 'fa-solid fa-globe', label: 'External Courses' },
    { to: '/dashboard/announcements', icon: 'fa-solid fa-bullhorn', label: 'Announcements' },
    { to: '/dashboard/notifications', icon: 'fa-solid fa-bell', label: 'Notifications' },
    { to: '/dashboard/channels', icon: 'fa-solid fa-people-group', label: 'Learning Team' },
    { to: '/dashboard/messages', icon: 'fa-solid fa-message', label: 'Messages' },
    { to: '/dashboard/progress', icon: 'fa-solid fa-chart-line', label: 'Children Progress' },
    { to: '/dashboard/leaderboard', icon: 'fa-solid fa-trophy', label: 'Leaderboard' },
  ],
  instructor: [
    { to: '/dashboard', icon: 'fa-solid fa-house', label: 'Overview', end: true },
    { to: '/dashboard/schedule', icon: 'fa-solid fa-table-cells', label: 'Schedule' },
    { to: '/dashboard/sessions', icon: 'fa-solid fa-calendar-days', label: 'Sessions' },
    { to: '/dashboard/tasks', icon: 'fa-solid fa-list-check', label: 'Tasks' },
    { to: '/dashboard/submissions', icon: 'fa-solid fa-inbox', label: 'Submissions' },
    { to: '/dashboard/exams', icon: 'fa-solid fa-pen-to-square', label: 'Exams' },
    { to: '/dashboard/canvas', icon: 'fa-solid fa-pen-ruler', label: 'Canvas' },
    { to: '/dashboard/reviews', icon: 'fa-solid fa-star', label: 'Reviews' },
    { to: '/dashboard/announcements', icon: 'fa-solid fa-bullhorn', label: 'Announcements' },
    { to: '/dashboard/notifications', icon: 'fa-solid fa-bell', label: 'Notifications' },
    { to: '/dashboard/channels', icon: 'fa-solid fa-people-group', label: 'Learning Team' },
    { to: '/dashboard/messages', icon: 'fa-solid fa-message', label: 'Messages' },
    { to: '/dashboard/progress', icon: 'fa-solid fa-chart-bar', label: 'Progress Reports' },
    { to: '/dashboard/leaderboard', icon: 'fa-solid fa-trophy', label: 'Leaderboard' },
    { to: '/dashboard/challenges/manage', icon: 'fa-solid fa-gears', label: 'Manage Challenges' },
  ],
  admin: [
    { to: '/dashboard', icon: 'fa-solid fa-house', label: 'Overview', end: true },
    { to: '/dashboard/schedule', icon: 'fa-solid fa-table-cells', label: 'Schedule' },
    { to: '/dashboard/users', icon: 'fa-solid fa-users', label: 'Users' },
    { to: '/dashboard/profiles', icon: 'fa-solid fa-id-card', label: 'Student Profiles' },
    { to: '/dashboard/sessions', icon: 'fa-solid fa-calendar-days', label: 'Sessions' },
    { to: '/dashboard/tasks', icon: 'fa-solid fa-list-check', label: 'Tasks' },
    { to: '/dashboard/submissions', icon: 'fa-solid fa-inbox', label: 'Submissions' },
    { to: '/dashboard/exams', icon: 'fa-solid fa-pen-to-square', label: 'Exams' },
    { to: '/dashboard/canvas', icon: 'fa-solid fa-pen-ruler', label: 'Canvas' },
    { to: '/dashboard/reviews', icon: 'fa-solid fa-star', label: 'Reviews' },
    { to: '/dashboard/external', icon: 'fa-solid fa-globe', label: 'External Courses' },
    { to: '/dashboard/announcements', icon: 'fa-solid fa-bullhorn', label: 'Announcements' },
    { to: '/dashboard/notifications', icon: 'fa-solid fa-bell', label: 'Notifications' },
    { to: '/dashboard/audit-logs', icon: 'fa-solid fa-shield-halved', label: 'Audit Logs' },
    { to: '/dashboard/messages', icon: 'fa-solid fa-message', label: 'Messages' },
    { to: '/dashboard/progress', icon: 'fa-solid fa-chart-bar', label: 'Progress Reports' },
    { to: '/dashboard/leaderboard', icon: 'fa-solid fa-trophy', label: 'Leaderboard' },
    { to: '/dashboard/challenges/manage', icon: 'fa-solid fa-gears', label: 'Manage Challenges' },
  ],
};

const roleLabels = {
  student: 'Student Portal',
  parent: 'Parent Portal',
  instructor: 'Instructor Portal',
  admin: 'Admin Panel',
};

const DashboardLayout = () => {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 900);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Initialize scroll reveal animations for all dashboard pages
  useScrollReveal();

  const role = user?.role || 'student';
  const navItems = navConfig[role] || navConfig.student;
  const portalLabel = roleLabels[role] || 'Portal';
  const userName = user?.FullName || user?.UserName || 'User';

  /* Gender-aware avatar */
  const avatarSeed = user?._id || user?.UserName || userName;
  const avatarUrl = getAvatarUrl(avatarSeed, userName, 80);
  const avatarSrc = user?.avatar || avatarUrl;
  const userInitials = userName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  // Name shown on the loading screen: the sidebar label for this page, or the
  // closest parent section (e.g. a child page under Tasks), or a neutral word.
  const pageLabel = (() => {
    const match = navItems
      .filter((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
      .sort((a, b) => b.to.length - a.to.length)[0];
    if (location.pathname === '/dashboard/account') return 'your account';
    return match ? match.label : 'page';
  })();

  // Warm the code for every page this role can reach, while the browser is
  // idle, so a click only has to wait for data.
  useEffect(() => preloadDashboardPages(navItems.map((item) => item.to)), [navItems]);

  // One highlight that glides to the active link, instead of the fill jumping
  // from one row to the next. Positioned by writing to the DOM directly: it is
  // pure presentation, and state here would re-render the whole layout on
  // every navigation and resize.
  const navRef = useRef(null);
  const indicatorRef = useRef(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return undefined;

    const place = () => {
      const active = nav.querySelector('.nav-item.active');
      if (!active) {
        indicator.style.opacity = '0';
        return;
      }
      indicator.style.opacity = '1';
      indicator.style.transform = `translateY(${active.offsetTop}px)`;
      indicator.style.height = `${active.offsetHeight}px`;
      indicator.style.left = `${active.offsetLeft}px`;
      indicator.style.width = `${active.offsetWidth}px`;
    };

    place();
    // The first placement must not slide in from the top of the menu.
    const frame = requestAnimationFrame(() => indicator.classList.add('is-ready'));
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
    };
  }, [location.pathname, sidebarOpen, navItems]);

  // A new page opens at the top. Back/forward is left to the browser, which
  // restores the previous position.
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, navigationType]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="dashboard-wrapper">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop visible"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside className={`dashboard-sidebar glass-panel ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <Logo
            size="md"
            variant={sidebarOpen ? 'full' : 'mark'}
            onClick={() => navigate('/dashboard')}
            style={{ padding: sidebarOpen ? '0' : '0' }}
          />
          <button
            className="toggle-sidebar-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {sidebarOpen ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
            </svg>
          </button>
        </div>

        {sidebarOpen && (
          <div className="sidebar-role-badge">
            <span className="role-pill">{role}</span>
          </div>
        )}

        <nav className="sidebar-nav" ref={navRef}>
          <span className="nav-indicator" ref={indicatorRef} aria-hidden="true" />
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end || false}
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              onClick={() => { if (window.innerWidth <= 900) closeSidebar(); }}
            >
              <span className="icon"><i className={item.icon} /></span>
              {sidebarOpen && <span className="label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <span className="icon"><i className="fa-solid fa-right-from-bracket" /></span>
            {sidebarOpen && <span className="label">Log Out</span>}
          </button>
        </div>
      </aside>

      <div className={`dashboard-main ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <header className="dashboard-header glass-panel">
          <div className="header-left">
            <button
              className="toggle-sidebar-btn-mobile"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <i className="fa-solid fa-bars" />
            </button>
            <h3>
              <span className="header-portal">{portalLabel}</span>
              <span className="header-sep" aria-hidden="true">/</span>
              <span className="header-page">{pageLabel === 'your account' ? 'Account' : pageLabel}</span>
            </h3>
          </div>

          <div className="header-right">
            {role === 'student' && <GamificationWidget />}
            <NotificationBell />
            <button className="theme-toggle-icon" onClick={toggleTheme} title="Toggle Theme" aria-label="Toggle theme">
              <i className={theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun'} />
            </button>
            <button className="user-profile" onClick={() => navigate('/dashboard/account')} title="Open account profile">
              <div className="avatar" style={{ overflow: 'hidden', padding: avatarFailed ? undefined : 0 }}>
                {avatarFailed
                  ? userInitials
                  : <img src={avatarSrc} alt={userName} onError={() => setAvatarFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                }
              </div>
              <span>{userName}</span>
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          <PageStage pathname={location.pathname} label={pageLabel}>
            <Outlet />
          </PageStage>
        </div>
      </div>

      {/* Pixel pet — students only */}
      {role === 'student' && <Pet />}
    </div>
  );
};

export default DashboardLayout;
