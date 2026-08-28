import { revisionSchema } from "./contracts.ts";
import { parseRemoteError, parseRemotePublish, parseRemoteStatus, TransportError, type CareerWorkspaceTransport } from "./transport.ts";

export interface SshTransportConfig {
  sshTarget: string;
  remoteCommand: string;
  sshArgs?: string[];
}

export class SshCareerWorkspaceTransport implements CareerWorkspaceTransport {
  constructor(private readonly config: SshTransportConfig) {}

  async status() {
    validateSshConfig(this.config);
    const output = await runRemoteCommand(this.config, ["status"]);
    return parseRemoteStatus(new TextDecoder().decode(output.stdout));
  }

  async export(revision: string): Promise<Uint8Array> {
    revisionSchema.parse(revision);
    validateSshConfig(this.config);
    const output = await runRemoteCommand(this.config, ["export", "--revision", revision]);
    return output.stdout;
  }

  async publish(archive: Uint8Array) {
    validateSshConfig(this.config);
    const output = await runRemoteCommand(this.config, ["publish"], archive);
    return parseRemotePublish(new TextDecoder().decode(output.stdout));
  }
}

export function validateSshConfig(config: SshTransportConfig): void {
  if (isUnsafeToken(config.sshTarget) || config.sshTarget.startsWith("-")) {
    throw new TransportError({ schemaVersion: 1, action: "status", ok: false, code: "TRANSPORT_UNAVAILABLE" });
  }
  if (isUnsafeToken(config.remoteCommand) || config.remoteCommand.startsWith("-") || config.remoteCommand.includes(" ")) {
    throw new TransportError({ schemaVersion: 1, action: "status", ok: false, code: "TRANSPORT_UNAVAILABLE" });
  }
  for (const arg of config.sshArgs ?? []) {
    if (isUnsafeToken(arg)) {
      throw new TransportError({ schemaVersion: 1, action: "status", ok: false, code: "TRANSPORT_UNAVAILABLE" });
    }
  }
}

function isUnsafeToken(token: string): boolean {
  return token.length === 0 || /[\0-\x1F\x7F]/.test(token);
}

async function runRemoteCommand(
  config: SshTransportConfig,
  commandArgs: string[],
  stdin?: Uint8Array,
): Promise<{ stdout: Uint8Array; stderr: Uint8Array }> {
  const args = [
    ...(config.sshArgs ?? []),
    config.sshTarget,
    "--",
    config.remoteCommand,
    ...commandArgs,
  ];
  const proc = Bun.spawn(["ssh", ...args], {
    stdin: stdin ? "pipe" : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  if (stdin && proc.stdin) {
    await proc.stdin.write(stdin);
    await proc.stdin.end();
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).bytes(),
    new Response(proc.stderr).bytes(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    const action = commandArgs[0] as "status" | "export" | "publish";
    try {
      throw new TransportError(parseRemoteError(action, new TextDecoder().decode(stderr)));
    } catch (error) {
      if (error instanceof TransportError) {
        throw error;
      }
      throw new TransportError({
        schemaVersion: 1,
        action,
        ok: false,
        code: "TRANSPORT_UNAVAILABLE",
      });
    }
  }

  return { stdout, stderr };
}
