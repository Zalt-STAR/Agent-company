import type { Agent, AgentStatus } from '../types';
import { useApp } from '../store/studio';

export const STATUS_STYLE: Record<AgentStatus, { dot: string; label: string; pulse?: boolean }> = {
  idle: { dot: 'bg-zinc-600', label: 'idle' },
  thinking: { dot: 'bg-amber-400', label: 'thinking', pulse: true },
  planning: { dot: 'bg-amber-500', label: 'planning' },
  designing: { dot: 'bg-pink-400', label: 'designing' },
  coding: { dot: 'bg-cyan-400', label: 'coding' },
  reviewing: { dot: 'bg-violet-400', label: 'reviewing' },
  testing: { dot: 'bg-green-400', label: 'testing' },
  waiting: { dot: 'bg-orange-400', label: 'waiting' },
  error: { dot: 'bg-red-500', label: 'error' },
};

export function StatusDot({ status }: { status: AgentStatus }) {
  const st = STATUS_STYLE[status];
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${st.dot} ${st.pulse ? 'pulse-dot' : ''}`} />;
}

export function Avatar({ agent, size = 'md' }: { agent?: Pick<Agent, 'avatar' | 'color' | 'name'>; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-5 w-5 text-[11px]' : size === 'lg' ? 'h-10 w-10 text-xl' : 'h-8 w-8 text-base';
  if (!agent) return <span className={`${dim} inline-grid shrink-0 place-items-center rounded-full bg-zinc-700`}>?</span>;
  return (
    <span
      className={`${dim} inline-grid shrink-0 place-items-center rounded-full`}
      style={{ background: `${agent.color}22`, boxShadow: `inset 0 0 0 1.5px ${agent.color}` }}
      title={agent.name}
    >
      {agent.avatar}
    </span>
  );
}

const USER = { avatar: '🧑', color: '#e4e4e7', name: 'You' };
const SYSTEM = { avatar: '⚙️', color: '#71717a', name: 'Studio' };

export function useActor(id: string | undefined) {
  const agent = useApp((s) => s.agents.find((a) => a.id === id));
  if (id === 'user') return USER;
  if (id === 'system') return SYSTEM;
  return agent;
}

/** Render text with @mentions and ticket ids highlighted. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(@[a-z0-9-]+|\bT-\d+\b)/gi);
  return (
    <>
      {parts.map((p, i) =>
        /^@/.test(p) ? (
          <span key={i} className="rounded bg-sky-500/15 px-0.5 font-medium text-sky-300">
            {p}
          </span>
        ) : /^T-\d+$/.test(p) ? (
          <span key={i} className="rounded bg-zinc-700/60 px-1 font-mono text-[0.9em] text-zinc-200">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  disabled,
  title,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles = {
    primary: 'bg-amber-400 text-zinc-950 hover:bg-amber-300 font-semibold',
    ghost: 'text-zinc-300 hover:bg-zinc-800 hover:text-white',
    outline: 'border border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800',
    danger: 'border border-red-500/40 text-red-300 hover:bg-red-500/10',
  }[variant];
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center p-8 text-center text-sm text-zinc-500">{children}</div>;
}
