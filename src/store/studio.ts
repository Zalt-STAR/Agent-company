import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Settings, StudioState } from '../types';
import { createTeam } from '../agents/roles';

export type Tab = 'board' | 'channel' | 'files' | 'preview';

export interface UiState {
  selectedAgentId: string;
  tab: Tab;
  /** Index into the timeline when replaying; null = live. */
  replayIndex: number | null;
  selectedCommitId?: string;
  selectedFile?: string;
  selectedTicketId?: string;
  settingsOpen: boolean;
}

export interface AppState extends StudioState {
  settings: Settings;
  ui: UiState;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'mock',
  apiKey: '',
  model: 'claude-opus-5',
  localUrl: 'http://localhost:11434',
  localModel: 'qwen3-coder:30b',
  localContext: 32768,
  effort: 'high',
  engineers: 2,
  mode: 'parallel',
  speed: 1,
  maxTurns: 150,
  maxTokens: 2_000_000,
};

export function initialStudio(brief: string, engineers: number): StudioState {
  return {
    brief,
    agents: createTeam(engineers),
    tickets: [],
    messages: [],
    files: {},
    filesVersion: 0,
    locks: {},
    commits: [],
    timeline: [],
    questions: [],
    run: { status: 'idle', tick: 0, turnsUsed: 0, tokensUsed: 0, busy: false },
    nextTicket: 1,
    nextMessage: 1,
    nextEvent: 1,
  };
}

export function createAppStore(settings: Partial<Settings> = {}) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  return createStore<AppState>()(() => ({
    ...initialStudio('', s.engineers),
    settings: s,
    ui: { selectedAgentId: 'producer', tab: 'board', replayIndex: null, settingsOpen: false },
  }));
}

export type AppStore = ReturnType<typeof createAppStore>;

/** The app-wide store instance used by the UI. Tests create their own with createAppStore(). */
export const appStore = createAppStore();

export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(appStore, selector);
}

export function setUi(patch: Partial<UiState>) {
  appStore.setState((s) => ({ ui: { ...s.ui, ...patch } }));
}

export function setSettings(patch: Partial<Settings>) {
  appStore.setState((s) => ({ settings: { ...s.settings, ...patch } }));
}

/** The board/files view: a timeline snapshot while replaying, otherwise live state. */
export function useView() {
  const replayIndex = useApp((s) => s.ui.replayIndex);
  const event = useApp((s) => (replayIndex === null ? undefined : s.timeline[replayIndex]));
  const files = useApp((s) => s.files);
  const tickets = useApp((s) => s.tickets);
  const locks = useApp((s) => s.locks);
  if (event) return { ...event.snapshot, replaying: true, event };
  return { files, tickets, locks, replaying: false, event: undefined };
}
