import { createInterface } from "node:readline";

// ANSI color helpers
export const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
export const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
export const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
export const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
export const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
export const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

// Logger
export const log = {
  info: (msg: string) => console.log(cyan("info") + " " + msg),
  success: (msg: string) => console.log(green("ok") + "   " + msg),
  warn: (msg: string) => console.log(yellow("warn") + " " + msg),
  error: (msg: string) => console.error(red("err") + "  " + msg),
  step: (n: number, msg: string) =>
    console.log(bold(cyan(`[${n}]`)) + " " + msg),
};

function createRL() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

export function ask(prompt: string, defaultValue?: string): Promise<string> {
  const rl = createRL();
  const suffix = defaultValue ? dim(` (${defaultValue})`) : "";
  return new Promise((resolve) => {
    rl.question(bold(prompt) + suffix + " ", (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

export function confirm(prompt: string, defaultYes = true): Promise<boolean> {
  const rl = createRL();
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  return new Promise((resolve) => {
    rl.question(bold(prompt) + ` ${dim(hint)} `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === "") resolve(defaultYes);
      else resolve(a === "y" || a === "yes");
    });
  });
}

export function askMultiline(prompt: string): Promise<string> {
  const rl = createRL();
  console.log(bold(prompt) + dim(" (enter empty line to finish)"));
  const lines: string[] = [];
  return new Promise((resolve) => {
    rl.on("line", (line) => {
      if (line === "") {
        rl.close();
        resolve(lines.join("\n"));
      } else {
        lines.push(line);
      }
    });
  });
}
