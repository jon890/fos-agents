import { revisionSchema } from "./contracts.ts";
import { makeRemoteError, parseRemoteError, parseRemotePublish, parseRemoteStatus, TransportError, type CareerWorkspaceTransport } from "./transport.ts";

type SshAction = "status" | "export" | "publish";

export interface SshTransportConfig {
  sshTarget: string;
  remoteCommand: string;
  sshArgs?: string[];
}

export class SshCareerWorkspaceTransport implements CareerWorkspaceTransport {
  constructor(private readonly config: SshTransportConfig) {}

  async status() {
    validateSshConfig(this.config, "status");
    const output = await runRemoteCommand(this.config, ["status"]);
    try {
      return parseRemoteStatus(new TextDecoder().decode(output.stdout));
    } catch {
      throw new TransportError(makeRemoteError("status", "TRANSPORT_UNAVAILABLE"));
    }
  }

  async export(revision: string): Promise<Uint8Array> {
    if (!revisionSchema.safeParse(revision).success) {
      throw new TransportError(makeRemoteError("export", "INVALID_MANIFEST"));
    }
    validateSshConfig(this.config, "export");
    const output = await runRemoteCommand(this.config, ["export", "--revision", revision]);
    return output.stdout;
  }

  async publish(archive: Uint8Array) {
    validateSshConfig(this.config, "publish");
    const output = await runRemoteCommand(this.config, ["publish"], archive);
    try {
      return parseRemotePublish(new TextDecoder().decode(output.stdout));
    } catch {
      throw new TransportError(makeRemoteError("publish", "TRANSPORT_UNAVAILABLE"));
    }
  }
}

export function validateSshConfig(config: SshTransportConfig, action: SshAction = "status"): void {
  if (
    isUnsafeToken(config.sshTarget)
    || config.sshTarget.startsWith("-")
    || !/^[A-Za-z0-9_.@:%[\]-]+$/.test(config.sshTarget)
  ) {
    throw new TransportError(makeRemoteError(action, "TRANSPORT_UNAVAILABLE"));
  }
  const commandSegments = config.remoteCommand.split("/");
  if (
    isUnsafeToken(config.remoteCommand)
    || !/^(?:\/[A-Za-z0-9._-]+)+$|^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(config.remoteCommand)
    || commandSegments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new TransportError(makeRemoteError(action, "TRANSPORT_UNAVAILABLE"));
  }
  for (const arg of config.sshArgs ?? []) {
    if (isUnsafeToken(arg)) {
      throw new TransportError(makeRemoteError(action, "TRANSPORT_UNAVAILABLE"));
    }
  }
}

export function buildSshInvocationArgs(config: SshTransportConfig, commandArgs: string[]): string[] {
  return [
    ...(config.sshArgs ?? []),
    "--",
    config.sshTarget,
    config.remoteCommand,
    ...commandArgs,
  ];
}

function isUnsafeToken(token: string): boolean {
  return token.length === 0 || /[\0-\x1F\x7F]/.test(token);
}

async function runRemoteCommand(
  config: SshTransportConfig,
  commandArgs: string[],
  stdin?: Uint8Array,
): Promise<{ stdout: Uint8Array; stderr: Uint8Array }> {
  const args = buildSshInvocationArgs(config, commandArgs);
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
    const action = commandArgs[0] as SshAction;
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
