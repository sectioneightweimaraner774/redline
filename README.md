# redline

Automatic code review for Claude Code, powered by Codex via OpenRouter.

Run `redline` in any git repo to install a Claude Code hook. Every time Claude finishes a response, Codex automatically reviews uncommitted changes and feeds the results back into Claude's context.

## How it works

```
You're working in Claude Code as normal:

  claude --dangerously-skip-permissions

Behind the scenes, a Stop hook fires after each Claude response:

  Claude Code Stop event
    → redline review --hook
    → codex exec review --uncommitted
    → review fed back to Claude as hook output
    → Claude reads the review and tells you about any issues
```

Redline installs a single hook in `.claude/settings.local.json`. It's stateless — no background processes, no watchers, no extra directories.

## Setup

Requires [Bun](https://bun.sh), [Claude Code](https://docs.anthropic.com/en/docs/claude-code), and [Codex CLI](https://github.com/openai/codex).

```bash
git clone https://github.com/alexanderatallah/redline.git
cd redline
bun install
bun link
```

### Authentication

All inference is routed through [OpenRouter](https://openrouter.ai). Authenticate with one of:

```bash
# Option 1: OAuth (opens browser)
redline login

# Option 2: Environment variable
export OPENROUTER_API_KEY=sk-or-...
```

## Quick start

```bash
cd your-project
redline              # installs the hook, done
# now use Claude Code normally — reviews happen automatically
```

## Commands

| Command | Description |
|---------|-------------|
| `redline` | Enable reviews with the default model (`openai/gpt-5.4`) |
| `redline <model>` | Enable reviews with a custom model (any OpenRouter slug) |
| `redline off` | Disable reviews (remove the hook) |
| `redline review [model]` | Run a single review manually, print to stdout |
| `redline review [model] --hook` | Run a review and output Claude Code hook JSON |
| `redline login` | Authenticate with OpenRouter via OAuth |
| `redline config` | Show current configuration |
| `redline config set <key> <value>` | Set a config value |
| `redline config reset` | Reset config to defaults |
| `redline --help` | Show help |
| `redline --version` | Show version |

### Model customization

The default review model is `openai/gpt-5.4`. Pass any [OpenRouter model slug](https://openrouter.ai/models) to customize:

```bash
redline openai/gpt-5.4-pro       # use GPT-5.4 Pro
redline anthropic/claude-opus-4.6 # use Claude Opus (reviewing its own code)
redline google/gemini-2.5-pro     # use Gemini
```

## Why Claude Code only?

Codex CLI's hook system can't feed output back into the agent's context. Claude Code's `Stop` hook supports a `decision: "block"` response with a `reason` field that gets injected directly into Claude's conversation — this is what lets Claude read and act on the review.

When Codex adds support for feeding hook output back to the agent, redline will support it as the main agent too.

## What gets reviewed

Redline uses `codex exec review --uncommitted`, which reviews all staged, unstaged, and untracked changes in the repo. This means every time Claude finishes working, Codex reviews everything that's changed.

## Requirements

- [Bun](https://bun.sh) runtime
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (main agent)
- [Codex CLI](https://github.com/openai/codex) (reviewer)
- [OpenRouter](https://openrouter.ai) account (free to sign up, pay-per-use)

## License

MIT
