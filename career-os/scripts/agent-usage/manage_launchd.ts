import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export const LAUNCHD_LABEL = "com.fos-agents.career-os.agent-usage";

export type LaunchdDeps = {
  home: string;
  uid: number;
  repoRoot: string;
  bunPath: string;
  run: (command: string, args: string[]) => { status: number; stdout: string };
  write: (line: string) => void;
};

const usage = `사용법: manage_launchd.ts <명령> [--dry-run]\n\n사용량 수집기를 매일 10시에 돌리는 launchd 작업을 관리한다.\n\n명령:\n  install [--dry-run]    plist 를 쓰고 launchd 에 등록한다\n  uninstall [--dry-run]  launchd 에서 내리고 plist 를 지운다\n  status                 등록 여부, plist 존재, 로그 끝 다섯 줄을 낸다\n  help, --help, -h\n`;

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderPlist(template: string, values: { bunPath: string; repoRoot: string; logDir: string }): string {
  for (const [name, value] of Object.entries(values)) {
    if (!isAbsolute(value)) throw new Error(`${name} 는 절대 경로여야 한다: ${value}`);
  }
  const rendered = template
    .replaceAll("{{BUN_PATH}}", () => escapeXml(values.bunPath))
    .replaceAll("{{REPO_ROOT}}", () => escapeXml(values.repoRoot))
    .replaceAll("{{LOG_DIR}}", () => escapeXml(values.logDir));
  if (rendered.includes("{{")) throw new Error("채우지 못한 자리표시자가 남았다");
  return rendered;
}

export function manageLaunchd(args: string[], deps: LaunchdDeps): number {
  const [command, ...rest] = args;
  const dryRun = rest.includes("--dry-run");
  const { home, uid, repoRoot, run, write } = deps;
  const plistPath = join(home, "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`);
  const logDir = join(home, "Library", "Logs", "fos-career-os");
  const logPath = join(logDir, "agent-usage.log");
  const domain = `gui/${uid}`;
  const target = `${domain}/${LAUNCHD_LABEL}`;

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      write(usage);
      return 0;
    case "install": {
      const template = readFileSync(join(import.meta.dir, "launchd", "agent-usage.plist.template"), "utf8");
      const plist = renderPlist(template, { bunPath: deps.bunPath, repoRoot, logDir });
      if (dryRun) {
        write(`쓸 파일: ${plistPath}`);
        write(`실행할 명령: launchctl bootout ${target}`);
        write(`실행할 명령: launchctl bootstrap ${domain} ${plistPath}`);
        write(plist);
        return 0;
      }
      if (!existsSync(join(repoRoot, "career-os", ".env"))) {
        write("career-os/.env 가 없다");
        return 1;
      }
      mkdirSync(logDir, { recursive: true });
      mkdirSync(join(home, "Library", "LaunchAgents"), { recursive: true });
      writeFileSync(plistPath, plist);
      run("launchctl", ["bootout", target]);
      const result = run("launchctl", ["bootstrap", domain, plistPath]);
      if (result.status !== 0) {
        write(`launchctl bootstrap 실패: status ${result.status}`);
        return 1;
      }
      write(`등록했다: ${plistPath}`);
      return 0;
    }
    case "uninstall":
      if (dryRun) {
        write(`지울 파일: ${plistPath}`);
        write(`실행할 명령: launchctl bootout ${target}`);
        return 0;
      }
      run("launchctl", ["bootout", target]);
      rmSync(plistPath, { force: true });
      write(`내렸다: ${plistPath}`);
      return 0;
    case "status": {
      write(run("launchctl", ["print", target]).status === 0 ? "LOADED" : "NOT_LOADED");
      write(existsSync(plistPath) ? "PLIST_PRESENT" : "PLIST_MISSING");
      if (existsSync(logPath)) {
        const lines = readFileSync(logPath, "utf8").split("\n").filter((line) => line !== "");
        for (const line of lines.slice(-5)) write(line);
      }
      return 0;
    }
    default:
      process.stderr.write(usage);
      return 2;
  }
}

if (import.meta.main) {
  const code = manageLaunchd(process.argv.slice(2), {
    home: homedir(),
    uid: process.getuid?.() ?? 0,
    repoRoot: resolve(import.meta.dir, "../../.."),
    bunPath: process.execPath,
    run: (command, args) => {
      const result = Bun.spawnSync([command, ...args]);
      return { status: result.exitCode ?? 1, stdout: result.stdout.toString() };
    },
    write: (line) => console.log(line),
  });
  process.exit(code);
}
