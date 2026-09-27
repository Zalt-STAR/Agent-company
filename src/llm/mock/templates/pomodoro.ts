import type { ProjectTemplate } from './types';
import { splitGlob } from './types';

const raw = import.meta.glob('./pomodoro/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const pomodoro: ProjectTemplate = {
  id: 'pomodoro',
  match: /pomodoro|focus timer|\btimer\b/i,
  ...splitGlob(raw, 'pomodoro'),
  spec: {
    title: 'Focus — Pomodoro Timer',
    summary: 'A single-screen Pomodoro timer that cycles focus sessions and breaks, with a progress ring and a session counter.',
    kind: 'app',
    stack: 'vanilla',
    features: [
      '25 min focus / 5 min short break / 15 min long break every 4th cycle',
      'Start, pause, reset and skip controls (Space toggles)',
      'Circular progress ring and live countdown in the tab title',
      'Count of completed focus sessions',
    ],
    outOfScope: ['Custom durations', 'Sounds and notifications', 'Persistence across reloads'],
    templateId: 'pomodoro',
  },
  design: {
    summary: 'Calm, dark single card. The accent color encodes the mode: orange focus, green short break, blue long break.',
    screens: ['Timer card: mode tabs, progress dial, controls, stats footer'],
    flow: ['Land on Focus mode, 25:00', 'Press Start (or Space) — the ring drains', 'At 00:00 the next mode starts', 'Every 4th focus session leads to a long break'],
    palette: { bg: '#1c1917', surface: '#292524', text: '#fafaf9', muted: '#a8a29e', work: '#f97316', short: '#22c55e', long: '#38bdf8' },
    typography: 'System rounded sans. Timer 48px/700 tabular numerals; body 15px; captions 13px.',
    spacing: '4 / 8 / 16 / 24 / 40px scale; 16px card radius; 10px button radius.',
  },
  tickets: [
    {
      key: 'scaffold',
      title: 'Scaffold app shell & design tokens',
      description: 'Create index.html, the stylesheet with DESIGN.md tokens, and main.js wiring timer, UI and stats modules (stubbed).',
      acceptance: ['index.html loads src/main.js as a module', 'styles.css defines the palette and spacing tokens', 'Preview renders a card with no console errors'],
      priority: 1,
      files: ['index.html', 'src/styles.css', 'src/main.js', 'src/timer.js', 'src/ui.js', 'src/stats.js'],
      stubs: ['src/timer.js', 'src/ui.js', 'src/stats.js'],
      dependsOn: [],
      commitNote: 'Scaffold shell, tokens and module stubs',
    },
    {
      key: 'timer',
      title: 'Timer engine: focus/break cycles',
      description: 'State machine for work / short / long modes with start, pause, reset, skip and select.',
      acceptance: ['Counts down once per second while running', 'Focus → short break, every 4th focus → long break', 'Pause/reset/skip behave as labeled'],
      priority: 1,
      files: ['src/timer.js'],
      dependsOn: ['scaffold'],
      commitNote: 'Implement timer state machine with mode cycling',
    },
    {
      key: 'ui',
      title: 'Timer display & controls',
      description: 'Render mode tabs, the progress ring, the countdown and control buttons; Space toggles.',
      acceptance: ['Shows MM:SS countdown and a draining ring', 'Start/Pause label reflects state', 'Tabs switch mode', 'No console errors on load'],
      priority: 1,
      files: ['src/ui.js'],
      dependsOn: ['scaffold'],
      commitNote: 'Render dial, tabs and controls',
      flaws: [{ kind: 'bug', path: 'src/ui.js', find: 'timeEl.textContent = formatTime(remaining);', replace: 'timeEl.textContent = fmtTime(remaining);' }],
    },
    {
      key: 'stats',
      title: 'Session stats',
      description: 'Track completed focus sessions and minutes focused; shown in the card footer.',
      acceptance: ['Completing a focus session increments the counter', 'Breaks are not counted'],
      priority: 2,
      files: ['src/stats.js'],
      dependsOn: ['scaffold'],
      commitNote: 'Track completed focus sessions',
      flaws: [{ kind: 'debugLog', path: 'src/stats.js', anchor: 'sessions.push', line: "      console.log('session recorded', sessions);" }],
    },
  ],
};
