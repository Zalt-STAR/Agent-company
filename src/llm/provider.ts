import type { Agent, Settings, StudioState } from '../types';
import { createAnthropicProvider } from './anthropic';
import { createMockProvider } from './mock';

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  system: string;
  messages: LLMMessage[];
  /** Structured view of the turn. Real providers ignore it; the mock provider uses it to act deterministically. */
  meta: { agent: Agent; state: StudioState; attempt: number };
  signal?: AbortSignal;
}

export interface LLMResponse {
  text: string;
  usage: { input: number; output: number };
  /** Optional model-provided reasoning summary (e.g. summarized thinking). */
  reasoning?: string;
}

export interface LLMProvider {
  name: string;
  complete(req: LLMRequest): Promise<LLMResponse>;
}

export const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 (default)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
];

/** The single entry point every agent uses to reach an LLM. */
export function getProvider(settings: Settings): LLMProvider {
  if (settings.provider === 'anthropic') {
    if (!settings.apiKey) throw new Error('No API key set. Open Settings to add one, or switch to the mock provider.');
    return createAnthropicProvider(settings);
  }
  return createMockProvider(settings);
}

export const estimateTokens = (s: string) => Math.ceil(s.length / 4);
