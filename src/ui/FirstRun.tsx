import { useState } from 'react';
import { setUi, useApp } from '../store/studio';
import { scheduler } from './runtime';

const EXAMPLES = ['A Pomodoro timer', 'A Snake game', 'A habit tracker', 'A platformer level'];

export function FirstRun() {
  const [brief, setBrief] = useState('');
  const provider = useApp((s) => s.settings.provider);
  const submit = (b: string) => {
    if (b.trim()) scheduler.newProject(b.trim());
  };

  return (
    <div className="grid h-full place-items-center bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.08),transparent_60%)] p-6">
      <div className="w-full max-w-2xl text-center">
        <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">
          📋 Producer · 🎨 Designer · 🛠️ Engineers · 🔍 Reviewer · 🧪 QA
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50">What should the studio build?</h1>
        <p className="mt-3 text-zinc-400">Give a one-line brief. An AI agent company will spec it, design it, build it, review it and test it — live.</p>
        <form
          className="mt-8 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(brief);
          }}
        >
          <input
            autoFocus
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. A Snake game with a neon look"
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base outline-none placeholder:text-zinc-600 focus:border-amber-400/60"
          />
          <button type="submit" disabled={!brief.trim()} className="rounded-xl bg-amber-400 px-5 font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40">
            Build it
          </button>
        </form>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => submit(ex)} className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-amber-400/60 hover:text-white">
              {ex}
            </button>
          ))}
        </div>
        <p className="mt-10 text-xs text-zinc-500">
          {provider === 'mock' ? (
            <>
              Running on the built-in <b className="text-zinc-400">mock LLM</b> — no API key needed.{' '}
              <button type="button" className="underline hover:text-zinc-300" onClick={() => setUi({ settingsOpen: true })}>
                Add a Claude API key
              </button>{' '}
              to have real models do the work.
            </>
          ) : (
            <>Using Claude via your API key (kept in memory only).</>
          )}
        </p>
      </div>
    </div>
  );
}
