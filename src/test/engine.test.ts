import { describe, expect, it } from 'vitest';
import { applyAction } from '../engine/apply';
import type { AgentResponse } from '../agents/actions';
import { parseAgentResponse } from '../agents/actions';
import { initialStudio } from '../store/studio';
import type { StudioState } from '../types';

const act = (action: AgentResponse['action']): AgentResponse => ({ reasoning: '', action, message: null });

function ok(s: StudioState, agent: string, action: AgentResponse['action']) {
  const r = applyAction(s, agent, act(action));
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function withSpec() {
  let s = initialStudio('A thing', 2);
  s = ok(s, 'producer', {
    type: 'write_spec',
    spec: { title: 'Thing', summary: 'A thing', kind: 'app', stack: 'vanilla', features: [], outOfScope: [] },
    tickets: [
      { title: 'Scaffold', description: '', acceptance: ['runs'], priority: 1, files: ['index.html', 'src/a.js'], dependsOn: [] },
      { title: 'Feature A', description: '', acceptance: ['works'], priority: 1, files: ['src/a.js'], dependsOn: [], assignee: 'eng-2' },
      { title: 'Feature B', description: '', acceptance: ['works'], priority: 2, files: ['src/b.js'], dependsOn: ['#1'] },
    ],
  });
  return s;
}

describe('board rules', () => {
  it('assigns tickets, resolves #n dependencies and writes SPEC.md', () => {
    const s = withSpec();
    expect(s.tickets.map((t) => t.assignee)).toEqual(['eng-1', 'eng-2', 'eng-1']);
    expect(s.tickets[2].dependsOn).toEqual(['T-1']);
    expect(s.files['SPEC.md']).toContain('Feature B');
  });

  it('enforces role permissions', () => {
    const r = applyAction(withSpec(), 'eng-1', act({ type: 'ship', note: '' }));
    expect(r.ok).toBe(false);
  });

  it('only one engineer can hold a file lock', () => {
    let s = ok(withSpec(), 'eng-1', { type: 'claim_ticket', ticketId: 'T-1' });
    expect(s.locks['src/a.js']).toEqual({ agentId: 'eng-1', ticketId: 'T-1' });
    const r = applyAction(s, 'eng-2', act({ type: 'claim_ticket', ticketId: 'T-2' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/locked/);
    s = ok(s, 'eng-1', { type: 'write_code', ticketId: 'T-1', edits: [{ path: 'src/a.js', content: 'x' }], commitNote: 'a', readyForReview: true });
    expect(s.locks).toEqual({});
    expect(s.tickets[0].column).toBe('review');
    expect(ok(s, 'eng-2', { type: 'claim_ticket', ticketId: 'T-2' }).tickets[1].column).toBe('in_progress');
  });

  it('blocks claims on unfinished dependencies and writes to files locked by others', () => {
    let s = withSpec();
    expect(applyAction(s, 'eng-1', act({ type: 'claim_ticket', ticketId: 'T-3' })).ok).toBe(false);
    s = ok(s, 'eng-1', { type: 'claim_ticket', ticketId: 'T-1' });
    const s2 = { ...s, tickets: s.tickets.map((t) => (t.id === 'T-2' ? { ...t, column: 'in_progress' as const } : t)) };
    expect(applyAction(s2, 'eng-2', act({ type: 'write_code', ticketId: 'T-2', edits: [{ path: 'src/a.js', content: 'y' }], commitNote: 'b', readyForReview: false })).ok).toBe(false);
  });

  it('QA cannot pass while the preview has console errors, and two fails flag the Producer', () => {
    let s = ok(withSpec(), 'eng-1', { type: 'claim_ticket', ticketId: 'T-1' });
    s = ok(s, 'eng-1', { type: 'write_code', ticketId: 'T-1', edits: [{ path: 'src/a.js', content: 'x' }], commitNote: 'a', readyForReview: true });
    s = ok(s, 'reviewer', { type: 'review', ticketId: 'T-1', verdict: 'approve', comments: '' });
    s = { ...s, preview: { filesVersion: s.filesVersion, tick: 1, ok: false, errors: ['ReferenceError: x'], warnings: [], logs: [] } };
    const pass = applyAction(s, 'qa', act({ type: 'qa_result', ticketId: 'T-1', verdict: 'pass', notes: '' }));
    expect(pass.ok).toBe(false);
    const bug = { title: 'x', steps: ['open'], expected: 'ok', actual: 'ReferenceError: x' };
    s = ok(s, 'qa', { type: 'qa_result', ticketId: 'T-1', verdict: 'fail', notes: '', bug });
    expect(s.tickets[0]).toMatchObject({ column: 'backlog', qaFails: 1, needsProducer: false });
    s = ok(s, 'eng-1', { type: 'claim_ticket', ticketId: 'T-1' });
    s = ok(s, 'eng-1', { type: 'write_code', ticketId: 'T-1', edits: [{ path: 'src/a.js', content: 'z' }], commitNote: 'fix', readyForReview: true });
    s = ok(s, 'reviewer', { type: 'review', ticketId: 'T-1', verdict: 'approve', comments: '' });
    s = ok(s, 'qa', { type: 'qa_result', ticketId: 'T-1', verdict: 'fail', notes: '', bug });
    expect(s.tickets[0]).toMatchObject({ qaFails: 2, needsProducer: true });
    expect(applyAction(s, 'eng-1', act({ type: 'claim_ticket', ticketId: 'T-1' })).ok).toBe(false);
    s = ok(s, 'producer', { type: 'update_ticket', ticketId: 'T-1', assignee: 'eng-2' });
    expect(s.tickets[0]).toMatchObject({ assignee: 'eng-2', needsProducer: false, qaFails: 0 });
  });

  it('cannot ship until everything is done and the preview is fresh and clean', () => {
    const s = withSpec();
    expect(applyAction(s, 'producer', act({ type: 'ship', note: '' })).ok).toBe(false);
    const done = { ...s, tickets: s.tickets.map((t) => ({ ...t, column: 'done' as const })) };
    expect(applyAction(done, 'producer', act({ type: 'ship', note: '' })).ok).toBe(false);
    const fresh = { ...done, preview: { filesVersion: done.filesVersion, tick: 1, ok: true, errors: [], warnings: [], logs: [] } };
    const r = applyAction(fresh, 'producer', act({ type: 'ship', note: 'v1' }));
    expect(r.ok && r.state.run.status).toBe('shipped');
  });

  it('records timeline snapshots for replay', () => {
    const s = ok(withSpec(), 'eng-1', { type: 'claim_ticket', ticketId: 'T-1' });
    const move = s.timeline.at(-1)!;
    expect(move.kind).toBe('move');
    expect(move.snapshot.tickets.find((t) => t.id === 'T-1')!.column).toBe('in_progress');
    expect(s.timeline[0].snapshot.tickets.find((t) => t.id === 'T-1')!.column).toBe('backlog');
  });
});

describe('response parsing', () => {
  it('extracts JSON from fenced or chatty output', () => {
    const r = parseAgentResponse('Sure!\n```json\n{"reasoning":"r","action":{"type":"noop"},"message":null}\n```');
    expect(r.ok).toBe(true);
  });
  it('reports schema errors with paths', () => {
    const r = parseAgentResponse('{"action":{"type":"write_design","design":{"summary":"s"}}}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/design\.screens/);
  });
});
