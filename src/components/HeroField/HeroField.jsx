import React, { useEffect, useRef } from 'react';
import './HeroField.css';

/**
 * The moving layer behind the hero headline: a drift of points that draw a
 * hairline between themselves whenever two of them come close, and lean away
 * from the pointer when there is one.
 *
 * It is a 2D canvas rather than CSS because the connections have to be
 * recomputed every frame — no number of animated gradients gives you a line
 * that appears because two things happen to be near each other.
 *
 * ── Cost ───────────────────────────────────────────────────────────────
 * A full-bleed canvas is the expensive kind, so the budget is explicit rather
 * than incidental:
 *
 *   The backing store is capped by pixel COUNT, not by device pixel ratio. A
 *   1920×830 hero at dpr 2 is 6.4M pixels — 25MB of memory for a field of
 *   soft dots. MAX_BACKING_PX holds it near 10MB by lowering the effective
 *   ratio, which on marks this soft is invisible.
 *
 *   Nothing is allocated per frame. Points are plain objects in one array,
 *   written in place; the loops are indexed rather than iterator-based, so
 *   there is no closure churn for the GC to collect sixty times a second.
 *
 *   Point count comes from area, then from what the device admits to having
 *   (cores and memory), and links compare squared distances so the common
 *   case — a pair too far apart to matter — never reaches a square root.
 *
 *   The loop runs only while the canvas is on screen and the tab is visible,
 *   resizes are coalesced onto a frame, and teardown drops the backing store
 *   rather than waiting for the GC to notice a detached canvas.
 *
 * Colours come from the CSS custom properties the hero already sets, so the
 * field flips with the theme without this file knowing either palette; a
 * MutationObserver on the theme attribute re-reads them on a switch.
 *
 * Reduced motion draws the field once and stops: the texture survives, the
 * movement does not.
 */

const LINK_DIST = 148; // px at which two points start drawing a line
const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
const AREA_PER_DOT = 26000; // px² of canvas per point
const MAX_DOTS = 110;
const MAX_BACKING_PX = 2600000; // ≈10MB of backing store at 4 bytes/px
const POINTER_RADIUS = 190;
const SPEED = 0.14;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How much this machine should be asked to draw. Both hints are advisory and
 *  often absent, so the fallbacks assume a mid-range device, not a good one. */
const deviceScale = () => {
  if (typeof navigator === 'undefined') return 1;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  if (cores <= 2 || memory <= 2) return 0.45;
  if (cores <= 4 || memory <= 4) return 0.7;
  return 1;
};

