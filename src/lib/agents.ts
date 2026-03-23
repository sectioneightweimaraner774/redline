import { codexEnv } from "./env";

const DEFAULT_MODEL = "openai/gpt-5.4";

export function isCodexInstalled(): boolean {
  return Bun.spawnSync(["which", "codex"]).exitCode === 0;
}

export function getDefaultModel(): string {
  return DEFAULT_MODEL;
}

export function getCodexEnv(apiKey: string): Record<string, string> {
  return codexEnv(apiKey);
}

/** Build argv for running a codex review. */
export function buildReviewArgs(outputFile: string, model?: string): string[] {
  const args = [
    "codex",
    "exec",
    "review",
    "-c", 'model_provider="openrouter"',
    "--uncommitted",
    "-o", outputFile,
  ];
  if (model) {
    args.push("-c", `model="${model}"`);
  }
  return args;
}
