import { join } from "node:path";
import { existsSync, writeFileSync } from "node:fs";
import { findProjectRoot } from "../lib/hooks";

const PENDING_FILE = "redline-pending";

function getPendingPath(): string | null {
  const root = findProjectRoot();
  if (!root) return null;
  return join(root, ".git", PENDING_FILE);
}

function hasUncommittedChanges(): boolean {
  const result = Bun.spawnSync(["git", "status", "--porcelain"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.exitCode === 0 && result.stdout.toString().trim().length > 0;
}

export function checkCommand(model?: string): void {
  // Gate 1: any uncommitted changes?
  if (!hasUncommittedChanges()) {
    process.exit(0);
  }

  // Gate 2: review already pending?
  const pendingPath = getPendingPath();
  if (pendingPath && existsSync(pendingPath)) {
    process.exit(0);
  }

  // Mark review as pending
  if (pendingPath) {
    writeFileSync(pendingPath, new Date().toISOString());
  }

  // Build the review command
  const reviewCmd = model ? `redline review ${model}` : "redline review";

  // Output hook JSON instructing Claude to run background review
  const hookOutput = {
    decision: "block",
    reason: `Uncommitted code changes detected. Please run the following command as a background task to get a Codex code review:\n\n${reviewCmd}\n\nContinue working — you can monitor the review in your background tasks. When it completes, assess the findings and inform the user of any issues.`,
  };

  console.log(JSON.stringify(hookOutput));
}
