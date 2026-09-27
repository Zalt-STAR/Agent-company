# Studio — an AI agent company

Give Studio a one-line brief ("A Snake game", "A habit tracker") and a small company of AI agents builds it while you watch: the **Producer** scopes it into tickets, the **Designer** sets the UX and tokens, **Engineers** write the code, the **Reviewer** reads the diffs, **QA** runs the app, and the Producer ships it. The result runs live in a sandboxed preview and can be exported as a zip.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine rules + full mock runs (generated apps executed under jsdom)
npm run build && npm run e2e -- "A Snake game"   # real-browser smoke test (Playwright)
```

With no API key or local model, Studio uses a **deterministic mock LLM**, so the whole loop runs offline. To use Claude, open **Settings → Anthropic Claude** and paste a key. The key lives only in memory: it is never persisted, and reloading the page clears it. Requests go straight from the browser to `api.anthropic.com`.

## Run it on a local model

Studio can run entirely on your machine through [Ollama](https://ollama.com) (or any OpenAI-compatible server: LM Studio, llama.cpp, vLLM).

```bash
ollama pull qwen3-coder:30b
ollama serve            # usually already running
npm run dev             # then Settings → Local · Ollama → Test connection
```

**Recommended model: `qwen3-coder:30b`.** It is tuned for coding and agentic work, and it is a Mixture-of-Experts model with only ~3B parameters active per token. That makes it fast, which matters because a run makes 30–40 calls. It has a 256K context, fits a 24 GB GPU or a 32 GB Mac (~19 GB download), and is the most common pick for local coding agents. Alternatives:

| Model | Download | Hardware | When |
| --- | --- | --- | --- |
| `qwen3-coder:30b` | 19 GB | 24 GB GPU / 32 GB Mac | Default: best speed and quality balance |
| `qwen3.6:27b` | 17 GB | 24 GB GPU / 32 GB Mac | Stronger reasoning, slower (dense) |
| `devstral:24b` | 14 GB | 16–24 GB GPU | Mistral's agentic coder |
| `gpt-oss:20b` | 14 GB | 16 GB RAM/VRAM | Smaller machines |

How the local path works (`src/llm/local.ts`):
- **Structured output.** Replies are constrained to the agents' JSON schema, generated from the same zod schema used for validation. If a server rejects schema mode, the provider falls back to JSON mode, then to plain text. Validation and the retry still apply either way.
- **Context window.** Ollama's default context is small and it silently truncates long prompts, so Studio requests `num_ctx` explicitly (32K by default; adjustable in Settings).
- **Scheduling.** Choosing a local provider switches the scheduler to one agent per tick, since one GPU serves one request at a time.
- **Stuck agents.** An agent that replies "no action" while it still has work gets one nudged retry. If it still doesn't act, the run pauses and names the stuck agent.
- **Browser origin.** Ollama accepts browser requests from `localhost` by default. If you serve Studio from another origin, start Ollama with `OLLAMA_ORIGINS=<that origin>`. For LM Studio, enable CORS in its server settings.

Small models (under ~14B) handle the JSON protocol but tend to under-scope work and stall at review, so use one of the models above for full runs. `src/test/local-live.test.ts` runs a live Producer turn against your server: `LOCAL_LLM_URL=http://localhost:11434 LOCAL_LLM_MODEL=qwen3-coder:30b npx vitest run src/test/local-live.test.ts`.

## How it works

```
brief ─▶ Producer ─▶ Designer ─▶ Engineers ⇄ Reviewer ⇄ QA ─▶ Producer ships
                 (spec + tickets)  (DESIGN.md)   (commits)   (diffs)   (preview)
```

- **Board is the source of truth.** Agents act only through typed actions on tickets (`claim_ticket`, `write_code`, `review`, `qa_result`, …). The engine (`src/engine/apply.ts`) enforces the rules:
  - roles can only take their own actions
  - dependencies must be Done before a ticket is claimed
  - one engineer per file lock
  - QA can't pass, and the Producer can't ship, while the latest preview has console errors
  - two QA failures flag the ticket for the Producer to rescope or reassign
- **Turns.** Each turn, an agent gets a small context: a rolling project summary, its memory, its mentions, and only the tickets and files it needs (`src/agents/context.ts`). It replies with one JSON object. The reply is validated with zod, then checked against the board rules. On failure the agent gets one corrective retry with the error.
- **Scheduler** (`src/scheduler/scheduler.ts`). The scheduler is turn-based and runs agents either serially or in parallel lanes. It shows a tick counter and has Start, Pause, Step and Speed controls. A hard cap on turns and tokens pauses the run when hit. Agents with nothing new to do are skipped, so they don't burn LLM calls.
- **Preview runtime** (`src/runtime`):
  - `esbuild-wasm` bundles the generated project in the browser. React is supplied from bundled UMD builds, and external packages are rejected.
  - The bundled app runs in a `sandbox="allow-scripts"` iframe.
  - An injected shim forwards console output, uncaught errors and promise rejections. It also runs a smoke test that presses keys and clicks a button.
  - QA and the Producer read that report. QA uses a hidden runner; the Preview tab shows the same thing live.
- **Replay.** Every commit, ticket move and spec or design event stores a snapshot. The timeline scrubber replays how the board and files looked at each point.
- **Export.** Downloads a zip with the sources, `SPEC.md`, `DESIGN.md`, a README with the commit log, and a self-contained `dist/index.html` that runs by double-click.

## The mock LLM

`src/llm/mock` stands in for a model. It reads the same turn context a real model gets and replies with the same JSON protocol. It builds one of six real template projects ticket by ticket: Pomodoro, Snake, habit tracker, platformer, a generic list app and a generic arcade game.

The first submission of some tickets contains a deliberate flaw, so every feedback loop gets exercised for real:
- A leftover `console.log` gets caught by the Reviewer from the diff.
- A runtime error (e.g. `ReferenceError: COLOURS is not defined`) gets caught by QA from the actual preview console and traced to the file.
- The platformer's physics ticket fails QA twice, so the Producer rescopes it and reassigns it to another engineer.

The designer's first reply is also intentionally malformed, to exercise validate-and-retry. An ambiguous brief (e.g. "something about penguins") makes the Producer ask you a question card first.

## Layout

| Path | What |
| --- | --- |
| `src/types.ts` | Domain model |
| `src/agents/` | Role definitions and system prompts, action schemas, context builder |
| `src/engine/` | Pure board engine: rules, commits, locks, timeline snapshots |
| `src/scheduler/` | Tick loop, eligibility, retries, budget |
| `src/llm/` | Provider interface; Anthropic, local (Ollama / OpenAI-compatible) and mock providers |
| `src/runtime/` | Bundler, preview shim, iframe runner |
| `src/ui/` | Roster, Board, Channel, Files and diffs, Preview, Inspector, Timeline, Settings |
