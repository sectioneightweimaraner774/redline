#!/usr/bin/env bun

import { loadConfig } from "./lib/config-store";
import { login } from "./lib/auth";
import { log, bold, green, dim, cyan } from "./lib/prompts";
import { findProjectRoot, installHook, removeHook } from "./lib/hooks";

const VERSION = "0.3.0";

const HELP = `
${bold("redline")} — automatic code review for Claude Code via Codex

${bold("Usage:")}
  redline [model]                Enable Codex reviews (default: openai/gpt-5.4)
  redline off                    Disable reviews (remove hook)
  redline review [model]         Run a single review manually
  redline review [model] --hook  Run review, output as Claude Code hook JSON
  redline login                  Authenticate with OpenRouter
  redline config [args...]       Show/set configuration

${bold("Options:")}
  --help, -h     Show this help
  --version      Show version

${bold("Examples:")}
  redline                        # enable with default model
  redline openai/gpt-5.4-pro     # enable with custom model
  redline off                    # disable
`;

async function resolveApiKey(): Promise<string> {
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey) return envKey;

  const config = await loadConfig();
  if (config.openrouter_api_key) return config.openrouter_api_key;

  log.info("No API key found. Starting OAuth login...");
  const { key } = await login();
  return key;
}

async function enableReviews(model?: string): Promise<void> {
  await resolveApiKey(); // ensure we have a key before installing

  const root = findProjectRoot();
  if (!root) {
    log.error("Not inside a git repository.");
    process.exit(1);
  }

  const { installed, updated } = await installHook(root, model);

  const displayModel = model || "openai/gpt-5.4";
  if (!installed && !updated) {
    log.info(`Redline hook already installed (${displayModel}).`);
  } else if (updated) {
    log.success(`Redline hook updated → ${cyan(displayModel)}`);
  } else {
    log.success(`Redline hook installed → ${cyan(displayModel)}`);
  }

  console.log();
  console.log(`  ${dim("Location:")} .claude/settings.local.json`);
  console.log(`  ${dim("Trigger:")}  Claude Code Stop event`);
  console.log(`  ${dim("Action:")}   codex exec review --uncommitted`);
  console.log();
  console.log(`  Run ${green("redline off")} to disable.`);
}

async function disableReviews(): Promise<void> {
  const root = findProjectRoot();
  if (!root) {
    log.error("Not inside a git repository.");
    process.exit(1);
  }

  const removed = await removeHook(root);
  if (removed) {
    log.success("Redline hook removed.");
  } else {
    log.info("No redline hook found.");
  }
}

async function main() {
  const args = Bun.argv.slice(2);

  if (args.length === 0) {
    await enableReviews();
    return;
  }

  if (args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return;
  }

  if (args[0] === "--version") {
    console.log(`redline v${VERSION}`);
    return;
  }

  switch (args[0]) {
    case "off": {
      await disableReviews();
      break;
    }

    case "review": {
      const apiKey = await resolveApiKey();
      // Parse: redline review [model] [--hook]
      const hasHook = args.includes("--hook");
      const reviewArgs = args.slice(1).filter((a) => a !== "--hook");
      const model = reviewArgs[0]; // optional model

      const { reviewCommand } = await import("./commands/review");
      await reviewCommand({ model, hook: hasHook, apiKey });
      break;
    }

    case "login": {
      const { loginCommand } = await import("./commands/login");
      await loginCommand();
      break;
    }

    case "config": {
      const { configCommand } = await import("./commands/config");
      await configCommand(args.slice(1));
      break;
    }

    default: {
      // Treat as model slug → install hook with that model
      await enableReviews(args[0]);
      break;
    }
  }
}

main().catch((err) => {
  log.error((err as Error).message);
  process.exit(1);
});
