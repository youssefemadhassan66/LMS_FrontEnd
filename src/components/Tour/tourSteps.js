// The introduction each role sees on its first visit, and again from the
// "Show me around" button in the header. Targets are data-tour attributes;
// a sidebar step falls back to the menu button on a phone, where the sidebar
// is a closed drawer.

const MENU = '[data-tour="menu"]';
const MENU_NOTE = 'Tap the menu button at the top left to find it.';

const nav = (name) => ({
  target: [`[data-tour="${name}"]`, MENU],
  placement: 'right',
  menuNote: MENU_NOTE,
});

const studentSteps = (firstName) => [
  {
    icon: 'fa-solid fa-hand-sparkles',
    title: `Welcome to AlgoGambit${firstName ? `, ${firstName}` : ''}!`,
    body: 'This quick tour shows you where everything is. It takes about a minute, and you can skip it at any time.',
  },
  {
    target: '[data-tour="quick-actions"]',
    icon: 'fa-solid fa-bolt',
    title: 'Start here',
    body: 'These buttons take you straight to what you will do most: your tasks, your schedule, handing in work and asking a teacher.',
  },
  {
    target: '[data-tour="next-session"]',
    optional: true,
    icon: 'fa-solid fa-video',
    title: 'Your next class',
    body: 'Your next class shows here with a countdown. When it starts, a Join button appears.',
  },
  {
    target: '[data-tour="stats"]',
    icon: 'fa-solid fa-chart-simple',
    title: 'Your numbers',
    body: 'Tasks left to do, tasks done, and work waiting for a grade. Tap “More numbers” under them to see the rest.',
  },
  {
    ...nav('nav-tasks'),
    icon: 'fa-solid fa-list-check',
    title: 'My Tasks',
    body: 'Everything your teacher asks you to do, with its due date. Open a task to read it and hand in your work.',
  },
  {
    ...nav('nav-schedule'),
    icon: 'fa-solid fa-calendar-week',
    title: 'Schedule',
    body: 'Your classes for the week, laid out like a calendar.',
  },
  {
    ...nav('nav-progress'),
    icon: 'fa-solid fa-chart-line',
    title: 'My Progress',
    body: 'See how you are improving, your ratings from teachers, and the badges you have earned.',
  },
  {
    ...nav('nav-messages'),
    icon: 'fa-solid fa-comments',
    title: 'Messages',
    body: 'Stuck on something? Send your teacher a message here.',
  },
  {
    target: '[data-tour="xp"]',
    optional: true,
    icon: 'fa-solid fa-trophy',
    title: 'Level up',
    body: 'You earn XP for finishing tasks and challenges. Learn a little every day to keep your streak going!',
  },
  {
    target: '[data-tour="notifications"]',
    icon: 'fa-solid fa-bell',
    title: 'Notifications',
    body: 'New tasks, grades and messages show up here, so you never miss anything.',
  },
  {
    target: '[data-tour="help"]',
    icon: 'fa-solid fa-circle-question',
    title: 'Need this again?',
    body: 'Tap this button any time to replay the tour. Have fun learning!',
    finishLabel: 'Let’s go!',
  },
];

const parentSteps = (firstName) => [
  {
    icon: 'fa-solid fa-hand-sparkles',
    title: `Welcome${firstName ? `, ${firstName}` : ''}!`,
    body: 'Here is a one-minute tour of where to find your children’s classes, homework and progress. You can skip it at any time.',
  },
  {
    target: '[data-tour="children"]',
    icon: 'fa-solid fa-children',
    title: 'Your children',
    body: 'Every child linked to your account appears here. Tap View to see everything about one of them.',
  },
  {
    target: '[data-tour="link-child"]',
    icon: 'fa-solid fa-user-plus',
    title: 'Link a child',
    body: 'Not seeing your child? Send a link request with their email. They accept it from their own dashboard.',
  },
  {
    target: '[data-tour="quick-actions"]',
    icon: 'fa-solid fa-bolt',
    title: 'Shortcuts',
    body: 'Jump straight to progress, the class schedule, homework, or a message to a teacher.',
  },
  {
    target: '[data-tour="stats"]',
    icon: 'fa-solid fa-chart-simple',
    title: 'At a glance',
    body: 'Tasks still to do, how much is finished, and the average rating from teachers.',
  },
  {
    ...nav('nav-progress'),
    icon: 'fa-solid fa-chart-line',
    title: 'Children Progress',
    body: 'Grades, teacher ratings and how each child is improving over time.',
  },
  {
    ...nav('nav-schedule'),
    icon: 'fa-solid fa-calendar-week',
    title: 'Schedule',
    body: 'All your children’s classes in one calendar.',
  },
  {
    ...nav('nav-messages'),
    icon: 'fa-solid fa-comments',
    title: 'Messages',
    body: 'Talk to your children’s teachers directly.',
  },
  {
    target: '[data-tour="notifications"]',
    icon: 'fa-solid fa-bell',
    title: 'Notifications',
    body: 'We let you know about new homework, grades and announcements here.',
  },
  {
    target: '[data-tour="help"]',
    icon: 'fa-solid fa-circle-question',
    title: 'Need this again?',
    body: 'Tap this button any time to replay the tour.',
    finishLabel: 'Got it',
  },
];

const builders = { student: studentSteps, parent: parentSteps };

/** The tour for a role, or null when the role has none. */
export const tourStepsFor = (role, firstName) => builders[role]?.(firstName) || null;

const storageKey = (userId) => `algogambit:tour:v1:${userId}`;

/** Whether this user has finished or skipped the tour on this browser. */
export const hasSeenTour = (userId) => {
  try {
    return window.localStorage.getItem(storageKey(userId)) !== null;
  } catch {
    // Storage blocked (private window): never auto-start rather than nag on
    // every visit. The header button still opens it.
    return true;
  }
};

export const markTourSeen = (userId, outcome) => {
  try {
    window.localStorage.setItem(storageKey(userId), outcome);
  } catch {
    /* storage unavailable; nothing to remember it in */
  }
};
