import { login } from "../lib/auth";
import { maskKey } from "../lib/config-store";
import { log } from "../lib/prompts";

export async function loginCommand(): Promise<void> {
  log.info("Starting OpenRouter OAuth login...");
  try {
    const { key, user_id } = await login();
    log.success(`Authenticated! Key: ${maskKey(key)}`);
    if (user_id) {
      log.info(`User ID: ${user_id}`);
    }
  } catch (err) {
    log.error(`Login failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
