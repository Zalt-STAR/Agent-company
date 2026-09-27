import type { ProjectTemplate } from './types';
import { splitGlob } from './types';

const raw = import.meta.glob('./platformer/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const platformer: ProjectTemplate = {
  id: 'platformer',
  match: /platform|jump|mario|side.?scroll/i,
  ...splitGlob(raw, 'platformer'),
  spec: {
    title: 'Hop Hills — Platformer Level',
    summary: 'One hand-built side-scrolling level: run, jump over pits and spikes, collect coins and reach the flag.',
    kind: 'game',
    stack: 'vanilla',
    features: ['Tile-based level with scrolling camera', 'Run + jump physics with tile collisions', 'Coins, spikes and pits', 'Win at the flag, lose on spikes or falling, restart'],
    outOfScope: ['Enemies', 'Multiple levels', 'Sound'],
    templateId: 'platformer',
  },
  design: {
    summary: 'Bright, chunky storybook style: sky gradient, parallax hills, grass-topped dirt tiles, a red hero with a big eye.',
    screens: ['Title overlay', 'Level view with HUD (coins, timer)', 'Lose overlay', 'Win overlay'],
    flow: ['Title → Play/Enter', 'Run right, collect coins, avoid hazards', 'Touch flag → win overlay with time', 'Spikes/pit → lose overlay → Enter retries'],
    palette: { bg: '#0c4a6e', skyTop: '#38bdf8', skyBottom: '#e0f2fe', ground: '#92400e', grass: '#65a30d', coin: '#facc15', player: '#ef4444', flag: '#22c55e' },
    typography: 'Verdana / system sans. Title 20px bold with drop shadow; overlay heading 30px; HUD 16px tabular numerals.',
    spacing: '32px tiles; 8 / 16 / 24px UI spacing; 10px canvas radius.',
    coreLoop: 'Each frame: read input → accelerate → gravity → resolve X then Y tile collisions → pickups/hazards/goal → draw with camera centered on the player.',
    controls: '←/→ or A/D to run, ↑/W/Space to jump, Enter to start or retry.',
    artDirection: 'Flat shapes only: rectangles for tiles and hero, triangles for spikes, circles for bobbing coins, pennant flag.',
  },
  tickets: [
    {
      key: 'scaffold',
      title: 'Scaffold canvas, HUD & game states',
      description: 'index.html with canvas, HUD and overlay; main.js with loop and ready/playing/over/won states. Modules stubbed.',
      acceptance: ['Canvas and HUD render', 'Overlay shows Play; Enter starts', 'No console errors'],
      priority: 1,
      files: ['index.html', 'src/styles.css', 'src/config.js', 'src/main.js', 'src/player.js', 'src/input.js', 'src/level.js', 'src/render.js', 'src/entities.js'],
      stubs: ['src/player.js', 'src/input.js', 'src/level.js', 'src/render.js', 'src/entities.js'],
      dependsOn: [],
      commitNote: 'Scaffold canvas, HUD, overlay and game states',
    },
    {
      key: 'player',
      title: 'Player physics & controls',
      description: 'Run/jump with acceleration, gravity, max fall speed, and axis-separated tile collision.',
      acceptance: ['Player lands and stands on solid tiles', 'Runs left/right and jumps ~3 tiles high', 'Cannot pass through walls or ceilings', 'No console errors'],
      priority: 1,
      files: ['src/player.js', 'src/input.js'],
      dependsOn: ['scaffold'],
      commitNote: 'Add run/jump physics and tile collisions',
      flaws: [
        { kind: 'bug', path: 'src/player.js', find: 'p.vy + GRAVITY * dt', replace: 'p.vy + GRAVITY_ACCEL * dt' },
        { kind: 'bug', path: 'src/player.js', find: 'if (!world.isSolid(tx, ty)) continue;', replace: 'if (!world.solidAt(tx, ty)) continue;' },
      ],
    },
    {
      key: 'level',
      title: 'Level layout & rendering',
      description: 'Tile map with pits, platforms, coins, spikes and a flag; renderer with sky, parallax hills and camera.',
      acceptance: ['Level is wider than the screen and the camera follows the player', 'Tiles, coins, spikes and flag are drawn per DESIGN.md'],
      priority: 1,
      files: ['src/level.js', 'src/render.js'],
      dependsOn: ['scaffold'],
      commitNote: 'Build level map and scrolling renderer',
    },
    {
      key: 'entities',
      title: 'Coins, hazards & win/lose',
      description: 'Coin pickup, spikes and pits end the run, flag wins.',
      acceptance: ['Coins are collected once and counted in the HUD', 'Spikes or falling shows the lose overlay', 'Touching the flag shows the win overlay', 'Enter restarts'],
      priority: 2,
      files: ['src/entities.js'],
      dependsOn: ['scaffold'],
      commitNote: 'Add coins, hazards and goal',
      flaws: [{ kind: 'debugLog', path: 'src/entities.js', anchor: 'world.collected += 1;', line: "      console.log('coin!', world.collected);" }],
    },
  ],
};
