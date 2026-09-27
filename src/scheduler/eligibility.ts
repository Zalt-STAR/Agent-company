import type { Agent, AgentStatus, StudioState } from '../types';
import { depsDone, lockConflicts } from '../engine/apply';
import { unreadMentions } from '../agents/context';

export interface Intent {
  act: boolean;
  status: AgentStatus;
  activity: string;
}

/**
 * Cheap deterministic pre-filter: does this agent have something to do this tick?
 * Keeps LLM calls to agents that can actually move the board.
 */
export function intentFor(s: StudioState, a: Agent): Intent {
  const mentioned = unreadMentions(s, a).length > 0;
  const pendingQ = s.questions.find((q) => !q.answer);
  if (s.run.status === 'shipped') return { act: false, status: 'idle', activity: 'Shipped 🎉' };

  switch (a.role) {
    case 'producer': {
      if (pendingQ) return { act: false, status: 'waiting', activity: 'Waiting for your answer' };
      if (!s.spec) return { act: true, status: 'planning', activity: 'Scoping the brief' };
      if (s.questions.some((q) => q.answer && !q.consumed)) return { act: true, status: 'planning', activity: 'Reading your answer' };
      const rescope = s.tickets.find((t) => t.needsProducer);
      if (rescope) return { act: true, status: 'planning', activity: `Rescoping ${rescope.id}` };
      if (s.tickets.length && s.tickets.every((t) => t.column === 'done')) {
        return { act: true, status: 'planning', activity: 'Preparing to ship' };
      }
      if (mentioned) return { act: true, status: 'planning', activity: 'Answering the team' };
      return { act: false, status: 'idle', activity: 'Watching the board' };
    }
    case 'designer': {
      if (s.spec && !s.design) return { act: true, status: 'designing', activity: 'Designing UX & tokens' };
      if (mentioned) return { act: true, status: 'designing', activity: 'Answering the team' };
      return { act: false, status: 'idle', activity: s.design ? 'Design delivered' : 'Waiting for the spec' };
    }
    case 'engineer': {
      if (!s.design) return { act: false, status: 'idle', activity: 'Waiting for the design' };
      const mine = s.tickets.find((t) => t.column === 'in_progress' && t.assignee === a.id);
      if (mine) return { act: true, status: 'coding', activity: `Coding ${mine.id}: ${mine.title}` };
      const candidates = s.tickets
        .filter((t) => t.column === 'backlog' && !t.needsProducer && (!t.assignee || t.assignee === a.id) && depsDone(s, t))
        .sort((x, y) => Number(!!y.assignee) - Number(!!x.assignee) || x.priority - y.priority);
      const free = candidates.find((t) => !lockConflicts(s, t, a.id).length);
      if (free) return { act: true, status: 'coding', activity: `Picking up ${free.id}` };
      if (candidates.length) {
        const f = lockConflicts(s, candidates[0], a.id)[0];
        return { act: false, status: 'waiting', activity: `Waiting on lock ${f} (${s.locks[f].agentId})` };
      }
      if (mentioned) return { act: true, status: 'thinking', activity: 'Answering the team' };
      const blocked = s.tickets.find((t) => t.column === 'backlog' && t.assignee === a.id);
      if (blocked) return { act: false, status: 'waiting', activity: `${blocked.id} blocked on ${blocked.needsProducer ? 'Producer' : blocked.dependsOn.join(', ')}` };
      return { act: false, status: 'idle', activity: 'No tickets available' };
    }
    case 'reviewer': {
      const q = s.tickets.filter((t) => t.column === 'review');
      if (q.length) return { act: true, status: 'reviewing', activity: `Reviewing ${q[0].id}` };
      if (mentioned) return { act: true, status: 'reviewing', activity: 'Answering the team' };
      return { act: false, status: 'idle', activity: 'Review queue empty' };
    }
    case 'qa': {
      const q = s.tickets.filter((t) => t.column === 'qa');
      if (q.length) return { act: true, status: 'testing', activity: `Testing ${q[0].id}` };
      if (mentioned) return { act: true, status: 'testing', activity: 'Answering the team' };
      return { act: false, status: 'idle', activity: 'QA queue empty' };
    }
  }
}
