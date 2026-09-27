#!/usr/bin/env bash
# Install Ollama (if needed) and pull the best local model for Studio that fits this machine.
#
#   npm run setup:local                      # auto-pick by hardware
#   MODEL=qwen3.6:27b npm run setup:local    # force a model
#   DRY_RUN=1 npm run setup:local            # show what would happen
#
# macOS and Linux. On Windows: install Ollama from https://ollama.com/download, then run
#   ollama pull qwen3-coder:30b
set -euo pipefail

say() { printf '\033[1;33m▸\033[0m %s\n' "$*"; }
run() { if [[ "${DRY_RUN:-}" == 1 ]]; then echo "  (dry run) $*"; else "$@"; fi; }

OS="$(uname -s)"

# ── 1. Ollama ────────────────────────────────────────────────────────────────
if ! command -v ollama >/dev/null 2>&1; then
  say "Ollama is not installed."
  if [[ "$OS" == Darwin ]]; then
    if command -v brew >/dev/null 2>&1; then
      say "Installing with Homebrew: brew install ollama"
      run brew install ollama
    else
      say "Download the macOS app from https://ollama.com/download, open it once, then re-run this script."
      exit 1
    fi
  elif [[ "$OS" == Linux ]]; then
    say "Installing with the official script (https://ollama.com/install.sh). It may ask for sudo."
    if [[ "${DRY_RUN:-}" == 1 ]]; then echo "  (dry run) curl -fsSL https://ollama.com/install.sh | sh"; else curl -fsSL https://ollama.com/install.sh | sh; fi
  else
    say "Unsupported OS ($OS). Install Ollama from https://ollama.com/download."
    exit 1
  fi
fi

# ── 2. Hardware → model ──────────────────────────────────────────────────────
GB=0
KIND="RAM"
if [[ "$OS" == Darwin ]]; then
  GB=$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
  KIND="unified memory"
  [[ "$(uname -m)" == arm64 ]] || KIND="RAM (Intel Mac, CPU only)"
elif command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1; then
  GB=$(( $(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | sort -n | tail -1) / 1024 ))
  KIND="GPU VRAM"
else
  GB=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo) / 1024 / 1024 ))
  KIND="RAM (no NVIDIA GPU found, CPU only)"
fi
say "Detected ${GB} GB ${KIND}."

if [[ -n "${MODEL:-}" ]]; then
  say "Using MODEL=${MODEL} as requested."
elif [[ "$KIND" == "GPU VRAM" && $GB -ge 22 ]] || [[ "$KIND" != "GPU VRAM" && $GB -ge 30 ]]; then
  MODEL="qwen3-coder:30b"
  say "Picked ${MODEL} (recommended: coding/agent-tuned MoE, fast, 256K context, ~19 GB)."
elif [[ $GB -ge 15 ]]; then
  MODEL="gpt-oss:20b"
  say "Picked ${MODEL} (~14 GB): the best fit for 16 GB machines. qwen3-coder:30b needs ~24 GB VRAM or 32 GB RAM."
else
  say "Under 16 GB: full studio runs will be unreliable on a local model."
  say "Consider the built-in mock or Claude instead. To try anyway: MODEL=qwen2.5-coder:7b npm run setup:local"
  exit 1
fi

# ── 3. Server ────────────────────────────────────────────────────────────────
if ! curl -fsS http://localhost:11434/api/version >/dev/null 2>&1; then
  say "Starting the Ollama server in the background (log: /tmp/ollama-serve.log)."
  if [[ "${DRY_RUN:-}" == 1 ]]; then echo "  (dry run) ollama serve &"; else nohup ollama serve >/tmp/ollama-serve.log 2>&1 & sleep 3; fi
fi

# ── 4. Pull ──────────────────────────────────────────────────────────────────
say "Pulling ${MODEL} (this is a large download)…"
run ollama pull "$MODEL"

cat <<EOF

$(say "Done.")
  1. npm run dev
  2. Open Studio → Settings → "Local · Ollama"
  3. Model: ${MODEL} → Test connection → pick a brief
EOF
