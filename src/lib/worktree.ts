const WORKTREE_DIR = ".worktrees";

function run(
  args: string[],
  cwd?: string,
): { stdout: string; stderr: string; exitCode: number } {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
    exitCode: result.exitCode,
  };
}

export function getBaseBranch(): string {
  const { stdout, exitCode } = run(["branch", "--show-current"]);
  if (exitCode !== 0 || !stdout) {
    return "HEAD";
  }
  return stdout;
}

export function createWorktree(name: string, baseBranch: string): string {
  const worktreePath = `${WORKTREE_DIR}/${name}`;
  const branchName = `agentmux/${name}`;
  const { exitCode, stderr } = run([
    "worktree",
    "add",
    worktreePath,
    "-b",
    branchName,
    baseBranch,
  ]);
  if (exitCode !== 0) {
    throw new Error(`Failed to create worktree '${name}': ${stderr}`);
  }
  return worktreePath;
}

export function removeWorktree(name: string): void {
  const worktreePath = `${WORKTREE_DIR}/${name}`;
  run(["worktree", "remove", worktreePath, "--force"]);
  // Also clean up the branch
  run(["branch", "-D", `agentmux/${name}`]);
}

export function getDiff(worktreePath: string, baseBranch: string): string {
  const { stdout } = run(["diff", `${baseBranch}..HEAD`], worktreePath);
  return stdout;
}

export function commitUncommitted(worktreePath: string, agentName: string): boolean {
  // Check for uncommitted changes
  const { stdout: status } = run(["status", "--porcelain"], worktreePath);
  if (!status) return false;

  run(["add", "-A"], worktreePath);
  run(
    ["commit", "-m", `agentmux: auto-commit ${agentName} changes`],
    worktreePath,
  );
  return true;
}

export function listWorktrees(): string[] {
  const { stdout } = run(["worktree", "list", "--porcelain"]);
  const paths: string[] = [];
  for (const line of stdout.split("\n")) {
    if (line.startsWith("worktree ") && line.includes(WORKTREE_DIR)) {
      paths.push(line.replace("worktree ", ""));
    }
  }
  return paths;
}

export async function ensureWorktreeIgnored(): Promise<void> {
  const gitignorePath = ".gitignore";
  let content = "";
  try {
    content = await Bun.file(gitignorePath).text();
  } catch {
    // No .gitignore yet
  }
  if (!content.includes(WORKTREE_DIR)) {
    await Bun.write(gitignorePath, content + `\n${WORKTREE_DIR}/\n`);
  }
}
