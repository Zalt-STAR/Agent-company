import type { Agent, Settings, StudioState, Ticket } from '../../types';
import type { AgentResponse } from '../../agents/actions';
import { depsDone, isPreviewFresh, lockConflicts } from '../../engine/apply';
import { ticketDiff, unreadMentions } from '../../agents/context';
import type { LLMProvider, LLMRequest } from '../provider';
import { estimateTokens } from '../provider';
import { chooseTemplate, templateById } from './templates';
import type { Flaw, ProjectTemplate } from './templates';

/**
 * A deterministic stand-in for an LLM. It reads the same turn context a real model would
 * (via request.meta) and replies with the same JSON protocol, so the whole loop — parsing,
 * validation, retries, board rules, previews — is exercised without an API key.
 */
export function createMockProvider(settings: Pick<Settings, 'speed'>, opts: { latencyMs?: number } = {}): LLMProvider {
  return {
    name: 'mock',
    async complete(req: LLMRequest) {
      const base = opts.latencyMs ?? 350 + Math.random() * 650;
      const wait = base / Math.max(0.25, settings.speed);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const { agent, state, attempt } = req.meta;
      const response = decide(state, agent, attempt);
      const text = typeof response === 'string' ? response : JSON.stringify(response, null, 1);
      const input = estimateTokens(req.system) + req.messages.reduce((n, m) => n + estimateTokens(m.content), 0);
      return { text, usage: { input, output: estimateTokens(text) } };
    },
  };
}

type Reply = AgentResponse | string;

const noop = (reasoning: string, message?: AgentResponse['message']): AgentResponse => ({
  reasoning,
  action: { type: 'noop' },
  message: message ?? null,
});

function templateFor(s: StudioState): ProjectTemplate | undefined {
  return templateById(s.spec?.templateId, s.brief);
}

function decide(s: StudioState, agent: Agent, attempt: number): Reply {
  switch (agent.role) {
    case 'producer':
      return producer(s);
    case 'designer':
      return designer(s, attempt);
    case 'engineer':
      return engineer(s, agent);
    case 'reviewer':
      return reviewer(s);
    case 'qa':
      return qa(s);
  }
}

// ── Producer ────────────────────────────────────────────────────────────────

function producer(s: StudioState): Reply {
  if (!s.spec) {
    const answer = s.questions.find((q) => q.answer)?.answer;
    const choice = chooseTemplate(s.brief, answer);
    if ('ambiguous' in choice) {
      return {
        reasoning: 'The brief does not say whether this is an app or a game, which changes the whole plan. Asking before scoping.',
        action: {
          type: 'ask_user',
          question: `"${s.brief.trim()}" — should the studio build this as a small app or as a simple game?`,
          options: ['A small app', 'A simple game'],
        },
        message: null,
      };
    }
    const t = choice.template;
    const engs = s.agents.filter((a) => a.role === 'engineer').map((a) => a.id);
    const keyIndex = new Map(t.tickets.map((tk, i) => [tk.key, i + 1]));
    return {
      reasoning: `Scoped the brief as a ${t.spec.kind} ("${t.spec.title}"). Scaffold first so engineers can work on separate modules in parallel.`,
      action: {
        type: 'write_spec',
        spec: t.spec,
        tickets: t.tickets.map((tk, i) => ({
          title: tk.title,
          description: tk.description,
          acceptance: tk.acceptance,
          priority: tk.priority,
          files: tk.files,
          dependsOn: tk.dependsOn.map((d) => `#${keyIndex.get(d)}`),
          assignee: engs[i % engs.length],
          templateKey: tk.key,
        })),
      },
      message: {
        text: `Spec is up: ${t.tickets.length} tickets, scaffold first. @designer please set the UX flow and tokens before engineers start.`,
        mentions: ['designer'],
      },
    };
  }

  const rescope = s.tickets.find((t) => t.needsProducer);
  if (rescope) {
    const engs = s.agents.filter((a) => a.role === 'engineer').map((a) => a.id);
    const next = engs[(engs.indexOf(rescope.assignee ?? '') + 1) % engs.length] ?? engs[0];
    const lastBug = rescope.bugs[rescope.bugs.length - 1];
    return {
      reasoning: `${rescope.id} failed QA twice. Fresh eyes help: reassigning to ${next} and pinning the acceptance to the failing check.`,
      action: {
        type: 'update_ticket',
        ticketId: rescope.id,
        assignee: next,
        description: `${rescope.description}\n\nRescoped after 2 QA failures. Last failure: ${lastBug?.actual ?? 'see bug reports'}`,
      },
      message: {
        text: `@${next} please take over ${rescope.id} — two QA fails. Start from the last bug report; keep scope as is.`,
        mentions: [next],
      },
    };
  }

  if (s.tickets.length && s.tickets.every((t) => t.column === 'done')) {
    if (!isPreviewFresh(s)) return noop('Waiting for a fresh preview run before shipping.');
    if (!s.preview!.ok) return noop('All tickets are done but the preview still reports errors; holding the release.', {
      text: `@qa all tickets are Done but the preview shows: ${s.preview!.errors[0] ?? s.preview!.buildError}. Please file a bug.`,
      mentions: ['qa'],
    });
    return {
      reasoning: 'Every ticket is Done, reviewed and QA-passed, and the latest preview runs with zero console errors. Shipping.',
      action: { type: 'ship', note: `${s.spec.title} v1: ${s.spec.features.join('; ')}.` },
      message: { text: `Shipped ${s.spec.title} 🚀 Thanks team.`, mentions: [] },
    };
  }

  if (s.questions.some((q) => q.answer && !q.consumed)) return noop('Noted the answer; the plan already reflects it.');
  return noop('Nothing needs the Producer right now.');
}

