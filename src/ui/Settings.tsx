import { useState } from 'react';
import { MODELS } from '../llm/provider';
import { LOCAL_PRESETS, RECOMMENDED_LOCAL_MODELS, listLocalModels } from '../llm/local';
import { appStore, setSettings, setUi, useApp } from '../store/studio';
import type { Settings as S } from '../types';

/** A labelled control. `group` renders a fieldset-like div for button groups, where a <label> would hijack the buttons' names. */
function Field({ label, hint, group, children }: { label: string; hint?: string; group?: boolean; children: React.ReactNode }) {
  const body = (
    <>
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </>
  );
  return group ? (
    <div role="group" aria-label={label} className="block">
      {body}
    </div>
  ) : (
    <label className="block">{body}</label>
  );
}

const input = 'w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500';

const PROVIDERS: { id: S['provider']; label: string; hint: string }[] = [
  { id: 'mock', label: 'Mock', hint: 'No key, deterministic demo' },
  { id: 'anthropic', label: 'Anthropic Claude', hint: 'Cloud, your API key' },
  { id: 'ollama', label: 'Local · Ollama', hint: 'Runs on your machine' },
  { id: 'openai-compatible', label: 'Local · OpenAI-compatible', hint: 'LM Studio, llama.cpp, vLLM' },
];

function choose(provider: S['provider']) {
  const st = appStore.getState().settings;
  const patch: Partial<S> = { provider };
  if (provider === 'ollama' || provider === 'openai-compatible') {
    const preset = LOCAL_PRESETS[provider];
    const other = LOCAL_PRESETS[provider === 'ollama' ? 'openai-compatible' : 'ollama'];
    if (st.provider !== provider && (st.localUrl === other.url || !st.localUrl)) {
      patch.localUrl = preset.url;
      patch.localModel = preset.model;
    }
    // A single local GPU serves one request at a time; parallel lanes would just queue.
    patch.mode = 'serial';
  }
  setSettings(patch);
}

function LocalSettings() {
  const st = useApp((s) => s.settings);
  const [check, setCheck] = useState<{ state: 'idle' | 'checking' | 'ok' | 'error'; models: string[]; error?: string }>({ state: 'idle', models: [] });
  const isOllama = st.provider === 'ollama';
  const installed = check.models.includes(st.localModel) || check.models.includes(`${st.localModel}:latest`);

  const test = async () => {
    setCheck({ state: 'checking', models: [] });
    try {
      setCheck({ state: 'ok', models: await listLocalModels(st) });
    } catch (e) {
      setCheck({ state: 'error', models: [], error: (e as Error).message });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 p-3">
      <Field label="Server URL" hint={isOllama ? 'Ollama default: http://localhost:11434' : 'LM Studio default: http://localhost:1234/v1 · llama.cpp: http://localhost:8080/v1'}>
        <input className={input} value={st.localUrl} onChange={(e) => setSettings({ localUrl: e.target.value })} spellCheck={false} />
      </Field>
      <Field label="Model">
        <input className={input} aria-label="Local model" list="local-models" value={st.localModel} onChange={(e) => setSettings({ localModel: e.target.value })} spellCheck={false} />
        <datalist id="local-models">
          {[...new Set([...check.models, ...RECOMMENDED_LOCAL_MODELS.map((m) => m.id)])].map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
      {isOllama && (
        <div className="space-y-1">
          {RECOMMENDED_LOCAL_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSettings({ localModel: m.id })}
              className={`flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-xs ${st.localModel === m.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900'}`}
            >
              <span className="w-28 shrink-0 font-mono">{m.id}</span>
              <span className="min-w-0 flex-1">{m.note}</span>
              <span className="shrink-0 text-zinc-500">{m.hw}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {isOllama && (
          <Field label="Context window">
            <select className={input} value={st.localContext} onChange={(e) => setSettings({ localContext: Number(e.target.value) })}>
              {[16384, 32768, 65536].map((n) => (
                <option key={n} value={n}>
                  {n / 1024}K tokens
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="flex items-end">
          <button type="button" onClick={test} className="w-full rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500">
            {check.state === 'checking' ? 'Checking…' : 'Test connection'}
          </button>
        </div>
      </div>
      {check.state === 'ok' && (
        <div className={`rounded-md p-2 text-xs ${installed ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200'}`}>
          {installed ? (
            <>✓ Connected — {st.localModel} is ready.</>
          ) : (
            <>
              Connected, but {st.localModel} isn't installed.{' '}
              {isOllama ? (
                <>
                  Run <code className="rounded bg-zinc-900 px-1">ollama pull {st.localModel}</code>
                </>
              ) : (
                'Load it in your server first.'
              )}
              {check.models.length > 0 && <>. Available: {check.models.slice(0, 6).join(', ')}</>}
            </>
          )}
        </div>
      )}
      {check.state === 'error' && <div className="rounded-md bg-red-500/10 p-2 text-xs text-red-300">{check.error}</div>}
      <p className="text-xs text-zinc-500">
        Output is constrained to the agents' JSON schema. Local runs are free but slower; scheduling switches to one agent per tick because one GPU serves one request at a time.
      </p>
    </div>
  );
}

export function SettingsModal() {
  const open = useApp((s) => s.ui.settingsOpen);
  const st = useApp((s) => s.settings);
  const started = useApp((s) => s.run.tick > 0);
  if (!open) return null;
  const set = (p: Partial<S>) => setSettings(p);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setUi({ settingsOpen: false })}>
      <div className="scroll-thin max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button type="button" className="text-zinc-500 hover:text-white" onClick={() => setUi({ settingsOpen: false })}>
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="LLM provider" group>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choose(p.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${st.provider === p.id ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
                >
                  <div className="font-medium">{p.label}</div>
                  <div className="text-xs text-zinc-500">{p.hint}</div>
                </button>
              ))}
            </div>
          </Field>

          {(st.provider === 'ollama' || st.provider === 'openai-compatible') && <LocalSettings />}

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
