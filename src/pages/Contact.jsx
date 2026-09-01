import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';
import './Landing.css';

/**
 * Contact, on the same landing system as the home and about pages.
 *
 * The opening is the form. Nobody arrives here to read, so the copy beside it
 * is only what you need before you type: who picks the message up, how long
 * they take, and the two ways to skip the form entirely. Everything below is
 * the shared furniture — the row cards, the note block, the closing plate.
 */

const CHANNELS = [
  {
    fa: 'fa-solid fa-graduation-cap',
    title: 'Joining a class',
    desc: 'Which track suits your child, what a session looks like, and how to book a free first lesson.',
  },
  {
    fa: 'fa-solid fa-user-shield',
    title: 'Parent accounts',
    desc: 'Attendance, instructor notes, progress and billing — how the parent dashboard works and what it shows.',
  },
  {
    fa: 'fa-solid fa-screwdriver-wrench',
    title: 'Technical help',
    desc: 'Trouble signing in, a lesson that will not load, or anything on the platform behaving oddly.',
  },
  {
    fa: 'fa-solid fa-school',
    title: 'Schools and partners',
    desc: 'Running AlgoGambit with a group, a school or a club, and what that costs.',
  },
];

const FAQ = [
  {
    q: 'How quickly will someone reply?',
    a: 'Within one working day, and usually the same day. Sunday to Thursday, 10:00–18:00 Cairo time. Anything sent over the weekend is answered first thing Sunday.',
  },
  {
    q: 'Does my child need any experience?',
    a: 'No. Most students start with none at all — the first track assumes nothing beyond being able to use a computer. Students who already code are placed further along after a short chat.',
  },
  {
    q: 'What ages do you teach?',
    a: 'Eight to eighteen. Groups are set by age and by level, so an eight-year-old and a fifteen-year-old are never in the same lesson.',
  },
  {
    q: 'Can we try a lesson before paying?',
    a: 'Yes. The first session is free and there is nothing to install — everything runs in the browser. Ask for it in your message and we will book a time that suits you.',
  },
  {
    q: 'What do we need at home?',
    a: 'A computer with a browser and a working internet connection. A headset helps in a live session, but a laptop microphone is fine.',
  },
  {
    q: 'Can parents see what happens in class?',
    a: 'That is what the parent dashboard is for: attendance, the instructor’s notes after each session, progress through the track and the billing history, all in one place.',
  },
];

const SUBJECTS = [
  'Joining a class',
  'Parent account',
  'Technical help',
  'Schools and partners',
  'Something else',
];

