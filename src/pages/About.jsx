import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';
import './Landing.css';

/**
 * About, on the same landing system as the home page.
 *
 * The body is the home page’s furniture reused: the tools strip, the ruled
 * grid, the threaded map and the closing plate. Two pages that share a system
 * should not need two sets of components to say so, and the pieces that were
 * genuinely missing (a note block, a row of figures) were small enough to add.
 *
 * The opening is the deliberate exception. A page about the school should not
 * begin with the same panel the home page begins with, so this one is a stage —
 * .ab-hero in Landing.css — centred on a field of rings with a light sweeping
 * round it, where the home page is a lit slab with points drifting across it.
 */

// Same count as the home page's strip, and the travel in Landing.css is
// 100/MARQUEE_COPIES percent — the two have to be changed together.
const MARQUEE_COPIES = 4;

const SKILLS = [
  {
    fa: 'fa-solid fa-code',
    title: 'Coding Basics',
    level: 'Start here',
    color: '#6366f1',
    points: ['What a program actually is', 'How computers follow instructions', 'Variables and values', 'Your first Python script', 'Reading an error message'],
  },
  {
    fa: 'fa-brands fa-python',
    title: 'Python',
    level: 'Beginner → Advanced',
    color: '#3b82f6',
    points: ['Variables and data types', 'Loops and conditions', 'Functions and modules', 'Lists and dictionaries', 'Small projects and scripts'],
  },
  {
    fa: 'fa-solid fa-brain',
    title: 'Logical Thinking',
    level: 'All levels',
    color: '#a855f7',
    points: ['Breaking problems into steps', 'Spotting patterns', 'Writing pseudocode', 'Debugging strategies', 'Thinking before typing'],
  },
  {
    fa: 'fa-solid fa-globe',
    title: 'Web Development',
    level: 'Beginner → Intermediate',
    color: '#10b981',
    points: ['HTML structure and tags', 'CSS styling and layout', 'Making things move with JS', 'Building real pages', 'Putting your site online'],
  },
  {
    fa: 'fa-solid fa-gamepad',
    title: 'Game Development',
    level: 'Intermediate',
    color: '#f59e0b',
    points: ['Game loops and logic', 'Moving characters on screen', 'Collision detection', 'Scoring and levels', 'Finishing a complete game'],
  },
  {
    fa: 'fa-solid fa-diagram-project',
    title: 'Algorithms',
    level: 'Intermediate',
    color: '#ec4899',
    points: ['What an algorithm is', 'Sorting and searching', 'Recursion basics', 'Thinking about efficiency', 'Solving coding puzzles'],
  },
];

const JOURNEY = [
  {
    label: 'Start with the basics',
    blurb: 'Logical thinking and Python fundamentals. No experience needed — we start from zero.',
    when: 'Weeks 1–4',
  },
  {
    label: 'Build your first projects',
    blurb: 'A calculator, a quiz game, a to-do list. Small wins that build real confidence.',
    when: 'Weeks 5–10',
  },
  {
    label: 'Go deeper',
    blurb: 'Pick a track you love — web development or game creation — and follow it properly.',
    when: 'Weeks 11–20',
  },
  {
    label: 'Create something real',
    blurb: 'A game, a website, a tool. Something finished, that you made, that you can show.',
    when: 'Weeks 21+',
  },
];

const PLATFORM = [
  { fa: 'fa-solid fa-chalkboard-user', title: 'Live Sessions', desc: 'One-to-one and group sessions with your instructor, recorded so you can rewatch any of them.' },
  { fa: 'fa-solid fa-list-check', title: 'Tasks & Assignments', desc: 'Homework after each session, submitted in the platform and returned with scored feedback.' },
  { fa: 'fa-solid fa-chart-bar', title: 'Progress Dashboard', desc: 'Session history, task completion and progress charts — how far you have come, in one place.' },
  { fa: 'fa-solid fa-people-roof', title: 'Parent Portal', desc: 'Parents see attendance, tasks, instructor notes and monthly reports without asking for them.' },
  { fa: 'fa-solid fa-shield-halved', title: 'Safe & Secure', desc: 'Modern authentication and encrypted storage, on a platform built for children to use.' },
  { fa: 'fa-solid fa-moon', title: 'Dark & Light', desc: 'Full theme support on every page, so studying late at night is as comfortable as midday.' },
];

