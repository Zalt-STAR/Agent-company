import { useEffect, useRef, useState } from 'react';
import { useApp, useView } from '../store/studio';
import { buildHtml } from '../runtime/preview';
import { Empty } from './common';

interface LogLine {
  level: string;
  text: string;
}

export function Preview() {
  const { files, replaying } = useView();
  const report = useApp((s) => s.preview);
  const filesVersion = useApp((s) => s.filesVersion);
  const [html, setHtml] = useState<string>('');
  const [buildError, setBuildError] = useState<string>();
  const [building, setBuilding] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [nonce, setNonce] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const hasCode = Object.keys(files).some((p) => /\.(html|jsx?|tsx?)$/.test(p));

  useEffect(() => {
    if (!hasCode) return;
    let cancelled = false;
    setBuilding(true);
    const t = setTimeout(async () => {
      try {
        const { html, bundle } = await buildHtml(files);
        if (cancelled) return;
        setHtml(html);
        setBuildError(bundle.ok ? undefined : bundle.error);
        setLogs([]);
      } catch (e) {
        if (!cancelled) setBuildError(`Bundler failed: ${(e as Error).message}`);
      } finally {
        if (!cancelled) setBuilding(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [files, hasCode, nonce]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow || !e.data?.__studio) return;
      const { level, text } = e.data as LogLine;
      if (level === 'ready' || level === 'smoke') return;
      setLogs((l) => [...l.slice(-199), { level, text }]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!hasCode) return <Empty>Nothing to run yet — the preview appears once engineers commit code.</Empty>;

  const errors = logs.filter((l) => l.level === 'error').length;
  const openInTab = () => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2 text-xs">
        <span className={`h-2 w-2 rounded-full ${buildError || errors ? 'bg-red-500' : building ? 'bg-amber-400 pulse-dot' : 'bg-emerald-400'}`} />
        <span className="text-zinc-300">{building ? 'Building…' : buildError ? 'Build failed' : errors ? `${errors} console error${errors > 1 ? 's' : ''}` : 'Running'}</span>
        {replaying && <span className="rounded bg-sky-500/15 px-1.5 text-sky-300">replay snapshot</span>}
        {report && !replaying && (
          <span className="text-zinc-500">
            · last QA run: tick {report.tick}, {report.filesVersion === filesVersion ? 'current' : 'stale'},{' '}
            <span className={report.ok ? 'text-emerald-400' : 'text-rose-400'}>{report.ok ? 'clean' : `${report.errors.length || 1} issue(s)`}</span>
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <button type="button" className="rounded px-2 py-1 text-zinc-300 hover:bg-zinc-800" onClick={() => setNonce((n) => n + 1)}>
            ↻ Reload
          </button>
          <button type="button" className="rounded px-2 py-1 text-zinc-300 hover:bg-zinc-800" onClick={openInTab} disabled={!html}>
            ↗ Open
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-white">
        {html && <iframe ref={frameRef} key={nonce} title="Preview" sandbox="allow-scripts allow-modals" srcDoc={html} className="h-full w-full border-0" />}
      </div>
      <div className="scroll-thin h-36 shrink-0 overflow-y-auto border-t border-zinc-800 bg-zinc-950 font-mono text-[11px]">
        <div className="sticky top-0 flex items-center justify-between bg-zinc-950 px-3 py-1 text-zinc-500">
          <span>Console</span>
          <button type="button" className="hover:text-zinc-300" onClick={() => setLogs([])}>
            clear
          </button>
        </div>
        {buildError && <div className="px-3 py-0.5 text-rose-300">{buildError}</div>}
        {logs.map((l, i) => (
          <div key={i} className={`px-3 py-0.5 ${l.level === 'error' ? 'text-rose-300' : l.level === 'warn' ? 'text-amber-300' : 'text-zinc-400'}`}>
            {l.level === 'error' ? '✖ ' : l.level === 'warn' ? '⚠ ' : '› '}
            {l.text}
          </div>
        ))}
        {!logs.length && !buildError && <div className="px-3 text-zinc-600">No output.</div>}
      </div>
    </div>
  );
}
