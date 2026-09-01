import React, { lazy, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import LazySection from '../components/LazySection/LazySection';
import Typewriter from '../components/Typewriter/Typewriter';
import HeroField from '../components/HeroField/HeroField';
import './Home.css';
import './Landing.css';

// The hero headline, typed line by line. Kept out here so the second line can
// be scheduled off the first line's length.
const HERO_LINE_1 = 'Your Coding Journey';
const HERO_LINE_2 = 'Starts Right Here';
// Groups in the tools marquee. Four, so the track stays wider than the window
// on anything up to an ultrawide; the travel in Landing.css is 100/4 percent
// and the two have to be changed together.
const MARQUEE_COPIES = 4;

const HERO_SPEED = 52;
const HERO_DELAY = 320;

// The dashboard preview is the heaviest thing on the page and it sits well
// below the fold, so it is split into its own chunk and only fetched once the
// reader is close to it.
const DashboardPreview = lazy(() => import('../components/DashboardPreview/DashboardPreview'));


const TRACKS = [
  {
    fa: 'fa-solid fa-code',
    title: 'Coding Basics',
    level: 'Start Here',
    color: '#6366f1',
    desc: 'Learn what code is, how computers think, and write your very first program. No experience needed at all.',
  },
  {
    fa: 'fa-brands fa-python',
    title: 'Python',
    level: 'Beginner → Advanced',
    color: '#3b82f6',
    desc: 'The friendliest programming language. Build real programs, automate tasks, and solve fun challenges.',
  },
  {
    fa: 'fa-solid fa-brain',
    title: 'Logical Thinking',
    level: 'All Levels',
    color: '#a855f7',
    desc: 'Learn to break big problems into small steps. This skill makes everything else in coding click.',
  },
  {
    fa: 'fa-solid fa-globe',
    title: 'Web Development',
    level: 'Beginner → Intermediate',
    color: '#10b981',
    desc: 'Build your own websites from scratch. HTML, CSS, and a little JavaScript to make things move.',
  },
  {
    fa: 'fa-solid fa-gamepad',
    title: 'Game Development',
    level: 'Intermediate',
    color: '#f59e0b',
    desc: 'Create your own 2D games with Python. Design levels, add characters, and share with friends.',
  },
  {
    fa: 'fa-solid fa-diagram-project',
    title: 'Algorithms',
    level: 'Intermediate',
    color: '#ec4899',
    desc: 'Discover clever ways to solve problems. Sorting, searching, and thinking like a computer scientist.',
  },
];

// Each roadmap is a goal and the stops on the way to it. A stop carries what
// it actually involves and roughly how long it runs, because "Coding Basics"
// on its own tells a parent nothing about what their child will be doing.
const PATHS = [
  {
    icon: 'fa-solid fa-seedling',
    title: 'Complete Beginner',
    blurb: 'Never written a line of code.',
    span: 'about 8 weeks',
    color: '#10b981',
    steps: [
      { label: 'Coding Basics', blurb: 'What code is, and how a computer follows instructions.', weeks: '2 weeks' },
      { label: 'Logical Thinking', blurb: 'Breaking a big problem into small, ordered steps.', weeks: '2 weeks' },
      { label: 'Python Intro', blurb: 'Variables, loops, and your first working program.', weeks: '3 weeks' },
      { label: 'First Mini Project', blurb: 'Build something small, finish it, show it off.', weeks: '1 week' },
    ],
  },
  {
    icon: 'fa-solid fa-rocket',
    title: 'Aspiring Developer',
    blurb: 'Wants to build real things.',
    span: 'about 14 weeks',
    color: '#3b82f6',
    steps: [
      { label: 'Python Fundamentals', blurb: 'Functions, files, and code other people can read.', weeks: '4 weeks' },
      { label: 'Web Dev Basics', blurb: 'HTML, CSS, and a page that is genuinely yours.', weeks: '4 weeks' },
      { label: 'Algorithms', blurb: 'Sorting, searching, and why speed matters.', weeks: '3 weeks' },
      { label: 'Build a Portfolio', blurb: 'Three finished projects, online and linkable.', weeks: '3 weeks' },
    ],
  },
  {
    icon: 'fa-solid fa-gamepad',
    title: 'Game Creator',
    blurb: 'Here to make games.',
    span: 'about 12 weeks',
    color: '#f59e0b',
    steps: [
      { label: 'Python Basics', blurb: 'Enough Python to make things move on screen.', weeks: '3 weeks' },
      { label: 'Game Logic', blurb: 'Movement, collisions, scoring, and the game loop.', weeks: '3 weeks' },
      { label: 'Pygame Projects', blurb: 'Two complete games, start to finish.', weeks: '4 weeks' },
      { label: 'Publish Your Game', blurb: 'Package it up and hand it to your friends.', weeks: '2 weeks' },
    ],
  },
];

const WHY = [
  { fa: 'fa-solid fa-hands-holding-child', title: 'Made for Young Learners', desc: 'Every lesson is designed to be clear, fun, and encouraging — no confusing jargon.' },
  { fa: 'fa-solid fa-person-chalkboard', title: 'Live Sessions', desc: 'Learn with a real instructor who guides you, answers questions, and keeps you on track.' },
  { fa: 'fa-solid fa-chart-line', title: 'Track Your Progress', desc: 'See how far you have come with session history, task completion, and progress charts.' },
  { fa: 'fa-solid fa-people-roof', title: 'Parents Stay Informed', desc: 'Parents can see sessions, tasks, and progress reports — always in the loop.' },
  { fa: 'fa-solid fa-shield-halved', title: 'Safe & Secure', desc: 'Your account and data are protected with modern security. Safe for kids to use.' },
  { fa: 'fa-solid fa-infinity', title: 'Learn at Your Pace', desc: 'No pressure. Revisit sessions, catch up on tasks, and grow at the speed that works for you.' },
];

const TOOLS = [
  { icon: 'fa-brands fa-python', label: 'Python' },
  { icon: 'fa-brands fa-js', label: 'JavaScript' },
  { icon: 'fa-brands fa-html5', label: 'HTML' },
  { icon: 'fa-brands fa-css3-alt', label: 'CSS' },
  { icon: 'fa-brands fa-git-alt', label: 'Git' },
  { icon: 'fa-solid fa-terminal', label: 'Command Line' },
  { icon: 'fa-solid fa-code', label: 'VS Code' },
  { icon: 'fa-solid fa-gamepad', label: 'Pygame' },
  { icon: 'fa-solid fa-database', label: 'SQL Basics' },
];

const Home = () => {
  const [activePath, setActivePath] = useState(0);
  const [firstLineDone, setFirstLineDone] = useState(false);
  // Stable identity: the callback is an effect dependency inside Typewriter.
  const handleFirstLineDone = useCallback(() => setFirstLineDone(true), []);
  const path = PATHS[activePath];

  return (
    <div className="home-container is-home-page hm">
      {/* ══════════ HERO ══════════ */}
      {/* The hero's backdrop is three layers, all decorative: hairlines on the
          layout's own columns (CSS, see .hero-section-wrapper in Home.css), two
          slow coloured washes behind them, and the drifting point field on top.
          Each one flips with the theme off the same custom properties. */}
      <section className="hero-section-wrapper">
        {/* The verticals, bounded to the rails' box. Decorative, and the tick
            repeats what the badge above it already says, so it is hidden from
            assistive tech rather than read out twice. */}
        <div className="hero-lattice" aria-hidden="true">
          <span className="hm-tick hero-tick">Ages 8–18</span>
        </div>
        <HeroField />
        <div className="hero-section">
          <div className="hero-badge">
            <i className="fa-solid fa-star" /> Learn to Code the Fun Way
          </div>
          {/* Typed one line after the other. The second line waits on the
              first line's onDone rather than on a computed delay, so the caret
              hands off at the line break however the timers actually ran. */}
          <h1 className="hero-title">
            <Typewriter
              text={HERO_LINE_1}
              speed={HERO_SPEED}
              startDelay={HERO_DELAY}
              persistCaret={false}
              onDone={handleFirstLineDone}
            />
            <br />
            <Typewriter
              className="hero-accent"
              text={HERO_LINE_2}
              speed={HERO_SPEED}
              startDelay={160}
              start={firstLineDone}
            />
          </h1>
          <p className="hero-subtitle">
            AlgoGambit is a warm, friendly place where kids and teens learn real programming skills —
            from their very first line of code all the way to building their own games and websites.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="nb-btn nb-btn-primary nb-btn-lg">
              <i className="fa-solid fa-play" /> Start Learning Free
            </Link>
            <Link to="/about" className="nb-btn nb-btn-secondary nb-btn-lg">
              <i className="fa-solid fa-circle-info" /> See What We Teach
            </Link>
          </div>
          <div className="hero-stats">
            {[
              { value: '6+', label: 'Coding Tracks', icon: 'fa-solid fa-layer-group' },
              { value: '100%', label: 'Hands-On', icon: 'fa-solid fa-hand' },
              { value: '24/7', label: 'Platform Access', icon: 'fa-solid fa-clock' },
            ].map(s => (
              <div key={s.label} className="hero-stat">
                <i className={s.icon} style={{ color: '#60a5fa', fontSize: '1.1rem' }} />
                <span className="stat-value">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TOOLS STRIP ══════════ */}
      <section className="hm-strip reveal fade-in" aria-label="Tools and languages">
        <span className="hm-strip-cap">Tools and languages you will actually use</span>
        {/* MARQUEE_COPIES identical rows. The animation travels exactly one
            row's width, so the loop closes on itself; the extra copies are
            what keep the track wider than the window, which is what stops the
            right-hand side emptying out before the loop comes round. Only the
            first is announced — the rest are the same list again. */}
        <div className="hm-marquee">
          {Array.from({ length: MARQUEE_COPIES }, (_, copy) => (
            <ul
              key={copy}
              className="hm-marquee-row"
              aria-hidden={copy > 0 ? 'true' : undefined}
            >
              {TOOLS.map(t => (
                <li key={`${t.label}-${copy}`}><i className={t.icon} /> {t.label}</li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      {/* ══════════ DASHBOARD PREVIEW ══════════ */}
      <section className="hm-plate reveal slide-up">
        <header className="hm-head">
          <span className="hm-tick"><i className="fa-solid fa-gauge-high" /> The dashboard</span>
          <h2 className="hm-title">Two dashboards, one for each of you.</h2>
          <p className="hm-sub">
            Students land on their streak, their XP and the tasks waiting on them.
            Parents land on attendance, instructor notes, progress and billing.
          </p>
        </header>

        <LazySection
          minHeight="26rem"
          fallback={<div className="hm-mock-skeleton" aria-hidden="true" />}
        >
          <DashboardPreview />
        </LazySection>
        <p className="hm-figcap">Switch roles and click through the panels. Illustrative preview — your own numbers start at zero on day one.</p>
      </section>

      {/* ══════════ PATHS ══════════ */}
      <section className="hm-plate reveal slide-up">
        <header className="hm-head">
          <span className="hm-tick"><i className="fa-solid fa-map" /> Roadmaps</span>
          <h2 className="hm-title">Pick your path.</h2>
          <p className="hm-sub">Not sure where to start? Choose a goal and follow the steps.</p>
        </header>

        {/* Which goal. Three cards rather than a list of words: this is the
            choice the whole section turns on, so it is given the weight of
            one. Each carries its own colour, which the map below inherits. */}
        <div className="hm-goals" role="group" aria-label="Choose a roadmap">
          {PATHS.map((p, i) => (
            <button
              key={p.title}
              type="button"
              className={`hm-goal${activePath === i ? ' is-active' : ''}`}
              style={{ '--goal': p.color }}
              aria-pressed={activePath === i}
              onClick={() => setActivePath(i)}
            >
              <span className="hm-goal-icon"><i className={p.icon} /></span>
              <span className="hm-goal-title">{p.title}</span>
              <span className="hm-goal-blurb">{p.blurb}</span>
              <span className="hm-goal-meta">
                {p.steps.length} stops · {p.span}
              </span>
            </button>
          ))}
        </div>

        {/* The map itself: numbered stops threaded on one line — across the
            page where there is room, down it where there is not. Keyed on the
            path so switching goals replays the entrance rather than swapping
            the words underneath the reader. */}
        <ol
          className="hm-map"
          key={path.title}
          style={{ '--goal': path.color, '--stops': path.steps.length }}
        >
          {path.steps.map((step, i) => (
            <li key={step.label} className="hm-stop">
              <span className="hm-stop-num">{i + 1}</span>
              <span className="hm-stop-body">
                <span className="hm-stop-title">{step.label}</span>
                <span className="hm-stop-blurb">{step.blurb}</span>
                <span className="hm-stop-weeks">
                  <i className="fa-regular fa-clock" /> {step.weeks}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ══════════ TRACKS ══════════ */}
      <section className="hm-plate reveal slide-up">
        <header className="hm-head">
          <span className="hm-tick"><i className="fa-solid fa-code-fork" /> Study tracks</span>
          <h2 className="hm-title">Six tracks, endless possibilities.</h2>
          <p className="hm-sub">Pick a track that excites you and follow it all the way to a real project.</p>
        </header>

        <div className="hm-grid">
          {TRACKS.map((t, i) => (
            <article
              key={t.title}
              className="hm-cell"
              style={{ '--cell-accent': t.color, '--cell-accent-soft': `${t.color}1f` }}
            >
              <span className="hm-cell-index">{String(i + 1).padStart(2, '0')}</span>
              <div className="hm-cell-icon"><i className={t.fa} /></div>
              <h3>{t.title}</h3>
              <span className="hm-cell-level">{t.level}</span>
              <p>{t.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ══════════ WHY ══════════ */}
      <section className="hm-plate reveal slide-up">
        <header className="hm-head">
          <span className="hm-tick"><i className="fa-solid fa-heart" /> Why AlgoGambit</span>
          <h2 className="hm-title">A place where learning feels good.</h2>
        </header>

        <div className="hm-rows">
          {WHY.map(w => (
            <div key={w.title} className="hm-row">
              <span className="hm-row-icon" aria-hidden="true"><i className={w.fa} /></span>
              <h3>{w.title}</h3>
              <p>{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ CLOSE ══════════ */}
      {/* The backdrop here is CSS. A three.js prism used to sit behind this
          plate, but it refracts into a full rainbow — a palette this page does
          not otherwise contain — and it was the only thing still pulling the
          three.js chunk onto the landing page. */}
      <section className="hm-plate hm-close reveal slide-up">
        <span className="hm-close-bg" aria-hidden="true" />
        <span className="hm-tick"><i className="fa-solid fa-laptop-code" /> Get started</span>
        <h2 className="hm-title">Ready to write your first line of code?</h2>
        <p className="hm-sub">
          Join AlgoGambit and start building real things from day one. No experience needed.
        </p>
        <div className="hm-close-actions">
          <Link to="/login" className="nb-btn nb-btn-primary nb-btn-lg">
            <i className="fa-solid fa-arrow-right" /> Get Started — It is Free
          </Link>
          <Link to="/contact" className="nb-btn nb-btn-secondary nb-btn-lg">
            <i className="fa-solid fa-envelope" /> Talk to Us
          </Link>
        </div>
      </section>

    </div>
  );
};

export default Home;
