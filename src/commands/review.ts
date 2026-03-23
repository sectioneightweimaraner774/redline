import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import { isCodexInstalled, buildReviewArgs, getCodexEnv } from "../lib/agents";
import { ensureCodexConfig } from "../lib/env";
import { log } from "../lib/prompts";

interface ReviewOptions {
  model?: string;
  apiKey: string;
}

export async function reviewCommand(opts: ReviewOptions): Promise<void> {
  const { apiKey, model } = opts;

  if (!isCodexInstalled()) {
    log.error("codex CLI is not installed or not on PATH.");
    process.exit(1);
  }

  await ensureCodexConfig();

  const outputFile = join(tmpdir(), `redline-review-${Date.now()}.txt`);
  const args = buildReviewArgs(outputFile, model);
  const env = { ...process.env, ...getCodexEnv(apiKey) };

  // Stream codex output in real-time so background task shows progress
  const proc = Bun.spawn(args, {
    cwd: process.cwd(),
    env,
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  // Read the final review from the -o output file
  let review = "";
  try {
    review = (await Bun.file(outputFile).text()).trim();
    try { unlinkSync(outputFile); } catch { /* ignore */ }
  } catch {
    // No output file — codex output was already streamed to stdout
  }

  if (exitCode !== 0 && !review) {
    log.error(`Codex review failed (exit ${exitCode}).`);
    process.exit(1);
  }

  // Print the captured review summary (codex streaming output already shown above)
  if (review) {
    console.log("\n--- Review Summary ---\n");
    console.log(review);
  }
}