const SAFETY = [
  { fa: 'fa-solid fa-lock', label: 'Encrypted data' },
  { fa: 'fa-solid fa-user-shield', label: 'Secure login' },
  { fa: 'fa-solid fa-eye', label: 'Parent visibility' },
  { fa: 'fa-solid fa-ban', label: 'No data sharing' },
];

const FIGURES = [
  { icon: 'fa-solid fa-layer-group', value: '6', label: 'Coding tracks' },
  { icon: 'fa-solid fa-users', value: '4', label: 'User roles' },
  { icon: 'fa-solid fa-folder-open', value: '50+', label: 'Real projects' },
  { icon: 'fa-solid fa-clock', value: '24/7', label: 'Platform access' },
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

const About = () => (
  <div className="home-container is-home-page hm">

    {/* ══════════ OPENING ══════════ */}
    {/* Third opening, third device. The home page opens on a lit slab of its
        own colour with the point field drifting over it; the contact page
        opens on the form itself. This one is a stage: centred type, nothing
        beside it, standing on a ring field with a light sweeping slowly
        around it — see .ab-hero in Landing.css. */}
    <section className="ab-hero">
      <div className="ab-hero-inner">
        <span className="hm-tick">About AlgoGambit</span>
        <h1 className="ab-hero-title">
          We teach children to <em>build things that run.</em>
        </h1>
        <p className="ab-hero-lead">
          Python, web development, game creation and the logical thinking underneath all
          of it — taught live to learners aged 8 to 18, on a platform that remembers every
          session, every task and every step forward.
        </p>
        <div className="ab-hero-actions">
          <Link to="/login" className="nb-btn nb-btn-primary nb-btn-lg">
            <i className="fa-solid fa-play" /> Join now
          </Link>
          <Link to="/contact" className="nb-btn nb-btn-secondary nb-btn-lg">
            <i className="fa-solid fa-envelope" /> Talk to us
          </Link>
        </div>

        {/* The four things asked before anyone reads the body. */}
        <ul className="ab-rail">
          <li><i className="fa-solid fa-child-reaching" aria-hidden="true" /> Ages 8–18</li>
          <li><i className="fa-solid fa-video" aria-hidden="true" /> Live online lessons</li>
          <li><i className="fa-solid fa-seedling" aria-hidden="true" /> No experience needed</li>
          <li><i className="fa-solid fa-gift" aria-hidden="true" /> First session free</li>
        </ul>
      </div>
    </section>

    {/* ══════════ TOOLS STRIP ══════════ */}
    <section className="hm-strip reveal fade-in" aria-label="Tools and languages">
      <span className="hm-strip-cap">What students actually work with</span>
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

    {/* ══════════ WHAT WE TEACH ══════════ */}
    <section className="hm-plate reveal slide-up">
      <header className="hm-head">
        <span className="hm-tick"><i className="fa-solid fa-graduation-cap" /> Skill tracks</span>
        <h2 className="hm-title">Everything we teach.</h2>
        <p className="hm-sub">
          Six tracks, each with structured lessons and a real project at the end of it.
        </p>
      </header>

      <div className="hm-grid">
        {SKILLS.map((s, i) => (
          <article
            key={s.title}
            className="hm-cell"
            style={{ '--cell-accent': s.color, '--cell-accent-soft': `${s.color}1f` }}
          >
            <span className="hm-cell-index">{String(i + 1).padStart(2, '0')}</span>
            <div className="hm-cell-icon"><i className={s.fa} /></div>
            <h3>{s.title}</h3>
            <span className="hm-cell-level">{s.level}</span>
            <ul className="hm-cell-points">
              {s.points.map(p => (
                <li key={p}><i className="fa-solid fa-check" aria-hidden="true" /> {p}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>

    {/* ══════════ THE JOURNEY ══════════ */}
    <section className="hm-plate reveal slide-up">
      <header className="hm-head">
        <span className="hm-tick"><i className="fa-solid fa-map-location-dot" /> The journey</span>
        <h2 className="hm-title">From zero to builder.</h2>
        <p className="hm-sub">
          A clear path from a first variable to a project worth showing someone.
        </p>
      </header>

      {/* The home page's roadmap, with one path and no chooser. */}
      <ol className="hm-map" style={{ '--stops': JOURNEY.length }}>
        {JOURNEY.map((step, i) => (
          <li key={step.label} className="hm-stop">
            <span className="hm-stop-num">{i + 1}</span>
            <span className="hm-stop-body">
              <span className="hm-stop-title">{step.label}</span>
              <span className="hm-stop-blurb">{step.blurb}</span>
              <span className="hm-stop-weeks">
                <i className="fa-regular fa-clock" /> {step.when}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>

    {/* ══════════ THE PLATFORM ══════════ */}
    <section className="hm-plate reveal slide-up">
      <header className="hm-head">
        <span className="hm-tick"><i className="fa-solid fa-laptop" /> The platform</span>
        <h2 className="hm-title">Built for serious learning.</h2>
        <p className="hm-sub">
          The lessons are live, but everything around them is written down and kept.
        </p>
      </header>

      <div className="hm-rows">
        {PLATFORM.map(p => (
          <div key={p.title} className="hm-row">
            <span className="hm-row-icon" aria-hidden="true"><i className={p.fa} /></span>
            <h3>{p.title}</h3>
            <p>{p.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* ══════════ SAFETY ══════════ */}
    <section className="hm-plate reveal slide-up">
      <div className="hm-note">
        <span className="hm-note-icon" aria-hidden="true">
          <i className="fa-solid fa-shield-halved" />
        </span>
        <div className="hm-note-body">
          <span className="hm-tick"><i className="fa-solid fa-lock" /> Safety</span>
          <h2 className="hm-note-title">Safe for kids, legible to parents.</h2>
          <p className="hm-note-text">
            Accounts use modern authentication, data is encrypted at rest, and every endpoint
            is rate limited. Parents get full visibility of their child&apos;s sessions, tasks and
            progress, and nothing is shared outside the platform.
          </p>
          <ul className="hm-note-tags">
            {SAFETY.map(t => (
              <li key={t.label}><i className={t.fa} aria-hidden="true" /> {t.label}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>

    {/* ══════════ BY THE NUMBERS ══════════ */}
    <section className="hm-plate reveal slide-up">
      <header className="hm-head">
        <span className="hm-tick"><i className="fa-solid fa-chart-simple" /> By the numbers</span>
        <h2 className="hm-title">AlgoGambit, counted up.</h2>
      </header>

      <dl className="hm-figures">
        {FIGURES.map(f => (
          <div key={f.label} className="hm-figure">
            <i className={f.icon} aria-hidden="true" />
            <dt className="hm-figure-value">{f.value}</dt>
            <dd className="hm-figure-label">{f.label}</dd>
          </div>
        ))}
      </dl>
    </section>

    {/* ══════════ CLOSE ══════════ */}
    <section className="hm-plate hm-close reveal slide-up">
      <span className="hm-close-bg" aria-hidden="true" />
      <span className="hm-tick"><i className="fa-solid fa-laptop-code" /> Get started</span>
      <h2 className="hm-title">Ready to write your first line of code?</h2>
      <p className="hm-sub">
        Your first session is a click away. No experience needed, and nothing to install.
      </p>
      <div className="hm-close-actions">
        <Link to="/login" className="nb-btn nb-btn-primary nb-btn-lg">
          <i className="fa-solid fa-arrow-right" /> Start learning
        </Link>
        <Link to="/contact" className="nb-btn nb-btn-secondary nb-btn-lg">
          <i className="fa-solid fa-envelope" /> Talk to us
        </Link>
      </div>
    </section>

  </div>
);

export default About;
