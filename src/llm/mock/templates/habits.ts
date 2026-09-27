import type { ProjectTemplate } from './types';
import { splitGlob } from './types';

const raw = import.meta.glob('./habits/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const habits: ProjectTemplate = {
  id: 'habits',
  match: /habit|streak/i,
  ...splitGlob(raw, 'habits'),
  spec: {
    title: 'Streaks — Habit Tracker',
    summary: 'Track a handful of daily habits over the last 7 days, with per-habit streaks and a daily summary.',
    kind: 'app',
    stack: 'vanilla',
    features: ['Habit list with a 7-day check grid', 'Streak count per habit', 'Add habits with an icon; remove habits', '"N of M done today" summary'],
    outOfScope: ['Accounts and sync', 'Persistence across reloads', 'Reminders'],
    templateId: 'habits',
  },
  design: {
    summary: 'Light, airy productivity look. Violet for completed days, orange for the streak flame.',
    screens: ['Main: header, habit grid card, add form, daily summary'],
    flow: ['See seeded habits', 'Tap a day cell to toggle it', 'Streak updates instantly', 'Add a habit via the form; × removes one'],
    palette: { bg: '#f8fafc', surface: '#ffffff', text: '#0f172a', muted: '#64748b', line: '#e2e8f0', accent: '#7c3aed', flame: '#f97316' },
    typography: 'Inter / system sans. H1 28px/700 −0.5 tracking; body 15px; captions 12px.',
    spacing: '4 / 8 / 12 / 20 / 32px; 14px card radius; 8px cells.',
  },
  tickets: [
    {
      key: 'scaffold',
      title: 'Scaffold layout & tokens',
      description: 'index.html with header, list and form mounts; stylesheet with tokens; main.js wiring store, list and form (stubbed).',
      acceptance: ['Header and empty list card render', 'Tokens from DESIGN.md are defined', 'No console errors'],
      priority: 1,
      files: ['index.html', 'src/styles.css', 'src/main.js', 'src/store.js', 'src/habitList.js', 'src/addHabit.js'],
      stubs: ['src/store.js', 'src/habitList.js', 'src/addHabit.js'],
      dependsOn: [],
      commitNote: 'Scaffold layout, tokens and module stubs',
    },
    {
      key: 'store',
      title: 'Habit store & streak logic',
      description: 'In-memory store with add/remove/toggle, local day keys, and streak calculation.',
      acceptance: ['Toggling a day flips its state', 'Streak counts consecutive days ending today (or yesterday)', 'Subscribers are notified on change'],
      priority: 1,
      files: ['src/store.js'],
      dependsOn: ['scaffold'],
      commitNote: 'Add habit store with streaks',
    },
    {
      key: 'list',
      title: '7-day habit grid',
      description: 'Render each habit with 7 day cells, streak and remove button; click delegation.',
      acceptance: ['Each habit shows the last 7 days', 'Clicking a cell toggles it', 'Streak column updates', 'No console errors'],
      priority: 1,
      files: ['src/habitList.js'],
      dependsOn: ['scaffold'],
      commitNote: 'Render habit grid with toggles and streaks',
      flaws: [{ kind: 'bug', path: 'src/habitList.js', find: '${store.streak(h.id)}', replace: '${store.streakFor(h.id)}' }],
    },
    {
      key: 'form',
      title: 'Add habit form & daily summary',
      description: 'Form to add a habit with an icon; summary line of habits done today.',
      acceptance: ['Submitting a name adds a habit', 'Empty names are ignored', 'Summary shows done/total for today'],
      priority: 2,
      files: ['src/addHabit.js'],
      dependsOn: ['scaffold'],
      commitNote: 'Add habit form and daily summary',
      flaws: [{ kind: 'debugLog', path: 'src/addHabit.js', anchor: 'const data = new FormData(form);', line: "    console.log('adding habit', Object.fromEntries(data));" }],
    },
  ],
};
