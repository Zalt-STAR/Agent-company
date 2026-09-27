import type { Agent, RunState, Settings, StudioState } from '../types';
import type { AppState, AppStore } from '../store/studio';
import { initialStudio } from '../store/studio';
import { buildContext } from '../agents/context';
import { parseAgentResponse } from '../agents/actions';
import type { Action } from '../agents/actions';
import { applyAction, isPreviewFresh } from '../engine/apply';
import { Tx } from '../engine/tx';
import type { LLMMessage, LLMProvider } from '../llm/provider';
import type { PreviewRunner } from '../runtime/preview';
import { intentFor } from './eligibility';

export interface SchedulerDeps {
  runner: PreviewRunner;
  providerFactory: (settings: Settings) => LLMProvider;
  /** Base delay between ticks at speed 1. */
  tickDelayMs?: number;
}

const MAX_ATTEMPTS = 2; // first try + one retry on invalid JSON / rejected action
const MEMORY_SIZE = 8;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A fingerprint of everything that could give an idle agent something new to do. */
function boardKey(s: StudioState) {
  return [
    s.filesVersion,
    s.tickets.map((t) => `${t.id}:${t.column}:${t.assignee}:${t.needsProducer}`).join(','),
    s.nextMessage,
    s.questions.filter((q) => q.answer).length,
    s.preview?.filesVersion ?? -1,
    Object.keys(s.locks).length,
  ].join('|');
}

export class Scheduler {
  private loop: Promise<void> | null = null;
  private rr = 0;
  private noopKeys = new Map<string, string>();
  private previewInflight?: Promise<void>;
  private abort = new AbortController();
  /** Bumped on every new project so in-flight turns from the old one are discarded. */
  private epoch = 0;

  constructor(
    private store: AppStore,
    private deps: SchedulerDeps,
  ) {}

  private get s(): AppState {
    return this.store.getState();
  }

  private setRun(patch: Partial<RunState>) {
    this.store.setState((s) => ({ run: { ...s.run, ...patch } }));
  }

