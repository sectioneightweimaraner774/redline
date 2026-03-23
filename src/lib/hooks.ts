import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const REDLINE_MARKER = "redline check";

/** Walk up from cwd to find the git repo root. */
export function findProjectRoot(from: string = process.cwd()): string | null {
  let dir = from;
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}

interface HookEntry {
  type: string;
  command: string;
  timeout?: number;
}

interface HookGroup {
  matcher?: string;
  hooks: HookEntry[];
}

interface Settings {
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
}

function settingsPath(projectRoot: string): string {
  return join(projectRoot, ".claude", "settings.local.json");
}

async function readSettings(path: string): Promise<Settings> {
  try {
    const text = await Bun.file(path).text();
    return JSON.parse(text) as Settings;
  } catch {
    return {};
  }
}

async function writeSettings(path: string, settings: Settings): Promise<void> {
  const dir = join(path, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await Bun.write(path, JSON.stringify(settings, null, 2) + "\n");
}

/** Install the redline Stop hook into .claude/settings.local.json. */
export async function installHook(
  projectRoot: string,
  model?: string,
): Promise<{ installed: boolean; updated: boolean }> {
  const path = settingsPath(projectRoot);
  const settings = await readSettings(path);

  // Build the command
  const parts = [REDLINE_MARKER];
  if (model) parts.push(model);
  const command = parts.join(" ");

  // Ensure hooks.Stop exists
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.Stop) settings.hooks.Stop = [];

  // Check if we already have a redline hook
  for (const group of settings.hooks.Stop) {
    for (let i = 0; i < group.hooks.length; i++) {
      if (group.hooks[i].command.startsWith(REDLINE_MARKER)) {
        if (group.hooks[i].command === command) {
          return { installed: false, updated: false }; // already identical
        }
        // Update existing
        group.hooks[i].command = command;
        await writeSettings(path, settings);
        return { installed: true, updated: true };
      }
    }
  }

  // Add new hook group
  settings.hooks.Stop.push({
    hooks: [
      {
        type: "command",
        command,
        timeout: 10,
      },
    ],
  });

  await writeSettings(path, settings);
  return { installed: true, updated: false };
}

/** Remove the redline Stop hook from .claude/settings.local.json. */
export async function removeHook(
  projectRoot: string,
): Promise<boolean> {
  const path = settingsPath(projectRoot);
  const settings = await readSettings(path);

  if (!settings.hooks?.Stop) return false;

  let removed = false;

  // Filter out redline hooks from each group
  settings.hooks.Stop = settings.hooks.Stop
    .map((group) => ({
      ...group,
      hooks: group.hooks.filter((h) => {
        if (h.command.startsWith(REDLINE_MARKER)) {
          removed = true;
          return false;
        }
        return true;
      }),
    }))
    .filter((group) => group.hooks.length > 0);

  // Clean up empty structures
  if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  await writeSettings(path, settings);
  return removed;
}
