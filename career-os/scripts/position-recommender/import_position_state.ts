#!/usr/bin/env bun
/**
 * 파일에 있던 회사 조사와 개인 제외 규칙을 Backend 로 옮긴다.
 *
 * 운영과 로컬을 각각 옮겨야 하고 옮긴 뒤 건수를 대조해야 원본을 지울 수 있어,
 * 한 번 쓰고 버리지 않고 진입점으로 남긴다. ADR-123 을 따른다.
 *
 * 읽을 위치는 `--source-dir` 가 정한다. `career-os/state/` 는 `.gitignore` 에 걸려
 * 저장소 작업본마다 있고 없고가 다르다. 경로를 고정하면 옮길 때마다 코드를 고쳐야 한다.
 *
 * `--dry-run` 이 기본이다. `--commit` 을 줘야 실제로 보낸다.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalRequestHash } from "../../services/recommendation-api/src/common/idempotency/request-hash.ts";
import {
  companyEvidenceRequestSchema,
  exclusionsRequestSchema,
  type CompanyEvidence,
  type CompanyEvidenceSourceType,
} from "../../services/recommendation-api/src/positions/schema.ts";
import { runCli, UsageError } from "../lib/cli.ts";
import { CompanyResearchFile } from "./company-research/schema.ts";
import { positionExclusionsSchema } from "./feedback/exclusions.ts";
import { createRecommendationApiClient } from "./recommendation-api/client.ts";

export const defaultSourceDirectory = resolve(import.meta.dir, "../../state");

/**
 * 파일의 `source.sourceType` 을 `company_evidence.source_type` 으로 옮기는 표다.
 *
 * 키 집합은 `CompanyResearchFactSourceType` 과 같아야 한다. 단위 테스트가 그것을 대조한다.
 */
export const SOURCE_TYPE_BY_FILE_VALUE = {
  "regulatory-filing": "dart-financial",
  "public-compensation": "review",
  "job-posting": "job-posting",
  official: "official",
  "investor-relations": "official",
  "reputable-news": "other",
  other: "other",
} satisfies Record<string, CompanyEvidenceSourceType>;

/**
 * `validUntil` 이 없는 근거에 붙일 기간이다. 단위는 일이다.
 *
 * 기간은 `docs/data-schema.md` 의 「회사 근거」 유효기간 표가 소유한다.
 * `job-posting` 만 그 표가 기간을 정하지 않는다. 수집 실행마다 다시 만드는 값이기 때문이다.
 * 여기서 옮기는 것은 이미 모아 둔 옛 근거이므로 `official` 과 같은 90일을 준다.
 */
const VALID_DAYS: Record<string, number> = {
  "dart-financial": 180,
  review: 60,
  "job-posting": 90,
  official: 90,
  other: 90,
};

/** 버전 1 규칙에는 사유가 없다. 옮긴 뒤에도 사람이 원본을 구분할 수 있게 이 문구를 남긴다. */
const LEGACY_EXCLUSION_REASON = "이관 전 규칙";

export const decidedAtPattern = /^\d{4}-\d{2}-\d{2}$/;

export type CompanyEvidenceImport = {
  companyKey: string;
  evidence: CompanyEvidence[];
};

export type ImportPayload = {
  companies: CompanyEvidenceImport[];
  evidenceCount: number;
  droppedInferenceCount: number;
  exclusions: unknown[];
  /** 원본에 근거로 쓸 URL 이 없어 옮길 수 없는 버전 1 규칙 수. */
  evidenceUrlMissingCount: number;
  /** Backend 의 제외 규칙 계약을 만족하지 못하는 규칙 수. */
  rejectedExclusionCount: number;
};

function mapSourceType(value: string): CompanyEvidenceSourceType {
  const mapped = (SOURCE_TYPE_BY_FILE_VALUE as Record<string, CompanyEvidenceSourceType>)[value];
  if (!mapped) throw new Error(`옮길 수 없는 sourceType 입니다: ${value}`);
  if (VALID_DAYS[mapped] === undefined) {
    throw new Error(`유효기간을 정하지 않은 source_type 입니다: ${mapped}`);
  }
  return mapped;
}

