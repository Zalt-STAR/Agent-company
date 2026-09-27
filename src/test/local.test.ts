import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOllamaProvider, createOpenAICompatibleProvider, listLocalModels } from '../llm/local';
import { DEFAULT_SETTINGS, initialStudio } from '../store/studio';
import type { LLMRequest } from '../llm/provider';

const state = { ...initialStudio('x', 1), settings: DEFAULT_SETTINGS };
const req: LLMRequest = { system: 'sys', messages: [{ role: 'user', content: 'ctx' }], meta: { agent: state.agents[0], state, attempt: 0 } };
const reply = '{"reasoning":"r","action":{"type":"noop"},"message":null}';

function stubFetch(handler: (url: string, body: Record<string, unknown>) => Response) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ url, body });
    return handler(url, body);
  });
  return calls;
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

afterEach(() => vi.unstubAllGlobals());

describe('Ollama provider', () => {
  it('sends system + messages, num_ctx and the JSON schema; reads content, thinking and usage', async () => {
    const calls = stubFetch(() => json({ message: { content: reply, thinking: 'hmm' }, prompt_eval_count: 120, eval_count: 30, done_reason: 'stop' }));
    const p = createOllamaProvider({ ...DEFAULT_SETTINGS, provider: 'ollama', localUrl: 'http://localhost:11434/', localModel: 'qwen3-coder:30b' });
    const res = await p.complete(req);
    expect(calls[0].url).toBe('http://localhost:11434/api/chat');
    expect(calls[0].body).toMatchObject({ model: 'qwen3-coder:30b', stream: false, options: { num_ctx: 32768 } });
    expect((calls[0].body.messages as { role: string }[]).map((m) => m.role)).toEqual(['system', 'user']);
    const format = calls[0].body.format as Record<string, unknown>;
    expect(JSON.stringify(format)).toContain('"anyOf"');
    expect(JSON.stringify(format)).not.toContain('$schema');
    expect(res).toEqual({ text: reply, reasoning: 'hmm', usage: { input: 120, output: 30 } });
  });

  it('falls back to plain JSON mode when the server rejects the schema', async () => {
    const calls = stubFetch((_u, body) => (typeof body.format === 'object' ? json({ error: 'invalid format' }, 400) : json({ message: { content: reply } })));
    const p = createOllamaProvider({ ...DEFAULT_SETTINGS, provider: 'ollama', localModel: 'fallback-model' });
    expect((await p.complete(req)).text).toBe(reply);
    expect(calls.map((c) => c.body.format === 'json')).toEqual([false, true]);
  });

  it('explains how to pull a missing model', async () => {
    stubFetch(() => json({ error: "model 'qwen3-coder:30b' not found" }, 404));
    const p = createOllamaProvider({ ...DEFAULT_SETTINGS, provider: 'ollama' });
    await expect(p.complete(req)).rejects.toThrow('ollama pull qwen3-coder:30b');
  });

  it('explains how to start the server when unreachable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    const p = createOllamaProvider({ ...DEFAULT_SETTINGS, provider: 'ollama' });
    await expect(p.complete(req)).rejects.toThrow(/ollama serve/);
  });

  it('lists installed models', async () => {
    stubFetch(() => json({ models: [{ name: 'qwen3-coder:30b' }] }));
    expect(await listLocalModels({ provider: 'ollama', localUrl: 'http://localhost:11434' })).toEqual(['qwen3-coder:30b']);
  });
});

describe('OpenAI-compatible provider', () => {
  it('uses /chat/completions with a json_schema response_format', async () => {
    const calls = stubFetch(() => json({ choices: [{ message: { content: reply }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    const p = createOpenAICompatibleProvider({ ...DEFAULT_SETTINGS, provider: 'openai-compatible', localUrl: 'http://localhost:1234/v1', localModel: 'm' });
    const res = await p.complete(req);
    expect(calls[0].url).toBe('http://localhost:1234/v1/chat/completions');
    expect(calls[0].body.response_format).toMatchObject({ type: 'json_schema' });
    expect(res.usage).toEqual({ input: 10, output: 5 });
  });

  it('marks truncated output', async () => {
    stubFetch(() => json({ choices: [{ message: { content: '{"a":' }, finish_reason: 'length' }] }));
    const p = createOpenAICompatibleProvider({ ...DEFAULT_SETTINGS, provider: 'openai-compatible', localModel: 'm2' });
    expect((await p.complete(req)).text).toContain('truncated');
  });
});
