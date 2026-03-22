function run(args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(["tmux", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

export function createSession(name: string): void {
  const { exitCode, stderr } = run(["new-session", "-d", "-s", name]);
  if (exitCode !== 0) {
    throw new Error(`Failed to create tmux session '${name}': ${stderr}`);
  }
}

export function splitHorizontal(name: string): void {
  run(["split-window", "-h", "-t", name]);
}

export function sendKeys(name: string, pane: number, cmd: string): void {
  run(["send-keys", "-t", `${name}:0.${pane}`, cmd, "Enter"]);
}

export function setLayout(name: string, layout: string): void {
  run(["select-layout", "-t", name, layout]);
}

export function attach(name: string): void {
  // Blocking — hands control to the user
  Bun.spawnSync(["tmux", "attach-session", "-t", name], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
}

export function waitForSession(name: string): Promise<void> {
  // Poll until the tmux session no longer exists (agents finished)
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const { exitCode } = run(["has-session", "-t", name]);
      if (exitCode !== 0) {
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });
}

export function killSession(name: string): void {
  run(["kill-session", "-t", name]);
}

export function sessionExists(name: string): boolean {
  const { exitCode } = run(["has-session", "-t", name]);
  return exitCode === 0;
}

export function listAgentmuxSessions(): string[] {
  const { stdout } = run(["list-sessions", "-F", "#{session_name}"]);
  if (!stdout) return [];
  return stdout
    .split("\n")
    .filter((s) => s.startsWith("agentmux-"));
}
