import { useApp, setUi } from '../store/studio';
import { Avatar, STATUS_STYLE, StatusDot } from './common';

export function Roster() {
  const agents = useApp((s) => s.agents);
  const selected = useApp((s) => s.ui.selectedAgentId);
  const locks = useApp((s) => s.locks);

  return (
    <aside className="scroll-thin flex w-64 shrink-0 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-950">
      <div className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Team</div>
      <ul className="space-y-1 px-2 pb-4">
        {agents.map((a) => {
          const held = Object.entries(locks).filter(([, l]) => l.agentId === a.id).map(([p]) => p);
          const st = STATUS_STYLE[a.status];
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setUi({ selectedAgentId: a.id })}
                className={`w-full rounded-lg px-2.5 py-2 text-left transition ${
                  selected === a.id ? 'bg-zinc-800/80 ring-1 ring-zinc-700' : 'hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar agent={a} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-zinc-100">{a.name}</span>
                      <span className="truncate text-xs text-zinc-500">{a.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <StatusDot status={a.status} />
                      <span className={a.status === 'error' ? 'text-red-300' : 'text-zinc-400'}>{st.label}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 line-clamp-2 pl-[42px] text-xs leading-snug text-zinc-500">{a.activity}</div>
                {held.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 pl-[42px]">
                    {held.map((p) => (
                      <span key={p} className="rounded bg-zinc-800 px-1 font-mono text-[10px] text-amber-200/80">
                        🔒 {p.split('/').pop()}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
