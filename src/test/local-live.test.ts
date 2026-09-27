// Live check against a running local server. Skipped unless LOCAL_LLM_URL is set, e.g.
//   LOCAL_LLM_URL=http://localhost:11434 LOCAL_LLM_MODEL=qwen3-coder:30b npx vitest run src/test/local-live.test.ts
import { describe, expect, it } from 'vitest';
import { createOllamaProvider } from '../llm/local';
import { buildContext } from '../agents/context';
import { parseAgentResponse } from '../agents/actions';
import { applyAction } from '../engine/apply';
import { createAppStore } from '../store/studio';
import { Tx } from '../engine/tx';

const url = process.env.LOCAL_LLM_URL;

describe.skipIf(!url)('local model (live)', () => {
  it('Producer turn returns a schema-valid spec the board accepts', async () => {
    const store = createAppStore({ provider: 'ollama', localUrl: url!, localModel: process.env.LOCAL_LLM_MODEL ?? 'qwen3-coder:30b' });
    const tx = new Tx({ ...store.getState(), brief: 'A Pomodoro timer' });
    tx.message('user', 'A Pomodoro timer', ['producer']);
    const s = { ...store.getState(), ...tx.done() };
    const agent = s.agents[0];
    const { system, user } = buildContext(s, agent);
    const provider = createOllamaProvider(s.settings);
    const res = await provider.complete({ system, messages: [{ role: 'user', content: user }], meta: { agent, state: s, attempt: 0 } });
    console.log(res.usage, res.text.slice(0, 1500));
    const parsed = parseAgentResponse(res.text);
    expect(parsed.ok, parsed.ok ? '' : parsed.error).toBe(true);
    if (parsed.ok) {
      const applied = applyAction(s, 'producer', parsed.value);
      console.log('board:', applied.ok ? applied.summary : applied.error);
    }
  }, 600_000);
});