// ── Designer ────────────────────────────────────────────────────────────────

function designer(s: StudioState, attempt: number): Reply {
  const t = templateFor(s);
  if (!s.spec || !t) return noop('No spec yet.');
  if (s.design) return noop('Design already delivered; nothing new asked.');
  if (attempt === 0) {
    // Deliberately malformed first draft (missing required fields) to exercise validation + retry.
    return JSON.stringify({
      reasoning: 'Drafting the design doc.',
      action: { type: 'write_design', design: { summary: t.design.summary, palette: t.design.palette } },
      message: null,
    });
  }
  return {
    reasoning: `Design follows the spec's ${s.spec.kind} scope. Tokens are written so engineers can map them 1:1 to CSS variables.`,
    action: { type: 'write_design', design: t.design },
    message: {
      text: `DESIGN.md is in with palette, type and spacing tokens${s.spec.kind === 'game' ? ', core loop and controls' : ''}. Engineers, go ahead.`,
      mentions: s.agents.filter((a) => a.role === 'engineer').map((a) => a.id),
    },
  };
}

// ── Engineer ────────────────────────────────────────────────────────────────

function applyFlaw(files: Record<string, string>, flaw: Flaw) {
  const src = files[flaw.path];
  if (src === undefined) return;
  if (flaw.kind === 'bug') {
    files[flaw.path] = src.replace(flaw.find, flaw.replace);
  } else {
    const lines = src.split('\n');
    const i = lines.findIndex((l) => l.includes(flaw.anchor));
    if (i >= 0) lines.splice(i + 1, 0, flaw.line);
    files[flaw.path] = lines.join('\n');
  }
}

function submissionAttempt(t: Ticket) {
  return t.bugs.length + t.reviews.filter((r) => r.verdict === 'request_changes').length;
}

