import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { findProjectRoot } from "../lib/hooks";

function getDiffStat(): string {
  const result = Bun.spawnSync(["git", "diff", "--stat", "HEAD"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stat = result.stdout.toString().trim();
  if (stat) return stat;

  // Fall back to status for untracked files
  const status = Bun.spawnSync(["git", "status", "--porcelain"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return status.stdout.toString().trim();
}

/** Simple string hash for comparing diff stats. */
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

export function checkCommand(model?: string): void {
  const diffStat = getDiffStat();
  if (!diffStat) {
    process.exit(0);
  }

  // Deduplicate: only fire if the diff has changed since last check
  const root = findProjectRoot();
  const hashFile = root ? join(root, ".git", "redline-last-diff") : null;
  const currentHash = hash(diffStat);

  if (hashFile && existsSync(hashFile)) {
    const lastHash = readFileSync(hashFile, "utf-8").trim();
    if (lastHash === currentHash) {
      process.exit(0); // same diff as last check — skip
    }
  }

  // Save current hash
  if (hashFile) {
    writeFileSync(hashFile, currentHash);
  }

  // Build the actual codex command for transparency
  const codexArgs = [
    "codex", "exec", "review",
    "-c", "'model_provider=\"openrouter\"'",
    "--uncommitted",
  ];
  if (model) {
    codexArgs.push("-c", `'model="${model}"'`);
  }
  const codexCmd = codexArgs.join(" ");

  const hookOutput = {
    decision: "block",
    reason: `Redline: Here is a summary of uncommitted changes since the last review:\n\n${diffStat}\n\nIf these changes are substantial enough to warrant a code review (e.g., new logic, bug fixes, refactors — not just formatting or comments), run the following command as a background task:\n\n${codexCmd}\n\nIf the changes are trivial, or a review is already running, skip it. When a review completes, assess the findings and inform the user of any issues.`,
  };

  console.log(JSON.stringify(hookOutput));
}
