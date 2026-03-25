# Changelog

## 0.3.0

- **Interactive setup** — `redline` now prompts for model, reasoning effort, and provider variant (nitro/floor/standard)
- **Reasoning effort** — configurable per-review via `-c model_reasoning_effort` (minimal, low, medium, high)
- **Provider variants** — append `:nitro`, `:floor` to model slugs for throughput or cost optimization
- **`--effort` flag** — set effort non-interactively: `redline --effort=low`
- **Remove config command** — `redline config` removed (unused; API key managed via `redline login` or env var)
- **Fix `--effort` flag ignored during install** — found by Codex review

## 0.2.0

- **Async reviews** — reviews run as Claude Code background tasks (visible, killable, non-blocking)
- **Diff-hash dedup** — Stop hook only fires when uncommitted changes differ from last check
- **Transparent commands** — hook output shows the raw `codex exec review` command
- **Streaming output** — review progress streams in real-time to background task viewer

## 0.1.0

- Initial release as **redline**
- Stateless CLI: `redline` installs a Claude Code Stop hook, `redline off` removes it
- Hook triggers `codex exec review --uncommitted` via OpenRouter
- OAuth PKCE login for OpenRouter authentication
- Custom model support via positional argument

## Pre-release

- **vigil** (v0.2.0) — background watcher + `.vigil/` filesystem protocol (replaced by hook-based approach)
- **agentmux** (v0.1.0) — tmux split-pane multiplexer with git worktrees (replaced by simpler architecture)
