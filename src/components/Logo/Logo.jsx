import React from 'react';

/**
 * AlgoGambit Logo
 *
 * Props:
 *   size     — 'sm' | 'md' | 'lg'  (default 'md')
 *   variant  — 'full' | 'mark'     (default 'full')
 *              'full'  = icon + wordmark
 *              'mark'  = icon only (for collapsed sidebar)
 *   onClick  — optional click handler
 *   style    — extra inline styles on the wrapper
 */
const SIZES = {
  sm: { mark: 28, font: '1.1rem', gap: '0.45rem' },
  md: { mark: 36, font: '1.35rem', gap: '0.55rem' },
  lg: { mark: 48, font: '1.8rem',  gap: '0.7rem' },
};

const Logo = ({ size = 'md', variant = 'full', onClick, style = {} }) => {
  const s = SIZES[size] || SIZES.md;

  // A disc, not a rounded square. Every chrome the mark sits in — the auth top
  // bar chip, the landing nav pill, the sidebar rail — is a full-radius pill,
  // and a 10px-cornered tile inside a 999px capsule reads as two shapes that
  // missed each other. A circle shares the pill's curvature at every point.
  // The artwork stays on a light disc in both themes: it is a solid navy glyph
  // with no light variant, so it needs the contrast.
  const mark = (
    <div
      className="ag-logo-mark"
      style={{
        width: s.mark,
        height: s.mark,
        flexShrink: 0,
        borderRadius: '50%',
        background: '#ffffff',
        border: '1.5px solid var(--border-color)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <img
        src="/logo.png"
        alt="AlgoGambit Logo"
        style={{
          // logo.png is a square canvas with a wide transparent margin baked
          // in, so `contain` at 100% renders the glyph far smaller than the
          // disc it sits in. Oversizing the box cancels that margin out.
          // The glyph is landscape (~0.68 x 0.50 of the canvas), so its
          // corners leave the circle past ~119% — this keeps clearance.
          width: '106%',
          height: '106%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  );

  const wordmark = (
    <span
      // Classed so chrome that runs out of horizontal room can drop the word
      // and keep the mark. The landing navbar does this on phones, where the
      // wordmark was crowding the nav out past the right edge.
      className="ag-logo-word"
      style={{
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 800,
        fontSize: s.font,
        color: 'var(--text-primary)',
        letterSpacing: '-0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      Algo<span style={{ color: '#6366f1' }}>Gambit</span>
    </span>
  );

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        cursor: onClick ? 'pointer' : 'default',
        textDecoration: 'none',
        userSelect: 'none',
        ...style,
      }}
    >
      {mark}
      {variant === 'full' && wordmark}
    </div>
  );
};

export default Logo;