const Contact = () => {
  const [sent, setSent] = useState(false);
  // One prefix per mounted form, so every label points at its own field even
  // if this ever renders twice on a page.
  const id = useId();

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
    e.target.reset();
  };

  return (
    <div className="home-container is-home-page hm ct-page">

      {/* ══════════ HERO: THE FORM ══════════ */}
      <section className="ct-hero">
        <div className="ct-hero-inner">
          <div>
            <span className="hm-tick"><i className="fa-solid fa-comments" /> Contact</span>
            <h1 className="ct-title">
              Talk to a person,<br />
              <em>not a ticket queue.</em>
            </h1>
            <p className="ct-lead">
              Questions about a track, a booking, an invoice or something that will not load —
              the same small team answers all of it, usually the same day.
            </p>

            <ul className="ct-lines">
              <li className="ct-line">
                <i className="fa-solid fa-envelope" aria-hidden="true" />
                <span>
                  <span className="ct-line-key">Email</span>
                  <a className="ct-line-value" href="mailto:hello@algogambit.online">
                    hello@algogambit.online
                  </a>
                </span>
              </li>
              <li className="ct-line">
                <i className="fa-solid fa-phone" aria-hidden="true" />
                <span>
                  <span className="ct-line-key">Phone</span>
                  <a className="ct-line-value" href="tel:+20211234567">+20 2 1123 4567</a>
                </span>
              </li>
              <li className="ct-line">
                <i className="fa-solid fa-clock" aria-hidden="true" />
                <span>
                  <span className="ct-line-key">Hours</span>
                  <span className="ct-line-value">Sun–Thu, 10:00–18:00 (Cairo)</span>
                </span>
              </li>
            </ul>
          </div>

          <div className="ct-form">
            <span className="hm-tick"><i className="fa-solid fa-paper-plane" /> Send a message</span>
            <h2 className="ct-form-title">Tell us what you need.</h2>
            <p className="ct-form-sub">
              A few lines is plenty. The more you say about your child&apos;s age and experience,
              the more useful the first reply will be.
            </p>

            {/* Polite rather than assertive: the confirmation is worth hearing,
                but not worth cutting off whatever is being read. */}
            <div role="status" aria-live="polite">
              {sent && (
                <p className="ct-sent">
                  <i className="fa-solid fa-circle-check" aria-hidden="true" />
                  Thank you — your message is on its way. We will reply within one working day.
                </p>
              )}
            </div>

            <form className="ct-fields" onSubmit={handleSubmit}>
              <div className="ct-pair">
                <p className="ct-field">
                  <label htmlFor={`${id}-name`}>Your name</label>
                  <input
                    id={`${id}-name`}
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Sara Hassan"
                  />
                </p>
                <p className="ct-field">
                  <label htmlFor={`${id}-email`}>Email</label>
                  <input
                    id={`${id}-email`}
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </p>
              </div>

              <div className="ct-pair">
                <p className="ct-field">
                  <label htmlFor={`${id}-role`}>I am a</label>
                  <select id={`${id}-role`} name="role" defaultValue="Parent">
                    <option>Parent</option>
                    <option>Student</option>
                    <option>Teacher or school</option>
                    <option>Someone else</option>
                  </select>
                </p>
                <p className="ct-field">
                  <label htmlFor={`${id}-subject`}>About</label>
                  <select id={`${id}-subject`} name="subject" defaultValue={SUBJECTS[0]}>
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </p>
              </div>

              <p className="ct-field">
                <label htmlFor={`${id}-message`}>Message</label>
                <textarea
                  id={`${id}-message`}
                  name="message"
                  required
                  rows="5"
                  placeholder="My daughter is 11 and has never coded before…"
                />
              </p>

              <button type="submit" className="nb-btn nb-btn-primary nb-btn-lg ct-submit">
                <i className="fa-solid fa-paper-plane" /> Send message
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ══════════ WHAT WE CAN HELP WITH ══════════ */}
      <section className="hm-plate reveal slide-up">
        <header className="hm-head">
          <span className="hm-tick"><i className="fa-solid fa-circle-question" /> What we can help with</span>
          <h2 className="hm-title">Four things people usually write about.</h2>
          <p className="hm-sub">
            Pick whichever is closest in the form above — it only decides who reads it first.
          </p>
        </header>

        <div className="hm-rows is-quad">
          {CHANNELS.map(c => (
            <div key={c.title} className="hm-row">
              <span className="hm-row-icon" aria-hidden="true"><i className={c.fa} /></span>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section className="hm-plate reveal slide-up" id="faq">
        <header className="hm-head">
          <span className="hm-tick"><i className="fa-solid fa-comment-dots" /> Before you write</span>
          <h2 className="hm-title">Answers to the usual questions.</h2>
        </header>

        <div className="ct-faq">
          {FAQ.map((f, i) => (
            <details key={f.q} className="ct-q" open={i === 0}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ══════════ WHERE WE ARE ══════════ */}
      <section className="hm-plate reveal slide-up">
        <div className="hm-note">
          <span className="hm-note-icon" aria-hidden="true">
            <i className="fa-solid fa-location-dot" />
          </span>
          <div className="hm-note-body">
            <span className="hm-tick"><i className="fa-solid fa-globe" /> Where we are</span>
            <h2 className="hm-note-title">Cairo, teaching online.</h2>
            <p className="hm-note-text">
              Every lesson is live and online, so where you are does not matter — students join
              from anywhere with a browser and an internet connection. Sessions are scheduled in
              Cairo time, and we will find a slot that works in yours.
            </p>
            <ul className="hm-note-tags">
              <li><i className="fa-solid fa-video" aria-hidden="true" /> Live online lessons</li>
              <li><i className="fa-solid fa-earth-africa" aria-hidden="true" /> Any time zone</li>
              <li><i className="fa-solid fa-download" aria-hidden="true" /> Nothing to install</li>
              <li><i className="fa-solid fa-reply" aria-hidden="true" /> Replies in one working day</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ══════════ CLOSE ══════════ */}
      <section className="hm-plate hm-close reveal slide-up">
        <span className="hm-close-bg" aria-hidden="true" />
        <span className="hm-tick"><i className="fa-solid fa-laptop-code" /> Or skip the form</span>
        <h2 className="hm-title">You can also just start.</h2>
        <p className="hm-sub">
          The first session is free, and you can book it from your account in a couple of minutes.
        </p>
        <div className="hm-close-actions">
          <Link to="/login" className="nb-btn nb-btn-primary nb-btn-lg">
            <i className="fa-solid fa-arrow-right" /> Start learning
          </Link>
          <Link to="/about" className="nb-btn nb-btn-secondary nb-btn-lg">
            <i className="fa-solid fa-circle-info" /> See what we teach
          </Link>
        </div>
      </section>

    </div>
  );
};

export default Contact;
