import { useState } from 'react';
import { useApp } from '../store/studio';
import { Avatar } from './common';
import { scheduler } from './runtime';

export function QuestionCard() {
  const q = useApp((s) => s.questions.find((x) => !x.answer));
  const from = useApp((s) => s.agents.find((a) => a.id === q?.from));
  const [custom, setCustom] = useState('');
  if (!q) return null;
  return (
    <div className="mx-4 mt-3 rounded-xl border border-sky-500/40 bg-sky-500/10 p-4">
      <div className="flex items-start gap-3">
        <Avatar agent={from} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-300">{from?.name ?? 'The Producer'} needs your input</div>
          <div className="mt-1 text-sm text-zinc-100">{q.text}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {q.options.map((o) => (
              <button key={o} type="button" onClick={() => scheduler.answer(q.id, o)} className="rounded-full bg-sky-400 px-3 py-1 text-sm font-medium text-sky-950 hover:bg-sky-300">
                {o}
              </button>
            ))}
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (custom.trim()) scheduler.answer(q.id, custom.trim());
              }}
            >
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Or type an answer…"
                className="rounded-full border border-sky-500/40 bg-zinc-950 px-3 py-1 text-sm outline-none"
              />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
