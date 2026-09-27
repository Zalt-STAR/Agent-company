import type { ProjectTemplate } from './types';
import { splitGlob } from './types';

const listRaw = import.meta.glob('./quicklist/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const dodgeRaw = import.meta.glob('./dodge/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Turn a free-form brief into a short product title. */
export function titleFromBrief(brief: string, fallback: string): string {
  const cleaned = brief
    .replace(/^(please\s+)?(build|make|create|design)\s+(me\s+)?(an?\s+|the\s+)?/i, '')
    .replace(/[.!?].*$/, '')
    .trim();
  if (!cleaned) return fallback;
  const words = cleaned.split(/\s+/).slice(0, 5).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function quicklist(brief: string): ProjectTemplate {
  const title = titleFromBrief(brief, 'Quick List');
  const files = splitGlob(listRaw, 'quicklist');
  files.final['src/config.js'] = `export const TITLE = ${JSON.stringify(title)};\nexport const TAGLINE = ${JSON.stringify(`A small list app for: ${brief.trim().slice(0, 120)}`)};\n`;
  return {
    id: 'quicklist',
    match: /$^/,
    ...files,
    spec: {
      title,
      summary: `A focused single-screen list app for "${brief.trim()}": add items, check them off, filter, and clear finished ones.`,
      kind: 'app',
      stack: 'vanilla',
      features: ['Add items', 'Toggle done / delete', 'Filter all / open / done', 'Open count and clear done'],
      outOfScope: ['Accounts, sync and persistence', 'Due dates and reminders'],
      templateId: 'quicklist',
    },
    design: {
      summary: 'Dark, minimal utility with an emerald accent; one column, generous touch targets.',
      screens: ['Main: title, entry form, filters, list, footer'],
      flow: ['Type and press Enter to add', 'Check to complete', 'Filter with pills', 'Clear done from the footer'],
      palette: { bg: '#111827', surface: '#1f2937', text: '#f9fafb', muted: '#9ca3af', line: '#374151', accent: '#10b981' },
      typography: 'System sans. H1 28px; body 16px; footer 13px.',
      spacing: '4 / 8 / 12 / 20 / 32px; 10px radius.',
    },
    tickets: [
      {
        key: 'scaffold',
        title: 'Scaffold page, config & tokens',
        description: 'index.html, stylesheet with tokens, config with the product title, main.js wiring the store and view (stubbed).',
        acceptance: ['Title and tagline render', 'No console errors'],
        priority: 1,
        files: ['index.html', 'src/styles.css', 'src/config.js', 'src/main.js', 'src/items.js', 'src/view.js'],
        stubs: ['src/items.js', 'src/view.js'],
        dependsOn: [],
        commitNote: 'Scaffold page, config and stubs',
      },
      {
        key: 'items',
        title: 'Items store with filters',
        description: 'In-memory items with add/toggle/remove/clear done and filter predicates.',
        acceptance: ['Empty input is ignored', 'Toggle, remove and clear done work', 'Subscribers are notified'],
        priority: 1,
        files: ['src/items.js'],
        dependsOn: ['scaffold'],
        commitNote: 'Add items store with filters',
        flaws: [{ kind: 'debugLog', path: 'src/items.js', anchor: 'items = [...items,', line: "      console.log('added', clean);" }],
      },
      {
        key: 'view',
        title: 'List view, filters & footer',
        description: 'Entry form, filter pills, item rows with checkbox and delete, open count and clear done.',
        acceptance: ['Adding shows the item', 'Filters switch the visible items', 'Footer shows open count', 'No console errors'],
        priority: 1,
        files: ['src/view.js'],
        dependsOn: ['scaffold'],
        commitNote: 'Render list view with filters',
        flaws: [{ kind: 'bug', path: 'src/view.js', find: "root.querySelector('.count').textContent", replace: "footerCount.textContent" }],
      },
    ],
  };
}

export function dodge(brief: string): ProjectTemplate {
  const title = titleFromBrief(brief, 'Dodge');
  const files = splitGlob(dodgeRaw, 'dodge');
  files.final['src/config.js'] = `export const TITLE = ${JSON.stringify(title)};\nexport const SURVIVE_SECONDS = 30;\nexport const COLORS = { bg: '#0f0d2e', player: '#f472b6', hazard: '#818cf8' };\n`;
  return {
    id: 'dodge',
    match: /$^/,
    ...files,
    spec: {
      title,
      summary: `An arcade survival game inspired by "${brief.trim()}": move left and right to dodge falling blocks for 30 seconds.`,
      kind: 'game',
      stack: 'vanilla',
      features: ['Left/right movement', 'Falling blocks that speed up over time', 'Lose on hit, win after 30s', 'Restart from the overlay'],
      outOfScope: ['Power-ups', 'Leaderboards', 'Sound'],
      templateId: 'dodge',
    },
    design: {
      summary: 'Synthwave night palette: pink player paddle, indigo blocks on a deep navy field.',
      screens: ['Title overlay', 'Playfield with survival timer', 'Hit overlay', 'Win overlay'],
      flow: ['Title → Enter/Play', 'Dodge blocks as they speed up', 'Hit → retry; survive 30s → win'],
      palette: { bg: '#1e1b4b', field: '#0f0d2e', text: '#eef2ff', muted: '#a5b4fc', player: '#f472b6', hazard: '#818cf8' },
      typography: 'System sans. Title 20px bold; overlay 28px; HUD tabular numerals.',
      spacing: '8 / 16 / 24px; 12px radius.',
      coreLoop: 'Each frame: move player, spawn and advance blocks (rate and speed scale with time), test AABB hits, check the 30s win.',
      controls: '←/→ or A/D to move; Enter to start or retry.',
      artDirection: 'Flat rounded rectangles; no sprites.',
    },
    tickets: [
      {
        key: 'scaffold',
        title: 'Scaffold canvas, loop & overlays',
        description: 'Canvas, HUD timer, overlay; loop with ready/playing/over/won states; player and hazards stubbed.',
        acceptance: ['Canvas and timer render', 'Enter starts the loop', 'No console errors'],
        priority: 1,
        files: ['index.html', 'src/styles.css', 'src/config.js', 'src/main.js', 'src/player.js', 'src/hazards.js'],
        stubs: ['src/player.js', 'src/hazards.js'],
        dependsOn: [],
        commitNote: 'Scaffold canvas, loop and overlays',
      },
      {
        key: 'player',
        title: 'Player movement',
        description: 'Left/right movement clamped to the field.',
        acceptance: ['Arrow keys and A/D move the player', 'Player never leaves the field'],
        priority: 1,
        files: ['src/player.js'],
        dependsOn: ['scaffold'],
        commitNote: 'Add clamped player movement',
      },
      {
        key: 'hazards',
        title: 'Falling hazards & difficulty ramp',
        description: 'Spawn falling blocks, speed up over time, AABB collision with the player.',
        acceptance: ['Blocks fall and speed up', 'A hit ends the run', 'Surviving 30s wins', 'No console errors'],
        priority: 1,
        files: ['src/hazards.js'],
        dependsOn: ['scaffold'],
        commitNote: 'Add falling hazards with difficulty ramp',
        flaws: [{ kind: 'bug', path: 'src/hazards.js', find: 'ctx.fillStyle = COLORS.hazard;', replace: 'ctx.fillStyle = PALETTE.hazard;' }],
      },
    ],
  };
}
