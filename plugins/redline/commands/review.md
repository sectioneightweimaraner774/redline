---
description: Run a standard code review using Codex. Accepts optional arguments like "last 3 commits", "against main", or "commit abc123". Defaults to uncommitted changes.
allowed-tools: Bash
---
Run a Codex code review as a background task.

## Determine the diff source

Parse `$ARGUMENTS` to decide what to review. If no arguments are provided, default to `--uncommitted`.

| User says | Codex flag |
|---|---|
| *(nothing)* | `--uncommitted` |
| `last N commits` or `N commits` | Generate a range: `--base HEAD~N` |
| `commit <sha>` | `--commit <sha>` |
| `against main` / `vs main` / any branch name | `--base <branch>` |
| `--uncommitted`, `--base ...`, `--commit ...` | Pass through as-is |

For `last N commits`, use `--base HEAD~N` so Codex reviews the cumulative diff of those N commits against their common ancestor.

## Run the review

Build the command using the diff flag determined above.

If `${user_config.provider}` is `openrouter`:
```
OPENROUTER_API_KEY="${user_config.openrouter_api_key}" codex exec review -c 'model_provider="openrouter"' -c 'model="${user_config.model}"' -c 'model_reasoning_effort="${user_config.effort}"' <diff-flag>
```

If `${user_config.provider}` is `openai`:
```
codex exec review <diff-flag>
```

When the review completes, assess the findings and inform the user of any issues found.

$ARGUMENTS
