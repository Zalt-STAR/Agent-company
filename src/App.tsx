import type { Tab } from './store/studio';
import { setUi, useApp } from './store/studio';
import { Header } from './ui/Header';
import { Roster } from './ui/Roster';
import { Board } from './ui/Board';
import { Channel } from './ui/Channel';
import { Files } from './ui/Files';
import { Preview } from './ui/Preview';
import { Inspector } from './ui/Inspector';
import { Timeline } from './ui/Timeline';
import { QuestionCard } from './ui/QuestionCard';
import { SettingsModal } from './ui/Settings';
import { FirstRun } from './ui/FirstRun';
import { scheduler } from './ui/runtime';

const TABS: { id: Tab; label: string }[] = [
  { id: 'board', label: 'Board' },
  { id: 'channel', label: 'Channel' },
  { id: 'files', label: 'Files' },
  { id: 'preview', label: 'Preview' },
];

function TabBadge({ tab }: { tab: Tab }) {
  const n = useApp((s) =>
    tab === 'board' ? s.tickets.filter((t) => t.column !== 'done').length : tab === 'channel' ? s.messages.length : tab === 'files' ? s.commits.length : 0,
  );
  const previewBad = useApp((s) => tab === 'preview' && s.preview && !s.preview.ok);
  if (previewBad) return <span className="h-1.5 w-1.5 rounded-full bg-red-500" />;
  if (!n) return null;
  return <span className="rounded bg-zinc-800 px-1.5 text-[11px] text-zinc-400">{n}</span>;
}

function ShipBanner() {
  const shipped = useApp((s) => s.run.status === 'shipped');
  const note = useApp((s) => s.shippedNote);
  const title = useApp((s) => s.spec?.title);
  if (!shipped) return null;
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
      <span className="text-2xl">🚀</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-emerald-200">{title} shipped</div>
        {note && <div className="truncate text-xs text-emerald-200/70">{note}</div>}
      </div>
      <button type="button" className="rounded-md bg-emerald-400 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-300" onClick={() => setUi({ tab: 'preview', replayIndex: null })}>
        Play it
      </button>
    </div>
  );
}

function ReplayBanner() {
  const event = useApp((s) => (s.ui.replayIndex === null ? undefined : s.timeline[s.ui.replayIndex]));
  if (!event) return null;
  return (
    <div className="flex items-center gap-2 border-b border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-xs text-sky-200">
      ⟲ Viewing the project as of tick {event.tick}: <span className="truncate">{event.label}</span>
      <button type="button" className="ml-auto underline" onClick={() => setUi({ replayIndex: null })}>
        Back to live
      </button>
    </div>
  );
}

export default function App() {
  const hasBrief = useApp((s) => !!s.brief);
  const tab = useApp((s) => s.ui.tab);

  return (
    <div className="flex h-full flex-col">
      {hasBrief ? (
        <>
          <Header />
          <div className="flex min-h-0 flex-1">
            <Roster />
            <main className="flex min-w-0 flex-1 flex-col">
              <QuestionCard />
              <ShipBanner />
              <nav className="mt-2 flex gap-1 border-b border-zinc-800 px-4">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setUi({ tab: t.id })}
                    className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${tab === t.id ? 'border-amber-400 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
                  >
                    {t.label}
                    <TabBadge tab={t.id} />
                  </button>
                ))}
              </nav>
              <ReplayBanner />
              <div className="min-h-0 flex-1">
                {tab === 'board' && <Board />}
                {tab === 'channel' && <Channel />}
                {tab === 'files' && <Files />}
                {tab === 'preview' && <Preview />}
              </div>
            </main>
            <Inspector />
          </div>
          <Timeline />
        </>
      ) : (
        <FirstRun />
      )}
      <SettingsModal />
    </div>
  );
}

// Expose for debugging in the browser console.
(window as unknown as { studio: typeof scheduler }).studio = scheduler;
