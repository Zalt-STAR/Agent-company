import { useState } from 'react';
import { appStore, setSettings, setUi, useApp } from '../store/studio';
import { scheduler } from './runtime';
import { Button } from './common';
import { exportZip } from '../export';
import { providerLabel } from '../llm/provider';

const STATUS_PILL: Record<string, string> = {
  idle: 'bg-zinc-800 text-zinc-300',
  running: 'bg-emerald-500/15 text-emerald-300',
  paused: 'bg-zinc-800 text-zinc-300',
  waiting_user: 'bg-sky-500/15 text-sky-300',
  shipped: 'bg-amber-400/15 text-amber-300',
};

function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  return (
    <div className="w-28" title={`${label}: ${value.toLocaleString()} / ${max.toLocaleString()}`}>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-zinc-500">
        <span>{label}</span>
        <span className="tabular-nums">{value >= 10000 ? `${Math.round(value / 1000)}k` : value}</span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded bg-zinc-800">
        <div className={`h-full ${pct > 85 ? 'bg-red-400' : 'bg-zinc-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Header() {
  const run = useApp((s) => s.run);
  const settings = useApp((s) => s.settings);
  const title = useApp((s) => s.spec?.title ?? s.brief);
  const hasBrief = useApp((s) => !!s.brief);
  const [exporting, setExporting] = useState(false);
  const running = run.status === 'running';

  const doExport = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await exportZip(appStore.getState());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-amber-400 text-sm font-black text-zinc-950">S</span>
        <span className="font-semibold tracking-tight">Studio</span>
      </div>
      <div className="mx-2 h-6 w-px bg-zinc-800" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-100">{title}</div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className={`rounded px-1.5 py-px font-medium ${STATUS_PILL[run.status]}`}>{run.status.replace('_', ' ')}</span>
          <span className="tabular-nums">tick {run.tick}</span>
          <span>· {providerLabel(settings)}</span>
          {run.pauseReason && <span className="truncate text-amber-300/80">· {run.pauseReason}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {running ? (
          <Button variant="outline" onClick={() => scheduler.pause('Paused by you')} title="Pause after the current tick">
            ⏸ Pause
          </Button>
        ) : (
          <Button variant="primary" onClick={() => scheduler.start()} disabled={!hasBrief || run.status === 'shipped' || run.status === 'waiting_user'}>
            ▶ Start
          </Button>
        )}
        <Button variant="outline" onClick={() => scheduler.step()} disabled={!hasBrief || running || run.busy || run.status === 'shipped'} title="Run exactly one tick">
          ⏭ Step
        </Button>
        <select
          className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-1.5 text-sm text-zinc-200"
          value={settings.speed}
          onChange={(e) => setSettings({ speed: Number(e.target.value) })}
          title="Speed"
        >
          {[0.5, 1, 2, 4].map((x) => (
            <option key={x} value={x}>
              {x}×
            </option>
          ))}
        </select>
      </div>

      <div className="hidden items-center gap-3 lg:flex">
        <Meter label="turns" value={run.turnsUsed} max={settings.maxTurns} />
        <Meter label="tokens" value={run.tokensUsed} max={settings.maxTokens} />
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" onClick={doExport} disabled={!hasBrief || exporting} title="Download the project as a zip">
          ⬇ {exporting ? 'Zipping…' : 'Export'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => scheduler.closeProject()}
          title="Start a new project"
        >
          ＋ New
        </Button>
        <Button variant="ghost" onClick={() => setUi({ settingsOpen: true })} title="Settings">
          ⚙
        </Button>
      </div>
    </header>
  );
}
