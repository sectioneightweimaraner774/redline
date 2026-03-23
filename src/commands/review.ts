import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";
import { isCodexInstalled, buildReviewArgs, getCodexEnv } from "../lib/agents";
import { ensureCodexConfig } from "../lib/env";
import { findProjectRoot } from "../lib/hooks";
import { log } from "../lib/prompts";

interface ReviewOptions {
  model?: string;
  apiKey: string;
}

function clearPending(): void {
  const root = findProjectRoot();
  if (!root) return;
  const pendingPath = join(root, ".git", "redline-pending");
  if (existsSync(pendingPath)) {
    try { unlinkSync(pendingPath); } catch { /* ignore */ }
  }
}

export async function reviewCommand(opts: ReviewOptions): Promise<void> {
  const { apiKey, model } = opts;

  try {
    if (!isCodexInstalled()) {
      log.error("codex CLI is not installed or not on PATH.");
      process.exit(1);
    }

    await ensureCodexConfig();

    const outputFile = join(tmpdir(), `redline-review-${Date.now()}.txt`);
    const args = buildReviewArgs(outputFile, model);
    const env = { ...process.env, ...getCodexEnv(apiKey) };

    const proc = Bun.spawnSync(args, {
      cwd: process.cwd(),
      env,
      stdout: "pipe",
      stderr: "pipe",
    });

    // Read review from output file, fall back to stdout
    let review: string;
    try {
      review = await Bun.file(outputFile).text();
      try { unlinkSync(outputFile); } catch { /* ignore */ }
    } catch {
      review = proc.stdout.toString().trim();
    }

    if (proc.exitCode !== 0 && !review) {
      log.error(`Codex review failed (exit ${proc.exitCode}): ${proc.stderr.toString().trim()}`);
      process.exit(1);
    }

    if (!review) {
      log.info("No uncommitted changes to review.");
      process.exit(0);
    }

    console.log(review);
  } finally {
    clearPending();
  }
}
