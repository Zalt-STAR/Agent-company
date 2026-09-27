import { COLUMNS } from '../types';
import type { Ticket } from '../types';
import { setUi, useApp, useView } from '../store/studio';
import { Avatar, Empty, RichText } from './common';

const COLUMN_ACCENT: Record<string, string> = {
  backlog: 'border-t-zinc-600',
  in_progress: 'border-t-cyan-400',
  review: 'border-t-violet-400',
  qa: 'border-t-green-400',
  done: 'border-t-amber-400',
};

function Assignee({ id }: { id?: string }) {
  const agent = useApp((s) => s.agents.find((a) => a.id === id));
  if (!agent) return <span className="text-[11px] text-zinc-600">unassigned</span>;
  return (
    <span className="flex items-center gap-1 text-[11px] text-zinc-400">
      <Avatar agent={agent} size="sm" />
      {agent.name}
    </span>
  );
}

function TicketCard({ t, locks }: { t: Ticket; locks: Record<string, { agentId: string; ticketId: string }> }) {
  const lockedFiles = t.files.filter((f) => locks[f]?.ticketId === t.id);
  return (
    <button
      type="button"
      onClick={() => setUi({ selectedTicketId: t.id })}
      className="flash w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-left transition hover:border-zinc-600"
      key={`${t.id}-${t.column}`}
    >
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="font-mono text-zinc-500">{t.id}</span>
        <span className={`rounded px-1 font-semibold ${t.priority === 1 ? 'bg-red-500/15 text-red-300' : t.priority === 2 ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-700 text-zinc-300'}`}>
          P{t.priority}
        </span>
        {t.kind === 'bug' && <span className="rounded bg-rose-500/15 px-1 text-rose-300">bug</span>}
        {t.qaFails > 0 && <span className="rounded bg-rose-500/15 px-1 text-rose-300">QA ✗{t.qaFails}</span>}
        {t.reviewRejections > 0 && <span className="rounded bg-violet-500/15 px-1 text-violet-300">changes ×{t.reviewRejections}</span>}
        {t.needsProducer && <span className="rounded bg-orange-500/20 px-1 text-orange-300">needs producer</span>}
      </div>
      <div className="mt-1 text-sm leading-snug text-zinc-100">{t.title}</div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Assignee id={t.assignee} />
        <span className="text-[11px] text-zinc-500">{t.acceptance.length} AC</span>
      </div>
      {lockedFiles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lockedFiles.map((f) => (
            <span key={f} className="rounded bg-amber-400/10 px-1 font-mono text-[10px] text-amber-200">
              🔒 {f}
            </span>
          ))}
        </div>
      )}
      {t.dependsOn.length > 0 && t.column === 'backlog' && (
        <div className="mt-1 text-[11px] text-zinc-500">after {t.dependsOn.join(', ')}</div>
      )}
    </button>
  );
}

