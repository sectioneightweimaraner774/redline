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

export function checkCommand(model?: string): void {
  const diffStat = getDiffStat();
  if (!diffStat) {
    process.exit(0);
  }

  const reviewCmd = model ? `redline review ${model}` : "redline review";

  const hookOutput = {
    decision: "block",
    reason: `Redline: Here is a summary of uncommitted changes since the last review:\n\n${diffStat}\n\nIf these changes are substantial enough to warrant a code review (e.g., new logic, bug fixes, refactors — not just formatting or comments), run the following command as a background task:\n\n${reviewCmd}\n\nIf the changes are trivial, or a review is already running, skip it. When a review completes, assess the findings and inform the user of any issues.`,
  };

  console.log(JSON.stringify(hookOutput));
}
