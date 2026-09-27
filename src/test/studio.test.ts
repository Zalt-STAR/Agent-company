import { describe, expect, it } from 'vitest';
import { createAppStore } from '../store/studio';
import { Scheduler } from '../scheduler/scheduler';
import { createMockProvider } from '../llm/mock';
import { FIXED_TEMPLATES } from '../llm/mock/templates';
import { quicklist, dodge } from '../llm/mock/templates/generic';
import { nodePreviewRunner, buildForNode } from './nodeRunner';
import type { Settings } from '../types';

function setup(settings: Partial<Settings> = {}) {
  const store = createAppStore({ speed: 4, maxTurns: 400, ...settings });
  const scheduler = new Scheduler(store, {
    runner: nodePreviewRunner,
    providerFactory: (s) => createMockProvider(s, { latencyMs: 0 }),
    tickDelayMs: 0,
  });
  return { store, scheduler };
}

async function runToEnd(brief: string, settings: Partial<Settings> = {}) {
  const { store, scheduler } = setup(settings);
  scheduler.newProject(brief);
  await scheduler.whenIdle();
  return { store, scheduler, s: store.getState() };
}

describe('mock studio end-to-end', () => {
  for (const [brief, mode, engineers] of [
    ['A Pomodoro timer', 'parallel', 2],
    ['A Snake game', 'parallel', 3],
    ['A habit tracker', 'serial', 1],
    ['A platformer level', 'parallel', 2],
  ] as const) {
    it(`ships "${brief}" (${mode}, ${engineers} eng)`, async () => {
      const { s } = await runToEnd(brief, { mode, engineers });
      expect(s.run.pauseReason).toBeUndefined();
      expect(s.run.status).toBe('shipped');
      expect(s.tickets.every((t) => t.column === 'done')).toBe(true);
      expect(s.preview?.ok).toBe(true);
      expect(s.preview?.filesVersion).toBe(s.filesVersion);
      expect(s.files['SPEC.md']).toContain('#');
      expect(s.files['DESIGN.md']).toContain('Palette');
      expect(Object.keys(s.locks)).toHaveLength(0);
      // The deliberate flaws exercised review and QA loops.
      const reviews = s.tickets.flatMap((t) => t.reviews);
      expect(reviews.some((r) => r.verdict === 'request_changes') || s.tickets.some((t) => t.bugs.length)).toBe(true);
    }, 60_000);
  }

  it('QA catches a real runtime error, and the Producer rescopes after two QA failures', async () => {
    const { s } = await runToEnd('A platformer level', { engineers: 2 });
    const player = s.tickets.find((t) => t.title.startsWith('Player physics'))!;
    expect(player.bugs.length).toBe(2);
    expect(player.bugs[0].actual).toMatch(/GRAVITY_ACCEL/);
    expect(player.column).toBe('done');
    // Reassigned to the other engineer by the Producer.
    expect(s.timeline.some((e) => e.label.startsWith(`${player.id} rescoped`))).toBe(true);
  }, 60_000);

  it('asks the user when the brief is ambiguous, then continues after the answer', async () => {
    const { store, scheduler } = setup();
    scheduler.newProject('Something about penguins');
    await scheduler.whenIdle();
    let s = store.getState();
    expect(s.run.status).toBe('waiting_user');
    const q = s.questions[0];
    expect(q.options).toContain('A simple game');
    scheduler.answer(q.id, 'A simple game');
    await scheduler.whenIdle();
    s = store.getState();
    expect(s.spec?.templateId).toBe('dodge');
    expect(s.run.status).toBe('shipped');
  }, 60_000);

  it('designer validation failure is retried once and recorded', async () => {
    const { s } = await runToEnd('A Snake game');
    const designer = s.agents.find((a) => a.role === 'designer')!;
    expect(designer.turns).toBeGreaterThan(0);
    expect(s.design).toBeDefined();
    const designTurn = s.timeline.find((e) => e.kind === 'design');
    expect(designTurn).toBeDefined();
  }, 60_000);

  it('pauses on the turn budget cap', async () => {
    const { s } = await runToEnd('A Snake game', { maxTurns: 5 });
    expect(s.run.status).toBe('paused');
    expect(s.run.pauseReason).toMatch(/Budget cap/);
    expect(s.run.turnsUsed).toBeGreaterThanOrEqual(5);
  }, 60_000);

  it('step runs exactly one tick', async () => {
    const { store, scheduler } = setup();
    scheduler.newProject('A Snake game', false);
    await scheduler.step();
    const s = store.getState();
    expect(s.run.tick).toBe(1);
    expect(s.spec?.title).toBe('Snake');
    expect(s.run.status).toBe('paused');
  });
});

describe('templates', () => {
  const all = [...FIXED_TEMPLATES, quicklist('a grocery list app'), dodge('a meteor game')];
  for (const t of all) {
    it(`${t.id}: final build runs cleanly`, async () => {
      const files = { ...t.final };
      const { bundle } = await buildForNode(files);
      expect(bundle.error).toBeUndefined();
      const report = await nodePreviewRunner(files, 0, 0);
      expect(report.errors).toEqual([]);
    }, 20_000);

    it(`${t.id}: scaffold with stubs runs cleanly`, async () => {
      const scaffold = t.tickets[0];
      const files: Record<string, string> = {};
      for (const p of scaffold.files) files[p] = scaffold.stubs?.includes(p) ? t.stubs[p] : t.final[p];
      const report = await nodePreviewRunner(files, 0, 0);
      expect(report.errors).toEqual([]);
    }, 20_000);

    for (const tk of t.tickets) {
      for (const [i, flaw] of (tk.flaws ?? []).entries()) {
        if (flaw.kind !== 'bug') continue;
        it(`${t.id}/${tk.key}: flaw #${i} surfaces as a console error`, async () => {
          const files = { ...t.final, [flaw.path]: t.final[flaw.path].replace(flaw.find, flaw.replace) };
          expect(files[flaw.path]).not.toBe(t.final[flaw.path]);
          const report = await nodePreviewRunner(files, 0, 0);
          expect(report.errors.length).toBeGreaterThan(0);
        }, 20_000);
      }
    }
  }
});