function plusDaysIsoDate(observedAt: string, days: number): string {
  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) throw new Error("근거의 수집 시각을 읽을 수 없습니다.");
  return new Date(observed.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function readCompanyEvidence(directory: string): {
  companies: CompanyEvidenceImport[];
  droppedInferenceCount: number;
} {
  if (!existsSync(directory)) return { companies: [], droppedInferenceCount: 0 };
  const files = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .toSorted((left, right) => left.localeCompare(right, "en"));

  let droppedInferenceCount = 0;
  const companies = files.map((name) => {
    const parsed = CompanyResearchFile.parse(
      JSON.parse(readFileSync(join(directory, name), "utf8")),
    );
    const profile = parsed.profile;
    // 추론은 근거가 아니다. 다음 판정이 남은 근거 위에서 다시 만든다.
    droppedInferenceCount += profile.inferences.length;
    const evidence = profile.facts.map((fact) => {
      const sourceType = mapSourceType(fact.source.sourceType);
      // Backend 계약은 offset 없는 UTC 만 받는다. 파일은 offset 을 허용한다.
      const observedAt = new Date(fact.source.observedAt).toISOString();
      return {
        sourceType,
        url: fact.source.url,
        title: fact.source.title,
        summary: fact.statement,
        payloadJson: fact as unknown as Record<string, unknown>,
        observedAt,
        validUntil: fact.validUntil ?? plusDaysIsoDate(observedAt, VALID_DAYS[sourceType]),
      } satisfies CompanyEvidence;
    });
    return { companyKey: profile.companyKey, evidence };
  });
  return { companies, droppedInferenceCount };
}

/**
 * 버전 1 규칙을 버전 2로 올린다.
 *
 * `evidenceUrls` 는 하나 이상이어야 한다. 파일 계약의 `exclusionEvidenceSchema` 가
 * `scope` 와 무관하게 그렇게 요구해 왔고 Backend 가 같은 계약을 쓴다.
 * 버전 1 규칙의 `url` 이 그 한 건이 된다. `identityHash` 만 있는 규칙은 쓸 URL 이
 * 원본에 없으므로 지어내지 않고 그대로 두어 계약 검사에 걸리게 한다.
 */
type ParsedExclusion = ReturnType<typeof positionExclusionsSchema.parse>["exclusions"][number];
/** `scope` 가 없는 버전 1 규칙이 담는 칸이다. */
type LegacyExclusion = ParsedExclusion & { source: string; identityHash?: string; url?: string };

function isLegacyExclusion(rule: ParsedExclusion): rule is LegacyExclusion {
  return !("scope" in rule);
}

function upgradeLegacyExclusion(rule: LegacyExclusion, decidedAt: string) {
  return {
    ...rule,
    scope: "posting" as const,
    decisionKind: "manual" as const,
    reason: LEGACY_EXCLUSION_REASON,
    evidenceUrls: rule.url ? [rule.url] : [],
    decidedAt,
  };
}

function readExclusions(
  directory: string,
  decidedAt: string | undefined,
): { exclusions: unknown[]; evidenceUrlMissingCount: number; rejectedCount: number } {
  const path = join(directory, "position-exclusions.json");
  if (!existsSync(path)) {
    return { exclusions: [], evidenceUrlMissingCount: 0, rejectedCount: 0 };
  }
  const parsed = positionExclusionsSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  // 버전마다 배열 타입이 달라 그대로 두면 filter 가 좁혀지지 않는다.
  const rules: ParsedExclusion[] = parsed.exclusions;
  const legacy = rules.filter(isLegacyExclusion);
  if (legacy.length > 0 && !decidedAt) {
    throw new Error(
      `버전 1 제외 규칙 ${legacy.length}건의 결정일이 원본에 없습니다. --decided-at YYYY-MM-DD 로 주세요.`,
    );
  }
  const exclusions = rules.map((rule) =>
    isLegacyExclusion(rule) ? upgradeLegacyExclusion(rule, decidedAt!) : rule,
  );
  const rejectedCount = exclusions.filter(
    (rule) => !exclusionsRequestSchema.safeParse({ schemaVersion: 2, exclusions: [rule] }).success,
  ).length;
  return {
    exclusions,
    evidenceUrlMissingCount: legacy.filter((rule) => !rule.url).length,
    rejectedCount,
  };
}

export function buildImportPayload(
  sourceDirectory: string,
  options: { decidedAt?: string } = {},
): ImportPayload {
  if (!existsSync(sourceDirectory)) {
    throw new Error(`옮길 원본 디렉터리가 없습니다: ${sourceDirectory}`);
  }
  const { companies, droppedInferenceCount } = readCompanyEvidence(
    join(sourceDirectory, "company-research"),
  );
  const { exclusions, evidenceUrlMissingCount, rejectedCount } = readExclusions(
    join(sourceDirectory, "private-config"),
    options.decidedAt,
  );
  return {
    companies,
    evidenceCount: companies.reduce((total, company) => total + company.evidence.length, 0),
    droppedInferenceCount,
    exclusions,
    evidenceUrlMissingCount,
    rejectedExclusionCount: rejectedCount,
  };
}

/** 회사명과 제외 사유는 내지 않는다. 옮긴 양만 센다. */
export function formatImportSummary(payload: ImportPayload): string[] {
  const lines = [
    `회사 ${payload.companies.length}개, 회사 근거 ${payload.evidenceCount}건`,
    `버린 추론 ${payload.droppedInferenceCount}건`,
    `제외 규칙 ${payload.exclusions.length}건`,
  ];
  if (payload.evidenceUrlMissingCount > 0) {
    lines.push(`근거 URL이 원본에 없는 버전 1 제외 규칙 ${payload.evidenceUrlMissingCount}건`);
  }
  if (payload.rejectedExclusionCount > 0) {
    lines.push(`Backend 계약을 만족하지 못하는 제외 규칙 ${payload.rejectedExclusionCount}건`);
  }
  return lines;
}

async function commitImport(payload: ImportPayload, companyTierRunId: string | undefined) {
  // 하나라도 계약을 벗어나면 아무것도 보내지 않는다. 절반만 옮기면 대조할 기준이 없어진다.
  if (payload.rejectedExclusionCount > 0) {
    throw new Error(
      `Backend 계약을 만족하지 못하는 제외 규칙 ${payload.rejectedExclusionCount}건이 있어 아무것도 보내지 않았습니다.`,
    );
  }
  const client = createRecommendationApiClient();
  if (payload.evidenceCount > 0) {
    if (!companyTierRunId) {
      throw new UsageError("회사 근거를 보내려면 --company-tier-run-id 가 필요합니다.");
    }
    const body = companyEvidenceRequestSchema.parse({
      schemaVersion: 1,
      companies: payload.companies.filter((company) => company.evidence.length > 0),
    });
    const key = `import-company-evidence:${canonicalRequestHash(body).slice(7, 23)}`;
    await client.putCompanyEvidence(companyTierRunId, body, key);
  }
  if (payload.exclusions.length > 0) {
    const body = exclusionsRequestSchema.parse({
      schemaVersion: 2,
      exclusions: payload.exclusions,
    });
    const key = `import-exclusions:${canonicalRequestHash(body).slice(7, 23)}`;
    await client.replaceExclusions(body, key);
  }
}

if (import.meta.main) {
  await runCli(
    {
      name: "import_position_state.ts",
      summary: "파일에 있던 회사 조사와 개인 제외 규칙을 Backend 로 옮긴다.",
      options: {
        "--source-dir": {
          value: true,
          description: "옮길 원본이 있는 디렉터리",
          fallback: defaultSourceDirectory,
        },
        "--decided-at": {
          value: true,
          description: "버전 1 제외 규칙에 붙일 결정일. YYYY-MM-DD",
          pattern: decidedAtPattern,
        },
        "--dry-run": { description: "보내지 않고 집계만 낸다. 기본값이다" },
        "--commit": { description: "실제로 Backend 에 보낸다" },
        "--company-tier-run-id": {
          value: true,
          description: "회사 근거를 저장할 회사 tier 실행 ID. --commit 과 함께 쓴다",
        },
      },
    },
    async (args) => {
      const sourceDirectory = String(args.options["--source-dir"]);
      const payload = buildImportPayload(sourceDirectory, {
        decidedAt: args.options["--decided-at"] as string | undefined,
      });
      for (const line of formatImportSummary(payload)) console.log(line);
      if (!args.options["--commit"]) return;
      await commitImport(payload, args.options["--company-tier-run-id"] as string | undefined);
      console.log("Backend 반영을 마쳤다.");
    },
    { json: false },
  );
}
