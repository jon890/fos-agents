/**
 * 스킬 스크립트를 CLI 로 감쌀 때 반복되는 부분을 담는다.
 *
 * 인자 파싱, 사용법 오류 처리와 결과 출력이 스크립트마다 같은 모양으로 되풀이되어
 * 정작 그 스크립트가 무엇을 검사하고 무엇을 만드는지가 가려졌다.
 * 이 파일이 그 셋을 맡고, 각 스크립트는 자기 로직만 남긴다.
 *
 * ## 종료 코드
 *
 * | 코드 | 뜻 |
 * | --- | --- |
 * | 0 | 통과 |
 * | 1 | 검사나 실행 실패 |
 * | 2 | 사용법 오류. 인자가 없거나 값이 규격에 맞지 않다 |
 *
 * 사용법 오류를 1 과 나누는 이유는 호출하는 쪽이 재시도할지 인자를 고칠지 가리기 위해서다.
 */

export type OptionSpec = {
  /** 값을 받는 옵션인지. false 면 있고 없고만 본다. */
  value?: boolean;
  /** `--help` 에 출력할 설명. */
  description: string;
  /** 값이 이 정규식에 맞지 않으면 사용법 오류로 끝낸다. */
  pattern?: RegExp;
  /** 값을 주지 않았을 때 쓸 값. */
  fallback?: string;
};

export type PositionalSpec = {
  name: string;
  description: string;
  required?: boolean;
};

export type CliSpec = {
  /** 도움말 첫 줄에 쓰는 이름. */
  name: string;
  /** 이 스크립트가 하는 일 한 줄. */
  summary: string;
  positional?: PositionalSpec[];
  options?: Record<string, OptionSpec>;
};

export type ParsedArgs = {
  positional: string[];
  options: Record<string, string | boolean | undefined>;
};

export class UsageError extends Error {}

/** 기존 CLI의 첫 옵션값 조회. 중복, 모르는 옵션과 옵션 모양의 값도 기존대로 둔다. */
export function firstOptionValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function formatHelp(spec: CliSpec): string {
  const lines = [spec.name, '', spec.summary, '', 'Usage:'];
  // 이름에 이미 꺾쇠가 있으면 그대로 쓴다. 겹쳐 감싸면 <<이름>> 이 된다.
  const slots = (spec.positional ?? [])
    .map((p) => {
      const slot = /^[<[].*[>\]]$/.test(p.name) ? p.name : `<${p.name}>`;
      return p.required === false ? `[${slot}]` : slot;
    })
    .join(' ');
  lines.push(`  ${spec.name} ${slots}`.trimEnd());

  if (spec.positional?.length) {
    lines.push('', 'Arguments:');
    const width = Math.max(...spec.positional.map((p) => p.name.length));
    for (const p of spec.positional) {
      lines.push(`  ${p.name.padEnd(width)}  ${p.description}`);
    }
  }

  const names = Object.keys(spec.options ?? {});
  if (names.length) {
    lines.push('', 'Options:');
    const width = Math.max(...names.map((n) => n.length), '--help'.length);
    for (const name of names) {
      const option = spec.options![name];
      const fallback = option.fallback ? ` 기본값: ${option.fallback}` : '';
      lines.push(`  ${name.padEnd(width)}  ${option.description}${fallback}`);
    }
    lines.push(`  ${'--help'.padEnd(width)}  이 도움말을 보여준다`);
  }
  return lines.join('\n');
}

/**
 * argv 를 spec 대로 나눈다. `--help` 는 호출하는 쪽에서 처리하도록 옵션에 남긴다.
 * 규격에 맞지 않으면 UsageError 를 던진다.
 */
export function parseArgs(argv: string[], spec: CliSpec): ParsedArgs {
  const positional: string[] = [];
  const options: Record<string, string | boolean | undefined> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    if (token === '--help') {
      options['--help'] = true;
      continue;
    }

    const option = spec.options?.[token];
    if (!option) throw new UsageError(`모르는 옵션입니다: ${token}`);

    if (!option.value) {
      options[token] = true;
      continue;
    }

    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new UsageError(`${token} 에 값이 필요합니다.`);
    }
    if (option.pattern && !option.pattern.test(next)) {
      throw new UsageError(`${token} 값이 규격에 맞지 않습니다: ${next}`);
    }
    options[token] = next;
    i++;
  }

  for (const [name, option] of Object.entries(spec.options ?? {})) {
    if (options[name] === undefined && option.fallback !== undefined) {
      options[name] = option.fallback;
    }
  }

  // 도움말은 인자를 갖추지 않아도 볼 수 있어야 한다.
  if (options['--help']) return { positional, options };

  const required = (spec.positional ?? []).filter((p) => p.required !== false);
  if (positional.length < required.length) {
    const missing = required[positional.length];
    throw new UsageError(`${missing.name} 인자가 필요합니다.`);
  }

  return { positional, options };
}

/** 검사 스크립트의 결과. `passed` 로 종료 코드를 정한다. */
export type CheckResult = { passed: boolean } & Record<string, unknown>;

export type RunOptions = {
  /** 결과를 JSON 으로 출력할지. 검사 스크립트는 true, 파일을 만드는 스크립트는 false 를 쓴다. */
  json?: boolean;
};

/**
 * 인자를 나누고 handler 를 실행한 뒤 종료 코드를 정한다.
 *
 * handler 가 CheckResult 를 돌려주면 `passed` 로 0 과 1 을 가른다.
 * 아무것도 돌려주지 않으면 예외가 없는 한 0 으로 끝낸다.
 */
export async function runCli(
  spec: CliSpec,
  handler: (args: ParsedArgs) => Promise<CheckResult | void> | CheckResult | void,
  runOptions: RunOptions = {},
): Promise<never> {
  const json = runOptions.json ?? true;
  const fail = (message: string, code: 1 | 2): never => {
    if (json) {
      console.error(JSON.stringify({ passed: false, error: message }, null, 2));
    } else {
      console.error(message);
    }
    process.exit(code);
  };

  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv.slice(2), spec);
  } catch (error) {
    console.error(formatHelp(spec));
    return fail(error instanceof Error ? error.message : String(error), 2);
  }

  if (args.options['--help']) {
    console.log(formatHelp(spec));
    process.exit(0);
  }

  try {
    const result = await handler(args);
    if (result === undefined) process.exit(0);
    if (json) console.log(JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(formatHelp(spec));
      return fail(error.message, 2);
    }
    return fail(error instanceof Error ? error.message : String(error), 1);
  }
}
