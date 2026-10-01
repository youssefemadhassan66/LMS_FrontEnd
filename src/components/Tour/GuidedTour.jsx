import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './GuidedTour.css';

const GAP = 14;        // between the highlighted element and the card
const EDGE = 12;       // keep the card this far from the viewport edge
const HALO = 6;        // spotlight padding around the element
const PHONE = 600;

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// On screen, or at least scrollable to: a closed mobile drawer sits off to
// the left and counts as hidden.
const isVisible = (el) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
};

/**
 * Finds what a step points at. `target` is a selector or a list of them, tried
 * in order: a sidebar link on desktop, the menu button on a phone, where the
 * drawer is closed. Returns the element and whether it was a fallback.
 */
const resolveTarget = (step) => {
  const selectors = [].concat(step?.target || []);
  for (let i = 0; i < selectors.length; i += 1) {
    const el = document.querySelector(selectors[i]);
    if (el && isVisible(el)) return { el, fallback: i > 0 };
  }
  return { el: null, fallback: false };
};

// Card position next to the highlighted rect. Desktop prefers the side the
// step asks for, then below, then above; a phone docks the card to whichever
// edge the element is not near.
const placeCard = (rect, card, placement) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x) => Math.min(Math.max(x, EDGE), vw - card.width - EDGE);
  const clampY = (y) => Math.min(Math.max(y, EDGE), vh - card.height - EDGE);

  if (!rect) return { top: clampY((vh - card.height) / 2), left: clampX((vw - card.width) / 2) };

  if (vw <= PHONE) {
    const nearTop = rect.top + rect.height / 2 < vh / 2;
    return { top: nearTop ? vh - card.height - EDGE : EDGE, left: EDGE };
  }

  const right = rect.left + rect.width + GAP;
  if (placement === 'right' && right + card.width <= vw - EDGE) {
    return { top: clampY(rect.top + rect.height / 2 - card.height / 2), left: right };
  }
  const below = rect.top + rect.height + GAP;
  if (below + card.height <= vh - EDGE) {
    return { top: below, left: clampX(rect.left + rect.width / 2 - card.width / 2) };
  }
  const above = rect.top - GAP - card.height;
  if (above >= EDGE) {
    return { top: above, left: clampX(rect.left + rect.width / 2 - card.width / 2) };
  }
  return { top: clampY(vh - card.height - EDGE), left: clampX(rect.left + rect.width / 2 - card.width / 2) };
};

/**
 * A step-by-step introduction that highlights one part of the page at a time.
 *
 * Steps: { target, title, body, icon, placement, optional, menuNote }.
 * A step with no target is a centred card. An `optional` step is skipped
 * when its element is not on the page (no upcoming class, say). onFinish is
 * called with 'done' or 'skipped'.
 */
const GuidedTour = ({ steps, onFinish }) => {
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState({ spot: null, card: null, fallback: false });
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const titleId = useId();
  const bodyId = useId();
  const step = steps[index];
  const last = index === steps.length - 1;

  // The next step to show in a direction, passing over optional steps whose
  // element is missing.
  const stepFrom = useCallback(
    (from, direction) => {
      let i = from + direction;
      while (i > 0 && i < steps.length - 1 && steps[i].optional && !resolveTarget(steps[i]).el) {
        i += direction;
      }
      return Math.min(Math.max(i, 0), steps.length - 1);
    },
    [steps],
  );

  const next = useCallback(() => {
    if (last) onFinish('done');
    else setIndex((i) => stepFrom(i, 1));
  }, [last, onFinish, stepFrom]);

  const back = useCallback(() => setIndex((i) => stepFrom(i, -1)), [stepFrom]);

  // Bring the element into view, then measure it and the card. Measuring
  // happens in animation frames so the card's own size is known, and again
  // after a smooth scroll has settled.
  useLayoutEffect(() => {
    const { el, fallback } = resolveTarget(step);
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });

    let frame = 0;
    const measure = () => {
      const card = cardRef.current;
      const target = el && el.isConnected && isVisible(el) ? el : null;
      const r = target?.getBoundingClientRect();
      const spot = r
        ? { top: r.top - HALO, left: r.left - HALO, width: r.width + HALO * 2, height: r.height + HALO * 2 }
        : null;
      const size = { width: card?.offsetWidth || 340, height: card?.offsetHeight || 220 };
      setLayout({ spot, card: placeCard(spot, size, step.placement), fallback });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    schedule();
    const settle = setTimeout(schedule, 420);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [step]);

  // Keyboard: arrows move, Escape leaves. Focus sits on the main button so
  // Enter or Space moves on.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onFinish('skipped');
      } else if (e.key === 'ArrowRight') {
        next();
      } else if (e.key === 'ArrowLeft') {
        back();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, back, onFinish]);

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [index]);

  // Return focus to wherever it was before the tour opened.
  useEffect(() => {
    const before = document.activeElement;
    return () => before?.focus?.({ preventScroll: true });
  }, []);

  const placed = layout.card !== null;
  const spotStyle = layout.spot || {
    top: window.innerHeight / 2,
    left: window.innerWidth / 2,
    width: 0,
    height: 0,
  };

  return createPortal(
    <div className="tour">
      {/* Swallows clicks on the page while the tour is up. */}
      <div className="tour__blocker" aria-hidden="true" />
      <div
        className={`tour__spot${layout.spot ? '' : ' is-empty'}`}
        style={spotStyle}
        aria-hidden="true"
      />
      <div
        ref={cardRef}
        className={`tour__card${placed ? ' is-placed' : ''}`}
        style={layout.card || undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        {/* Keyed by step, so each step's content plays its entrance. */}
        <div className="tour__content" key={index}>
          <div className="tour__top">
            {step.icon && (
              <span className="tour__icon" aria-hidden="true">
                <i className={step.icon} />
              </span>
            )}
            <span className="tour__count">
              {index + 1} of {steps.length}
            </span>
            <button type="button" className="tour__skip" onClick={() => onFinish('skipped')}>
              Skip tour
            </button>
          </div>
          <h2 id={titleId} className="tour__title">{step.title}</h2>
          <p id={bodyId} className="tour__body">
            {step.body}
            {layout.fallback && step.menuNote && (
              <span className="tour__note">
                <i className="fa-solid fa-bars" aria-hidden="true" /> {step.menuNote}
              </span>
            )}
          </p>
        </div>

        <div className="tour__footer">
          <div className="tour__dots" aria-hidden="true">
            {steps.map((s, i) => (
              <span key={s.title} className={i === index ? 'is-current' : i < index ? 'is-done' : ''} />
            ))}
          </div>
          <div className="tour__actions">
            {index > 0 && (
              <button type="button" className="tour__btn tour__btn--ghost" onClick={back}>
                Back
              </button>
            )}
            <button type="button" ref={nextRef} className="tour__btn tour__btn--primary" onClick={next}>
              {last ? step.finishLabel || 'Done' : index === 0 ? 'Show me around' : 'Next'}
              {!last && <i className="fa-solid fa-arrow-right" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default GuidedTour;
