import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import Logo from '../Logo/Logo';
import useScrollReveal from '../../hooks/useScrollReveal';
import './LandingLayout.css';

const LandingLayout = () => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  // The open flag carries the route it was opened on. Navigating is the whole
  // point of the menu, so it has to close once a link lands — but doing that
  // in an effect means setState in the effect body and a cascading render
  // (react-hooks/set-state-in-effect). Comparing the stored route to the
  // current one derives the same thing during render: once the path moves on,
  // the stored flag is stale and the menu reads as closed. This also covers
  // browser back/forward, which an onClick on each link would miss.
  const [menu, setMenu] = useState({ open: false, path: location.pathname });
  const menuOpen = menu.open && menu.path === location.pathname;

  const closeMenu = () => setMenu({ open: false, path: location.pathname });
  const toggleMenu = () => setMenu({ open: !menuOpen, path: location.pathname });

  // Initialize scroll reveal animations for all landing pages
  useScrollReveal();

  // Escape closes it, the way every other dismissable overlay behaves.
  // setState here is inside a listener, not the effect body, which is exactly
  // the subscribe-to-an-external-system shape effects are meant for.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenu({ open: false, path: location.pathname });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, location.pathname]);

  const isActive = (path) => location.pathname === path ? 'active' : '';
  // The three public pages share one landing system, so they share its
  // chrome: a translucent dark navbar and footer rather than the default
  // panel. Leaving one route out of this list is what made the contact page
  // look like a different site.
  const LANDING_ROUTES = ['/', '/about', '/contact'];
  const isCosmic = LANDING_ROUTES.includes(location.pathname);

  return (
    <div className={`landing-wrapper${isCosmic ? ' landing-cosmic' : ''}`}>
      <nav className={`landing-navbar glass-panel${isCosmic ? ' cosmic' : ''}`}>
        <div className="nav-brand">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Logo size="md" variant="full" />
          </Link>
        </div>
        
        <ul className="nav-links">
          <li><Link to="/" className={isActive('/')}>Home</Link></li>
          <li><Link to="/about" className={isActive('/about')}>About</Link></li>
          <li><Link to="/contact" className={isActive('/contact')}>Contact</Link></li>
        </ul>

        <div className="nav-actions">
          <button className="theme-icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            <i className={theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun'} />
          </button>
          <Link to="/login" className="btn-login">Login</Link>
          <Link to="/login" className="btn-signup">Get Started</Link>

          {/* Below 768px the nav links are hidden and below 520px so is the
              login link, which previously left About, Contact and Login with
              no route in at all on a phone. This is where they go. */}
          <button
            type="button"
            className="nav-toggle"
            onClick={toggleMenu}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
          >
            <i className={menuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'} />
          </button>
        </div>

        {menuOpen && (
          <div id="landing-mobile-menu" className="nav-mobile-menu">
            <Link to="/" className={isActive('/')}>Home</Link>
            <Link to="/about" className={isActive('/about')}>About</Link>
            <Link to="/contact" className={isActive('/contact')}>Contact</Link>
            <Link to="/login" className={isActive('/login')}>Login</Link>
          </div>
        )}
      </nav>

      {/* Outside the <nav> on purpose. The cosmic navbar sets backdrop-filter,
          which makes it the containing block for fixed-position descendants,
          so a backdrop nested inside it covered only the bar itself instead of
          the page and there was nothing to tap to dismiss. */}
      {menuOpen && (
        <div className="nav-mobile-backdrop" onClick={closeMenu} />
      )}

      <main className="landing-main">
        <div key={location.pathname} className="page-animate">
          <Outlet />
        </div>
      </main>

      <footer className={`landing-footer glass-panel${isCosmic ? ' cosmic' : ''}`}>
        <Logo size="sm" variant="full" />
        <p style={{ margin: 0 }}>&copy; {new Date().getFullYear()} AlgoGambit. All rights reserved.</p>
        <div className="footer-links">
          <Link to="/about">Privacy Policy</Link>
          <Link to="/contact">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
};

export default LandingLayout;
