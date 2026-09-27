import type { Action, AgentResponse, TicketDraft } from '../agents/actions';
import { summarizeAction } from '../agents/actions';
import { ROLE_DEFS } from '../agents/roles';
import type { Design, Spec, StudioState, Ticket } from '../types';
import { Tx } from './tx';

export type ApplyResult = { ok: true; state: StudioState; summary: string } | { ok: false; error: string };

const fail = (error: string): ApplyResult => ({ ok: false, error });

export function engineers(s: StudioState) {
  return s.agents.filter((a) => a.role === 'engineer');
}

export function isPreviewFresh(s: StudioState) {
  return !!s.preview && s.preview.filesVersion === s.filesVersion;
}

function cleanPath(p: string): string | null {
  const path = p.trim().replace(/^\.?\/+/, '');
  if (!path || path.includes('..') || path.startsWith('/')) return null;
  return path;
}

export function depsDone(s: StudioState, t: Ticket) {
  return t.dependsOn.every((d) => s.tickets.find((x) => x.id === d)?.column === 'done');
}

export function lockConflicts(s: StudioState, t: Ticket, agentId: string): string[] {
  return t.files.filter((f) => s.locks[f] && s.locks[f].agentId !== agentId);
}

function makeTicket(tx: Tx, draft: TicketDraft, createdBy: string, kind: Ticket['kind'] = 'feature'): Ticket {
  return {
    id: tx.newTicketId(),
    title: draft.title,
    description: draft.description,
    acceptance: draft.acceptance,
    column: 'backlog',
    priority: draft.priority,
    kind,
    assignee: draft.assignee,
    files: draft.files.map(cleanPath).filter((p): p is string => !!p),
    dependsOn: [],
    qaFails: 0,
    reviewRejections: 0,
    bugs: [],
    reviews: [],
    commits: [],
    needsProducer: false,
    createdBy,
    createdTick: tx.s.run.tick,
    templateKey: draft.templateKey,
  };
}

function resolveDeps(tx: Tx, deps: string[], indexToId: string[]): string[] {
  return deps
    .map((d) => {
      const m = /^#(\d+)$/.exec(d.trim());
      if (m) return indexToId[Number(m[1]) - 1];
      return tx.s.tickets.some((t) => t.id === d) ? d : undefined;
    })
    .filter((d): d is string => !!d);
}

export function specMarkdown(spec: Spec, tickets: Ticket[]): string {
  return [
    `# ${spec.title}`,
    '',
    spec.summary,
    '',
    `**Type:** ${spec.kind} · **Stack:** ${spec.stack}`,
    '',
    '## Features',
    ...spec.features.map((f) => `- ${f}`),
    '',
    '## Out of scope',
    ...spec.outOfScope.map((f) => `- ${f}`),
    '',
    '## Tickets',
    ...tickets.map((t) => `- **${t.id}** ${t.title} (P${t.priority})\n${t.acceptance.map((a) => `  - [ ] ${a}`).join('\n')}`),
    '',
  ].join('\n');
}

export function designMarkdown(d: Design): string {
  const lines = [
    '# Design',
    '',
    d.summary,
    '',
    '## Screens',
    ...d.screens.map((x) => `- ${x}`),
    '',
    '## UX flow',
    ...d.flow.map((x, i) => `${i + 1}. ${x}`),
    '',
    '## Tokens',
    '### Palette',
    ...Object.entries(d.palette).map(([k, v]) => `- \`--${k}\`: ${v}`),
    '',
    `### Typography\n${d.typography}`,
    '',
    `### Spacing\n${d.spacing}`,
  ];
  if (d.coreLoop) lines.push('', `## Core loop\n${d.coreLoop}`);
  if (d.controls) lines.push('', `## Controls\n${d.controls}`);
  if (d.artDirection) lines.push('', `## Art direction\n${d.artDirection}`);
  return lines.join('\n') + '\n';
}

