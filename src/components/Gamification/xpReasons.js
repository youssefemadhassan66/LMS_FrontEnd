// Why XP was awarded, in words. One entry per reason the server uses
// (the `reason` enum on Gamification.xpHistory).
export const XP_REASONS = {
  task_submit: { label: 'Handed in a task', icon: 'fa-solid fa-paper-plane', tone: 'var(--data-tasks)' },
  task_submit_late: { label: 'Handed in a task late', icon: 'fa-solid fa-paper-plane', tone: 'var(--data-tasks)' },
  review_perfect: { label: 'Perfect review from a teacher', icon: 'fa-solid fa-star', tone: 'var(--data-review)' },
  review_excellent: { label: 'Excellent review from a teacher', icon: 'fa-solid fa-star', tone: 'var(--data-review)' },
  session_attended: { label: 'Came to class', icon: 'fa-solid fa-calendar-check', tone: 'var(--data-attendance)' },
  streak_bonus: { label: 'Streak bonus', icon: 'fa-solid fa-fire', tone: 'var(--data-review)' },
  challenge_solved: { label: 'Solved a coding challenge', icon: 'fa-solid fa-code', tone: 'var(--data-score)' },
  puzzle_solved: { label: 'Solved a puzzle', icon: 'fa-solid fa-puzzle-piece', tone: 'var(--data-score)' },
  exam_passed: { label: 'Passed an exam', icon: 'fa-solid fa-graduation-cap', tone: 'var(--data-exams)' },
  badge_bonus: { label: 'Badge bonus', icon: 'fa-solid fa-medal', tone: 'var(--data-score)' },
  lesson_completed: { label: 'Finished a lesson', icon: 'fa-solid fa-book-open', tone: 'var(--data-tasks)' },
};

export const xpReason = (reason = '') => {
  if (XP_REASONS[reason]) return XP_REASONS[reason];
  const words = reason.replace(/_/g, ' ').trim();
  return {
    label: words ? words[0].toUpperCase() + words.slice(1) : 'XP earned',
    icon: 'fa-solid fa-bolt',
    tone: 'var(--brand-primary)',
  };
};
