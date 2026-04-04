#!/usr/bin/env node

/**
 * Redline Stop hook handler.
 *
 * Reads the Stop event from stdin, checks for uncommitted changes,
 * deduplicates by diff hash, and suggests available commands.
 * The model decides which action (if any) is most helpful.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// --- Read Stop event from stdin ---

let stopHookActive = false;
try {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString();
  if (input) {
    const event = JSON.parse(input);
    stopHookActive = !!event.stop_hook_active;
  }
} catch {
  // No stdin or invalid JSON
}

if (stopHookActive) {
  process.exit(0);
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

// --- Deduplicate by diff hash ---

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

const pluginData = process.env.CLAUDE_PLUGIN_DATA;
const hashDir = pluginData || join(process.cwd(), ".git");
const hashFile = join(hashDir, "redline-last-diff");

if (pluginData && !existsSync(pluginData)) {
  mkdirSync(pluginData, { recursive: true });
}

const currentHash = hash(diffStat);

if (existsSync(hashFile)) {
  const lastHash = readFileSync(hashFile, "utf-8").trim();
  if (lastHash === currentHash) {
    process.exit(0);
  }
}

writeFileSync(hashFile, currentHash);

// --- Output block decision with available commands ---

const reason = `Redline: Uncommitted changes detected:

${diffStat}

Based on your current context, you may invoke one of these as a background task:
- /redline:review — standard code review
- /redline:adversarial — challenge design decisions and probe for failure modes
- /redline:rescue <task> — delegate a task to Codex for help

Choose the most helpful action, or skip if the changes are trivial or an action is already running. Consider what you just did, how complex the changes are, and what would be most helpful right now.`;

console.log(JSON.stringify({ decision: "block", reason }));
