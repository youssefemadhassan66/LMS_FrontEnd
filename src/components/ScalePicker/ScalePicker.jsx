import React, { useId } from 'react';
import './ScalePicker.css';

// Low, middling and high scores get their own colour, so a row of ratings
// reads at a glance.
const toneFor = (value, min, max) => {
  if (value <= min) return 'none';
  const ratio = (value - min) / (max - min);
  if (ratio < 0.4) return 'low';
  if (ratio < 0.7) return 'mid';
  return 'high';
};

/**
 * A score from `min` to `max`, picked by tapping a step instead of dragging a
 * slider. Steps up to the chosen one fill in, like a bar.
 *
 * It is a native radio group underneath, so arrow keys move the score and
 * screen readers announce "3 of 6" without extra wiring. `captions` maps a
 * score to a word ("Good") shown next to the number.
 */
const ScalePicker = ({ label, value, onChange, min = 0, max = 5, captions = {} }) => {
  const name = useId();
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const caption = captions[value];

  return (
    <fieldset
      className="scale-picker"
      data-tone={toneFor(value, min, max)}
      style={{ '--scale-steps': steps.length }}
    >
      <legend className="scale-picker__legend">
        <span className="scale-picker__label">{label}</span>
        <span className="scale-picker__readout" aria-hidden="true">
          {/* Keyed so the number pops each time it changes. */}
          <strong key={value}>{value}</strong>
          <span>/{max}</span>
          {caption && <em>{caption}</em>}
        </span>
      </legend>
      <div className="scale-picker__steps">
        {steps.map((step) => (
          <label
            key={step}
            className={[
              'scale-picker__step',
              step > min && step <= value ? 'is-filled' : '',
              step === value ? 'is-current' : '',
            ].join(' ').trim()}
            style={{ '--step-index': step - min }}
          >
            <input
              type="radio"
              name={name}
              value={step}
              checked={step === value}
              onChange={() => onChange(step)}
              aria-label={captions[step] ? `${step} – ${captions[step]}` : String(step)}
            />
            <span aria-hidden="true">{step}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export default ScalePicker;
