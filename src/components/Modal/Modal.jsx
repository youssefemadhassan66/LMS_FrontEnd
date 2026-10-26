import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

/**
 * Accessible modal:
 * - role="dialog" + aria-modal + aria-labelledby
 * - ESC closes
 * - Focus moves into the modal on open and is trapped via Tab/Shift+Tab
 * - Body scroll is locked while open
 * - Returns focus to the previously focused element on close
 * - Fades out on close (see playExit)
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const EXIT_MS = 170;

/**
 * Plays the closing animation on a copy of the dialog.
 *
 * Once a modal closes, React has already removed it and its parent has usually
 * cleared the data it showed, so the real dialog cannot stay up to animate.
 * A static copy can: it is inert and hidden from assistive technology, and it
 * removes itself when the animation ends. Browsers without the Web Animations
 * API (and jsdom in tests) simply skip it.
 */
const playExit = (overlay, scrollTop) => {
  if (!overlay || typeof overlay.animate !== 'function') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const ghost = overlay.cloneNode(true);
  // cloneNode copies attributes, not what the user typed or picked.
  const sources = overlay.querySelectorAll('input, textarea, select');
  ghost.querySelectorAll('input, textarea, select').forEach((field, i) => {
    if (field.type === 'checkbox' || field.type === 'radio') field.checked = sources[i].checked;
    else field.value = sources[i].value;
  });
  ghost.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.classList.add('is-closing');
  const panel = ghost.querySelector('.modal-panel');
  panel?.removeAttribute('role');
  document.body.appendChild(ghost);
  if (panel) panel.scrollTop = scrollTop;

  const sheet = window.matchMedia?.('(max-width: 640px)').matches;
  const options = { duration: EXIT_MS, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' };
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], options);
  const out = panel?.animate(
    sheet
      ? [{ transform: 'none' }, { transform: 'translateY(40%)', opacity: 0 }]
      : [{ transform: 'none' }, { transform: 'translateY(10px) scale(0.96)', opacity: 0 }],
    options,
  );
  const remove = () => ghost.remove();
  if (out?.finished) out.finished.then(remove, remove);
  else setTimeout(remove, EXIT_MS);
};

const Modal = ({ isOpen, onClose, title, subtitle, children, size = 'md' }) => {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Keep the latest onClose in a ref so the open/close effect below doesn't
  // depend on its identity. Parents pass an inline `() => setX(false)`, which is
  // a new function every render; if the effect depended on it, every keystroke
  // (which re-renders the parent form) would re-run the effect and its cleanup
  // would steal focus out of the input. See the focus restore in the cleanup.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll(FOCUSABLE);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);

    // Held here rather than read from the refs on close: by then React has
    // detached them. The panel's scroll position is lost with the layout, so
    // it is tracked as the user scrolls.
    const overlay = overlayRef.current;
    const panelNode = panelRef.current;
    let scrollTop = 0;
    const onScroll = () => { scrollTop = panelNode.scrollTop; };
    panelNode?.addEventListener('scroll', onScroll, { passive: true });

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    /* Focus first focusable inside the modal */
    setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector(FOCUSABLE);
      (first || panel).focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKey);
      panelNode?.removeEventListener('scroll', onScroll);
      playExit(overlay, scrollTop);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  const titleId = useId();

  if (!isOpen) return null;

  const sizeClass = `modal-${size}`;

  return createPortal(
    <div ref={overlayRef} className="modal-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className={`modal-panel ${sizeClass}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div className="modal-heading">
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            type="button"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
