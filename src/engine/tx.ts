import type {
  Column,
  Commit,
  FileChange,
  StudioState,
  Ticket,
  TimelineKind,
} from '../types';
import { COLUMNS } from '../types';

/**
 * A small immutable-update helper. Each method replaces `s` with a new object so
 * that timeline snapshots can hold references to earlier versions cheaply.
 */
export class Tx {
  private pendingEvents: { kind: TimelineKind; label: string; actor: string; commitId?: string }[] = [];

  constructor(public s: StudioState) {}

  ticket(id: string): Ticket | undefined {
    return this.s.tickets.find((t) => t.id === id);
  }

  patchTicket(id: string, patch: Partial<Ticket>) {
    this.s = { ...this.s, tickets: this.s.tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
  }

  addTicket(t: Ticket) {
    this.s = { ...this.s, tickets: [...this.s.tickets, t], nextTicket: this.s.nextTicket + 1 };
  }

  newTicketId(): string {
    return `T-${this.s.nextTicket}`;
  }

  move(id: string, column: Column, actor: string, why = '') {
    const t = this.ticket(id);
    if (!t || t.column === column) return;
    this.patchTicket(id, { column });
    const label = COLUMNS.find((c) => c.id === column)!.label;
    this.event('move', `${id} → ${label}${why ? ` (${why})` : ''}`, actor);
  }

  message(from: string, text: string, mentions: string[] = [], ticketId?: string) {
    const found = new Set(mentions);
    for (const m of text.matchAll(/@([a-z0-9-]+)/gi)) found.add(m[1].toLowerCase());
    const valid = [...found].filter((m) => this.s.agents.some((a) => a.id === m));
    const msg = { id: this.s.nextMessage, tick: this.s.run.tick, from, text, mentions: valid, ticketId };
    this.s = { ...this.s, messages: [...this.s.messages, msg], nextMessage: this.s.nextMessage + 1 };
  }

  writeFiles(author: string, ticketId: string | undefined, note: string, edits: { path: string; content: string | null }[]) {
    const changes: FileChange[] = [];
    const files = { ...this.s.files };
    for (const e of edits) {
      const before = files[e.path] ?? null;
      if (before === e.content) continue;
      if (e.content === null) delete files[e.path];
      else files[e.path] = e.content;
      changes.push({ path: e.path, before, after: e.content });
    }
    const commit: Commit = {
      id: `c${this.s.commits.length + 1}`,
      tick: this.s.run.tick,
      author,
      ticketId,
      note,
      changes,
    };
    this.s = {
      ...this.s,
      files,
      filesVersion: this.s.filesVersion + (changes.length ? 1 : 0),
      commits: [...this.s.commits, commit],
    };
    if (ticketId) {
      const t = this.ticket(ticketId);
      if (t) this.patchTicket(ticketId, { commits: [...t.commits, commit.id] });
    }
    this.event('commit', `${commit.id}: ${note}`, author, commit.id);
    return commit;
  }

  lock(path: string, agentId: string, ticketId: string) {
    this.s = { ...this.s, locks: { ...this.s.locks, [path]: { agentId, ticketId } } };
  }

  releaseLocks(ticketId: string) {
    const locks = Object.fromEntries(Object.entries(this.s.locks).filter(([, l]) => l.ticketId !== ticketId));
    this.s = { ...this.s, locks };
  }

  event(kind: TimelineKind, label: string, actor: string, commitId?: string) {
    this.pendingEvents.push({ kind, label, actor, commitId });
  }

  /** Finalize: attach snapshots of the final state to the events recorded in this transaction. */
  done(): StudioState {
    if (!this.pendingEvents.length) return this.s;
    const snapshot = { files: this.s.files, tickets: this.s.tickets, locks: this.s.locks };
    let id = this.s.nextEvent;
    const events = this.pendingEvents.map((e) => ({ ...e, id: id++, tick: this.s.run.tick, snapshot }));
    this.pendingEvents = [];
    this.s = { ...this.s, timeline: [...this.s.timeline, ...events], nextEvent: id };
    return this.s;
  }
}
