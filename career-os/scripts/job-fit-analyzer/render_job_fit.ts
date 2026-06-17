#!/usr/bin/env bun
// ADR-096 phase-02: JobFitRun 정본 JSON에서 사람 읽기용 Markdown을 파생한다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { JobFitRun, type JobFitRunType } from "./jobfit_schema.ts";

export function toMarkdown(run: JobFitRunType): string {
  const out: string[] = [];
  const role = run.targetRole;
  const sourceTag =
    role.source === "mvp-target"
      ? " (타깃: mvp-target fallback)"
      : ` (인자 역할: ${role.role})`;

  out.push(`# 타깃 직무 핏 진단 — ${run.reportDate} · ${role.role}${sourceTag}`);
  out.push("");

  // 1. 한 줄 결론
  out.push("## 한 줄 결론");
  out.push(
    `**${run.verdict.recommendation}** (신뢰도: ${run.verdict.confidence}) — ${run.verdict.rationale[0]}`,
  );
  out.push("");

  // 2. 지원 의사결정
  out.push("## 지원 의사결정");
  out.push(`- 권장: **${run.verdict.recommendation}**`);
  out.push(`- 신뢰도: ${run.verdict.confidence}`);
  out.push("- 근거:");
  for (const r of run.verdict.rationale) out.push(`  - ${r}`);
  out.push("");

  // 3. 커리어 패스 정합
  out.push("## 커리어 패스 정합");
  out.push(`- 현재 방향과의 정합: **${run.careerPath.alignmentWithCurrent}**`);
  out.push("- 예상 경로:");
  for (const t of run.careerPath.expectedTrajectory) out.push(`  - ${t}`);
  out.push("- 레버리지 또는 리스크:");
  for (const l of run.careerPath.leverageOrRisk) out.push(`  - ${l}`);
  out.push("");

  // 4. 면접 전략
  out.push("## 면접 전략");
  out.push("### 강점 어필");
  for (const p of run.interviewStrategy.strengthPitch) {
    out.push(`- **${p.strength}**`);
    out.push(`  - 어필 방법: ${p.howToFrame}`);
  }
  out.push("");
  out.push("### 약점 방어");
  for (const w of run.interviewStrategy.weaknessDefense) {
    out.push(`- **${w.weakness}**`);
    out.push(`  - 방어 방법: ${w.howToDefend}`);
  }
  out.push("");

  // 5. 강점
  out.push("## 강점");
  for (const s of run.strengths) {
    out.push(`- **${s.point}**`);
    out.push(`  - 근거: ${s.evidence}`);
    out.push(`  - 역할 레버리지: ${s.roleLeverage}`);
  }
  out.push("");

  // 6. 부족분·갭
  out.push("## 부족분·갭");
  for (const g of run.gaps) {
    out.push(`- **${g.area}** (우선도: ${g.priority})`);
    out.push(`  - 근거: ${g.evidenceSupport}`);
    out.push(`  - 면접 리스크: ${g.interviewRisk}`);
  }
  out.push("");

  // 7. 우선 보강
  out.push("## 우선 보강 (부차)");
  const r = run.reinforcement;
  out.push(`### D+30`);
  if (r.d30.length === 0) {
    out.push("해당 없음");
  } else {
    for (const item of r.d30) out.push(`- ${item}`);
  }
  out.push("");
  out.push("### D+60");
  if (r.d60.length === 0) {
    out.push("해당 없음");
  } else {
    for (const item of r.d60) out.push(`- ${item}`);
  }
  out.push("");
  out.push("### D+90");
  if (r.d90.length === 0) {
    out.push("해당 없음");
  } else {
    for (const item of r.d90) out.push(`- ${item}`);
  }
  out.push("");

  // 8. 예상 면접 질문
  out.push("## 예상 면접 질문");
  for (const iq of run.interviewQuestions) {
    out.push(`- **Q: ${iq.q}**`);
    out.push(`  - 리스크: ${iq.risk}`);
    out.push(`  - 답변 각도: ${iq.answerAngle}`);
  }
  out.push("");

  // 9. 다음 액션
  out.push("## 다음 액션");
  for (const a of run.nextActions) {
    out.push(`- **${a.skill}**`);
    out.push(`  - 입력: ${a.input}`);
    out.push(`  - 이유: ${a.why}`);
  }
  out.push("");

  // 10. 지난 진단 대비 변화 (optional)
  if (run.changeSince) {
    const cs = run.changeSince;
    out.push("## 지난 진단 대비 변화");
    out.push(`기준일: ${cs.lastDate}`);
    out.push("");
    out.push("### 해결된 갭");
    if (cs.resolved.length === 0) {
      out.push("없음");
    } else {
      for (const item of cs.resolved) out.push(`- ${item}`);
    }
    out.push("");
    out.push("### 새로 발생한 갭");
    if (cs.newGaps.length === 0) {
      out.push("없음");
    } else {
      for (const item of cs.newGaps) out.push(`- ${item}`);
    }
    out.push("");
    out.push("### 지속되는 갭");
    if (cs.persisting.length === 0) {
      out.push("없음");
    } else {
      for (const item of cs.persisting) out.push(`- ${item}`);
    }
    out.push("");
  }

  return out.join("\n");
}

function usage(): never {
  console.error(
    "usage: render_job_fit.ts --input <jobfit.json> --format md --output <path>",
  );
  process.exit(2);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let input = "";
  let output = "";
  let format = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input") input = args[++i] ?? "";
    else if (args[i] === "--output") output = args[++i] ?? "";
    else if (args[i] === "--format") format = args[++i] ?? "";
  }
  if (!input || !output || !format) usage();
  if (format !== "md") {
    console.error(`지원하지 않는 format: ${format} (md만 지원)`);
    process.exit(2);
  }

  const raw = JSON.parse(readFileSync(resolve(input), "utf-8"));
  const parsed = JobFitRun.safeParse(raw);
  if (!parsed.success) {
    console.error("jobfit.json 스키마 검증 실패:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  const content = toMarkdown(parsed.data);
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(resolve(output), content, "utf-8");
  console.log(`job-fit md: ${resolve(output)}`);
}
