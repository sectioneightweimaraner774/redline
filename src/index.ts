#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { loadConfig } from "./lib/config-store";
import { login } from "./lib/auth";
import { log, bold } from "./lib/prompts";

const VERSION = "0.1.0";

const HELP = `
${bold("agentmux")} — CLI for multiplexing Claude Code + Codex via OpenRouter

${bold("Usage:")}
  agentmux [command] [options]

${bold("Commands:")}
  run          Run the multiplexer workflow (default)
  login        Authenticate with OpenRouter via OAuth
  config       Show/set configuration
  cleanup      Remove agentmux worktrees and tmux sessions

${bold("Options:")}
  --task, -t   Task description (skips interactive prompt)
  --force, -f  Skip confirmation prompts (cleanup)
  --help, -h   Show this help
  --version    Show version
`;

async function resolveApiKey(): Promise<string> {
  // 1. Environment variable
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey) {
    log.info("Using API key from OPENROUTER_API_KEY env var");
    return envKey;
  }

  // 2. Config store
  const config = await loadConfig();
  if (config.openrouter_api_key) {
    log.info("Using API key from config");
    return config.openrouter_api_key;
  }

  // 3. OAuth flow
  log.info("No API key found. Starting OAuth login...");
  const { key } = await login();
  return key;
}

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
      task: { type: "string", short: "t" },
      force: { type: "boolean", short: "f" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (values.version) {
    console.log(`agentmux v${VERSION}`);
    process.exit(0);
  }

  const command = positionals[0] || "run";

  switch (command) {
    case "login": {
      const { loginCommand } = await import("./commands/login");
      await loginCommand();
      break;
    }

    case "config": {
      const { configCommand } = await import("./commands/config");
      await configCommand(positionals.slice(1));
      break;
    }

    case "cleanup": {
      const { cleanupCommand } = await import("./commands/cleanup");
      await cleanupCommand(!!values.force);
      break;
    }

    case "run": {
      const apiKey = await resolveApiKey();
      const { runCommand } = await import("./commands/run");
      await runCommand({ task: values.task, apiKey });
      break;
    }

    default:
      log.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  log.error((err as Error).message);
  process.exit(1);
});
