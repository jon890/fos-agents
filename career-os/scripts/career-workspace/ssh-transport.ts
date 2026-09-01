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
  validateSshArgs(config.sshArgs ?? [], action);
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

function validateSshArgs(args: readonly string[], action: SshAction): void {
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (isUnsafeToken(option)) {
      throw new TransportError(makeRemoteError(action, "TRANSPORT_UNAVAILABLE"));
    }
    if (option === "-p") {
      index += 1;
      validatePort(args[index], action);
      continue;
    }
    if (option === "-i") {
      index += 1;
      validateKeyPath(args[index], action);
      continue;
    }
    if (option === "-o") {
      index += 1;
      validateSshOption(args[index], action);
      continue;
    }
    throw new TransportError(makeRemoteError(action, "TRANSPORT_UNAVAILABLE"));
  }
}

function validatePort(port: string | undefined, action: SshAction): void {
  if (!port || !/^[0-9]{1,5}$/.test(port)) {
    throw new TransportError(makeRemoteError(action, "TRANSPORT_UNAVAILABLE"));
  }
  const parsed = Number(port);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new TransportError(makeRemoteError(action, "TRANSPORT_UNAVAILABLE"));
  }
}

function validateKeyPath(keyPath: string | undefined, action: SshAction): void {
  if (
    !keyPath
    || isUnsafeToken(keyPath)
    || keyPath.startsWith("-")
    || /\s/.test(keyPath)
    || keyPath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new TransportError(makeRemoteError(action, "TRANSPORT_UNAVAILABLE"));
  }
}

function validateSshOption(option: string | undefined, action: SshAction): void {
  if (
    option !== "IdentitiesOnly=yes"
    && option !== "StrictHostKeyChecking=yes"
    && option !== "StrictHostKeyChecking=accept-new"
  ) {
    throw new TransportError(makeRemoteError(action, "TRANSPORT_UNAVAILABLE"));
  }
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
