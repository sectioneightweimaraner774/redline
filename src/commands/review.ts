import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import { isCodexInstalled, buildReviewArgs, getCodexEnv } from "../lib/agents";
import { ensureCodexConfig } from "../lib/env";
import { log } from "../lib/prompts";

interface ReviewOptions {
  model?: string;
  hook: boolean;
  apiKey: string;
}

export async function reviewCommand(opts: ReviewOptions): Promise<void> {
  const { apiKey, model, hook } = opts;

  if (!isCodexInstalled()) {
    if (hook) {
      // In hook mode, output JSON so Claude gets feedback
      console.log(JSON.stringify({
        decision: "block",
        reason: "Redline: codex CLI is not installed. Install it to enable reviews.",
      }));
    } else {
      log.error("codex CLI is not installed or not on PATH.");
    }
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
    const errMsg = `Codex review failed (exit ${proc.exitCode}): ${proc.stderr.toString().trim()}`;
    if (hook) {
      console.log(JSON.stringify({ decision: "block", reason: `Redline: ${errMsg}` }));
    } else {
      log.error(errMsg);
    }
    process.exit(1);
  }

  if (!review) {
    if (hook) {
      // No review content — don't block Claude
      process.exit(0);
    } else {
      log.info("No uncommitted changes to review.");
      process.exit(0);
    }
  }

  if (hook) {
    // Output as Claude Code hook JSON
    const hookOutput = {
      decision: "block",
      reason: `Redline: Codex has reviewed your recent changes. Here is the review:\n\n${review}\n\nPlease assess the review above and inform the user of any issues found.`,
    };
    console.log(JSON.stringify(hookOutput));
  } else {
    console.log(review);
  }
}
