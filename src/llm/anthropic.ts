import Anthropic from '@anthropic-ai/sdk';
import type { Settings } from '../types';
import type { LLMProvider, LLMRequest, LLMResponse } from './provider';

// Models that accept adaptive thinking with summarized display.
const ADAPTIVE = new Set(['claude-opus-5', 'claude-sonnet-5', 'claude-fable-5-1']);
// Models where we opt in to server-side refusal fallbacks.
const FALLBACKS = new Set(['claude-opus-5', 'claude-fable-5-1']);

export function createAnthropicProvider(settings: Settings): LLMProvider {
  // The key lives only in memory (Zustand state); it is never persisted.
  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
  const model = settings.model;

  return {
    name: `anthropic:${model}`,
    async complete(req: LLMRequest): Promise<LLMResponse> {
      const params: Record<string, unknown> = {
        model,
        max_tokens: 16000,
        // Stable role prompt first so it caches across turns.
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        messages: req.messages,
      };
      if (ADAPTIVE.has(model)) {
        params.thinking = { type: 'adaptive', display: 'summarized' };
        params.output_config = { effort: settings.effort };
      }

      const stream = FALLBACKS.has(model)
        ? client.beta.messages.stream(
            { ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as unknown as Parameters<
              typeof client.beta.messages.stream
            >[0],
            { signal: req.signal },
          )
        : client.messages.stream(params as unknown as Parameters<typeof client.messages.stream>[0], { signal: req.signal });

      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') throw new Error('The model declined this request (stop_reason: refusal).');

      let text = '';
      let reasoning = '';
      for (const block of msg.content as { type: string; text?: string; thinking?: string }[]) {
        if (block.type === 'text' && block.text) text += block.text;
        if (block.type === 'thinking' && block.thinking) reasoning += block.thinking;
      }
      if (msg.stop_reason === 'max_tokens') text += '\n/* response truncated at max_tokens */';
      const u = msg.usage as { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };
      return {
        text,
        reasoning: reasoning || undefined,
        usage: {
          input: u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
          output: u.output_tokens,
        },
      };
    },
  };
}