function TicketDetail({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const commits = useApp((s) => s.commits.filter((c) => ticket.commits.includes(c.id)));
  const agents = useApp((s) => s.agents);
  const name = (id: string) => agents.find((a) => a.id === id)?.name ?? id;
  return (
    <div className="absolute inset-0 z-20 flex justify-end bg-black/40" onClick={onClose}>
      <div className="scroll-thin h-full w-[440px] max-w-full overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-zinc-500">
              {ticket.id} · {ticket.kind} · P{ticket.priority} · {COLUMNS.find((c) => c.id === ticket.column)?.label}
            </div>
            <h3 className="mt-1 text-lg font-semibold leading-snug">{ticket.title}</h3>
          </div>
          <button type="button" className="text-zinc-500 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">{ticket.description}</p>
        <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Acceptance criteria</h4>
        <ul className="mt-2 space-y-1 text-sm">
          {ticket.acceptance.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span className={ticket.column === 'done' ? 'text-emerald-400' : 'text-zinc-600'}>{ticket.column === 'done' ? '✓' : '○'}</span>
              <span className="text-zinc-200">{a}</span>
            </li>
          ))}
        </ul>
        <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Files</h4>
        <div className="mt-2 flex flex-wrap gap-1">
          {ticket.files.map((f) => (
            <button key={f} type="button" onClick={() => setUi({ tab: 'files', selectedFile: f, selectedTicketId: undefined })} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300 hover:bg-zinc-700">
              {f}
            </button>
          ))}
        </div>
        {ticket.bugs.length > 0 && (
          <>
            <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-rose-400">Bug reports</h4>
            {ticket.bugs.map((b, i) => (
              <div key={i} className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
                <div className="font-medium text-rose-200">{b.title}</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  by {name(b.by)} · tick {b.tick}
                </div>
                <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-zinc-300">
                  {b.steps.map((st, j) => (
                    <li key={j}>{st}</li>
                  ))}
                </ol>
                <div className="mt-2 text-xs">
                  <span className="text-zinc-500">Expected:</span> <span className="text-zinc-300">{b.expected}</span>
                </div>
                <div className="text-xs">
                  <span className="text-zinc-500">Actual:</span> <span className="font-mono text-rose-300">{b.actual}</span>
                </div>
              </div>
            ))}
          </>
        )}
        {ticket.reviews.length > 0 && (
          <>
            <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-violet-400">Reviews</h4>
            {ticket.reviews.map((r, i) => (
              <div key={i} className="mt-2 rounded-lg border border-zinc-800 p-3 text-sm">
                <div className={r.verdict === 'approve' ? 'text-emerald-300' : 'text-violet-300'}>
                  {r.verdict === 'approve' ? '✓ Approved' : '↩ Changes requested'} <span className="text-xs text-zinc-500">by {name(r.by)} · tick {r.tick}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-zinc-300">{r.comments}</div>
              </div>
            ))}
          </>
        )}
        {commits.length > 0 && (
          <>
            <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Commits</h4>
            <ul className="mt-2 space-y-1">
              {commits.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left text-sm hover:bg-zinc-900"
                    onClick={() => setUi({ tab: 'files', selectedCommitId: c.id, selectedFile: undefined, selectedTicketId: undefined })}
                  >
                    <span className="font-mono text-xs text-zinc-500">{c.id}</span> <RichText text={c.note} />{' '}
                    <span className="text-xs text-zinc-500">— {name(c.author)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export function Board() {
  const { tickets, locks } = useView();
  const selectedId = useApp((s) => s.ui.selectedTicketId);
  const selected = tickets.find((t) => t.id === selectedId);
  const spec = useApp((s) => s.spec);

  if (!tickets.length) {
    return <Empty>{spec ? 'No tickets yet.' : 'The Producer is scoping the brief — tickets will appear here.'}</Empty>;
  }
  const lockEntries = Object.entries(locks);

  return (
    <div className="relative flex h-full flex-col">
      {lockEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800 px-4 py-2 text-xs">
          <span className="text-zinc-500">File locks:</span>
          {lockEntries.map(([path, l]) => (
            <LockChip key={path} path={path} agentId={l.agentId} ticketId={l.ticketId} />
          ))}
        </div>
      )}
      <div className="scroll-thin grid min-h-0 flex-1 grid-cols-5 gap-3 overflow-x-auto p-4">
        {COLUMNS.map((col) => {
          const items = tickets.filter((t) => t.column === col.id).sort((a, b) => a.priority - b.priority);
          return (
            <section key={col.id} className={`flex min-h-0 min-w-44 flex-col rounded-xl border-t-2 bg-zinc-900/40 ${COLUMN_ACCENT[col.id]}`}>
              <header className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {col.label}
                <span className="rounded bg-zinc-800 px-1.5 text-zinc-400">{items.length}</span>
              </header>
              <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {items.map((t) => (
                  <TicketCard key={`${t.id}-${t.column}`} t={t} locks={locks} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {selected && <TicketDetail ticket={selected} onClose={() => setUi({ selectedTicketId: undefined })} />}
    </div>
  );
}

function LockChip({ path, agentId, ticketId }: { path: string; agentId: string; ticketId: string }) {
  const agent = useApp((s) => s.agents.find((a) => a.id === agentId));
  return (
    <span className="flex items-center gap-1 rounded-full bg-amber-400/10 py-0.5 pl-0.5 pr-2 text-amber-200">
      {agent && <Avatar agent={agent} size="sm" />}
      <span className="font-mono">{path}</span>
      <span className="text-amber-200/50">{ticketId}</span>
    </span>
  );
}
