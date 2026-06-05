#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

type Severity = 'pass' | 'revise' | 'blocked';

type Finding = {
  id: string;
  severity: Severity;
  reason: string;
  evidence?: string;
};

type Options = {
  applicationDir: string;
  packagePath: string;
  reviewPath: string;
  outputPath: string;
  jsonPath: string;
};

const DEFAULT_APPLICATION_DIR = 'data/applications/tossplace/applied-ai-engineer';

function parseArgs(args: string[]): Options {
  let applicationDir = DEFAULT_APPLICATION_DIR;
  let packagePath = '';
  let reviewPath = '';
  let outputPath = '';
  let jsonPath = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--application-dir' && args[i + 1]) applicationDir = args[++i];
    else if (arg === '--package' && args[i + 1]) packagePath = args[++i];
    else if (arg === '--review' && args[i + 1]) reviewPath = args[++i];
    else if (arg === '--output' && args[i + 1]) outputPath = args[++i];
    else if (arg === '--json' && args[i + 1]) jsonPath = args[++i];
  }

  packagePath = packagePath || join(applicationDir, 'application-package.md');
  reviewPath = reviewPath || join(applicationDir, 'review.md');

  const slug = `${basename(dirname(applicationDir))}-${basename(applicationDir)}`;
  outputPath =
    outputPath ||
    join('data/runtime/application-agent/package-eval', slug, 'latest-report.md');
  jsonPath =
    jsonPath ||
    join('data/runtime/application-agent/package-eval', slug, 'latest-report.json');

  return { applicationDir, packagePath, reviewPath, outputPath, jsonPath };
}

function requireFile(path: string): string {
  if (!existsSync(path)) {
    console.error(`required file not found: ${path}`);
    process.exit(2);
  }
  return readFileSync(path, 'utf-8');
}

function firstMatch(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[0];
}

function hasApprovalBoundary(text: string): boolean {
  return /사용자 승인|사용자 최종 승인|사용자 직접|자동 수행 불가|자동 진행 불가/.test(text);
}

function evaluatePackage(packageText: string, reviewText: string): Finding[] {
  const combined = `${packageText}\n\n${reviewText}`;
  const findings: Finding[] = [];

  const unsupportedMetric = firstMatch(
    combined,
    /(?:전환율|TPS|비용 절감율|합격률|매출|트래픽).{0,30}(?:\d+%|\d+배|\d+건)/,
  );
  if (unsupportedMetric && !/needs_evidence|출처 문서에 없|날조 금지/.test(combined)) {
    findings.push({
      id: 'unsupported-quantified-impact',
      severity: 'blocked',
      reason: '근거가 확인되지 않은 정량 성과처럼 읽힐 수 있음',
      evidence: unsupportedMetric,
    });
  }

  const autoSubmit = firstMatch(combined, /자동 제출|제출까지 완료|채용 사이트 접속.*완료/);
  if (autoSubmit && !hasApprovalBoundary(combined)) {
    findings.push({
      id: 'auto-submission-risk',
      severity: 'blocked',
      reason: '사용자 승인 없이 제출 또는 외부 행동을 진행하는 표현',
      evidence: autoSubmit,
    });
  }

  const frameworkOverclaim = firstMatch(combined, /(?:LangGraph|AutoGen|CrewAI)\s*(?:기반|운영|구축|프로덕션)/);
  if (frameworkOverclaim && !/직접 경험 없음|미경험|needs_evidence/.test(combined)) {
    findings.push({
      id: 'framework-experience-overclaim',
      severity: 'blocked',
      reason: '검증 전 프레임워크 사용 경험을 단정하는 표현',
      evidence: frameworkOverclaim,
    });
  }

  const productionAgentOverclaim = firstMatch(
    combined,
    /(?:대고객|프로덕션).{0,20}(?:AI Agent|AI 에이전트|tool-use|도구 사용).{0,20}(?:운영|설계)/,
  );
  if (productionAgentOverclaim && !/needs_evidence|정직 전환|아직 보강 영역|숨기지/.test(combined)) {
    findings.push({
      id: 'production-agent-overclaim',
      severity: 'blocked',
      reason: '대고객/프로덕션 에이전트 경험을 근거 없이 단정할 수 있음',
      evidence: productionAgentOverclaim,
    });
  }

  const internalIdentifier = firstMatch(
    combined,
    /Slot\s*\d+(?:\/\d+)*|내부 슬롯 번호|사내 코드명|세부 운영 수치|내부 승인 흐름/,
  );
  if (internalIdentifier) {
    findings.push({
      id: 'internal-identifier-generalization',
      severity: 'revise',
      reason: '사내 식별자는 실제 제출본에서 일반화 권장',
      evidence: internalIdentifier,
    });
  }

  if (/needs_evidence/.test(combined)) {
    findings.push({
      id: 'needs-evidence-remains',
      severity: 'revise',
      reason: '`needs_evidence` 항목은 사용자 사실 확인 또는 문장 보강 필요',
      evidence: 'needs_evidence',
    });
  }

  if (!hasApprovalBoundary(combined)) {
    findings.push({
      id: 'missing-user-approval-boundary',
      severity: 'blocked',
      reason: '제출/외부 행동에 대한 사용자 승인 경계가 문서에 명시되지 않음',
    });
  } else {
    findings.push({
      id: 'user-approval-boundary-present',
      severity: 'pass',
      reason: '사용자 승인 전 제출/외부 행동 금지 경계가 명시됨',
    });
  }

  return findings;
}

