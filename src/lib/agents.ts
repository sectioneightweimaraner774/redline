import { claudeEnv, codexEnv } from "./env";

export interface AgentConfig {
  name: string;
  displayName: string;
  defaultModel: string;
  buildRunCommand(task: string, cwd: string): string[];
  buildReviewCommand(baseBranch: string, cwd: string): string[];
  getEnv(apiKey: string): Record<string, string>;
}

export const CLAUDE_AGENT: AgentConfig = {
  name: "claude",
  displayName: "Claude Code",
  defaultModel: "anthropic/claude-opus-4.6",
  buildRunCommand(task: string, _cwd: string) {
    return ["claude", "--dangerously-skip-permissions", task];
  },
  buildReviewCommand(baseBranch: string, _cwd: string) {
    return [
      "claude",
      "-p",
      "--dangerously-skip-permissions",
      `Review the changes on this branch vs ${baseBranch}. Run git diff ${baseBranch}...HEAD to see them. Identify bugs, security issues, and suggest improvements. Be concise.`,
    ];
  },
  getEnv(apiKey: string) {
    return claudeEnv(apiKey);
  },
};

export const CODEX_AGENT: AgentConfig = {
  name: "codex",
  displayName: "Codex CLI",
  defaultModel: "openai/gpt-5.3-codex",
  buildRunCommand(task: string, _cwd: string) {
    // Use -c to set model_provider at runtime, --full-auto for non-interactive
    return [
      "codex",
      "-c", 'model_provider="openrouter"',
      "--full-auto",
      task,
    ];
  },
  buildReviewCommand(baseBranch: string, _cwd: string) {
    // codex review is a top-level shortcut for non-interactive code review
    return [
      "codex",
      "review",
      "-c", 'model_provider="openrouter"',
      "--base", baseBranch,
    ];
  },
  getEnv(apiKey: string) {
    return codexEnv(apiKey);
  },
};

const ALL_AGENTS: AgentConfig[] = [CLAUDE_AGENT, CODEX_AGENT];

export function getAgent(name: string): AgentConfig | undefined {
  return ALL_AGENTS.find((a) => a.name === name);
}

export async function detectAvailableAgents(): Promise<AgentConfig[]> {
  const available: AgentConfig[] = [];
  for (const agent of ALL_AGENTS) {
    const result = Bun.spawnSync(["which", agent.name]);
    if (result.exitCode === 0) {
      available.push(agent);
    }
  }
  return available;
}
