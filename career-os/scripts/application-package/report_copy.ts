/**
 * 지원 폴더의 결과 파일을 작업 폴더 `reports/` 에 날짜가 든 이름으로 복사한다.
 *
 * 에이전트는 이 사본을 「내 파일」 에 넣는다. 복사와 이름 짓기를 에이전트에게 맡기지 않는 것은
 * 공고 추천에서 넣기를 건너뛴 적이 있어, 실행기가 넣을 파일을 한 줄로 알리게 한 것과 같은 이유다.
 */

import { copyFileSync, existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** 파일 이름으로 정하는 결과 종류다. 여기 없는 이름은 복사하지 않는다. */
const REPORT_KINDS: Readonly<Record<string, string>> = {
  "application-package.html": "application",
  "resume.html": "resume",
  "resume.pdf": "resume",
  "career-description.html": "career-description",
  "career-description.pdf": "career-description",
  "resume-review.html": "resume-review",
};

export class ReportCopyUsageError extends Error {}

function seoulDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

/**
 * 파일 이름에 넣을 수 있게 회사와 직무 이름의 경로 구분자와 공백을 `-` 하나로 바꾼다.
 * 이어진 `-` 를 하나로 줄여, 회사와 직무 사이의 `--` 가 이름 안에 나오지 않게 한다.
 */
function slug(value: string): string {
  return value.trim().replace(/[\\/\s-]+/g, "-");
}

function isOutside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

/**
 * 링크를 풀어 비교한다. 지원 폴더 안의 링크가 작업 폴더 밖 파일을 가리키면 밖으로 본다.
 * 없는 경로는 있는 상위까지만 풀어, 없는 파일을 「밖」 이 아니라 「없음」 으로 알리게 한다.
 */
function real(path: string): string {
  const absolute = resolve(path);
  if (existsSync(absolute)) return realpathSync(absolute);
  const parent = dirname(absolute);
  return parent === absolute ? absolute : join(real(parent), basename(absolute));
}

export function copyReport(input: { root: string; applicationDirectory: string; file: string; now: Date }): string {
  const root = real(input.root);
  const applicationDirectory = real(input.applicationDirectory);
  const segments = relative(join(root, "applications"), applicationDirectory).split(sep);
  if (segments.length !== 2 || segments.some((segment) => !segment || segment === "..")) {
    throw new ReportCopyUsageError("지원 디렉터리는 작업 폴더의 applications/<회사>/<직무> 여야 합니다.");
  }
  const requested = resolve(input.file);
  const name = basename(requested);
  const file = real(requested);
  if (isOutside(applicationDirectory, file)) {
    throw new ReportCopyUsageError("복사할 파일은 지원 디렉터리 안에 있어야 합니다.");
  }
  const kind = REPORT_KINDS[name];
  if (!kind) {
    throw new ReportCopyUsageError(`복사할 수 있는 파일은 ${Object.keys(REPORT_KINDS).join(", ")} 입니다: ${name}`);
  }
  if (!existsSync(file) || !lstatSync(file).isFile()) throw new Error(`파일이 없습니다: ${requested}`);

  const [company, role] = segments as [string, string];
  const extension = name.slice(name.lastIndexOf("."));
  const target = join(root, "reports", `${seoulDate(input.now)}-${kind}-${slug(company)}--${slug(role)}${extension}`);
  mkdirSync(join(root, "reports"), { recursive: true });
  copyFileSync(file, target);
  return target;
}
