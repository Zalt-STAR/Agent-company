import type { Agent, StudioState, Ticket } from '../types';
import { depsDone, isPreviewFresh, lockConflicts } from '../engine/apply';
import { systemPromptFor } from './roles';

const MAX_FILE_CHARS = 6000;
const MAX_CONTEXT_FILES = 8;

/** Deterministic rolling summary of the project, shared with every agent to keep contexts small. */
export function projectSummary(s: StudioState): string {
  if (!s.spec) return `Brief: "${s.brief}". No spec yet.`;
  const count = (c: Ticket['column']) => s.tickets.filter((t) => t.column === c).length;
  const recent = s.timeline
    .slice(-6)
    .map((e) => `t${e.tick} ${e.label}`)
    .join('; ');
  const preview = s.preview
    ? s.preview.ok
      ? 'preview OK'
      : `preview has ${s.preview.errors.length || 1} error(s)`
    : 'preview not run yet';
  return [
    `Project "${s.spec.title}" (${s.spec.kind}, ${s.spec.stack}). ${s.spec.summary}`,
    `Board: ${count('backlog')} backlog, ${count('in_progress')} in progress, ${count('review')} review, ${count('qa')} QA, ${count('done')} done. ${preview}.`,
    s.design ? `Design: ${s.design.summary}` : 'Design: not written yet.',
    `Recent: ${recent || 'nothing yet'}.`,
  ].join('\n');
}

function ticketBrief(t: Ticket) {
  return {
    id: t.id,
    title: t.title,
    column: t.column,
    priority: t.priority,
    kind: t.kind,
    assignee: t.assignee ?? null,
    files: t.files,
    dependsOn: t.dependsOn,
    qaFails: t.qaFails,
    needsProducer: t.needsProducer || undefined,
  };
}

function ticketFull(t: Ticket) {
  return {
    ...ticketBrief(t),
    description: t.description,
    acceptance: t.acceptance,
    reviews: t.reviews.slice(-2),
    bugs: t.bugs.slice(-2),
  };
}

function pickFiles(s: StudioState, paths: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of paths.slice(0, MAX_CONTEXT_FILES)) {
    const c = s.files[p];
    if (c === undefined) continue;
    out[p] = c.length > MAX_FILE_CHARS ? c.slice(0, MAX_FILE_CHARS) + '\n/* …truncated… */' : c;
  }
  return out;
}

export function unreadMentions(s: StudioState, agent: Agent) {
  return s.messages.filter((m) => m.id > agent.lastReadMessageId && m.mentions.includes(agent.id) && m.from !== agent.id);
}

/** The ticket diff: file content before the ticket's first commit vs now. */
export function ticketDiff(s: StudioState, t: Ticket): { path: string; before: string | null; after: string | null }[] {
  const commits = s.commits.filter((c) => t.commits.includes(c.id));
  const first = new Map<string, string | null>();
  for (const c of commits) for (const ch of c.changes) if (!first.has(ch.path)) first.set(ch.path, ch.before);
  return [...first.entries()].map(([path, before]) => ({ path, before, after: s.files[path] ?? null }));
}

export function buildContext(s: StudioState, agent: Agent): { system: string; user: string } {
  const ctx: Record<string, unknown> = {
    tick: s.run.tick,
    brief: s.brief,
    summary: projectSummary(s),
    yourMemory: agent.memory.slice(-6),
    team: s.agents.map((a) => ({ id: a.id, role: a.role, name: a.name })),
    mentions: unreadMentions(s, agent)
      .slice(-5)
      .map((m) => ({ from: m.from, text: m.text, ticketId: m.ticketId })),
  };

  switch (agent.role) {
    case 'producer': {
      ctx.spec = s.spec ?? null;
      ctx.tickets = s.tickets.map(ticketBrief);
      ctx.needsRescope = s.tickets.filter((t) => t.needsProducer).map(ticketFull);
      ctx.questions = s.questions.map((q) => ({ question: q.text, options: q.options, answer: q.answer ?? null }));
      ctx.preview = s.preview ? { fresh: isPreviewFresh(s), ok: s.preview.ok, errors: s.preview.errors.slice(0, 5) } : null;
      ctx.engineers = s.agents.filter((a) => a.role === 'engineer').map((a) => a.id);
      break;
    }
    case 'designer': {
      ctx.spec = s.spec ?? null;
      ctx.tickets = s.tickets.map((t) => ({ id: t.id, title: t.title, acceptance: t.acceptance }));
      ctx.currentDesign = s.design ?? null;
      break;
    }
    case 'engineer': {
      const mine = s.tickets.find((t) => t.column === 'in_progress' && t.assignee === agent.id);
      const claimable = s.tickets.filter(
        (t) =>
          t.column === 'backlog' &&
          !t.needsProducer &&
          (!t.assignee || t.assignee === agent.id) &&
          depsDone(s, t) &&
          !lockConflicts(s, t, agent.id).length,
      );
      ctx.spec = s.spec ? { title: s.spec.title, kind: s.spec.kind, stack: s.spec.stack, features: s.spec.features } : null;
      ctx.design = s.design ?? null;
      ctx.currentTicket = mine ? ticketFull(mine) : null;
      ctx.claimable = claimable.sort((a, b) => a.priority - b.priority).map(ticketFull);
      ctx.fileList = Object.keys(s.files).sort();
      ctx.yourLocks = Object.entries(s.locks)
        .filter(([, l]) => l.agentId === agent.id)
        .map(([p]) => p);
      const focus = mine ?? claimable[0];
      const paths = focus ? [...new Set([...focus.files, 'index.html', 'src/main.js', 'src/main.jsx'])] : [];
      ctx.files = pickFiles(s, paths);
      break;
    }
    case 'reviewer': {
      const queue = s.tickets.filter((t) => t.column === 'review');
      ctx.reviewQueue = queue.map((t) => ({
        ...ticketFull(t),
        commitNotes: s.commits.filter((c) => t.commits.includes(c.id)).map((c) => c.note),
        diff: ticketDiff(s, t).map((d) => ({
          path: d.path,
          before: d.before ? d.before.slice(0, MAX_FILE_CHARS) : null,
          after: d.after ? d.after.slice(0, MAX_FILE_CHARS) : null,
        })),
      }));
      ctx.designTokens = s.design?.palette ?? null;
      break;
    }
    case 'qa': {
      const queue = s.tickets.filter((t) => t.column === 'qa');
      ctx.qaQueue = queue.map(ticketFull);
      ctx.preview = s.preview
        ? {
            fresh: isPreviewFresh(s),
            ok: s.preview.ok,
            buildError: s.preview.buildError ?? null,
            consoleErrors: s.preview.errors.slice(0, 8),
            consoleWarnings: s.preview.warnings.slice(0, 5),
            logs: s.preview.logs.slice(0, 5),
          }
        : null;
      ctx.files = pickFiles(s, [...new Set(queue.flatMap((t) => t.files))]);
      break;
    }
  }

  return {
    system: systemPromptFor(agent.role, agent),
    user: `Context:\n${JSON.stringify(ctx, null, 1)}\n\nReply with a single JSON object: {"reasoning", "action", "message"}.`,
  };
}
