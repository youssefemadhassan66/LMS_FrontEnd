import React, { useCallback, useEffect, useRef, useState } from 'react';
import './DashboardPreview.css';

/**
 * An interactive preview of the dashboard, for visitors who have not signed up
 * yet: the surfaces they will land on, in a frame they can click through.
 *
 * There are two of them, because there are two people buying. A student wants
 * to know what they have to do next; a parent wants to know it is going well
 * and what it costs. Showing one dashboard to both leaves half the audience
 * reading someone else's screen, so the frame carries a role switch and each
 * role has its own tabs, figures and rows.
 *
 * Everything here is illustrative — the caption in Home.jsx says so — but each
 * panel mirrors a screen the product actually ships, so nothing is promised
 * that signing in will not show.
 *
 * Two rules shape the behaviour:
 *
 *   The numbers and bars animate on arrival, not on mount. A count-up that
 *   ran while the section was still below the fold would be over before it
 *   was seen, so the whole thing waits on its own IntersectionObserver. The
 *   page-wide reveal observer cannot do this job: it scans the DOM once when
 *   the route mounts, and this component is lazily mounted long after that.
 *
 *   The tabs advance on their own only until the visitor takes over. Once a
 *   tab or a role is clicked the rotation stops for good — a carousel that
 *   keeps moving under someone reading it is a nuisance, not a demonstration.
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Student ──────────────────────────────────────────────────────────── */

const STUDENT = {
  id: 'student',
  label: 'Student',
  icon: 'fa-solid fa-user-astronaut',
  title: 'Student dashboard',
  views: [
    { id: 'overview', icon: 'fa-solid fa-gauge-high', label: 'Overview', kind: 'overview' },
    { id: 'tasks', icon: 'fa-solid fa-list-check', label: 'Tasks', kind: 'summary' },
    { id: 'sessions', icon: 'fa-solid fa-calendar-day', label: 'Sessions', kind: 'sessions' },
    { id: 'progress', icon: 'fa-solid fa-chart-line', label: 'Progress', kind: 'bars' },
    {
      id: 'badges',
      icon: 'fa-solid fa-medal',
      label: 'Badges',
      kind: 'list',
      cap: 'Earned and still to come',
      rows: [
        { title: '7 day streak', meta: 'Gamification · +50 XP', tag: 'Earned', tone: 'good' },
        { title: 'First program', meta: 'Coding Basics · your very first run', tag: 'Earned', tone: 'good' },
        { title: 'Bug hunter', meta: 'Fixed ten broken programs', tag: 'Earned', tone: 'good' },
        { title: 'Web builder', meta: 'Publish your first page', tag: 'Locked' },
        { title: 'Marathon', meta: 'Reach a 30 day streak', tag: 'Locked' },
      ],
    },
    {
      id: 'feedback',
      icon: 'fa-solid fa-comment-dots',
      label: 'Feedback',
      kind: 'list',
      cap: 'From your instructor',
      rows: [
        { title: 'Great use of loops', meta: 'Python · nothing to change', tag: 'Praise', tone: 'good' },
        { title: 'Watch your indentation', meta: 'Python · one small fix', tag: 'Fix', tone: 'warn' },
        { title: 'Nice layout choices', meta: 'Web Development', tag: 'Praise', tone: 'good' },
        { title: 'Resubmit with comments', meta: 'Algorithms · needs one change', tag: 'Action', tone: 'warn' },
      ],
    },
  ],
  kpis: [
    { icon: 'fa-solid fa-fire', label: 'Streak', to: 12, suffix: '', foot: 'days in a row' },
    { icon: 'fa-solid fa-bolt', label: 'XP', to: 2480, suffix: '', foot: '+180 this week' },
    { icon: 'fa-solid fa-list-check', label: 'Tasks', to: 3, suffix: '', foot: '1 in review' },
    { icon: 'fa-solid fa-medal', label: 'Badges', to: 7, suffix: '', foot: '2 this month' },
  ],
  feedCap: 'This week',
  feed: [
    { title: 'Loops practice reviewed', meta: 'Python · instructor feedback', tag: 'Reviewed', tone: 'good' },
    { title: 'Build a number game', meta: 'Tuesday 18:00 · live session', tag: 'Upcoming', tone: 'info' },
    { title: 'Badge unlocked — 7 day streak', meta: 'Gamification · +50 XP', tag: 'Earned', tone: 'good' },
    { title: 'First website submitted', meta: 'Web Development · awaiting review', tag: 'In review', tone: 'warn' },
  ],
  summary: {
    stats: [
      { value: '3', label: 'open tasks' },
      { value: '1', label: 'waiting on review' },
      { value: '18', label: 'finished so far' },
    ],
    rows: [
      { title: 'Fix the bug in the countdown loop', meta: 'Python · due Friday', tag: 'To do', tone: 'warn' },
      { title: 'Style your profile card', meta: 'Web Development · due Sunday', tag: 'To do', tone: 'warn' },
      { title: 'Sorting practice set', meta: 'Algorithms · submitted', tag: 'In review', tone: 'info' },
      { title: 'Draw a sprite with Pygame', meta: 'Game Development · graded 9/10', tag: 'Done', tone: 'good' },
    ],
  },
  sessions: [
    { day: 'Tue', time: '18:00', title: 'Build a number game', meta: 'Python · live with your instructor', tag: 'Next', tone: 'good' },
    { day: 'Thu', time: '18:00', title: 'How the web works', meta: 'Web Development · live', tag: 'Booked', tone: 'info' },
    { day: 'Sat', time: '11:00', title: 'Project workshop', meta: 'Bring what you are building', tag: 'Booked', tone: 'info' },
  ],
  bars: {
    cap: 'Track progress',
    items: [
      { label: 'Python', to: 72 },
      { label: 'Web Development', to: 48 },
      { label: 'Algorithms', to: 35 },
      { label: 'Game Development', to: 20 },
    ],
  },
};

