import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config as loadEnv } from "dotenv";
import { configuredValue } from "../../plugin/src/client.ts";

export function resolvePrivateRoot(env: Record<string, string | undefined> = process.env): string {
  return resolve(configuredValue(env.ACCOUNTBOOK_PRIVATE_DIR) || "accountbook/private");
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--env")) {
    process.stderr.write("PRIVATE_ROOT_INVALID_ARGUMENTS\n");
    process.exitCode = 2;
  } else {
    if (args[1]) {
      const result = loadEnv({ path: args[1], quiet: true });
      if (result.error) {
        process.stderr.write("PRIVATE_ROOT_ENV_UNAVAILABLE\n");
        process.exit(2);
      }
    }
    process.stdout.write(`${resolvePrivateRoot()}\n`);
  }
}
