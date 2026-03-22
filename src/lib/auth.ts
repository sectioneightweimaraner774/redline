import { log } from "./prompts";
import { loadConfig, saveConfig } from "./config-store";

interface PKCEPair {
  code_verifier: string;
  code_challenge: string;
}

async function generatePKCE(): Promise<PKCEPair> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const code_verifier = Buffer.from(array).toString("base64url");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code_verifier),
  );
  const code_challenge = Buffer.from(digest).toString("base64url");
  return { code_verifier, code_challenge };
}

export async function login(): Promise<{ key: string; user_id?: string }> {
  const { code_verifier, code_challenge } = await generatePKCE();
  const callbackUrl = "http://localhost:3000/callback";

  let resolveCode: (code: string) => void;
  const codePromise = new Promise<string>((res) => {
    resolveCode = res;
  });

  const server = Bun.serve({
    port: 3000,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        if (code) {
          resolveCode(code);
          return new Response(
            `<html><body style="font-family:system-ui;text-align:center;padding:60px">
              <h1>Authenticated!</h1>
              <p>You can close this tab and return to your terminal.</p>
            </body></html>`,
            { headers: { "Content-Type": "text/html" } },
          );
        }
        return new Response("Missing code parameter", { status: 400 });
      }
      return new Response("Not found", { status: 404 });
    },
  });

  const authUrl =
    `https://openrouter.ai/auth` +
    `?callback_url=${encodeURIComponent(callbackUrl)}` +
    `&code_challenge=${code_challenge}` +
    `&code_challenge_method=S256`;

  log.info("Opening browser for authentication...");
  console.log(`\n  ${authUrl}\n`);

  // Open browser
  const openCmd =
    process.platform === "darwin"
      ? ["open", authUrl]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", authUrl]
        : ["xdg-open", authUrl];
  Bun.spawn(openCmd, { stdout: "ignore", stderr: "ignore" });

  log.info("Waiting for callback...");
  const code = await codePromise;
  server.stop();

  // Exchange code for key
  const resp = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier,
      code_challenge_method: "S256",
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Key exchange failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as { key: string; user_id?: string };

  // Persist
  const config = await loadConfig();
  config.openrouter_api_key = data.key;
  if (data.user_id) config.user_id = data.user_id;
  await saveConfig(config);

  return data;
}