/* ── Parent ───────────────────────────────────────────────────────────── */

const PARENT = {
  id: 'parent',
  label: 'Parent',
  icon: 'fa-solid fa-user-shield',
  title: 'Parent dashboard',
  views: [
    { id: 'overview', icon: 'fa-solid fa-gauge-high', label: 'Overview', kind: 'overview' },
    { id: 'progress', icon: 'fa-solid fa-chart-line', label: 'Progress', kind: 'bars' },
    { id: 'sessions', icon: 'fa-solid fa-calendar-day', label: 'Attendance', kind: 'sessions' },
    { id: 'billing', icon: 'fa-solid fa-receipt', label: 'Billing', kind: 'summary' },
    {
      id: 'reports',
      icon: 'fa-solid fa-file-lines',
      label: 'Reports',
      kind: 'list',
      cap: 'Written up every month',
      rows: [
        { title: 'April progress report', meta: 'Attendance 96% · 6 tasks graded', tag: 'Ready', tone: 'good' },
        { title: 'March progress report', meta: 'Attendance 100% · 7 tasks graded', tag: 'Ready', tone: 'good' },
        { title: 'Term summary', meta: 'Sent 12 April · PDF', tag: 'Sent', tone: 'info' },
        { title: 'May progress report', meta: 'Generates on 1 May', tag: 'Scheduled' },
      ],
    },
    {
      id: 'messages',
      icon: 'fa-solid fa-envelope',
      label: 'Messages',
      kind: 'list',
      cap: 'You and the instructor',
      rows: [
        { title: 'Sara — “Loops finally clicked this week.”', meta: 'Instructor · 2 days ago', tag: 'New', tone: 'info' },
        { title: 'Schedule change confirmed', meta: 'Wednesday moved to Saturday 11:00', tag: 'Read' },
        { title: 'Term plan shared', meta: 'PDF · 4 pages', tag: 'Read' },
        { title: 'Reminder — session tomorrow', meta: 'Tuesday 18:00', tag: 'Read' },
      ],
    },
  ],
  kpis: [
    { icon: 'fa-solid fa-calendar-check', label: 'Attended', to: 96, suffix: '%', foot: '24 of 25 sessions' },
    { icon: 'fa-solid fa-clock', label: 'Hours', to: 38, suffix: '', foot: 'taught this term' },
    { icon: 'fa-solid fa-check-double', label: 'Completed', to: 18, suffix: '', foot: 'tasks graded' },
    { icon: 'fa-solid fa-file-lines', label: 'Reports', to: 3, suffix: '', foot: '1 new this month' },
  ],
  feedCap: 'Recent activity',
  feed: [
    { title: 'Monthly progress report is ready', meta: 'April · sent to your email too', tag: 'New', tone: 'good' },
    { title: 'Note from the instructor', meta: '“Asked great questions about loops.”', tag: 'Feedback', tone: 'good' },
    { title: 'Thursday session confirmed', meta: 'Web Development · 18:00', tag: 'Booked', tone: 'info' },
    { title: 'Missed session rescheduled', meta: 'Moved to Saturday 11:00', tag: 'Rebooked', tone: 'warn' },
  ],
  summary: {
    stats: [
      { value: '1', label: 'active plan' },
      { value: '8', label: 'sessions left' },
      { value: '0', label: 'outstanding' },
    ],
    rows: [
      { title: 'April — 8 live sessions', meta: 'Paid 2 April · card ending 4417', tag: 'Paid', tone: 'good' },
      { title: 'March — 8 live sessions', meta: 'Paid 2 March · card ending 4417', tag: 'Paid', tone: 'good' },
      { title: 'May — 8 live sessions', meta: 'Renews 2 May · cancel any time', tag: 'Upcoming', tone: 'info' },
    ],
  },
  sessions: [
    { day: 'Tue', time: '18:00', title: 'Build a number game', meta: 'Python · attended, full hour', tag: 'Attended', tone: 'good' },
    { day: 'Thu', time: '18:00', title: 'How the web works', meta: 'Web Development · attended', tag: 'Attended', tone: 'good' },
    { day: 'Sat', time: '11:00', title: 'Project workshop', meta: 'Rescheduled from Wednesday', tag: 'Upcoming', tone: 'info' },
  ],
  bars: {
    cap: 'Where the time is going',
    items: [
      { label: 'Python', to: 72 },
      { label: 'Web Development', to: 48 },
      { label: 'Algorithms', to: 35 },
      { label: 'Game Development', to: 20 },
    ],
  },
};

