// Core domain types for the Studio agent company.

export type Role = 'producer' | 'designer' | 'engineer' | 'qa' | 'reviewer';

export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'planning'
  | 'designing'
  | 'coding'
  | 'reviewing'
  | 'testing'
  | 'waiting'
  | 'error';

export interface TurnRecord {
  tick: number;
  system: string;
  prompt: string;
  raw: string;
  reasoning: string;
  modelReasoning?: string;
  actionSummary: string;
  attempts: number;
  error?: string;
  tokens: number;
}

export interface Agent {
  id: string;
  role: Role;
  name: string;
  title: string;
  avatar: string;
  color: string;
  status: AgentStatus;
  activity: string;
  memory: string[];
  lastReadMessageId: number;
  lastTurn?: TurnRecord;
  turns: number;
  tokens: number;
}

export type Column = 'backlog' | 'in_progress' | 'review' | 'qa' | 'done';

export const COLUMNS: { id: Column; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'qa', label: 'QA' },
  { id: 'done', label: 'Done' },
];

export interface BugReport {
  tick: number;
  by: string;
  title: string;
  steps: string[];
  expected: string;
  actual: string;
}

export interface ReviewNote {
  tick: number;
  by: string;
  verdict: 'approve' | 'request_changes';
  comments: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  acceptance: string[];
  column: Column;
  priority: 1 | 2 | 3;
  kind: 'feature' | 'bug';
  assignee?: string;
  files: string[];
  dependsOn: string[];
  qaFails: number;
  reviewRejections: number;
  bugs: BugReport[];
  reviews: ReviewNote[];
  commits: string[];
  needsProducer: boolean;
  createdBy: string;
  createdTick: number;
  /** Template key used by the mock provider to look up canned work. */
  templateKey?: string;
}

export interface Message {
  id: number;
  tick: number;
  from: string; // agent id, 'user' or 'system'
  text: string;
  mentions: string[];
  ticketId?: string;
}

export interface FileChange {
  path: string;
  before: string | null;
  after: string | null;
}

export interface Commit {
  id: string;
  tick: number;
  author: string;
  ticketId?: string;
  note: string;
  changes: FileChange[];
}

export type FileMap = Record<string, string>;
export type LockMap = Record<string, { agentId: string; ticketId: string }>;

export interface Snapshot {
  files: FileMap;
  tickets: Ticket[];
  locks: LockMap;
}

export type TimelineKind = 'spec' | 'design' | 'create' | 'move' | 'commit' | 'question' | 'ship' | 'note';

export interface TimelineEvent {
  id: number;
  tick: number;
  kind: TimelineKind;
  label: string;
  actor: string;
  commitId?: string;
  snapshot: Snapshot;
}

export interface Question {
  id: string;
  tick: number;
  from: string;
  text: string;
  options: string[];
  answer?: string;
  consumed?: boolean;
}

export interface Spec {
  title: string;
  summary: string;
  kind: 'app' | 'game';
  stack: 'vanilla' | 'react';
  features: string[];
  outOfScope: string[];
  templateId?: string;
}

export interface Design {
  summary: string;
  screens: string[];
  flow: string[];
  palette: Record<string, string>;
  typography: string;
  spacing: string;
  coreLoop?: string;
  controls?: string;
  artDirection?: string;
}

export interface PreviewReport {
  filesVersion: number;
  tick: number;
  ok: boolean;
  buildError?: string;
  errors: string[];
  warnings: string[];
  logs: string[];
}

export type RunStatus = 'idle' | 'running' | 'paused' | 'waiting_user' | 'shipped';

export interface RunState {
  status: RunStatus;
  tick: number;
  turnsUsed: number;
  tokensUsed: number;
  pauseReason?: string;
  busy: boolean;
}

export type ProviderKind = 'mock' | 'anthropic' | 'ollama' | 'openai-compatible';

export interface Settings {
  provider: ProviderKind;
  apiKey: string;
  model: string;
  /** Base URL of the local model server (Ollama: http://localhost:11434, LM Studio: http://localhost:1234/v1). */
  localUrl: string;
  localModel: string;
  /** Context window to request from the local server (Ollama num_ctx). */
  localContext: number;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  engineers: 1 | 2 | 3;
  mode: 'serial' | 'parallel';
  speed: number;
  maxTurns: number;
  maxTokens: number;
}

export interface StudioState {
  brief: string;
  spec?: Spec;
  design?: Design;
  agents: Agent[];
  tickets: Ticket[];
  messages: Message[];
  files: FileMap;
  filesVersion: number;
  locks: LockMap;
  commits: Commit[];
  timeline: TimelineEvent[];
  questions: Question[];
  preview?: PreviewReport;
  run: RunState;
  nextTicket: number;
  nextMessage: number;
  nextEvent: number;
  shippedNote?: string;
}