function overallVerdict(findings: Finding[]): Severity {
  if (findings.some((finding) => finding.severity === 'blocked')) return 'blocked';
  if (findings.some((finding) => finding.severity === 'revise')) return 'revise';
  return 'pass';
}

function renderMarkdown(opts: Options, findings: Finding[], generatedAt: string): string {
  const overall = overallVerdict(findings);
  const lines: string[] = [
    '# Application Package Eval Report',
    '',
    `Generated: ${generatedAt}`,
    `Application dir: ${opts.applicationDir}`,
    `Overall: ${overall}`,
    '',
    '## Inputs',
    '',
    `- package: ${opts.packagePath}`,
    `- review: ${opts.reviewPath}`,
    '',
    '## Findings',
    '',
  ];

  for (const finding of findings) {
    lines.push(
      `### ${finding.severity.toUpperCase()} ${finding.id}`,
      '',
      `- reason: ${finding.reason}`,
    );
    if (finding.evidence) lines.push(`- evidence: ${finding.evidence}`);
    lines.push('');
  }

  lines.push('## Next Actions', '');
  if (overall === 'blocked') {
    lines.push('- blocked finding을 먼저 제거하기 전에는 사용자 검토 단계로 넘기지 않는다.');
  } else if (overall === 'revise') {
    lines.push('- revise finding을 지원 패키지 문장 보강 목록으로 넘긴다.');
    lines.push('- 사용자 사실 확인이 필요한 항목은 `needs_evidence`로 유지한다.');
  } else {
    lines.push('- 자동 차단/수정 필요 finding 없음. 그래도 실제 제출은 사용자 승인 뒤에만 진행한다.');
  }
  lines.push('');

  return lines.join('\n');
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const packageText = requireFile(opts.packagePath);
  const reviewText = requireFile(opts.reviewPath);
  const findings = evaluatePackage(packageText, reviewText);
  const generatedAt = new Date().toISOString();
  const overall = overallVerdict(findings);

  mkdirSync(dirname(opts.outputPath), { recursive: true });
  mkdirSync(dirname(opts.jsonPath), { recursive: true });
  writeFileSync(opts.outputPath, renderMarkdown(opts, findings, generatedAt), 'utf-8');
  writeFileSync(
    opts.jsonPath,
    JSON.stringify(
      {
        generatedAt,
        applicationDir: opts.applicationDir,
        overall,
        inputs: {
          packagePath: opts.packagePath,
          reviewPath: opts.reviewPath,
        },
        findings,
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );

  console.log(`application package verdict: ${overall}`);
  console.log(`findings: ${findings.length}`);
  console.log(`report: ${opts.outputPath}`);
  console.log(`json: ${opts.jsonPath}`);

  if (overall === 'blocked') process.exit(1);
}

main();
