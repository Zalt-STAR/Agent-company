import { useApp } from '../store/studio';
import { Avatar, Empty, STATUS_STYLE, StatusDot } from './common';

function Section({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-zinc-800">
      <summary className="cursor-pointer select-none px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300">{title}</summary>
      <div className="px-4 pb-3">{children}</div>
    </details>
  );
}

function Pre({ children }: { children: string }) {
  return <pre className="scroll-thin max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-900 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-300">{children}</pre>;
}

export function Inspector() {
  const agent = useApp((s) => s.agents.find((a) => a.id === s.ui.selectedAgentId));
  if (!agent) return <aside className="w-96 shrink-0 border-l border-zinc-800" />;
  const turn = agent.lastTurn;

  return (
    <aside className="scroll-thin flex w-96 shrink-0 flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-3 border-b border-zinc-800 p-4">
        <Avatar agent={agent} size="lg" />
        <div className="min-w-0">
          <div className="font-semibold">
            {agent.name} <span className="font-normal text-zinc-500">· {agent.title}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <StatusDot status={agent.status} /> {STATUS_STYLE[agent.status].label} · {agent.turns} turns · {agent.tokens.toLocaleString()} tokens
          </div>
        </div>
      </div>
      {!turn ? (
        <Empty>{agent.name} hasn't taken a turn yet.</Empty>
      ) : (
        <>
          <Section title={`Last turn · tick ${turn.tick}`}>
            <div className="text-sm text-zinc-100">{turn.actionSummary}</div>
            <div className="mt-1 text-xs text-zinc-500">
              {turn.attempts} attempt{turn.attempts > 1 ? 's' : ''} · {turn.tokens.toLocaleString()} tokens
            </div>
            {turn.error && <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-300">{turn.error}</div>}
            {!turn.error && turn.attempts > 1 && (
              <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-200">First reply failed validation; the retry succeeded.</div>
            )}
          </Section>
          <Section title="Reasoning summary">
            <p className="text-sm leading-relaxed text-zinc-300">{turn.reasoning || '—'}</p>
            {turn.modelReasoning && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-zinc-500">Model thinking (summarized)</summary>
                <Pre>{turn.modelReasoning}</Pre>
              </details>
            )}
          </Section>
          <Section title="Memory" open={false}>
            <ul className="space-y-1 text-xs text-zinc-400">
              {agent.memory.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </Section>
          <Section title="Last prompt" open={false}>
            <details>
              <summary className="cursor-pointer pb-1 text-xs text-zinc-500">System prompt</summary>
              <Pre>{turn.system}</Pre>
            </details>
            <Pre>{turn.prompt}</Pre>
          </Section>
          <Section title="Raw response">
            <Pre>{turn.raw}</Pre>
          </Section>
        </>
      )}
    </aside>
  );
}
