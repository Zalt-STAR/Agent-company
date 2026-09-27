import { MODELS } from '../llm/provider';
import { setSettings, setUi, useApp } from '../store/studio';
import type { Settings as S } from '../types';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

const input = 'w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500';

export function SettingsModal() {
  const open = useApp((s) => s.ui.settingsOpen);
  const st = useApp((s) => s.settings);
  const started = useApp((s) => s.run.tick > 0);
  if (!open) return null;
  const set = (p: Partial<S>) => setSettings(p);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setUi({ settingsOpen: false })}>
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button type="button" className="text-zinc-500 hover:text-white" onClick={() => setUi({ settingsOpen: false })}>
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="LLM provider">
            <div className="flex gap-2">
              {(['mock', 'anthropic'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set({ provider: p })}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm ${st.provider === p ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
                >
                  {p === 'mock' ? 'Mock (no key, deterministic)' : 'Anthropic Claude'}
                </button>
              ))}
            </div>
          </Field>

          {st.provider === 'anthropic' && (
            <>
              <Field label="API key" hint="Kept in memory only — never saved to disk or storage. Reloading the page clears it. Requests go straight from your browser to api.anthropic.com.">
                <input type="password" autoComplete="off" className={input} placeholder="sk-ant-…" value={st.apiKey} onChange={(e) => set({ apiKey: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Model">
                  <select className={input} value={st.model} onChange={(e) => set({ model: e.target.value })}>
                    {MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Effort">
                  <select className={input} value={st.effort} onChange={(e) => set({ effort: e.target.value as S['effort'] })}>
                    {(['low', 'medium', 'high', 'xhigh', 'max'] as const).map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Engineers" hint={started ? 'Applies to the next project' : undefined}>
              <select className={input} value={st.engineers} onChange={(e) => set({ engineers: Number(e.target.value) as S['engineers'] })}>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Scheduling">
              <select className={input} value={st.mode} onChange={(e) => set({ mode: e.target.value as S['mode'] })}>
                <option value="parallel">Parallel lanes</option>
                <option value="serial">One agent per tick</option>
              </select>
            </Field>
            <Field label="Max turns" hint="Run pauses when hit">
              <input type="number" min={1} className={input} value={st.maxTurns} onChange={(e) => set({ maxTurns: Math.max(1, Number(e.target.value)) })} />
            </Field>
            <Field label="Max tokens" hint="Input + output, all agents">
              <input type="number" min={1000} step={10000} className={input} value={st.maxTokens} onChange={(e) => set({ maxTokens: Math.max(1000, Number(e.target.value)) })} />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
