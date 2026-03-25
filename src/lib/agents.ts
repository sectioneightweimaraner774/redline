import { codexEnv } from "./env";

export const DEFAULT_MODEL = "openai/gpt-5.4";
export const DEFAULT_EFFORT = "high";
export const EFFORT_OPTIONS = ["minimal", "low", "medium", "high"] as const;
export const VARIANT_OPTIONS = ["nitro", "floor", "standard"] as const;
export const DEFAULT_VARIANT_IDX = 0; // nitro

export type Effort = (typeof EFFORT_OPTIONS)[number];
export type Variant = (typeof VARIANT_OPTIONS)[number];

/** Append variant suffix to model slug (e.g., "openai/gpt-5.4" + "nitro" → "openai/gpt-5.4:nitro"). */
export function applyVariant(model: string, variant: Variant): string {
  if (variant === "standard") return model;
  // Don't double-append if model already has a variant
  if (model.includes(":")) return model;
  return `${model}:${variant}`;
}

export function isCodexInstalled(): boolean {
  return Bun.spawnSync(["which", "codex"]).exitCode === 0;
}

export function getCodexEnv(apiKey: string): Record<string, string> {
  return codexEnv(apiKey);
}

/** Build argv for running a codex review (used by review.ts). */
export function buildReviewArgs(
  outputFile: string,
  model?: string,
  effort?: string,
): string[] {
  const args = [
    "codex", "exec", "review",
    "-c", 'model_provider="openrouter"',
    "--uncommitted",
    "-o", outputFile,
  ];
  if (model) {
    args.push("-c", `model="${model}"`);
  }
  if (effort) {
    args.push("-c", `model_reasoning_effort="${effort}"`);
  }
  return args;
}

/** Build the display command string (used by check.ts for hook output). */
export function buildReviewCommand(model?: string, effort?: string): string {
  const args = [
    "codex", "exec", "review",
    "-c", "'model_provider=\"openrouter\"'",
    "--uncommitted",
  ];
  if (model) {
    args.push("-c", `'model="${model}"'`);
  }
  if (effort) {
    args.push("-c", `'model_reasoning_effort="${effort}"'`);
  }
  return args.join(" ");
}
