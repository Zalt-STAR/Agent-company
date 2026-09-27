import { diffLines } from 'diff';
import type { FileChange } from '../types';

export function DiffView({ change }: { change: FileChange }) {
  const parts = diffLines(change.before ?? '', change.after ?? '');
  let oldNo = 1;
  let newNo = 1;
  const rows: { kind: 'add' | 'del' | 'ctx' | 'skip'; text: string; a?: number; b?: number }[] = [];
  parts.forEach((p, i) => {
    const lines = p.value.replace(/\n$/, '').split('\n');
    if (p.added) lines.forEach((l) => rows.push({ kind: 'add', text: l, b: newNo++ }));
    else if (p.removed) lines.forEach((l) => rows.push({ kind: 'del', text: l, a: oldNo++ }));
    else {
      // Collapse long unchanged runs to 3 lines of context on each side.
      const keepHead = i === 0 ? 0 : 3;
      const keepTail = i === parts.length - 1 ? 0 : 3;
      if (lines.length > keepHead + keepTail + 2) {
        lines.slice(0, keepHead).forEach((l) => rows.push({ kind: 'ctx', text: l, a: oldNo++, b: newNo++ }));
        const skipped = lines.length - keepHead - keepTail;
        rows.push({ kind: 'skip', text: `… ${skipped} unchanged lines …` });
        oldNo += skipped;
        newNo += skipped;
        lines.slice(lines.length - keepTail).forEach((l) => rows.push({ kind: 'ctx', text: l, a: oldNo++, b: newNo++ }));
      } else lines.forEach((l) => rows.push({ kind: 'ctx', text: l, a: oldNo++, b: newNo++ }));
    }
  });
  const status = change.before === null ? 'added' : change.after === null ? 'deleted' : 'modified';
  const adds = rows.filter((r) => r.kind === 'add').length;
  const dels = rows.filter((r) => r.kind === 'del').length;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs">
        <span className="font-mono text-zinc-200">{change.path}</span>
        <span className="text-zinc-500">{status}</span>
        <span className="ml-auto text-emerald-400">+{adds}</span>
        <span className="text-rose-400">−{dels}</span>
      </div>
      <pre className="scroll-thin overflow-x-auto font-mono text-[12px] leading-5">
        {rows.map((r, i) => (
          <div
            key={i}
            className={
              r.kind === 'add' ? 'bg-emerald-500/10 text-emerald-100' : r.kind === 'del' ? 'bg-rose-500/10 text-rose-200' : r.kind === 'skip' ? 'bg-zinc-900 text-center text-zinc-500' : 'text-zinc-400'
            }
          >
            {r.kind !== 'skip' && (
              <span className="inline-block w-16 select-none pr-2 text-right text-zinc-600">
                {r.a ?? ''} {r.b ?? ''}
              </span>
            )}
            <span className="select-none pr-1 text-zinc-600">{r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' '}</span>
            {r.text}
          </div>
        ))}
      </pre>
    </div>
  );
}
