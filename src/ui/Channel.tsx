import { useEffect, useRef, useState } from 'react';
import type { Message } from '../types';
import { useApp } from '../store/studio';
import { Avatar, Empty, RichText, useActor } from './common';
import { scheduler } from './runtime';

function Row({ m }: { m: Message }) {
  const actor = useActor(m.from);
  if (m.from === 'system') {
    return (
      <div className="mx-4 my-1 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-200/90">
        <span className="mr-2 font-mono text-amber-200/40">t{m.tick}</span>
        {m.text}
      </div>
    );
  }
  return (
    <div className={`flex gap-3 px-4 py-2 hover:bg-zinc-900/60 ${m.from === 'user' ? 'bg-sky-500/5' : ''}`}>
      <Avatar agent={actor} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold" style={{ color: actor && 'color' in actor ? actor.color : undefined }}>
            {actor?.name ?? m.from}
          </span>
          <span className="text-[11px] text-zinc-500">tick {m.tick}</span>
        </div>
        <div className="text-sm leading-relaxed text-zinc-200">
          <RichText text={m.text} />
        </div>
      </div>
    </div>
  );
}

export function Channel() {
  const messages = useApp((s) => s.messages);
  const agents = useApp((s) => s.agents);
  const [filter, setFilter] = useState<string>('all');
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const shown = filter === 'all' ? messages : messages.filter((m) => m.from === filter || m.mentions.includes(filter));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [shown.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2 text-xs">
        <span className="font-semibold text-zinc-300"># team</span>
        <span className="text-zinc-500">{messages.length} messages</span>
        <select className="ml-auto rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Everyone</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.title})
            </option>
          ))}
        </select>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto py-2">
        {shown.length ? shown.map((m) => <Row key={m.id} m={m} />) : <Empty>No messages yet.</Empty>}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 border-t border-zinc-800 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          scheduler.postUserMessage(draft);
          setDraft('');
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the team (mentions @producer by default)…"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <button type="submit" className="rounded-md bg-zinc-800 px-3 text-sm hover:bg-zinc-700" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
