import { useEffect, useState } from 'react';
import type { TimelineKind } from '../types';
import { appStore, setUi, useApp } from '../store/studio';

const KIND_COLOR: Record<TimelineKind, string> = {
  spec: 'bg-amber-400',
  design: 'bg-pink-400',
  create: 'bg-zinc-400',
  move: 'bg-sky-400',
  commit: 'bg-cyan-300',
  question: 'bg-violet-400',
  ship: 'bg-emerald-400',
  note: 'bg-orange-400',
};

export function Timeline() {
  const timeline = useApp((s) => s.timeline);
  const replayIndex = useApp((s) => s.ui.replayIndex);
  const [playing, setPlaying] = useState(false);
  const last = timeline.length - 1;
  const index = replayIndex ?? last;
  const current = timeline[index];

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const i = (appStore.getState().ui.replayIndex ?? 0) + 1;
      if (i >= timeline.length - 1) {
        setUi({ replayIndex: null });
        setPlaying(false);
      } else setUi({ replayIndex: i });
    }, 350);
    return () => clearInterval(id);
  }, [playing, timeline.length]);

  if (!timeline.length) {
    return <footer className="flex h-16 shrink-0 items-center border-t border-zinc-800 px-4 text-xs text-zinc-600">Timeline — commits and ticket moves will appear here.</footer>;
  }

  return (
    <footer className="shrink-0 border-t border-zinc-800 bg-zinc-950 px-4 py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          onClick={() => {
            if (playing) setPlaying(false);
            else {
              setUi({ replayIndex: 0 });
              setPlaying(true);
            }
          }}
          title="Replay how the project came together"
        >
          {playing ? '⏸ Stop' : '⟲ Replay'}
        </button>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-2">
            {timeline.map((e, i) => (
              <span key={e.id} className={`h-2 flex-1 ${KIND_COLOR[e.kind]} ${i <= index ? 'opacity-90' : 'opacity-25'}`} style={{ marginRight: 1 }} title={e.label} />
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={last}
            value={index}
            onChange={(e) => {
              setPlaying(false);
              const v = Number(e.target.value);
              setUi({ replayIndex: v >= last ? null : v });
            }}
            className="mt-2 w-full accent-amber-400"
            aria-label="Timeline scrubber"
          />
        </div>
        <button
          type="button"
          className={`rounded px-2 py-1 text-xs ${replayIndex === null ? 'text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800'}`}
          onClick={() => {
            setPlaying(false);
            setUi({ replayIndex: null });
          }}
        >
          ● Live
        </button>
      </div>
      <div className="mt-0.5 flex items-center gap-2 truncate text-xs text-zinc-400">
        <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_COLOR[current.kind]}`} />
        <span className="font-mono text-zinc-500">
          {index + 1}/{timeline.length} · t{current.tick}
        </span>
        <span className="truncate">{current.label}</span>
      </div>
    </footer>
  );
}
