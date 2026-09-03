import { stat } from "node:fs/promises";
import path from "node:path";
import { revisionSchema } from "./contracts.ts";
import {
  makeRemoteError,
  parseRemoteError,
  parseRemotePublish,
  parseRemoteStatus,
  TransportError,
  type CareerWorkspaceTransport,
} from "./transport.ts";

type CommandAction = "status" | "export" | "publish";

export interface CommandTransportConfig {
  command: string;
}

export class CommandCareerWorkspaceTransport implements CareerWorkspaceTransport {
  constructor(private readonly config: CommandTransportConfig) {}

  async status() {
    const output = await runCommand(this.config, ["status"]);
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
    return (await runCommand(this.config, ["export", "--revision", revision])).stdout;
  }

  async publish(archive: Uint8Array) {
    const output = await runCommand(this.config, ["publish"], archive);
    try {
      return parseRemotePublish(new TextDecoder().decode(output.stdout));
    } catch {
      throw new TransportError(makeRemoteError("publish", "TRANSPORT_UNAVAILABLE"));
    }
  }
}

export async function validateCommandTransportConfig(
  config: CommandTransportConfig,
  action: CommandAction = "status",
): Promise<void> {
  if (
    !path.isAbsolute(config.command)
    || config.command.length === 0
    || /[\0-\x1F\x7F]/.test(config.command)
  ) {
    throw unavailable(action);
  }

  try {
    if (!(await stat(config.command)).isFile()) {
      throw unavailable(action);
    }
  } catch (error) {
    if (error instanceof TransportError) {
      throw error;
    }
    throw unavailable(action);
  }
}

async function runCommand(
  config: CommandTransportConfig,
  commandArgs: string[],
  stdin?: Uint8Array,
): Promise<{ stdout: Uint8Array; stderr: Uint8Array }> {
  const action = commandArgs[0] as CommandAction;
  await validateCommandTransportConfig(config, action);

  let proc: Bun.Subprocess<"pipe", "pipe", "pipe">;
  try {
    proc = Bun.spawn([config.command, ...commandArgs], {
      stdin: stdin ? "pipe" : "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch {
    throw unavailable(action);
  }

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
    try {
      throw new TransportError(parseRemoteError(action, new TextDecoder().decode(stderr)));
    } catch (error) {
      if (error instanceof TransportError) {
        throw error;
      }
      throw unavailable(action);
    }
  }
  return { stdout, stderr };
}

function unavailable(action: CommandAction): TransportError {
  return new TransportError(makeRemoteError(action, "TRANSPORT_UNAVAILABLE"));
}
