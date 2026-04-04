---
description: Configure Redline — set OpenRouter API key, review model, and effort level
allowed-tools: Bash
---
Run the Redline setup wizard.

If no OpenRouter API key is configured (check OPENROUTER_API_KEY env var or plugin config), offer to run OAuth login:
```
node "${CLAUDE_PLUGIN_ROOT}/scripts/login.mjs"
```

Then help the user configure:
1. **Model** — which OpenRouter model to use for reviews (default: `openai/gpt-5.4`)
2. **Effort** — reasoning effort level: minimal, low, medium, or high (default: high)
3. **Provider variant** — append `:nitro` (fastest), `:floor` (cheapest), or nothing (standard) to the model slug

Save preferences to the plugin config. These are used by /redline:review, /redline:adversarial, and /redline:rescue.
