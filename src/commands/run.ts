import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AgentConfig } from "../lib/agents";
import { detectAvailableAgents } from "../lib/agents";
import { ensureCodexConfig } from "../lib/env";
import { log, ask, confirm, bold, cyan, dim, green } from "../lib/prompts";
import * as tmux from "../lib/tmux";
import * as worktree from "../lib/worktree";

interface RunOptions {
  task?: string;
  apiKey: string;
}

/** Shell-escape a single argument for use in a command string */
function shellQuote(s: string): string {
  // Wrap in single quotes, escaping any embedded single quotes
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/** Build a shell command string from env vars + command array */
function buildShellCommand(
  env: Record<string, string>,
  cwd: string,
  cmd: string[],
): string {
  const parts: string[] = [];
  // Export env vars
  for (const [k, v] of Object.entries(env)) {
    parts.push(`export ${k}=${shellQuote(v)}`);
  }
  // cd to worktree (use absolute path)
  parts.push(`cd ${shellQuote(resolve(cwd))}`);
  // The actual command, each arg properly quoted
  parts.push(cmd.map(shellQuote).join(" "));
  return parts.join(" && ");
}

export async function runCommand(opts: RunOptions): Promise<void> {
  const { apiKey } = opts;

  // --- Prerequisites ---
  log.step(1, "Checking prerequisites...");

  for (const tool of ["git", "tmux"]) {
    const r = Bun.spawnSync(["which", tool]);
    if (r.exitCode !== 0) {
      log.error(`'${tool}' is required but not found on PATH.`);
      process.exit(1);
    }
  }

  // Verify git repo
  const gitCheck = Bun.spawnSync(["git", "rev-parse", "--is-inside-work-tree"], {
    stdout: "pipe",
  });
  if (gitCheck.exitCode !== 0) {
    log.error("Not inside a git repository. Run this from a git repo.");
    process.exit(1);
  }

  // Detect agents
  const agents = await detectAvailableAgents();
  if (agents.length === 0) {
    log.error(
      "No coding agents found. Install 'claude' (Claude Code) or 'codex' (Codex CLI).",
    );
    process.exit(1);
  }

  const singleAgent = agents.length === 1;
  if (singleAgent) {
    log.info(
      `Single-agent mode: only ${bold(agents[0].displayName)} detected.`,
    );
  } else {
    log.success(
      `Found agents: ${agents.map((a) => a.displayName).join(", ")}`,
    );
  }

  // --- Task ---
  log.step(2, "Task definition");

  let taskDescription = opts.task;
  if (!taskDescription) {
    taskDescription = await ask("Task description:");
    if (!taskDescription) {
      log.error("Task description is required.");
      process.exit(1);
    }
  }

  const taskName =
    (await ask("Short task name (for branch names):", "task")) || "task";
  const sessionName = `agentmux-${taskName}-${Date.now()}`;

  // --- Setup ---
  log.step(3, "Setting up environment...");

  // Ensure codex config if codex is among the agents
  if (agents.some((a) => a.name === "codex")) {
    await ensureCodexConfig();
    log.success("Codex config ready (OpenRouter provider)");
  }

  // Ensure .worktrees is in .gitignore
  await worktree.ensureWorktreeIgnored();

  const baseBranch = worktree.getBaseBranch();

  // Create worktrees
  const agentWorktrees: { agent: AgentConfig; path: string }[] = [];
  for (const agent of singleAgent ? [agents[0]] : agents) {
    const wtPath = worktree.createWorktree(
      `${taskName}-${agent.name}`,
      baseBranch,
    );
    agentWorktrees.push({ agent, path: wtPath });
    log.success(
      `Worktree: ${wtPath} → branch agentmux/${taskName}-${agent.name}`,
    );
  }

  // --- Coding Phase ---
  log.step(4, "Starting coding phase...");

  tmux.createSession(sessionName);

  if (!singleAgent) {
    tmux.splitHorizontal(sessionName);
    tmux.setLayout(sessionName, "even-horizontal");
  }

  // Send agent commands to panes
  for (let i = 0; i < agentWorktrees.length; i++) {
    const { agent, path } = agentWorktrees[i];
    const env = agent.getEnv(apiKey);
    const cmd = agent.buildRunCommand(taskDescription, path);
    const fullCmd = buildShellCommand(env, path, cmd);

    tmux.sendKeys(sessionName, i, fullCmd);
  }

  console.log();
  log.info(
    `Attaching to tmux session ${bold(sessionName)}. ` +
      dim("Detach with Ctrl-b d when agents are done."),
  );
  console.log();

  // Attach — blocks until user detaches
  tmux.attach(sessionName);

  // --- Post-coding ---
  log.step(5, "Post-coding phase...");

  // Auto-commit any uncommitted changes
  for (const { agent, path } of agentWorktrees) {
    const committed = worktree.commitUncommitted(path, agent.name);
    if (committed) {
      log.info(`Auto-committed uncommitted changes for ${agent.displayName}`);
    }
  }

  // Kill the coding session
  if (tmux.sessionExists(sessionName)) {
    tmux.killSession(sessionName);
  }

  // --- Cross-review (only for multi-agent) ---
  if (!singleAgent) {
    log.step(6, "Cross-review phase");

    const doReview = await confirm("Proceed to cross-review?");
    if (doReview) {
      const reviewSession = `${sessionName}-review`;
      tmux.createSession(reviewSession);
      tmux.splitHorizontal(reviewSession);
      tmux.setLayout(reviewSession, "even-horizontal");

      // Each agent reviews the OTHER agent's changes
      for (let i = 0; i < agentWorktrees.length; i++) {
        const reviewer = agentWorktrees[i];
        const otherIdx = i === 0 ? 1 : 0;
        const otherWorktree = agentWorktrees[otherIdx];

        // Check if the other agent produced any changes
        const diff = worktree.getDiff(otherWorktree.path, baseBranch);
        if (!diff) {
          log.warn(
            `${otherWorktree.agent.displayName} produced no changes — skipping review by ${reviewer.agent.displayName}.`,
          );
          continue;
        }

        const env = reviewer.agent.getEnv(apiKey);
        // Review happens FROM the other agent's worktree so the reviewer can see the code
        const cmd = reviewer.agent.buildReviewCommand(
          baseBranch,
          otherWorktree.path,
        );
        const fullCmd = buildShellCommand(env, otherWorktree.path, cmd);

        tmux.sendKeys(reviewSession, i, fullCmd);
      }

      console.log();
      log.info(
        `Attaching to review session ${bold(reviewSession)}. ` +
          dim("Detach with Ctrl-b d when done."),
      );
      console.log();
      tmux.attach(reviewSession);

      if (tmux.sessionExists(reviewSession)) {
        tmux.killSession(reviewSession);
      }
    }
  }

  // --- Summary ---
  console.log();
  log.success("Session complete!");
  console.log();
  console.log(bold("  Branches:"));
  for (const { agent } of agentWorktrees) {
    const branchName = `agentmux/${taskName}-${agent.name}`;
    console.log(`    ${cyan(agent.displayName)}: ${green(branchName)}`);
    console.log(`      ${dim(`git diff ${baseBranch}..${branchName}`)}`);
  }
  console.log();

  const doCleanup = await confirm("Remove worktrees?", false);
  if (doCleanup) {
    for (const { agent } of agentWorktrees) {
      worktree.removeWorktree(`${taskName}-${agent.name}`);
      log.success(`Removed worktree: ${taskName}-${agent.name}`);
    }
  } else {
    log.info(
      "Worktrees preserved. Run `agentmux cleanup` to remove them later.",
    );
  }
}
