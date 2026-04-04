#!/usr/bin/env node

/**
 * Redline Stop hook handler.
 *
 * Reads the Stop event from stdin, checks for uncommitted changes,
 * and suggests available commands. The model decides which action
 * (if any) is most helpful based on the diff and its message history.
 */

import { execSync } from "node:child_process";

// --- Read Stop event from stdin ---

try {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString();
  if (input) {
    const event = JSON.parse(input);
    if (event.stop_hook_active) {
      process.exit(0);
    }
  }
} catch {
  // No stdin or invalid JSON
}

// --- Check for uncommitted changes ---

let diffStat = "";
try {
  diffStat = execSync("git diff --stat HEAD", { encoding: "utf-8" }).trim();
} catch {
  // not a git repo or no commits
}
if (!diffStat) {
  try {
    diffStat = execSync("git status --porcelain", { encoding: "utf-8" }).trim();
  } catch {
    // ignore
  }
}
if (!diffStat) {
  process.exit(0);
}

// --- Output block decision with available commands ---

const reason = `Redline: Uncommitted changes detected:

${diffStat}

Based on your current context, you may invoke one of these as a background task:
- /redline:review — standard code review
- /redline:adversarial — challenge design decisions and probe for failure modes
- /redline:rescue <task> — delegate a task to Codex for help

Choose the most helpful action, or skip if the changes are trivial, a review was already done for these changes, or an action is already running. Consider what you just did, how complex the changes are, and what would be most helpful right now.`;

console.log(JSON.stringify({ decision: "block", reason }));