function engineer(s: StudioState, agent: Agent): Reply {
  const tpl = templateFor(s);
  const mine = s.tickets.find((t) => t.column === 'in_progress' && t.assignee === agent.id);

  if (mine) {
    const tt = tpl?.tickets.find((x) => x.key === mine.templateKey);
    const attempt = submissionAttempt(mine);
    const files: Record<string, string> = {};
    let paths = mine.files;
    if (tt) {
      for (const p of tt.files) files[p] = tt.stubs?.includes(p) ? tpl!.stubs[p] : tpl!.final[p];
      const flaw = tt.flaws?.[attempt];
      if (flaw) applyFlaw(files, flaw);
      paths = tt.files;
    } else if (tpl) {
      // A bug ticket or a ticket the mock has no canned work for: restore the reference implementation of its files.
      for (const p of mine.files) if (tpl.final[p] !== undefined) files[p] = tpl.final[p];
      paths = Object.keys(files);
    }
    const edits = paths.filter((p) => files[p] !== undefined).map((p) => ({ path: p, content: files[p] }));
    const lastReview = [...mine.reviews].reverse().find((r) => r.verdict === 'request_changes');
    const lastBug = mine.bugs[mine.bugs.length - 1];
    const fixing = attempt > 0 ? (lastBug && (!lastReview || lastBug.tick > lastReview.tick) ? `Fix: ${lastBug.title}` : `Address review: ${lastReview?.comments}`) : undefined;
    if (!edits.length) {
      return {
        reasoning: `No code changes are needed for ${mine.id}; handing it to review.`,
        action: { type: 'write_code', ticketId: mine.id, edits: [{ path: 'NOTES.md', content: `${mine.id}: verified, no changes needed.\n` }], commitNote: `${mine.id}: verify`, readyForReview: true },
        message: null,
      };
    }
    const note = fixing ? fixing.split('\n')[0].slice(0, 90) : tt?.commitNote ?? `Implement ${mine.title}`;
    return {
      reasoning: fixing
        ? `${mine.id} came back (${fixing}). Rewriting ${edits.map((e) => e.path).join(', ')} to address it.`
        : `Implementing ${mine.id} against its acceptance criteria and DESIGN.md tokens; touching only ${edits.map((e) => e.path).join(', ')}.`,
      action: { type: 'write_code', ticketId: mine.id, edits, commitNote: note, readyForReview: true },
      message: { text: `${mine.id} ready for review — ${note.replace(/\.$/, '')}. @reviewer`, mentions: ['reviewer'] },
    };
  }

  const candidates = s.tickets
    .filter((t) => t.column === 'backlog' && !t.needsProducer && (!t.assignee || t.assignee === agent.id) && depsDone(s, t))
    .sort((a, b) => Number(!!b.assignee) - Number(!!a.assignee) || a.priority - b.priority);
  const pick = candidates.find((t) => !lockConflicts(s, t, agent.id).length);
  if (pick) {
    return {
      reasoning: `${pick.id} is ${pick.assignee ? 'assigned to me' : 'unassigned'}, its dependencies are Done and its files are free. Claiming it.`,
      action: { type: 'claim_ticket', ticketId: pick.id },
      message: null,
    };
  }
  const mentions = unreadMentions(s, agent);
  if (mentions.length) return noop('Read my mentions; nothing to pick up yet.');
  return noop('No claimable tickets right now.');
}

// ── Reviewer ────────────────────────────────────────────────────────────────

function reviewer(s: StudioState): Reply {
  const t = s.tickets.find((x) => x.column === 'review');
  if (!t) return noop('Review queue is empty.');
  const diff = ticketDiff(s, t);
  const findings: string[] = [];
  let added = 0;
  let removed = 0;
  for (const d of diff) {
    const before = new Set((d.before ?? '').split('\n'));
    const after = (d.after ?? '').split('\n');
    const afterSet = new Set(after);
    added += after.filter((l) => !before.has(l)).length;
    removed += [...before].filter((l) => !afterSet.has(l)).length;
    after.forEach((line, i) => {
      if (!before.has(line) && /console\.log\(/.test(line)) findings.push(`${d.path}:${i + 1} leaves a debug console.log — remove it before merge.`);
      if (!before.has(line) && /\b(TODO|FIXME)\b/.test(line)) findings.push(`${d.path}:${i + 1} has an unresolved ${line.includes('TODO') ? 'TODO' : 'FIXME'}.`);
    });
    if (!t.files.includes(d.path)) findings.push(`${d.path} is outside the ticket's file list (scope creep?).`);
  }
  if (findings.length) {
    return {
      reasoning: `Read the ${t.id} diff (+${added}/−${removed}). Found ${findings.length} issue(s) that should not merge.`,
      action: { type: 'review', ticketId: t.id, verdict: 'request_changes', comments: findings.join('\n') },
      message: { text: `@${t.assignee} changes requested on ${t.id}: ${findings[0]}`, mentions: t.assignee ? [t.assignee] : [] },
    };
  }
  return {
    reasoning: `Read the ${t.id} diff (+${added}/−${removed}) across ${diff.length} file(s). Scoped to the ticket, no debug leftovers, structure matches the module seams.`,
    action: { type: 'review', ticketId: t.id, verdict: 'approve', comments: `LGTM: +${added}/−${removed} lines, stays within ${t.files.join(', ')}.` },
    message: { text: `${t.id} approved. @qa it's yours.`, mentions: ['qa'] },
  };
}

// ── QA ──────────────────────────────────────────────────────────────────────

function symbolFromError(err: string): string | undefined {
  const m =
    /([\w$]+) is not defined/.exec(err) ??
    /([\w$.]+) is not a function/.exec(err) ??
    /reading '([\w$]+)'/.exec(err) ??
    /Could not resolve "([^"]+)"/.exec(err);
  return m?.[1].split('.').pop();
}

