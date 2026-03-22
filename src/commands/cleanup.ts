import { listWorktrees, removeWorktree } from "../lib/worktree";
import { listAgentmuxSessions, killSession } from "../lib/tmux";
import { log, confirm } from "../lib/prompts";

export async function cleanupCommand(force: boolean): Promise<void> {
  const worktrees = listWorktrees();
  const sessions = listAgentmuxSessions();

  if (worktrees.length === 0 && sessions.length === 0) {
    log.info("Nothing to clean up.");
    return;
  }

  if (worktrees.length > 0) {
    log.info(`Found ${worktrees.length} agentmux worktree(s):`);
    for (const wt of worktrees) console.log(`  ${wt}`);
  }

  if (sessions.length > 0) {
    log.info(`Found ${sessions.length} agentmux tmux session(s):`);
    for (const s of sessions) console.log(`  ${s}`);
  }

  if (!force) {
    const ok = await confirm("\nRemove all?");
    if (!ok) {
      log.info("Cancelled.");
      return;
    }
  }

  for (const s of sessions) {
    killSession(s);
    log.success(`Killed tmux session: ${s}`);
  }

  for (const wt of worktrees) {
    // Extract the worktree name from the path
    const name = wt.split("/").pop()!;
    try {
      removeWorktree(name);
      log.success(`Removed worktree: ${name}`);
    } catch (err) {
      log.error(`Failed to remove worktree ${name}: ${(err as Error).message}`);
    }
  }

  log.success("Cleanup complete.");
}