/** Validate and apply an agent's action. Pure: returns a new state or an error explaining the rule violated. */
export function applyAction(s0: StudioState, agentId: string, response: AgentResponse): ApplyResult {
  const agent = s0.agents.find((a) => a.id === agentId);
  if (!agent) return fail(`Unknown agent ${agentId}`);
  const action: Action = response.action;
  if (!ROLE_DEFS[agent.role].allowed.includes(action.type)) {
    return fail(`Action "${action.type}" is not allowed for the ${agent.role} role. Allowed: ${ROLE_DEFS[agent.role].allowed.join(', ')}`);
  }
  const tx = new Tx(s0);
  const tick = s0.run.tick;
  const needTicket = (id: string) => tx.ticket(id);

  switch (action.type) {
    case 'noop':
      break;

    case 'write_spec': {
      if (tx.s.spec) return fail('A spec already exists. Use create_ticket or update_ticket instead.');
      const engs = engineers(tx.s);
      const ids: string[] = [];
      const created: Ticket[] = [];
      action.tickets.forEach((draft, i) => {
        const t = makeTicket(tx, draft, agentId);
        if (!t.assignee || !engs.some((e) => e.id === t.assignee)) t.assignee = engs[i % engs.length]?.id;
        tx.addTicket(t);
        ids.push(t.id);
        created.push(t);
      });
      action.tickets.forEach((draft, i) => {
        tx.patchTicket(ids[i], { dependsOn: resolveDeps(tx, draft.dependsOn, ids).filter((d) => d !== ids[i]) });
      });
      tx.s = { ...tx.s, spec: action.spec };
      tx.event('spec', `Spec: ${action.spec.title}`, agentId);
      for (const t of created) tx.event('create', `${t.id} created: ${t.title}`, agentId);
      tx.writeFiles(agentId, undefined, 'Add product spec', [
        { path: 'SPEC.md', content: specMarkdown(action.spec, tx.s.tickets) },
      ]);
      break;
    }

    case 'create_ticket': {
      if (!tx.s.spec) return fail('Write the spec first.');
      const t = makeTicket(tx, action.ticket, agentId);
      t.dependsOn = resolveDeps(tx, action.ticket.dependsOn, []);
      if (t.assignee && !engineers(tx.s).some((e) => e.id === t.assignee)) t.assignee = undefined;
      tx.addTicket(t);
      tx.event('create', `${t.id} created: ${t.title}`, agentId);
      break;
    }

    case 'update_ticket': {
      const t = needTicket(action.ticketId);
      if (!t) return fail(`No ticket ${action.ticketId}`);
      if (t.column === 'done') return fail(`${t.id} is already Done.`);
      if (action.assignee && !engineers(tx.s).some((e) => e.id === action.assignee)) {
        return fail(`Unknown engineer "${action.assignee}". Engineers: ${engineers(tx.s).map((e) => e.id).join(', ')}`);
      }
      const reassigned = action.assignee && action.assignee !== t.assignee;
      tx.patchTicket(t.id, {
        title: action.title ?? t.title,
        description: action.description ?? t.description,
        acceptance: action.acceptance?.length ? action.acceptance : t.acceptance,
        priority: action.priority ?? t.priority,
        files: action.files ? action.files.map(cleanPath).filter((p): p is string => !!p) : t.files,
        assignee: action.assignee ?? t.assignee,
        needsProducer: false,
        qaFails: t.needsProducer ? 0 : t.qaFails,
      });
      if (reassigned && t.column === 'in_progress') {
        tx.releaseLocks(t.id);
        tx.move(t.id, 'backlog', agentId, 'reassigned');
      }
      tx.event('note', `${t.id} rescoped${reassigned ? ` → ${action.assignee}` : ''}`, agentId);
      break;
    }

    case 'ask_user': {
      if (tx.s.questions.some((q) => !q.answer)) return fail('There is already an unanswered question for the user.');
      const q = { id: `q${tx.s.questions.length + 1}`, tick, from: agentId, text: action.question, options: action.options };
      tx.s = { ...tx.s, questions: [...tx.s.questions, q] };
      tx.event('question', `Asked user: ${action.question}`, agentId);
      break;
    }

    case 'ship': {
      if (!tx.s.spec || !tx.s.tickets.length) return fail('Nothing to ship yet.');
      const open = tx.s.tickets.filter((t) => t.column !== 'done');
      if (open.length) return fail(`Cannot ship: ${open.map((t) => t.id).join(', ')} not Done.`);
      if (!isPreviewFresh(tx.s)) return fail('Cannot ship: the preview has not been checked against the latest files.');
      if (!tx.s.preview!.ok) return fail(`Cannot ship: preview has ${tx.s.preview!.errors.length} console error(s).`);
      tx.s = { ...tx.s, run: { ...tx.s.run, status: 'shipped' }, shippedNote: action.note };
      tx.event('ship', `Shipped: ${tx.s.spec!.title}`, agentId);
      break;
    }

    case 'write_design': {
      if (!tx.s.spec) return fail('There is no spec yet to design against.');
      tx.s = { ...tx.s, design: action.design };
      tx.event('design', 'Design doc written', agentId);
      tx.writeFiles(agentId, undefined, 'Add design doc & tokens', [{ path: 'DESIGN.md', content: designMarkdown(action.design) }]);
      break;
    }

    case 'claim_ticket': {
      const t = needTicket(action.ticketId);
      if (!t) return fail(`No ticket ${action.ticketId}`);
      if (t.column !== 'backlog') return fail(`${t.id} is in ${t.column}, not Backlog.`);
      if (t.needsProducer) return fail(`${t.id} is waiting on the Producer to rescope it.`);
      if (t.assignee && t.assignee !== agentId) return fail(`${t.id} is assigned to ${t.assignee}.`);
      if (!depsDone(tx.s, t)) return fail(`${t.id} depends on ${t.dependsOn.join(', ')} which are not Done yet.`);
      const mine = tx.s.tickets.find((x) => x.column === 'in_progress' && x.assignee === agentId);
      if (mine) return fail(`You already hold ${mine.id}. Finish it first.`);
      const conflicts = lockConflicts(tx.s, t, agentId);
      if (conflicts.length) return fail(`Files locked by others: ${conflicts.map((f) => `${f} (${tx.s.locks[f].agentId})`).join(', ')}`);
      tx.patchTicket(t.id, { assignee: agentId });
      for (const f of t.files) tx.lock(f, agentId, t.id);
      tx.move(t.id, 'in_progress', agentId, `claimed by ${agent.name}`);
      break;
    }

    case 'write_code': {
      const t = needTicket(action.ticketId);
      if (!t) return fail(`No ticket ${action.ticketId}`);
      if (t.column !== 'in_progress' || t.assignee !== agentId) return fail(`${t.id} is not In Progress with you. Claim it first.`);
      const edits: { path: string; content: string }[] = [];
      for (const e of action.edits) {
        const path = cleanPath(e.path);
        if (!path) return fail(`Invalid path "${e.path}"`);
        const lock = tx.s.locks[path];
        if (lock && lock.agentId !== agentId) return fail(`${path} is locked by ${lock.agentId} (${lock.ticketId}).`);
        edits.push({ path, content: e.content });
      }
      for (const e of edits) if (!tx.s.locks[e.path]) tx.lock(e.path, agentId, t.id);
      const extra = edits.map((e) => e.path).filter((p) => !t.files.includes(p));
      if (extra.length) tx.patchTicket(t.id, { files: [...t.files, ...extra] });
      tx.writeFiles(agentId, t.id, action.commitNote, edits);
      if (action.readyForReview) {
        tx.releaseLocks(t.id);
        tx.move(t.id, 'review', agentId, 'ready for review');
      }
      break;
    }

    case 'review': {
      const t = needTicket(action.ticketId);
      if (!t) return fail(`No ticket ${action.ticketId}`);
      if (t.column !== 'review') return fail(`${t.id} is not in Review.`);
      const note = { tick, by: agentId, verdict: action.verdict, comments: action.comments };
      if (action.verdict === 'approve') {
        tx.patchTicket(t.id, { reviews: [...t.reviews, note] });
        tx.move(t.id, 'qa', agentId, 'approved');
      } else {
        if (!action.comments.trim()) return fail('request_changes needs specific comments.');
        tx.patchTicket(t.id, { reviews: [...t.reviews, note], reviewRejections: t.reviewRejections + 1 });
        for (const f of t.files) if (!tx.s.locks[f] && t.assignee) tx.lock(f, t.assignee, t.id);
        tx.move(t.id, 'in_progress', agentId, 'changes requested');
      }
      break;
    }

    case 'qa_result': {
      const t = needTicket(action.ticketId);
      if (!t) return fail(`No ticket ${action.ticketId}`);
      if (t.column !== 'qa') return fail(`${t.id} is not in QA.`);
      if (action.verdict === 'pass') {
        if (!isPreviewFresh(tx.s)) return fail('The preview report is stale; wait for a fresh run.');
        if (!tx.s.preview!.ok) {
          return fail(`Cannot pass: the preview has ${tx.s.preview!.errors.length} console error(s): ${tx.s.preview!.errors[0] ?? tx.s.preview!.buildError}`);
        }
        tx.move(t.id, 'done', agentId, 'QA passed');
      } else {
        const bug = action.bug ?? {
          title: `QA failed ${t.id}`,
          steps: ['Open the preview'],
          expected: 'Acceptance criteria are met',
          actual: action.notes || 'Acceptance criteria not met',
        };
        const qaFails = t.qaFails + 1;
        tx.patchTicket(t.id, { bugs: [...t.bugs, { ...bug, tick, by: agentId }], qaFails, needsProducer: qaFails >= 2 });
        tx.move(t.id, 'backlog', agentId, qaFails >= 2 ? 'QA failed twice — needs Producer' : 'QA failed');
      }
      break;
    }

    case 'file_bug': {
      const t = makeTicket(
        tx,
        {
          title: action.title,
          description: `Bug filed by QA.\nExpected: ${action.expected}\nActual: ${action.actual}`,
          acceptance: ['The reproduction steps no longer reproduce the problem', 'The preview runs with no console errors'],
          priority: 1,
          files: action.files,
          dependsOn: [],
        },
        agentId,
        'bug',
      );
      t.bugs = [{ tick, by: agentId, title: action.title, steps: action.steps, expected: action.expected, actual: action.actual }];
      tx.addTicket(t);
      tx.event('create', `${t.id} bug filed: ${t.title}`, agentId);
      break;
    }
  }

  if (response.message?.text) {
    const ticketId = 'ticketId' in action ? action.ticketId : undefined;
    tx.message(agentId, response.message.text, response.message.mentions, ticketId);
  }
  return { ok: true, state: tx.done(), summary: summarizeAction(action) };
}