const ROLES = [STUDENT, PARENT];
const ROTATE_MS = 4200;

/** Counts from 0 to `to` once `run` turns true. Returns `to` outright for a
 *  visitor who has asked for reduced motion. */
const useCountUp = (to, run, reduced, duration = 1100) => {
  // Reduced motion settles on the final number at mount, so the effect below
  // never has to set state on its way in.
  const [value, setValue] = useState(() => (reduced ? to : 0));

  useEffect(() => {
    if (!run || reduced) return undefined;

    let frame;
    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - started) / duration);
      // Ease out cubic: fast at first, settling into the final number.
      setValue(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, run, reduced, duration]);

  return value;
};

const Kpi = ({ kpi, run, reduced }) => {
  const value = useCountUp(kpi.to, run, reduced);
  return (
    <div className="dp-kpi">
      <span className="dp-kpi-label"><i className={kpi.icon} /> {kpi.label}</span>
      <span className="dp-kpi-value">{value.toLocaleString()}{kpi.suffix}</span>
      <span className="dp-kpi-foot">{kpi.foot}</span>
    </div>
  );
};

/* A row's tag says what state the row is in, so the tag carries the colour:
   green for settled, amber for waiting on someone, blue for scheduled, and no
   colour at all for a row that is merely listed. Untoned is the default on
   purpose — if everything is coloured, nothing is. */
const tagClass = (tone) => (tone ? `dp-tag is-${tone}` : 'dp-tag');

const Rows = ({ items }) => (
  <ul className="dp-rows">
    {items.map((item) => (
      <li key={item.title}>
        <div className="dp-row-text">
          <strong>{item.title}</strong>
          <span>{item.meta}</span>
        </div>
        <span className={tagClass(item.tone)}>{item.tag}</span>
      </li>
    ))}
  </ul>
);