  private patchAgent(id: string, patch: Partial<Agent> | ((a: Agent) => Partial<Agent>)) {
    this.store.setState((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...(typeof patch === 'function' ? patch(a) : patch) } : a)),
    }));
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  newProject(brief: string, autoStart = true) {
    this.abort.abort();
    this.abort = new AbortController();
    this.epoch++;
    const { settings, ui } = this.s;
    const fresh = initialStudio(brief.trim(), settings.engineers);
    const tx = new Tx(fresh);
    tx.message('user', brief.trim(), ['producer']);
    this.store.setState({ ...tx.done(), ui: { ...ui, replayIndex: null, selectedAgentId: 'producer', tab: 'board', selectedCommitId: undefined, selectedFile: undefined } });
    this.noopKeys.clear();
    this.rr = 0;
    if (autoStart) this.start();
  }

  start() {
    const { run, brief } = this.s;
    if (!brief || run.status === 'shipped') return;
    if (this.s.questions.some((q) => !q.answer)) {
      this.setRun({ status: 'waiting_user', pauseReason: 'Waiting for your answer' });
      return;
    }
    this.setRun({ status: 'running', pauseReason: undefined });
    this.loop ??= this.runLoop().finally(() => {
      this.loop = null;
    });
  }

  pause(reason?: string) {
    if (this.s.run.status === 'running') this.setRun({ status: 'paused', pauseReason: reason });
  }

  /** Run exactly one tick, then stay paused. */
  async step() {
    const { run, brief } = this.s;
    if (!brief || run.busy || this.loop || run.status === 'shipped') return;
    this.setRun({ status: 'paused', pauseReason: undefined });
    await this.tick();
  }

  answer(questionId: string, answer: string) {
    const q = this.s.questions.find((x) => x.id === questionId);
    if (!q || q.answer) return;
    const tx = new Tx(this.s);
    tx.s = { ...tx.s, questions: tx.s.questions.map((x) => (x.id === questionId ? { ...x, answer } : x)) };
    tx.message('user', `@${q.from} ${answer}`, [q.from]);
    tx.event('note', `You answered: ${answer}`, 'user');
    this.store.setState(tx.done());
    if (this.s.run.status === 'waiting_user') this.start();
  }

  /** Resolves when the loop stops (paused, shipped, waiting on the user, or budget hit). */
  async whenIdle() {
    while (this.loop) await this.loop;
  }

  // ── Loop ──────────────────────────────────────────────────────────────────

  private async runLoop() {
    while (this.s.run.status === 'running') {
      await this.tick();
      if (this.s.run.status !== 'running') break;
      const delay = (this.deps.tickDelayMs ?? 500) / Math.max(0.25, this.s.settings.speed);
      if (delay > 0) await sleep(delay);
    }
  }

  async tick() {
    if (this.s.run.busy) return;
    this.setRun({ busy: true, tick: this.s.run.tick + 1 });
    try {
      const s = this.s;
      const intents = new Map(s.agents.map((a) => [a.id, intentFor(s, a)]));
      for (const a of s.agents) {
        const i = intents.get(a.id)!;
        if (!i.act) this.patchAgent(a.id, { status: i.status, activity: i.activity });
      }
      const key = boardKey(s);
      const ready = s.agents.filter((a) => intents.get(a.id)!.act && this.noopKeys.get(a.id) !== key);

      if (!ready.length) {
        if (s.questions.some((q) => !q.answer)) this.setRun({ status: 'waiting_user', pauseReason: 'Waiting for your answer' });
        else if (s.run.status !== 'shipped') {
          this.setRun({ status: 'paused', pauseReason: 'The team is idle — nothing on the board can move. Inspect the agents or give a new brief.' });
        }
        return;
      }

      let actors = ready;
      if (s.settings.mode === 'serial') {
        const order = s.agents.map((a) => a.id);
        const sorted = [...ready].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        const next = sorted.find((a) => order.indexOf(a.id) >= this.rr) ?? sorted[0];
        this.rr = order.indexOf(next.id) + 1;
        actors = [next];
      }

      await Promise.all(actors.map((a) => this.turn(a.id)));

      if (this.s.questions.some((q) => !q.answer) && this.s.run.status === 'running') {
        this.setRun({ status: 'waiting_user', pauseReason: 'The Producer asked you a question' });
      }
      this.checkBudget();
    } finally {
      this.setRun({ busy: false });
    }
  }

  private checkBudget() {
    const { run, settings } = this.s;
    if (run.status !== 'running') return;
    if (run.turnsUsed >= settings.maxTurns) this.setRun({ status: 'paused', pauseReason: `Budget cap hit: ${run.turnsUsed}/${settings.maxTurns} turns. Raise it in Settings to continue.` });
    else if (run.tokensUsed >= settings.maxTokens) {
      this.setRun({ status: 'paused', pauseReason: `Budget cap hit: ${run.tokensUsed.toLocaleString()}/${settings.maxTokens.toLocaleString()} tokens. Raise it in Settings to continue.` });
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  async refreshPreview() {
    if (this.previewInflight) return this.previewInflight;
    const { files, filesVersion, run } = this.s;
    this.previewInflight = this.deps
      .runner(files, filesVersion, run.tick)
      .then((report) => {
        this.store.setState({ preview: report });
      })
      .catch((e) => {
        this.store.setState({
          preview: { filesVersion, tick: run.tick, ok: false, errors: [], warnings: [], logs: [], buildError: `Preview runner failed: ${(e as Error).message}` },
        });
      })
      .finally(() => {
        this.previewInflight = undefined;
      });
    return this.previewInflight;
  }

  private needsPreview(agent: Agent) {
    const s = this.s;
    if (agent.role === 'qa') return s.tickets.some((t) => t.column === 'qa');
    if (agent.role === 'producer') return s.tickets.length > 0 && s.tickets.every((t) => t.column === 'done');
    return false;
  }

  // ── One agent turn ────────────────────────────────────────────────────────

  private async turn(agentId: string) {
    const epoch = this.epoch;
    const intent = intentFor(this.s, this.s.agents.find((a) => a.id === agentId)!);
    this.patchAgent(agentId, { status: 'thinking', activity: intent.activity });

    const first = this.s.agents.find((a) => a.id === agentId)!;
    for (let i = 0; i < 3 && this.needsPreview(first) && !isPreviewFresh(this.s); i++) await this.refreshPreview();

    const ctxState = this.s;
    const agent = ctxState.agents.find((a) => a.id === agentId)!;
    const { system, user } = buildContext(ctxState, agent);
    const messages: LLMMessage[] = [{ role: 'user', content: user }];
    const readUpTo = ctxState.nextMessage - 1;

    let provider: LLMProvider;
    try {
      provider = this.deps.providerFactory(ctxState.settings);
    } catch (e) {
      this.patchAgent(agentId, { status: 'error', activity: (e as Error).message });
      this.setRun({ status: 'paused', pauseReason: (e as Error).message });
      return;
    }

    let raw = '';
    let reasoning = '';
    let modelReasoning: string | undefined;
    let tokens = 0;
    let attempts = 0;
    let error: string | undefined;
    let action: Action | undefined;
    let summary = '';
    let fatal = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      attempts++;
      try {
        const res = await provider.complete({ system, messages, meta: { agent, state: ctxState, attempt }, signal: this.abort.signal });
        const used = res.usage.input + res.usage.output;
        tokens += used;
        this.setRun({ tokensUsed: this.s.run.tokensUsed + used });
        raw = res.text;
        modelReasoning = res.reasoning;
      } catch (e) {
        if (epoch !== this.epoch) return;
        error = `LLM request failed: ${(e as Error).message}`;
        fatal = true;
        break;
      }
      if (epoch !== this.epoch) return; // project was replaced mid-turn

      const parsed = parseAgentResponse(raw);
      if (parsed.ok) {
        reasoning = parsed.value.reasoning;
        const result = applyAction(this.s, agentId, parsed.value);
        if (result.ok) {
          this.store.setState(result.state);
          action = parsed.value.action;
          summary = result.summary;
          error = undefined;
          break;
        }
        error = `Rejected by the board: ${result.error}`;
      } else {
        error = parsed.error;
      }
      messages.push(
        { role: 'assistant', content: raw },
        { role: 'user', content: `Your previous reply was invalid — ${error}\nReply again with ONE corrected JSON object.` },
      );
    }

    const after = this.s;
    const next = intentFor(after, after.agents.find((a) => a.id === agentId)!);
    this.patchAgent(agentId, (a) => ({
      status: error ? 'error' : next.act ? next.status : next.status === 'waiting' ? 'waiting' : 'idle',
      activity: error ? error.slice(0, 120) : next.activity,
      turns: a.turns + 1,
      tokens: a.tokens + tokens,
      lastReadMessageId: Math.max(a.lastReadMessageId, readUpTo),
      memory: [...a.memory, `t${after.run.tick}: ${error ? `FAILED — ${error.slice(0, 100)}` : summary}`].slice(-MEMORY_SIZE),
      lastTurn: { tick: after.run.tick, system, prompt: user, raw, reasoning, modelReasoning, actionSummary: error ? 'No action (invalid)' : summary, attempts, error, tokens },
    }));
    this.setRun({ turnsUsed: this.s.run.turnsUsed + 1 });

    if (!action || action.type === 'noop') this.noopKeys.set(agentId, boardKey(this.s));
    else this.noopKeys.clear();

    if (agent.role === 'producer' && action) {
      this.store.setState((s) => ({ questions: s.questions.map((q) => (q.answer ? { ...q, consumed: true } : q)) }));
    }
    if (error) {
      const tx = new Tx(this.s);
      tx.message('system', `⚠️ ${agent.name} (${agent.title}) turn failed after ${attempts} attempt(s): ${error.slice(0, 200)}`);
      this.store.setState(tx.done());
    }
    if (fatal) this.setRun({ status: 'paused', pauseReason: error });
  }
}
