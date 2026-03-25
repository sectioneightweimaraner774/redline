#!/usr/bin/env bun

import { loadConfig } from "./lib/config-store";
import { login } from "./lib/auth";
import { log, bold, green, dim, cyan, ask, choose } from "./lib/prompts";
import { findProjectRoot, installHook, removeHook } from "./lib/hooks";
import {
  DEFAULT_MODEL, DEFAULT_EFFORT, EFFORT_OPTIONS, VARIANT_OPTIONS,
  DEFAULT_VARIANT_IDX, applyVariant,
  type Effort, type Variant,
} from "./lib/agents";

const VERSION = "0.3.0";

const HELP = `
${bold("redline")} — automatic code review for Claude Code via Codex

${bold("Usage:")}
  redline [model]             Enable Codex reviews (interactive setup)
  redline off                 Disable reviews (remove hook)
  redline review [model]      Run a single review manually
  redline login               Authenticate with OpenRouter

${bold("Options:")}
  --effort=<level>   Reasoning effort (minimal, low, medium, high)
  --help, -h         Show this help
  --version          Show version

${bold("Examples:")}
  redline                     # interactive setup
  redline openai/gpt-5.4-pro  # skip model prompt, still prompts for effort/variant
  redline off                 # disable
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

/** Parse --effort=X and --key=value flags from args. */
function parseFlags(args: string[]): { effort?: string; rest: string[] } {
  let effort: string | undefined;
  const rest: string[] = [];
  for (const arg of args) {
    if (arg.startsWith("--effort=")) {
      effort = arg.split("=")[1];
    } else {
      rest.push(arg);
    }
  }
  return { effort, rest };
}

async function enableReviews(modelArg?: string, effortArg?: string): Promise<void> {
  await resolveApiKey();

  const root = findProjectRoot();
  if (!root) {
    log.error("Not inside a git repository.");
    process.exit(1);
  }

  console.log();

  // Prompt for model (skip if provided as arg)
  const model = modelArg || await ask("  Model", DEFAULT_MODEL);

  // Prompt for reasoning effort (skip if provided via --effort flag)
  let effort: string;
  if (effortArg && EFFORT_OPTIONS.includes(effortArg as Effort)) {
    effort = effortArg;
  } else {
    const effortIdx = await choose(
      "  Reasoning effort",
      [...EFFORT_OPTIONS],
      EFFORT_OPTIONS.indexOf(DEFAULT_EFFORT),
    );
    effort = EFFORT_OPTIONS[effortIdx];
  }

  // Prompt for provider variant
  const variantIdx = await choose(
    "  Provider",
    [...VARIANT_OPTIONS],
    DEFAULT_VARIANT_IDX,
  );
  const variant = VARIANT_OPTIONS[variantIdx] as Variant;

  // Build final model slug with variant
  const finalModel = applyVariant(model, variant);

  console.log();

  const { installed, updated } = await installHook(root, finalModel, effort);

  const display = `${cyan(finalModel)} ${dim(`(${effort} effort)`)}`;
  if (!installed && !updated) {
    log.info(`Redline hook already installed → ${display}`);
  } else if (updated) {
    log.success(`Redline hook updated → ${display}`);
  } else {
    log.success(`Redline hook installed → ${display}`);
  }

  console.log();
  console.log(`  ${dim("Location:")} .claude/settings.local.json`);
  console.log(`  ${dim("Trigger:")}  Claude Code Stop event`);
  console.log(`  ${dim("Action:")}   Async background codex review when changes detected`);
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
  const rawArgs = Bun.argv.slice(2);
  const { effort, rest } = parseFlags(rawArgs);

  if (rest.length === 0) {
    await enableReviews(undefined, effort);
    return;
  }

  if (rest[0] === "--help" || rest[0] === "-h") {
    console.log(HELP);
    return;
  }

  if (rest[0] === "--version") {
    console.log(`redline v${VERSION}`);
    return;
  }

  switch (rest[0]) {
    case "off": {
      await disableReviews();
      break;
    }

    case "check": {
      // Called by the Stop hook: redline check [model] [--effort=X]
      const { checkCommand } = await import("./commands/check");
      // Model is the first non-flag arg after "check"
      const checkArgs = rest.slice(1);
      const { effort: checkEffort, rest: checkRest } = parseFlags(checkArgs);
      checkCommand(checkRest[0], checkEffort || effort);
      break;
    }

    case "review": {
      const apiKey = await resolveApiKey();
      const reviewArgs = rest.slice(1);
      const { effort: reviewEffort, rest: reviewRest } = parseFlags(reviewArgs);
      const { reviewCommand } = await import("./commands/review");
      await reviewCommand({
        model: reviewRest[0],
        effort: reviewEffort || effort,
        apiKey,
      });
      break;
    }

    case "login": {
      const { loginCommand } = await import("./commands/login");
      await loginCommand();
      break;
    }

    default: {
      // Treat as model slug → install hook with prompts for effort/variant
      await enableReviews(rest[0], effort);
      break;
    }
  }
}

main().catch((err) => {
  log.error((err as Error).message);
  process.exit(1);
});