function qa(s: StudioState): Reply {
  const queue = s.tickets.filter((t) => t.column === 'qa');
  if (!queue.length) return noop('QA queue is empty.');
  const p = s.preview;
  if (!p || !isPreviewFresh(s)) return noop('Waiting for a fresh preview run.');

  const problems = p.buildError ? [p.buildError] : p.errors;
  if (problems.length) {
    const err = problems[0];
    const sym = symbolFromError(err);
    const culprit =
      (sym && queue.find((t) => t.files.some((f) => s.files[f]?.includes(sym)))) ??
      (sym ? undefined : [...queue].sort((a, b) => (b.commits.at(-1) ?? '').localeCompare(a.commits.at(-1) ?? ''))[0]);
    if (!culprit) {
      const elsewhere = sym && s.tickets.find((t) => t.column !== 'qa' && t.column !== 'done' && t.files.some((f) => s.files[f]?.includes(sym)));
      return noop(`Preview is throwing "${err}", which comes from code outside my queue. Holding QA until it's fixed.`,
        elsewhere && !s.messages.slice(-6).some((m) => m.from === 'qa' && m.text.includes(elsewhere.id))
          ? { text: `@${elsewhere.assignee} heads up: ${elsewhere.id} is throwing "${err}" in the preview — blocking QA.`, mentions: elsewhere.assignee ? [elsewhere.assignee] : [] }
          : null);
    }
    const file = culprit.files.find((f) => sym && s.files[f]?.includes(sym)) ?? culprit.files[0];
    return {
      reasoning: `The preview has ${problems.length} console error(s). "${err}" traces to ${file} in ${culprit.id}. Failing it with repro steps.`,
      action: {
        type: 'qa_result',
        ticketId: culprit.id,
        verdict: 'fail',
        notes: `Console error on load: ${err}`,
        bug: {
          title: `${culprit.id}: ${err.slice(0, 80)}`,
          steps: ['Open the Preview tab (fresh load)', 'Let the app initialise; the smoke test presses Enter/Space/arrows and clicks the first button', 'Open the console panel'],
          expected: 'The app renders and the console shows no errors',
          actual: `${err}${file ? ` (from ${file})` : ''}`,
        },
      },
      message: { text: `@${culprit.assignee} ${culprit.id} fails QA: ${err}. Repro steps are on the ticket.`, mentions: culprit.assignee ? [culprit.assignee] : [] },
    };
  }

  const t = queue[0];
  const missing = t.files.filter((f) => !s.files[f]?.trim());
  if (missing.length) {
    return {
      reasoning: `${t.id} lists files that are missing or empty: ${missing.join(', ')}.`,
      action: {
        type: 'qa_result',
        ticketId: t.id,
        verdict: 'fail',
        notes: 'Missing files',
        bug: { title: `${t.id}: missing ${missing[0]}`, steps: ['Open the Files tab', `Look for ${missing[0]}`], expected: 'File exists with the implementation', actual: 'File is missing or empty' },
      },
      message: null,
    };
  }
  return {
    reasoning: `Preview built and ran the smoke test with 0 console errors. Checked ${t.id}'s ${t.acceptance.length} acceptance criteria against the running build and code.`,
    action: { type: 'qa_result', ticketId: t.id, verdict: 'pass', notes: `Verified: ${t.acceptance.join(' · ')}` },
    message: null,
  };
}
