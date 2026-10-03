/**
 * Configs map 1-to-1 to the five Progress-Trends endpoints
 * (/progress/<me|child/:id>/{reviews,tasks,submissions,exams,attendance}).
 *
 * Each entry tells <TrendsChart> what to plot, with which colors and labels.
 */

// Theme tokens, so a measure has the same colour here as on its card, in
// both themes. Recharts passes them straight to SVG, where var() resolves.
const C = {
  review:     'var(--data-review)',
  tasks:      'var(--data-tasks)',
  attendance: 'var(--data-attendance)',
  exams:      'var(--data-exams)',
  score:      'var(--data-score)',
  ontime:     'var(--data-ontime)',
};

export const TREND_CONFIGS = {
  reviews: {
    title: 'Review Ratings Over Time',
    short: 'reviews',
    icon: 'fa-solid fa-star',
    suffix: 'reviews',
    yDomain: [0, 5],
    metrics: [
      { key: 'avgOverall',       label: 'Overall',       color: C.review },
      { key: 'avgBehavior',      label: 'Behavior',      color: C.tasks },
      { key: 'avgUnderstanding', label: 'Understanding', color: C.exams },
      { key: 'avgParticipation', label: 'Participation', color: C.score },
      { key: 'avgCoding',        label: 'Coding',        color: C.ontime },
    ],
  },
  tasks: {
    title: 'Task Completion Trend',
    short: 'tasks',
    icon: 'fa-solid fa-list-check',
    suffix: 'tasks',
    yDomain: [0, 100],
    metrics: [
      { key: 'completionRate', label: 'Completion %', color: C.tasks },
    ],
  },
  submissions: {
    title: 'Submission Score & On-Time Rate',
    short: 'homework',
    icon: 'fa-solid fa-paper-plane',
    suffix: 'submissions',
    yDomain: [0, 100],
    metrics: [
      { key: 'onTimeRate', label: 'On-Time %',      color: C.ontime },
      // The API scores out of 10; ×10 puts it on the same 0-100 axis.
      { key: 'avgScore',   label: 'Avg score (×10)', color: C.score, scale: 10 },
    ],
  },
  exams: {
    title: 'Exam Performance',
    short: 'exams',
    icon: 'fa-solid fa-pen-to-square',
    suffix: 'exams',
    yDomain: [0, 100],
    metrics: [
      { key: 'avgPercentage', label: 'Avg %',     color: C.exams },
      { key: 'passRate',      label: 'Pass Rate', color: C.tasks },
    ],
  },
  attendance: {
    title: 'Attendance Rate',
    short: 'attendance',
    icon: 'fa-solid fa-calendar-check',
    suffix: 'attendance',
    yDomain: [0, 100],
    metrics: [
      { key: 'attendanceRate', label: 'Attendance %', color: C.attendance },
    ],
  },
};

export const buildTrendEndpoint = (scope, suffix, period = 'monthly') => {
  // scope is either 'me' or 'child/:profileId'
  return `/api/v1/progress/${scope}/${suffix}?period=${period}`;
};
