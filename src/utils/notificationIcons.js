// Font Awesome icon + colour per notification type. Colours are theme
// tokens that read as text in both themes; the --accent-* fills do not (they
// are pale in light mode and navy in dark).
// Keep the keys in sync with the `type` enum on the backend Notification model.
const ICONS = {
  schedule_reminder: { icon: 'fa-solid fa-clock', color: 'var(--warning)' },
  new_session: { icon: 'fa-solid fa-calendar-day', color: 'var(--brand-primary, #2563eb)' },
  schedule_updated: { icon: 'fa-solid fa-arrows-rotate', color: 'var(--info, #3b82f6)' },
  new_schedule_entry: { icon: 'fa-solid fa-calendar-plus', color: 'var(--info, #3b82f6)' },
  new_task: { icon: 'fa-solid fa-clipboard-list', color: 'var(--data-ontime)' },
  task_graded: { icon: 'fa-solid fa-circle-check', color: 'var(--success, #22c55e)' },
  new_submission: { icon: 'fa-solid fa-inbox', color: 'var(--success, #14b8a6)' },
  challenge_graded: { icon: 'fa-solid fa-flag-checkered', color: 'var(--success, #22c55e)' },
  lesson_completed: { icon: 'fa-solid fa-book-open', color: 'var(--success, #22c55e)' },
  exam_result: { icon: 'fa-solid fa-chart-column', color: 'var(--info, #3b82f6)' },
  session_review: { icon: 'fa-solid fa-star', color: 'var(--warning, #eab308)' },
  canvas_shared: { icon: 'fa-solid fa-pen-ruler', color: 'var(--data-score)' },
  xp_earned: { icon: 'fa-solid fa-bolt', color: 'var(--brand-primary)' },
  level_up: { icon: 'fa-solid fa-crown', color: 'var(--data-review)' },
  badge_unlocked: { icon: 'fa-solid fa-medal', color: 'var(--data-score)' },
  new_message: { icon: 'fa-solid fa-comment-dots', color: 'var(--brand-primary, #6366f1)' },
  announcement: { icon: 'fa-solid fa-bullhorn', color: 'var(--warning)' },
  new_user: { icon: 'fa-solid fa-user-plus', color: 'var(--brand-primary, #2563eb)' },
  system_alert: { icon: 'fa-solid fa-triangle-exclamation', color: 'var(--error, #ef4444)' },
};

const FALLBACK = { icon: 'fa-solid fa-bell', color: 'var(--text-muted)' };

export const notificationIcon = (type) => ICONS[type] || FALLBACK;

export default notificationIcon;
