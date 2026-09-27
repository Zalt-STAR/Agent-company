import { setUi, useApp, useView } from '../store/studio';
import { Avatar, Empty, RichText } from './common';
import { DiffView } from './Diff';

function CommitAuthor({ id }: { id: string }) {
  const agent = useApp((s) => s.agents.find((a) => a.id === id));
  return agent ? <Avatar agent={agent} size="sm" /> : null;
}

export function Files() {
  const { files, locks } = useView();
  const commits = useApp((s) => s.commits);
  const selectedFile = useApp((s) => s.ui.selectedFile);
  const selectedCommitId = useApp((s) => s.ui.selectedCommitId);
  const agents = useApp((s) => s.agents);
  const paths = Object.keys(files).sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  const commit = commits.find((c) => c.id === selectedCommitId);
  const file = selectedFile && files[selectedFile] !== undefined ? selectedFile : undefined;

  if (!paths.length && !commits.length) return <Empty>No files yet. The first commit lands after the spec is written.</Empty>;

  return (
    <div className="flex h-full min-h-0">
      <div className="scroll-thin flex w-64 shrink-0 flex-col overflow-y-auto border-r border-zinc-800">
        <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Files</div>
        {paths.map((p) => {
          const lock = locks[p];
          const holder = lock && agents.find((a) => a.id === lock.agentId);
          return (
            <button
              key={p}
              type="button"
              onClick={() => setUi({ selectedFile: p, selectedCommitId: undefined })}
              className={`flex items-center gap-2 px-3 py-1 text-left font-mono text-xs ${file === p && !commit ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-900'}`}
            >
              <span className="truncate">{p}</span>
              {holder && (
                <span className="ml-auto shrink-0 text-amber-300" title={`Locked by ${holder.name} (${lock.ticketId})`}>
                  🔒{holder.avatar}
                </span>
              )}
            </button>
          );
        })}
        <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Commits ({commits.length})</div>
        {[...commits].reverse().map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setUi({ selectedCommitId: c.id, selectedFile: undefined })}
            className={`flex items-start gap-2 px-3 py-1.5 text-left text-xs ${commit?.id === c.id ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}
          >
            <CommitAuthor id={c.author} />
            <span className="min-w-0">
              <span className="block truncate text-zinc-200">{c.note}</span>
              <span className="text-zinc-500">
                {c.id} · t{c.tick}
                {c.ticketId ? ` · ${c.ticketId}` : ''} · {c.changes.length} file{c.changes.length === 1 ? '' : 's'}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="scroll-thin min-w-0 flex-1 overflow-auto p-4">
        {commit ? (
          <div className="space-y-4">
            <div>
              <div className="font-mono text-xs text-zinc-500">
                {commit.id} · tick {commit.tick} · {agents.find((a) => a.id === commit.author)?.name}
                {commit.ticketId ? ` · ${commit.ticketId}` : ''}
              </div>
              <div className="mt-1 text-base text-zinc-100">
                <RichText text={commit.note} />
              </div>
            </div>
            {commit.changes.length ? commit.changes.map((ch) => <DiffView key={ch.path} change={ch} />) : <div className="text-sm text-zinc-500">No file changes in this commit.</div>}
          </div>
        ) : file ? (
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <div className="border-b border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-300">{file}</div>
            <pre className="scroll-thin overflow-x-auto p-0 font-mono text-[12px] leading-5 text-zinc-300">
              {files[file].split('\n').map((line, i) => (
                <div key={i}>
                  <span className="inline-block w-10 select-none pr-3 text-right text-zinc-600">{i + 1}</span>
                  {line}
                </div>
              ))}
            </pre>
          </div>
        ) : (
          <Empty>Select a file to view it, or a commit to see its diff.</Empty>
        )}
      </div>
    </div>
  );
}