const Panel = ({ role, view, seen, reduced }) => {
  if (view.kind === 'overview') {
    return (
      <>
        <div className="dp-kpis">
          {role.kpis.map((k) => (
            <Kpi key={k.label} kpi={k} run={seen} reduced={reduced} />
          ))}
        </div>
        <span className="dp-panel-cap">{role.feedCap}</span>
        <Rows items={role.feed} />
      </>
    );
  }

  if (view.kind === 'summary') {
    return (
      <>
        <div className="dp-summary">
          {role.summary.stats.map((s) => (
            <div key={s.label}>
              <span className="dp-summary-value">{s.value}</span>
              <span className="dp-summary-label">{s.label}</span>
            </div>
          ))}
        </div>
        <Rows items={role.summary.rows} />
      </>
    );
  }

  // A plain captioned list. The view carries its own rows, so adding a tab is
  // adding one entry to the role's views array and nothing else.
  if (view.kind === 'list') {
    return (
      <>
        <span className="dp-panel-cap">{view.cap}</span>
        <Rows items={view.rows} />
      </>
    );
  }

  if (view.kind === 'sessions') {
    return (
      <ul className="dp-sessions">
        {role.sessions.map((s) => (
          <li key={s.title}>
            <span className="dp-when">
              <strong>{s.day}</strong>
              <span>{s.time}</span>
            </span>
            <div className="dp-row-text">
              <strong>{s.title}</strong>
              <span>{s.meta}</span>
            </div>
            <span className={tagClass(s.tone)}>{s.tag}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <span className="dp-panel-cap">{role.bars.cap}</span>
      <ul className="dp-bars">
        {role.bars.items.map((t, i) => (
          <li key={t.label}>
            <div className="dp-bar-head">
              <span>{t.label}</span>
              <span>{t.to}%</span>
            </div>
            <div className="dp-bar-track">
              <div
                className="dp-bar-fill"
                style={{
                  width: seen ? `${t.to}%` : 0,
                  transitionDelay: reduced ? '0ms' : `${i * 110}ms`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};

const DashboardPreview = () => {
  const [reduced] = useState(prefersReducedMotion);
  const [roleId, setRoleId] = useState(STUDENT.id);
  const [viewId, setViewId] = useState(STUDENT.views[0].id);
  // Without IntersectionObserver there is nothing to wait for, so the frame
  // counts as arrived from the start.
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  const [taken, setTaken] = useState(false);
  const frameRef = useRef(null);

  const role = ROLES.find((r) => r.id === roleId) || STUDENT;
  const view = role.views.find((v) => v.id === viewId) || role.views[0];

  // Arrival: start the numbers and bars the first time the frame is on screen.
  useEffect(() => {
    if (seen || typeof IntersectionObserver === 'undefined') return undefined;

    const node = frameRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);

  // Rotation: only while it is visible, and only until the visitor clicks.
  useEffect(() => {
    if (!seen || taken || reduced) return undefined;
    const timer = setInterval(() => {
      setViewId((current) => {
        const next = role.views.findIndex((v) => v.id === current) + 1;
        return role.views[next % role.views.length].id;
      });
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [seen, taken, reduced, role]);

  const pickView = useCallback((id) => {
    setViewId(id);
    setTaken(true);
  }, []);

  const pickRole = useCallback((id) => {
    setRoleId(id);
    // The two roles do not share a tab list, so land on the new role's first
    // view rather than on whichever tab happened to be open.
    const next = ROLES.find((r) => r.id === id) || STUDENT;
    setViewId(next.views[0].id);
    setTaken(true);
  }, []);

  return (
    <div className={`dp${seen ? ' is-seen' : ''}`} ref={frameRef}>
      <div className="dp-bar">
        <span className="dp-dots" aria-hidden="true"><span /><span /><span /></span>
        <span className="dp-bar-title">{role.title}</span>

        {/* Who is looking. Two dashboards ship, so the preview shows both
            rather than picking one and hoping. */}
        <div className="dp-roles" role="group" aria-label="Choose a dashboard">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`dp-role${r.id === roleId ? ' is-active' : ''}`}
              aria-pressed={r.id === roleId}
              onClick={() => pickRole(r.id)}
            >
              <i className={r.icon} /> <span>{r.label}</span>
            </button>
          ))}
        </div>

        <span className="dp-live"><i className="fa-solid fa-circle" /> Live</span>
      </div>

      <div className="dp-body">
        <nav className="dp-nav" aria-label="Dashboard preview sections">
          {role.views.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`dp-nav-item${view.id === v.id ? ' is-active' : ''}`}
              aria-pressed={view.id === v.id}
              onClick={() => pickView(v.id)}
            >
              <i className={v.icon} /> <span>{v.label}</span>
            </button>
          ))}
          {/* The bar drains over one rotation, so the frame shows how long the
              current panel has left rather than switching without warning. */}
          {!taken && !reduced && seen && (
            <span className="dp-rotate" key={view.id} aria-hidden="true" />
          )}
        </nav>

        {/* Keyed on both, so a change of either gets its own entrance and the
            count-ups restart for the figures that just replaced them. */}
        <div className="dp-panel" key={`${role.id}-${view.id}`}>
          <Panel role={role} view={view} seen={seen} reduced={reduced} />
        </div>
      </div>
    </div>
  );
};

export default DashboardPreview;