const HeroField = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduced = prefersReducedMotion();
    const scale = deviceScale();
    const finePointer =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: fine)').matches;

    let width = 0;
    let height = 0;
    let frame = null;
    let resizeFrame = null;
    let last = 0;
    let clock = 0;
    let onScreen = true;

    const dots = [];
    const colors = { dot: 'rgba(37,99,235,0.5)', link: 'rgba(37,99,235,0.16)' };
    // Off-canvas until the pointer actually arrives, so nothing leans towards
    // a corner the reader never touched.
    const pointer = { x: -9999, y: -9999, strength: 0 };

    const readColors = () => {
      const style = getComputedStyle(canvas);
      const dot = style.getPropertyValue('--hero-dot').trim();
      const link = style.getPropertyValue('--hero-link').trim();
      if (dot) colors.dot = dot;
      if (link) colors.link = link;
    };

    const wanted = () =>
      Math.max(
        14,
        Math.min(MAX_DOTS, Math.round(((width * height) / AREA_PER_DOT) * scale)),
      );

    const spawn = (dot) => {
      // Depth. A point further back is smaller, fainter and slower, which is
      // what separates a field with space in it from a flat sheet of confetti.
      const z = 0.35 + Math.random() * 0.65;
      dot.x = Math.random() * width;
      dot.y = Math.random() * height;
      dot.vx = (Math.random() - 0.5) * SPEED * 2 * z;
      dot.vy = (Math.random() - 0.5) * SPEED * 2 * z;
      dot.z = z;
      dot.r = 0.7 + z * 1.7;
      // Its own phase and rate, so the field breathes unevenly rather than
      // pulsing in unison.
      dot.phase = Math.random() * Math.PI * 2;
      dot.rate = 0.0006 + Math.random() * 0.0011;
      dot.ox = 0;
      dot.oy = 0;
      return dot;
    };

    const fit = () => {
      const count = wanted();
      while (dots.length < count) dots.push(spawn({}));
      // Trim in place: a resize should not restart the whole field.
      if (dots.length > count) dots.length = count;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const prevW = width;
      const prevH = height;
      width = rect.width;
      height = rect.height;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const raw = width * height * dpr * dpr;
      // Trade resolution for memory once the canvas gets large, never the
      // other way around.
      const ratio =
        raw > MAX_BACKING_PX ? Math.max(1, dpr * Math.sqrt(MAX_BACKING_PX / raw)) : dpr;

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      if (prevW && prevH && dots.length) {
        // Carry the field across the resize instead of scattering it again.
        const sx = width / prevW;
        const sy = height / prevH;
        for (let i = 0; i < dots.length; i += 1) {
          dots[i].x *= sx;
          dots[i].y *= sy;
        }
      }
      fit();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Links first, so the points sit on top of their own web.
      ctx.strokeStyle = colors.link;
      ctx.lineWidth = 1;
      for (let i = 0; i < dots.length; i += 1) {
        const a = dots[i];
        const ax = a.x + a.ox;
        const ay = a.y + a.oy;
        for (let j = i + 1; j < dots.length; j += 1) {
          const b = dots[j];
          const dx = ax - (b.x + b.ox);
          const dy = ay - (b.y + b.oy);
          const sq = dx * dx + dy * dy;
          if (sq > LINK_DIST_SQ) continue;
          // Fade with separation so links arrive and leave rather than
          // blinking on at the threshold.
          ctx.globalAlpha = 1 - Math.sqrt(sq) / LINK_DIST;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(b.x + b.ox, b.y + b.oy);
          ctx.stroke();
        }
      }

      ctx.fillStyle = colors.dot;
      for (let i = 0; i < dots.length; i += 1) {
        const d = dots[i];
        // Depth sets the base opacity; the breath moves it a little either way.
        const twinkle = 0.72 + Math.sin(clock * d.rate + d.phase) * 0.28;
        ctx.globalAlpha = Math.min(1, d.z * twinkle);
        ctx.beginPath();
        ctx.arc(d.x + d.ox, d.y + d.oy, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const step = (now) => {
      // Scale by elapsed time so the drift runs at the same speed on a 60Hz
      // panel and a 144Hz one, and a backgrounded tab returning does not
      // teleport the field.
      const elapsed = Math.min(now - last, 48);
      const dt = elapsed / 16.67;
      last = now;
      clock += elapsed;

      // The pointer's pull eases in and out rather than snapping, so leaving
      // the hero relaxes the field instead of dropping it.
      const target = pointer.x > -9998 ? 1 : 0;
      pointer.strength += (target - pointer.strength) * 0.06 * dt;

      for (let i = 0; i < dots.length; i += 1) {
        const d = dots[i];
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        // Wrap rather than bounce: a bounce puts a visible wall at the edge of
        // the panel, and the panel is meant to look like a window onto
        // something larger.
        if (d.x < -10) d.x = width + 10;
        else if (d.x > width + 10) d.x = -10;
        if (d.y < -10) d.y = height + 10;
        else if (d.y > height + 10) d.y = -10;

        // Pointer lean, held as an offset rather than a change of velocity:
        // the field returns to its own drift the moment the pointer leaves,
        // and no point can be permanently dragged out of the layout.
        let tx = 0;
        let ty = 0;
        if (pointer.strength > 0.01) {
          const dx = d.x - pointer.x;
          const dy = d.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < POINTER_RADIUS && dist > 0.001) {
            const push = (1 - dist / POINTER_RADIUS) ** 2 * 26 * d.z * pointer.strength;
            tx = (dx / dist) * push;
            ty = (dy / dist) * push;
          }
        }
        d.ox += (tx - d.ox) * 0.1 * dt;
        d.oy += (ty - d.oy) * 0.1 * dt;
      }

      draw();
      frame = requestAnimationFrame(step);
    };

    const start = () => {
      if (frame !== null || reduced) return;
      last = performance.now();
      frame = requestAnimationFrame(step);
    };

    const stop = () => {
      if (frame === null) return;
      cancelAnimationFrame(frame);
      frame = null;
    };

    const sync = () => {
      if (onScreen && !document.hidden) start();
      else stop();
    };

    readColors();
    resize();
    draw();
    sync();

    // Resizes are coalesced onto a frame: dragging a window edge fires these
    // continuously, and each one reallocates the backing store.
    const scheduleResize = () => {
      if (resizeFrame !== null) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        resize();
        if (frame === null) draw();
      });
    };

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleResize);
    if (resizeObserver) resizeObserver.observe(canvas);
    else window.addEventListener('resize', scheduleResize);

    const visibility =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              onScreen = entries.some((entry) => entry.isIntersecting);
              sync();
            },
            { threshold: 0 },
          );
    visibility?.observe(canvas);

    const themeObserver = new MutationObserver(() => {
      readColors();
      if (frame === null) draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // The canvas itself cannot be hit — it is pointer-events: none so the
    // hero's buttons stay clickable — so the move is tracked on its parent.
    const host = canvas.parentElement;
    const tracking = Boolean(host) && finePointer && !reduced;
    const onMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };
    if (tracking) {
      host.addEventListener('pointermove', onMove, { passive: true });
      host.addEventListener('pointerleave', onLeave, { passive: true });
    }

    document.addEventListener('visibilitychange', sync);

    return () => {
      stop();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', scheduleResize);
      visibility?.disconnect();
      themeObserver.disconnect();
      document.removeEventListener('visibilitychange', sync);
      if (tracking) {
        host.removeEventListener('pointermove', onMove);
        host.removeEventListener('pointerleave', onLeave);
      }
      // Drop the backing store rather than waiting on the GC to notice a
      // detached canvas still holding several megabytes.
      canvas.width = 0;
      canvas.height = 0;
      dots.length = 0;
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-field" aria-hidden="true" />;
};

export default HeroField;
