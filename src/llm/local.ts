import { z } from 'zod';
import type { Settings } from '../types';
import { AgentResponseSchema } from '../agents/actions';
import type { LLMProvider, LLMRequest, LLMResponse } from './provider';

/**
 * Local models. Two server flavours:
 * - Ollama's native /api/chat, so we can set the context window (num_ctx) and constrain output to our JSON schema.
 * - Any OpenAI-compatible server (LM Studio, llama.cpp server, vLLM) via /chat/completions + response_format.
 */

export const RECOMMENDED_LOCAL_MODELS = [
  { id: 'qwen3-coder:30b', size: '19 GB', hw: '24 GB GPU or 32 GB Mac', note: 'Recommended — coding/agent-tuned MoE (3B active), fast, 256K context' },
  { id: 'qwen3.6:27b', size: '17 GB', hw: '24 GB GPU or 32 GB Mac', note: 'Dense agentic coder — stronger reasoning, slower per turn' },
  { id: 'devstral:24b', size: '14 GB', hw: '16–24 GB GPU', note: 'Mistral agentic coder, lighter footprint' },
  { id: 'gpt-oss:20b', size: '14 GB', hw: '16 GB RAM/VRAM', note: 'Best fit for 16 GB machines' },
];

export const LOCAL_PRESETS = {
  ollama: { url: 'http://localhost:11434', model: 'qwen3-coder:30b' },
  'openai-compatible': { url: 'http://localhost:1234/v1', model: 'qwen3-coder-30b-a3b-instruct' },
} as const;

const MAX_OUTPUT_TOKENS = 8192;
const TEMPERATURE = 0.2;

/** JSON schema for one agent reply, in the subset local grammar engines handle well (anyOf, no $schema/defaults). */
function responseJsonSchema(): Record<string, unknown> {
  const clean = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clean);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === '$schema' || k === 'default') continue;
      out[k === 'oneOf' ? 'anyOf' : k] = clean(v);
    }
    return out;
  };
  return clean(z.toJSONSchema(AgentResponseSchema, { io: 'input' })) as Record<string, unknown>;
}
let cachedSchema: Record<string, unknown> | undefined;
const schema = () => (cachedSchema ??= responseJsonSchema());

const trimSlash = (u: string) => u.trim().replace(/\/+$/, '');

async function post(url: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error(unreachable(url));
  }
}

function unreachable(url: string) {
  const origin = typeof location !== 'undefined' ? location.origin : 'this page';
  return `Can't reach the local model server at ${url}. Is it running (e.g. \`ollama serve\`)? If Studio isn't served from localhost, allow its origin: OLLAMA_ORIGINS="${origin}" ollama serve (LM Studio: enable CORS in the server settings).`;
}

async function failure(res: Response, model: string): Promise<Error> {
  const text = await res.text().catch(() => '');
  if (res.status === 404 && /not found|pull/i.test(text)) {
    return new Error(`Model "${model}" isn't installed on the local server. Run: ollama pull ${model}`);
  }
  return new Error(`Local server returned ${res.status}: ${text.slice(0, 300)}`);
}

// ── Ollama (native API) ─────────────────────────────────────────────────────

/** Output constraint modes, strongest first. We step down if a server rejects one. */
type FormatMode = 'schema' | 'json' | 'none';
const formatMode = new Map<string, FormatMode>();
const weaker = (m: FormatMode): FormatMode | undefined => (m === 'schema' ? 'json' : m === 'json' ? 'none' : undefined);

export function createOllamaProvider(settings: Settings): LLMProvider {
  const base = trimSlash(settings.localUrl);
  const model = settings.localModel.trim();
  const key = `ollama|${base}|${model}`;

  return {
    name: `ollama:${model}`,
    async complete(req: LLMRequest): Promise<LLMResponse> {
      for (;;) {
        const mode = formatMode.get(key) ?? 'schema';
        const res = await post(
          `${base}/api/chat`,
          {
            model,
            stream: false,
            keep_alive: '30m',
            messages: [{ role: 'system', content: req.system }, ...req.messages],
            ...(mode === 'schema' ? { format: schema() } : mode === 'json' ? { format: 'json' } : {}),
            options: { num_ctx: settings.localContext, num_predict: MAX_OUTPUT_TOKENS, temperature: TEMPERATURE },
          },
          req.signal,
        );
        if (!res.ok) {
          const err = await failure(res, model);
          const next = weaker(mode);
          // Older servers or some model templates reject schema-constrained output; fall back rather than fail the run.
          if (next && (res.status === 400 || res.status === 500) && !/isn't installed/.test(err.message)) {
            formatMode.set(key, next);
            continue;
          }
          throw err;
        }
        const data = (await res.json()) as {
          message?: { content?: string; thinking?: string };
          prompt_eval_count?: number;
          eval_count?: number;
          done_reason?: string;
        };
        let text = data.message?.content ?? '';
        if (data.done_reason === 'length') text += '\n/* response truncated: hit the output token limit */';
        return {
          text,
          reasoning: data.message?.thinking || undefined,
          usage: { input: data.prompt_eval_count ?? 0, output: data.eval_count ?? 0 },
        };
      }
    },
  };
}

// ── OpenAI-compatible (LM Studio, llama.cpp, vLLM) ──────────────────────────

export function createOpenAICompatibleProvider(settings: Settings): LLMProvider {
  const base = trimSlash(settings.localUrl);
  const model = settings.localModel.trim();
  const key = `oai|${base}|${model}`;

  return {
    name: `local:${model}`,
    async complete(req: LLMRequest): Promise<LLMResponse> {
      for (;;) {
        const mode = formatMode.get(key) ?? 'schema';
        const response_format =
          mode === 'schema'
            ? { type: 'json_schema', json_schema: { name: 'agent_response', schema: schema(), strict: false } }
            : mode === 'json'
              ? { type: 'json_object' }
              : undefined;
        const res = await post(
          `${base}/chat/completions`,
          {
            model,
            messages: [{ role: 'system', content: req.system }, ...req.messages],
            temperature: TEMPERATURE,
            max_tokens: MAX_OUTPUT_TOKENS,
            stream: false,
            ...(response_format ? { response_format } : {}),
          },
          req.signal,
        );
        if (!res.ok) {
          const err = await failure(res, model);
          const next = weaker(mode);
          if (next && (res.status === 400 || res.status === 422 || res.status === 500)) {
            formatMode.set(key, next);
            continue;
          }
          throw err;
        }
        const data = (await res.json()) as {
          choices?: { message?: { content?: string; reasoning_content?: string; reasoning?: string }; finish_reason?: string }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const choice = data.choices?.[0];
        let text = choice?.message?.content ?? '';
        if (choice?.finish_reason === 'length') text += '\n/* response truncated: hit the output token limit */';
        return {
          text,
          reasoning: choice?.message?.reasoning_content || choice?.message?.reasoning || undefined,
          usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
        };
      }
    },
  };
}

/** List models installed on the local server (used by Settings → Test connection). */
export async function listLocalModels(settings: Pick<Settings, 'provider' | 'localUrl'>): Promise<string[]> {
  const base = trimSlash(settings.localUrl);
  const url = settings.provider === 'ollama' ? `${base}/api/tags` : `${base}/models`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(unreachable(base));
  }
  if (!res.ok) throw new Error(`Local server returned ${res.status} for ${url}`);
  const data = (await res.json()) as { models?: { name: string }[]; data?: { id: string }[] };
  return settings.provider === 'ollama' ? (data.models ?? []).map((m) => m.name) : (data.data ?? []).map((m) => m.id);
}
