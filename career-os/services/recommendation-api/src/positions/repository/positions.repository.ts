import { Injectable } from "@nestjs/common";

import type { PostingCandidate, SourceDiagnostic } from "../../contracts/posting-candidate.js";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { companyKey, positionContentHash, positionIdentity, stableUuid } from "../hash.js";
import type {
  AnalysisFailureCode,
  AnalysisPolicy,
  AnalysisUpdate,
  CompanyEvidence,
  CompanyPreference,
  PositionExclusion,
} from "../schema.js";
import type {
  CompanyTierFailureCode,
  CompanyTierSource,
  StoredCompanyTierAssessment,
} from "../stored.js";

/** transaction 안팎에서 같은 질의를 쓸 수 있게 두 client 를 함께 받는다. */
export type DbClient = PrismaService | Prisma.TransactionClient;

export type CollectionRunRow = {
  collectionRunId: string;
  collectedAt: string;
  personalExcludedCount: number;
};

export type CollectionPositionRow = {
  positionId: string;
  positionVersionId: string;
  companyKey: string;
  companyName: string;
  postingUrl: string;
  contentHash: string;
};

export type PositionAnalysisRow = {
  positionId: string;
  contentHash: string;
  candidateContextVersion: string;
  contractVersion: number;
  validUntil: string;
  analyzedAt: string;
};

export type CompanyTierRunRow = {
  companyTierRunId: string;
  collectionRunId: string;
  candidateContextVersion: string;
  contractVersion: number;
  status: "pending" | "partial" | "completed";
  assessedNowCount: number;
  createdAt: string;
};

export type CompanyTierRunItemRow = {
  companyKey: string;
  companyName: string;
  selectionOrder: number;
  assessmentStatus: "new" | "stale";
  selectionReason: "discovery" | "refresh";
  priorTier: number | null;
  activePositionCount: number;
  resultStatus: "pending" | "created" | "reused" | "failed";
  companyTierAssessmentId: string | null;
  failureCode: CompanyTierFailureCode | null;
  attemptCount: number;
};

export type QueuedCompanyRow = {
  companyKey: string;
  companyName: string;
  activePositionCount: number;
  assessmentStatus: "new" | "stale";
  priorTier: number | null;
  priorReason: string | null;
  priorValidUntil: string | null;
};

export type CompanyTierRunItemUpdate = {
  companyTierRunId: string;
  companyKey: string;
  resultStatus: "created" | "reused" | "failed";
  companyTierAssessmentId: string | null;
  failureCode: CompanyTierFailureCode | null;
  completedAt: string;
};

export type AnalysisRunSummaryRow = {
  analysisRunId: string;
  contractVersion: number;
  resultStatuses: Array<"pending" | "created" | "reused" | "failed">;
};

export type AnalysisRunRow = {
  analysisRunId: string;
  collectionRunId: string;
  candidateContextVersion: string;
  contractVersion: number;
  status: "pending" | "partial" | "completed";
  analyzedNowCount: number;
  createdAt: string;
};

export type AnalysisRunItemRow = {
  positionId: string;
  positionVersionId: string;
  candidateId: string;
  contentHash: string;
  selectionOrder: number;
  analysisStatus: "new" | "changed" | "stale";
  selectionReason: "priority" | "aging" | "overflow";
  companyTier: number;
  companyTierSource: CompanyTierSource;
  companyTierAssessmentId: string | null;
  resultStatus: "pending" | "created" | "reused" | "failed";
  analysisId: string | null;
  failureCode: AnalysisFailureCode | null;
  attemptCount: number;
  posting: PostingCandidate;
};

export type AnalysisCandidateRow = {
  positionId: string;
  positionVersionId: string;
  candidateId: string;
  contentHash: string;
  analysisStatus: "new" | "changed" | "stale";
  selectionReason: "priority" | "aging";
  companyTier: number;
  companyTierSource: CompanyTierSource;
  companyTierAssessmentId: string | null;
  posting: PostingCandidate;
};

/** 분석 대기열을 고를 때 질의가 필요로 하는 값 전부. */
export type AnalysisQueueSpec = {
  collectionRunId: string;
  collectedAt: string;
  candidateContextVersion: string;
  analysisContractVersion: number;
  companyTierContractVersion: number;
  defaultCompanyTier: number;
  today: string;
  prioritySlots: number;
  agingSlots: number;
};

export type AnalysisRunItemUpdate = {
  analysisRunId: string;
  positionId: string;
  resultStatus: "created" | "reused" | "failed";
  analysisId: string | null;
  failureCode: AnalysisFailureCode | null;
  completedAt: string;
};

/** `position_analyses` 한 행. 분석 본문은 요청이 보낸 값을 그대로 담는다. */
export type NewAnalysisRow = AnalysisUpdate & {
  analysisId: string;
  positionVersionId: string;
  candidateContextVersion: string;
  contractVersion: number;
  createdByAnalysisRunId: string;
  analyzedAt: string;
  validUntil: string;
  companyTierAtAnalysis: number;
};

/** 추천 응답이 공고마다 담는 원본. 공고 본문은 이번 수집이 담은 version 의 것이다. */
export type RecommendationPositionRow = {
  positionId: string;
  positionVersionId: string;
  companyKey: string;
  contentHash: string;
  posting: PostingCandidate;
};

/** 추천 순위에 실을 분석 하나. 본문은 저장한 값을 그대로 담는다. */
export type RecommendationAnalysisRow = {
  analysisId: string;
  positionId: string;
  decision: "recommend" | "consider" | "hold";
  fitScore: number;
  reason: string;
  details: unknown[];
  nextActions: string[];
  createdByAnalysisRunId: string | null;
};

/** 추천 하나를 조립하는 데 필요한 읽기 전부. 도메인 판단은 담지 않는다. */
export type RecommendationInputs = {
  run: AnalysisRunRow;
  positions: RecommendationPositionRow[];
  freshAnalyses: Map<string, RecommendationAnalysisRow>;
  analyses: PositionAnalysisRow[];
  preferences: Map<string, CompanyPreference>;
  validAssessments: Map<string, StoredCompanyTierAssessment>;
  diagnostics: Array<{ source: string; status: string; failedCount: number }>;
  personalExcludedCount: number;
  assessmentFailedCount: number;
};

export type RecommendationRunRow = {
  recommendationRunId: string;
  analysisRunId: string;
  collectionRunId: string;
  generatedAt: string;
  analyzedNowCount: number;
  reusedCount: number;
  pendingCount: number;
  personalExcludedCount: number;
  pendingCandidates: unknown[];
};

export type RecommendationItemRow = {
  positionId: string;
  analysisId: string;
  rankNumber: number;
  decision: "recommend" | "consider" | "hold";
  companyTier: number;
  companyTierSource: CompanyTierSource;
  companyTierAssessmentId: string | null;
};

/** 저장된 추천 하나를 다시 읽은 것. 순위 항목은 `rank_number` 순이다. */
export type StoredRecommendation = RecommendationRunRow & {
  items: StoredRecommendationItem[];
  activeCount: number;
};

export type StoredRecommendationItem = {
  candidateId: string;
  company: string;
  title: string;
  postingUrl: string;
  companyTier: number;
  companyTierSource: CompanyTierSource;
  companyTierAssessmentId: string | null;
  decision: "recommend" | "consider" | "hold";
  fitScore: number;
  reason: string;
  details: unknown[];
  nextActions: string[];
};

/**
 * `GET /runs/{id}` 가 받은 ID 가 어느 실행인지.
 *
 * 추천 실행 ID 는 분석 실행 ID 에서 만들어지므로 아직 만들어지지 않은 추천도 가리킬 수 있다.
 * 그 경우를 `recommendation-missing` 으로 구분해 호출자가 만들도록 한다.
 */
export type RunLookup =
  | { kind: "analysis"; analysisRunId: string }
  | { kind: "recommendation"; recommendationRunId: string }
  | { kind: "recommendation-missing"; analysisRunId: string };

/** 저장할 회사 근거 한 건. 회사 식별자를 함께 담아 한 요청이 여러 회사를 다룬다. */
export type CompanyEvidenceRow = CompanyEvidence & { companyKey: string };

type RawRow = Record<string, unknown>;

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return /Z$|[+-]\d\d:\d\d$/.test(text)
    ? new Date(text).toISOString()
    : new Date(`${text}Z`).toISOString();
}

/**
 * `DATE` 열을 `YYYY-MM-DD` 로 읽는다.
 *
 * `toISOString()` 은 UTC 로 바꾸므로 프로세스 시간대가 UTC 가 아니면 하루가 밀린다.
 * 드라이버가 `DATE` 를 지역 시간 자정의 `Date` 로 주기 때문이다.
 * 진입점이 시간대를 고정하는 순서에 기대지 않도록 지역 시간 필드를 그대로 읽는다.
 */
function dateOnly(value: unknown): string {
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function at(value: string): Date {
  return new Date(value);
}

function number(value: unknown): number {
  return Number(value);
}

function jsonValue<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function optionalText(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

/** 제외 규칙 행을 계약 모양으로 되돌린다. `scope` 가 어느 칸을 읽을지 정한다. */
function toExclusion(row: RawRow): PositionExclusion {
  const evidence = {
    decisionKind: row.decision_kind as "career-downside" | "manual",
    reason: String(row.reason),
    evidenceUrls: jsonValue<string[]>(row.evidence_urls_json),
    confidence: optionalText(row.confidence) as "low" | "medium" | "high" | undefined,
    decidedAt: dateOnly(row.decided_at),
    expiresAt: row.expires_at === null ? undefined : dateOnly(row.expires_at),
  };
  if (row.scope === "company") {
    return { scope: "company", company: String(row.company_key), ...evidence };
  }
  if (row.scope === "company-role") {
    return {
      scope: "company-role",
      company: String(row.company_key),
      titleKeywords: jsonValue<string[]>(row.title_keywords_json),
      ...evidence,
    };
  }
  return {
    scope: "posting",
    source: String(row.source_key),
    identityHash: optionalText(row.identity_hash),
    url: optionalText(row.normalized_url),
    ...evidence,
  };
}

/** 회사 근거 행을 계약 모양으로 되돌린다. */
function toCompanyEvidence(row: RawRow): CompanyEvidence {
  return {
    sourceType: row.source_type as CompanyEvidence["sourceType"],
    url: String(row.url),
    title: optionalText(row.title),
    summary: String(row.summary),
    payloadJson: jsonValue<Record<string, unknown>>(row.payload_json),
    observedAt: iso(row.observed_at),
    validUntil: dateOnly(row.valid_until),
  };
}

/** 공고 하나가 이번 수집에서 차지한 자리. `saveCollection` 이 만들어 응답 조립에 넘긴다. */
export type UpsertedPosition = {
  positionId: string;
  positionVersionId: string;
  contentHash: string;
  posting: PostingCandidate;
};

/**
 * 추천 상태를 질의 단위로 읽고 쓴다.
 *
 * 전체 상태를 메모리에 올리지 않는다. 메서드는 도메인이 실제로 요구하는 단위로만 둔다.
 * 쓰기 경로는 자기 실행 행을 먼저 잠근 뒤에 값을 바꾼다.
 */
@Injectable()
export class PositionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 쓰기 transaction 을 연다.
   *
   * 격리 수준을 `READ COMMITTED` 로 내린다.
   * MySQL 기본값인 `REPEATABLE READ` 에서는 transaction 의 첫 읽기가 snapshot 을 세우므로,
   * 행 잠금을 잡고 나서 읽어도 잠금을 기다리는 동안 남이 commit 한 값이 보이지 않는다.
   * 그러면 잠금이 순서만 세우고 덮어쓰기는 막지 못한다.
   */
  /**
   * transaction 을 열지 않는 읽기가 쓸 client 다.
   *
   * 읽기 메서드의 `client` 에 기본값을 두지 않는다.
   * 기본값이 있으면 `tx` 를 빠뜨려도 오류가 나지 않고 그 질의만 transaction 밖으로 나간다.
   * transaction 이 필요 없는 자리는 이 메서드로 그 선택을 드러낸다.
   */
  reader(): DbClient {
    return this.prisma;
  }

  async transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback, {
      // 기본 `maxWait` 는 2초다. 앞선 transaction 이 길면 뒤의 요청이 일을 시작하지도 못하고
      // `P2028` 로 끝난다. 실제로 기다려도 되는 시간을 `timeout` 과 같은 규모로 준다.
      maxWait: 30_000,
      timeout: 30_000,
      isolationLevel: "ReadCommitted",
    });
  }

  // ---------------------------------------------------------------- 분석 정책

  async findPolicy(client: DbClient): Promise<AnalysisPolicy | undefined> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT candidate_context_version, daily_analysis_limit, priority_slots, aging_slots,
             stale_after_days, default_company_tier, daily_company_tier_limit,
             company_tier_stale_after_days
      FROM position_analysis_policy WHERE singleton_id = 1
    `;
    const row = rows[0];
    if (!row) return undefined;
    return {
      schemaVersion: 2,
      candidateContextVersion: String(row.candidate_context_version),
      dailyAnalysisLimit: number(row.daily_analysis_limit),
      prioritySlots: number(row.priority_slots),
      agingSlots: number(row.aging_slots),
      staleAfterDays: number(row.stale_after_days),
      defaultCompanyTier: number(row.default_company_tier),
      dailyCompanyTierLimit: number(row.daily_company_tier_limit),
      companyTierStaleAfterDays: number(row.company_tier_stale_after_days),
    };
  }

  /** 정책 행을 잠근다. 행이 없으면 잠글 것이 없고 `upsertPolicy` 의 unique key 가 순서를 세운다. */
  async lockPolicy(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT singleton_id FROM position_analysis_policy WHERE singleton_id = 1 FOR UPDATE`;
  }

  async upsertPolicy(
    policy: AnalysisPolicy,
    now: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO position_analysis_policy
        (singleton_id, candidate_context_version, daily_analysis_limit, priority_slots,
         aging_slots, stale_after_days, default_company_tier, daily_company_tier_limit,
         company_tier_stale_after_days, updated_at)
      VALUES (1, ${policy.candidateContextVersion}, ${policy.dailyAnalysisLimit},
              ${policy.prioritySlots}, ${policy.agingSlots}, ${policy.staleAfterDays},
              ${policy.defaultCompanyTier}, ${policy.dailyCompanyTierLimit},
              ${policy.companyTierStaleAfterDays}, ${at(now)})
      ON DUPLICATE KEY UPDATE
        candidate_context_version = VALUES(candidate_context_version),
        daily_analysis_limit = VALUES(daily_analysis_limit),
        priority_slots = VALUES(priority_slots), aging_slots = VALUES(aging_slots),
        stale_after_days = VALUES(stale_after_days),
        default_company_tier = VALUES(default_company_tier),
        daily_company_tier_limit = VALUES(daily_company_tier_limit),
        company_tier_stale_after_days = VALUES(company_tier_stale_after_days),
        updated_at = VALUES(updated_at)
    `;
  }

  // ---------------------------------------------------------------- 회사 선호

  async listPreferences(client: DbClient): Promise<CompanyPreference[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_key, company_name, tier, disposition, updated_at FROM company_preferences
    `;
    return rows.map((row) => ({
      companyKey: String(row.company_key),
      companyName: String(row.company_name),
      tier: number(row.tier),
      disposition: row.disposition as "analyze" | "exclude",
      updatedAt: iso(row.updated_at),
    }));
  }

  async upsertPreference(
    preference: CompanyPreference,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO company_preferences (company_key, company_name, tier, disposition, updated_at)
      VALUES (${preference.companyKey}, ${preference.companyName}, ${preference.tier},
              ${preference.disposition}, ${at(preference.updatedAt)})
      ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), tier = VALUES(tier),
        disposition = VALUES(disposition), updated_at = VALUES(updated_at)
    `;
  }

  /** 이번 수집에 등장한 회사 가운데 사람 override 가 걸린 것만 고른다. */
  async findPreferencesFor(
    keys: string[],
    client: DbClient,
  ): Promise<Map<string, CompanyPreference>> {
    if (keys.length === 0) return new Map();
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_key, company_name, tier, disposition, updated_at
      FROM company_preferences WHERE company_key IN (${Prisma.join(keys)})
    `;
    return new Map(
      rows.map((row) => [
        String(row.company_key),
        {
          companyKey: String(row.company_key),
          companyName: String(row.company_name),
          tier: number(row.tier),
          disposition: row.disposition as "analyze" | "exclude",
          updatedAt: iso(row.updated_at),
        },
      ]),
    );
  }

  // ------------------------------------------------------------ 개인 공고 제외

  /**
   * 제외 규칙 행 전부를 잠근다.
   *
   * `PUT` 이 규칙을 통째로 바꾸므로 잠글 단위가 실행 하나가 아니라 이 table 전체다.
   * ADR-122 에 따라 transaction 을 열고 값을 바꾸기 전에 먼저 부른다.
   * 멱등 키가 다른 두 `PUT` 이 동시에 와도 뒤의 것이 앞의 것을 기다린다.
   *
   * **`WHERE` 를 붙이지 않는다.** 조건을 달면 그 조건에 맞는 구간의 행만 잠겨,
   * 조건 밖의 규칙을 바꾸는 다른 transaction 이 기다리지 않고 함께 지나간다.
   * `DELETE` 뒤 `INSERT` 로 목록 전체를 바꾸는 경로라 그 둘이 섞이면 규칙이 반씩 남는다.
   *
   * **table 이 비어 있으면 이 잠금이 직렬화하지 못한다.** `transaction` 이 고른 격리 수준이
   * `READ COMMITTED` 이고, 그 수준에서 InnoDB 는 gap lock 을 잡지 않아 잠글 행이 없으면
   * 잠글 것도 없다. 2026-09-23 에 같은 container 에서 실측했다.
   * 빈 table 에 두 연결이 동시에 들어가면 뒤의 `INSERT` 가 기다리지 않고 바로 지나갔고,
   * 같은 절차를 `REPEATABLE READ` 로 돌리면 앞 transaction 이 끝날 때까지 3초를 기다렸다.
   * 규칙이 한 건이라도 있으면 그 행 잠금으로 직렬화된다.
   */
  async lockExclusions(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT position_exclusion_id FROM position_exclusions FOR UPDATE`;
  }

  /** `today` 기준으로 아직 유효한 규칙만 준다. `expires_at` 당일까지는 적용한다. */
  async listExclusions(today: string, client: DbClient): Promise<PositionExclusion[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT position_exclusion_id, scope, company_key, source_key, identity_hash,
             normalized_url, title_keywords_json, decision_kind, reason, evidence_urls_json,
             confidence, decided_at, expires_at
      FROM position_exclusions
      WHERE expires_at IS NULL OR expires_at >= ${today}
      ORDER BY position_exclusion_id
    `;
    return rows.map(toExclusion);
  }

  /**
   * 기존 규칙을 지우고 받은 규칙만 남긴다.
   *
   * `normalized_url` 은 받은 값을 그대로 넣는다. 저장 계층은 URL 을 정규화하지 않는다.
   * 정규화는 수집기 쪽 `normalizePostingUrl` 이 소유한다.
   *
   * 식별자는 순번과 본문에서 만든다. 같은 본문을 다시 보내면 같은 행 식별자가 나오고,
   * 한 요청에 같은 규칙이 두 번 들어와도 순번이 달라 기본 키가 부딪히지 않는다.
   */
  async replaceExclusions(
    exclusions: PositionExclusion[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`DELETE FROM position_exclusions`;
    for (const [index, rule] of exclusions.entries()) {
      const id = stableUuid(`position-exclusion:${index}:${JSON.stringify(rule)}`);
      const company = rule.scope === "posting" ? null : rule.company;
      const source = rule.scope === "posting" ? rule.source : null;
      const identityHash = rule.scope === "posting" ? (rule.identityHash ?? null) : null;
      const url = rule.scope === "posting" ? (rule.url ?? null) : null;
      const titleKeywords =
        rule.scope === "company-role" ? JSON.stringify(rule.titleKeywords) : null;
      await tx.$executeRaw`
        INSERT INTO position_exclusions
          (position_exclusion_id, scope, company_key, source_key, identity_hash, normalized_url,
           title_keywords_json, decision_kind, reason, evidence_urls_json, confidence,
           decided_at, expires_at)
        VALUES (${id}, ${rule.scope}, ${company}, ${source}, ${identityHash}, ${url},
                ${titleKeywords}, ${rule.decisionKind}, ${rule.reason},
                ${JSON.stringify(rule.evidenceUrls)}, ${rule.confidence ?? null},
                ${rule.decidedAt}, ${rule.expiresAt ?? null})
      `;
    }
  }

  // ------------------------------------------------------------------ 회사 근거

  /**
   * 회사 근거를 넣거나 같은 출처의 행을 갱신한다.
   *
   * 회사 조사는 이력이 아니라 현재 상태다. 같은 `(company_key, source_type, url)` 이 다시 오면
   * 행을 늘리지 않고 갱신한다. 이력은 `company_tier_assessments` 가 담는다.
   *
   * **더 오래된 관측으로는 덮지 않는다.** 이관 명령처럼 옛 파일을 보내는 호출자가 있고,
   * 조건 없이 덮으면 방금 모은 근거가 옛 값으로 돌아간다.
   * 같은 시각이면 나중에 온 것을 남긴다. `observed_at` 을 날짜 단위로 적는 수집기와
   * 재시도가 같은 시각을 다시 보내는데, 그것까지 막으면 갱신이 드러나지 않게 사라진다.
   * 요청 안의 중복을 걷는 비교와 SQL 의 비교가 같은 부등호여야 한다.
   * 다르면 같은 근거를 한 요청에 담느냐 나눠 보내느냐에 따라 남는 값이 달라진다.
   *
   * `observed_at` 대입을 마지막에 두는 것은 MySQL 이 대입을 왼쪽부터 평가해,
   * 먼저 바꾸면 뒤의 비교가 이미 바뀐 값을 보기 때문이다.
   *
   * 고유 키를 `url_hash` 에 거는 이유는 migration 주석이 적는다.
   * 한 요청에 같은 키가 두 번 들어오면 행은 하나다. 저장한 키를 그대로 돌려줘
   * 호출자가 이 요청이 다룬 서로 다른 출처가 몇인지 셀 수 있게 한다.
   */
  async saveCompanyEvidence(
    rows: CompanyEvidenceRow[],
    tx: Prisma.TransactionClient,
  ): Promise<CompanyEvidenceRow[]> {
    const byKey = new Map<string, CompanyEvidenceRow>();
    for (const row of rows) {
      const key = [row.companyKey, row.sourceType, row.url].join("\u0000");
      const kept = byKey.get(key);
      if (!kept || Date.parse(row.observedAt) >= Date.parse(kept.observedAt)) byKey.set(key, row);
    }
    const saved = [...byKey.values()];
    for (const row of saved) {
      const id = stableUuid(`company-evidence:${row.companyKey}:${row.sourceType}:${row.url}`);
      await tx.$executeRaw`
        INSERT INTO company_evidence
          (company_evidence_id, company_key, source_type, url, title, summary,
           payload_json, observed_at, valid_until)
        VALUES (${id}, ${row.companyKey}, ${row.sourceType}, ${row.url},
                ${row.title ?? null}, ${row.summary}, ${JSON.stringify(row.payloadJson)},
                ${at(row.observedAt)}, ${row.validUntil})
        ON DUPLICATE KEY UPDATE
          title = IF(VALUES(observed_at) >= observed_at, VALUES(title), title),
          summary = IF(VALUES(observed_at) >= observed_at, VALUES(summary), summary),
          payload_json = IF(VALUES(observed_at) >= observed_at, VALUES(payload_json), payload_json),
          valid_until = IF(VALUES(observed_at) >= observed_at, VALUES(valid_until), valid_until),
          observed_at = IF(VALUES(observed_at) >= observed_at, VALUES(observed_at), observed_at)
      `;
    }
    return saved;
  }

  /**
   * `today` 기준으로 아직 유효한 근거만 준다. `valid_until` 당일까지는 유효하다.
   *
   * 만료된 행은 지우지 않는다. 다음 수집이 같은 키로 갱신한다.
   */
  async listValidCompanyEvidence(
    company: string,
    today: string,
    client: DbClient,
  ): Promise<CompanyEvidence[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT source_type, url, title, summary, payload_json, observed_at, valid_until
      FROM company_evidence
      WHERE company_key = ${company} AND valid_until >= ${today}
      ORDER BY source_type, url
    `;
    return rows.map(toCompanyEvidence);
  }

  // ---------------------------------------------------------------- 수집 실행

  /**
   * 수집 실행 행을 잠근다.
   *
   * 멱등 키가 다른 두 요청이 같은 수집 실행에 동시에 와도 뒤의 것이 앞의 것을 기다리게 한다.
   *
   * 행이 이미 있으면 `FOR UPDATE` 하나로 끝낸다. 자리를 먼저 만들지 않는다.
   * 만들고 잠그는 순서로 두면, 행이 있을 때 두 transaction 이 그 자리를 만드는 문장에서
   * 공유 잠금을 함께 쥐고 뒤이은 `FOR UPDATE` 에서 서로 상대가 놓기를 기다려 교착에 빠진다.
   *
   * 행이 없을 때만 자리를 만든다. 그 문장은 `ON DUPLICATE KEY UPDATE` 다.
   * `INSERT IGNORE` 는 경합에서 진 쪽에 공유 잠금을 남겨 같은 교착을 만든다.
   */
  async lockCollectionRun(
    collectionRunId: string,
    collectedAt: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const locked = await tx.$queryRaw<RawRow[]>`
      SELECT run_id FROM position_collection_runs WHERE run_id = ${collectionRunId} FOR UPDATE
    `;
    if (locked.length > 0) return;
    await tx.$executeRaw`
      INSERT INTO position_collection_runs
        (run_id, idempotency_key, collected_at, status, active_count, personal_excluded_count)
      VALUES (${collectionRunId}, ${`collection:${collectionRunId}`}, ${at(collectedAt)},
              'processing', 0, 0)
      ON DUPLICATE KEY UPDATE run_id = run_id
    `;
    await tx.$queryRaw`
      SELECT run_id FROM position_collection_runs WHERE run_id = ${collectionRunId} FOR UPDATE
    `;
  }

  async findCollectionRun(
    collectionRunId: string,
    client: DbClient,
  ): Promise<CollectionRunRow | undefined> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT run_id, collected_at, personal_excluded_count
      FROM position_collection_runs WHERE run_id = ${collectionRunId}
    `;
    const row = rows[0];
    if (!row) return undefined;
    return {
      collectionRunId: String(row.run_id),
      collectedAt: iso(row.collected_at),
      personalExcludedCount: number(row.personal_excluded_count),
    };
  }

  async completeCollectionRun(
    collectionRunId: string,
    collectedAt: string,
    activeCount: number,
    personalExcludedCount: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE position_collection_runs
      SET collected_at = ${at(collectedAt)}, status = 'completed', active_count = ${activeCount},
          personal_excluded_count = ${personalExcludedCount}
      WHERE run_id = ${collectionRunId}
    `;
  }

  async ensureSources(sources: string[], tx: Prisma.TransactionClient): Promise<void> {
    for (const source of new Set(sources)) {
      await tx.$executeRaw`
        INSERT INTO position_sources (source_key, enabled) VALUES (${source}, TRUE)
        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
      `;
    }
  }

  /**
   * 바뀐 공고만 쓴다.
   *
   * 본문이 그대로면 `position_versions` 에 새 행을 만들지 않고 기존 version 을 다시 쓴다.
   */
  async upsertPositions(
    candidates: PostingCandidate[],
    collectedAt: string,
    tx: Prisma.TransactionClient,
  ): Promise<UpsertedPosition[]> {
    const upserted: UpsertedPosition[] = [];
    for (const posting of candidates) {
      const identityHash = positionIdentity(posting).slice(posting.source.length + 1);
      const contentHash = positionContentHash(posting);
      await tx.$executeRaw`
        INSERT INTO positions
          (position_id, source_key, identity_hash, normalized_url, company_key, company_name,
           title, lifecycle, first_seen_at, last_seen_at, pending_since)
        VALUES (${crypto.randomUUID()}, ${posting.source}, ${identityHash}, ${posting.url},
                ${companyKey(posting.company)}, ${posting.company}, ${posting.title}, 'active',
                ${at(collectedAt)}, ${at(collectedAt)}, ${at(collectedAt)})
        ON DUPLICATE KEY UPDATE normalized_url = VALUES(normalized_url),
          company_key = VALUES(company_key), company_name = VALUES(company_name),
          title = VALUES(title), lifecycle = 'active', last_seen_at = VALUES(last_seen_at)
      `;
      const positionRows = await tx.$queryRaw<RawRow[]>`
        SELECT position_id FROM positions
        WHERE source_key = ${posting.source} AND identity_hash = ${identityHash}
      `;
      const positionId = String(positionRows[0]!.position_id);
      const positionVersionId = await this.insertPositionVersionIfNew(
        positionId,
        contentHash,
        posting,
        collectedAt,
        tx,
      );
      upserted.push({ positionId, positionVersionId, contentHash, posting });
    }
    return upserted;
  }

  async insertPositionVersionIfNew(
    positionId: string,
    contentHash: string,
    snapshot: PostingCandidate,
    observedAt: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    await tx.$executeRaw`
      INSERT IGNORE INTO position_versions
        (position_version_id, position_id, content_hash, snapshot_json, observed_at)
      VALUES (${crypto.randomUUID()}, ${positionId}, ${contentHash}, ${JSON.stringify(snapshot)},
              ${at(observedAt)})
    `;
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT position_version_id FROM position_versions
      WHERE position_id = ${positionId} AND content_hash = ${contentHash}
    `;
    return String(rows[0]!.position_version_id);
  }

  /** 이번 수집에서 보이지 않은 공고를 `not_seen` 으로 내린다. 수집이 성공한 소스만 대상이다. */
  async markMissingPositionsNotSeen(
    okSources: string[],
    seenPositionIds: string[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (okSources.length === 0) return;
    const seen =
      seenPositionIds.length === 0
        ? Prisma.empty
        : Prisma.sql`AND position_id NOT IN (${Prisma.join(seenPositionIds)})`;
    await tx.$executeRaw`
      UPDATE positions SET lifecycle = 'not_seen'
      WHERE lifecycle = 'active' AND source_key IN (${Prisma.join(okSources)}) ${seen}
    `;
  }

  async setPendingSince(
    positionIds: string[],
    pendingSince: string | null,
    collectedAt: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (positionIds.length === 0) return;
    if (pendingSince === null) {
      await tx.$executeRaw`
        UPDATE positions SET pending_since = NULL
        WHERE position_id IN (${Prisma.join(positionIds)})
      `;
      return;
    }
    await tx.$executeRaw`
      UPDATE positions SET pending_since = COALESCE(pending_since, ${at(collectedAt)})
      WHERE position_id IN (${Prisma.join(positionIds)})
    `;
  }

  async upsertDiagnostics(
    collectionRunId: string,
    diagnostics: SourceDiagnostic[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const diagnostic of diagnostics) {
      await tx.$executeRaw`
        INSERT INTO position_source_run_diagnostics
          (run_id, source_key, status, collected_count, imported_count, skipped_count,
           failed_count, public_message)
        VALUES (${collectionRunId}, ${diagnostic.source}, ${diagnostic.status},
                ${diagnostic.collectedCount}, ${diagnostic.importedCount},
                ${diagnostic.skippedCount}, ${diagnostic.failedCount},
                ${diagnostic.status === "ok" ? "" : "일부 공고를 확인하지 못했습니다."})
        ON DUPLICATE KEY UPDATE status = VALUES(status),
          collected_count = VALUES(collected_count), imported_count = VALUES(imported_count),
          skipped_count = VALUES(skipped_count), failed_count = VALUES(failed_count),
          public_message = VALUES(public_message)
      `;
    }
  }

  async insertCollectionItems(
    collectionRunId: string,
    positions: UpsertedPosition[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const entry of positions) {
      await tx.$executeRaw`
        INSERT IGNORE INTO position_collection_items
          (run_id, position_id, position_version_id, posting_status, close_urgency)
        VALUES (${collectionRunId}, ${entry.positionId}, ${entry.positionVersionId},
                ${entry.posting.postingStatus}, ${entry.posting.closeUrgency})
      `;
    }
  }

  async listCollectionDiagnostics(
    collectionRunId: string,
    client: DbClient,
  ): Promise<Array<{ source: string; status: string; failedCount: number }>> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT source_key, status, failed_count FROM position_source_run_diagnostics
      WHERE run_id = ${collectionRunId} ORDER BY source_key
    `;
    return rows.map((row) => ({
      source: String(row.source_key),
      status: String(row.status),
      failedCount: number(row.failed_count),
    }));
  }

  /** 이번 수집이 담은 공고를 읽는다. 순서는 소스 안에서 안정된 `identity_hash` 순이다. */
  async listCollectionPositions(
    collectionRunId: string,
    client: DbClient,
  ): Promise<CollectionPositionRow[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT p.position_id, pv.position_version_id, p.company_key, p.company_name,
             p.normalized_url, pv.content_hash
      FROM position_collection_items pci
      JOIN positions p ON p.position_id = pci.position_id
      JOIN position_versions pv ON pv.position_version_id = pci.position_version_id
      WHERE pci.run_id = ${collectionRunId}
      ORDER BY p.source_key, p.identity_hash
    `;
    return rows.map((row) => ({
      positionId: String(row.position_id),
      positionVersionId: String(row.position_version_id),
      companyKey: String(row.company_key),
      companyName: String(row.company_name),
      postingUrl: String(row.normalized_url),
      contentHash: String(row.content_hash),
    }));
  }

  async listAnalysesForCollection(
    collectionRunId: string,
    client: DbClient,
  ): Promise<PositionAnalysisRow[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT pa.position_id, pv.content_hash, pa.candidate_context_version, pa.contract_version,
             pa.valid_until, pa.analyzed_at
      FROM position_analyses pa
      JOIN position_versions pv ON pv.position_version_id = pa.position_version_id
      JOIN position_collection_items pci
        ON pci.position_id = pa.position_id AND pci.run_id = ${collectionRunId}
      ORDER BY pa.analyzed_at
    `;
    return rows.map((row) => ({
      positionId: String(row.position_id),
      contentHash: String(row.content_hash),
      candidateContextVersion: String(row.candidate_context_version),
      contractVersion: number(row.contract_version),
      validUntil: dateOnly(row.valid_until),
      analyzedAt: iso(row.analyzed_at),
    }));
  }

  async findAnalysisRunByCollection(
    collectionRunId: string,
    client: DbClient,
  ): Promise<AnalysisRunSummaryRow | undefined> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT analysis_run_id, contract_version FROM position_analysis_runs
      WHERE collection_run_id = ${collectionRunId}
    `;
    const row = rows[0];
    if (!row) return undefined;
    const analysisRunId = String(row.analysis_run_id);
    const items = await client.$queryRaw<RawRow[]>`
      SELECT result_status FROM position_analysis_run_items
      WHERE analysis_run_id = ${analysisRunId} ORDER BY selection_order
    `;
    return {
      analysisRunId,
      contractVersion: number(row.contract_version),
      resultStatuses: items.map(
        (item) => item.result_status as "pending" | "created" | "reused" | "failed",
      ),
    };
  }

  // ------------------------------------------------------------ 회사 tier 실행

  async findCompanyTierRunByCollectionRun(
    collectionRunId: string,
    client: DbClient,
  ): Promise<CompanyTierRunRow | undefined> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_tier_run_id, collection_run_id, candidate_context_version, contract_version,
             status, assessed_now_count, created_at
      FROM company_tier_assessment_runs WHERE collection_run_id = ${collectionRunId}
    `;
    return rows[0] ? this.toCompanyTierRun(rows[0]) : undefined;
  }

  /**
   * 회사 tier 실행 행을 잠그고 읽는다.
   *
   * 멱등 키가 다른 두 요청이 같은 실행에 동시에 오면 뒤의 것이 여기서 기다린다.
   * 이 잠금이 없으면 둘이 같은 대기 항목을 각자 읽고 서로의 결과를 덮어쓴다.
   */
  async lockCompanyTierRun(
    companyTierRunId: string,
    tx: Prisma.TransactionClient,
  ): Promise<CompanyTierRunRow | undefined> {
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT company_tier_run_id, collection_run_id, candidate_context_version, contract_version,
             status, assessed_now_count, created_at
      FROM company_tier_assessment_runs WHERE company_tier_run_id = ${companyTierRunId}
      FOR UPDATE
    `;
    return rows[0] ? this.toCompanyTierRun(rows[0]) : undefined;
  }

  private toCompanyTierRun(row: RawRow): CompanyTierRunRow {
    return {
      companyTierRunId: String(row.company_tier_run_id),
      collectionRunId: String(row.collection_run_id),
      candidateContextVersion: String(row.candidate_context_version),
      contractVersion: number(row.contract_version),
      status: row.status as "pending" | "partial" | "completed",
      assessedNowCount: number(row.assessed_now_count),
      createdAt: iso(row.created_at),
    };
  }

  async listCompanyTierRunItems(
    companyTierRunId: string,
    client: DbClient,
  ): Promise<CompanyTierRunItemRow[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_key, company_name, selection_order, assessment_status, selection_reason,
             prior_tier, active_position_count, result_status, company_tier_assessment_id,
             failure_code, attempt_count
      FROM company_tier_assessment_run_items
      WHERE company_tier_run_id = ${companyTierRunId} ORDER BY selection_order
    `;
    return rows.map((row) => ({
      companyKey: String(row.company_key),
      companyName: String(row.company_name),
      selectionOrder: number(row.selection_order),
      assessmentStatus: row.assessment_status as "new" | "stale",
      selectionReason: row.selection_reason as "discovery" | "refresh",
      priorTier: row.prior_tier === null ? null : number(row.prior_tier),
      activePositionCount: number(row.active_position_count),
      resultStatus: row.result_status as "pending" | "created" | "reused" | "failed",
      companyTierAssessmentId:
        row.company_tier_assessment_id === null ? null : String(row.company_tier_assessment_id),
      failureCode: (row.failure_code ?? null) as CompanyTierFailureCode | null,
      attemptCount: number(row.attempt_count),
    }));
  }

  /**
   * 임차권이 끝난 처리 중 표시를 회수한다.
   *
   * 2시간이 지나도록 결과가 오지 않은 항목은 `lease_expired` 로 닫고 실행을 마감한다.
   * 회수하지 않으면 그 회사가 다음 수집에서도 계속 다른 실행에 묶여 있다.
   */
  async reclaimExpiredCompanyTierLeases(
    leaseCutoff: string,
    now: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE company_tier_assessment_run_items i
      JOIN company_tier_assessment_runs r ON r.company_tier_run_id = i.company_tier_run_id
      SET i.result_status = 'failed', i.failure_code = 'lease_expired',
          i.completed_at = ${at(now)}, i.attempt_count = i.attempt_count + 1
      WHERE r.status = 'pending' AND r.created_at <= ${at(leaseCutoff)}
        AND i.result_status = 'pending'
    `;
    await tx.$executeRaw`
      UPDATE company_tier_assessment_runs r
      SET r.status = CASE
            WHEN EXISTS (
              SELECT 1 FROM company_tier_assessment_run_items i
              WHERE i.company_tier_run_id = r.company_tier_run_id AND i.result_status = 'failed'
            ) THEN 'partial' ELSE 'completed' END,
          r.completed_at = ${at(now)}
      WHERE r.status = 'pending' AND r.created_at <= ${at(leaseCutoff)}
    `;
  }

  /**
   * 회사 tier 대기열을 고른다.
   *
   * 유효한 평가가 없는 회사를 활성 공고 수가 많은 순으로 먼저 고르고,
   * 남은 자리를 만료된 이전 Tier 1, 2, 3 순으로 채운다.
   * 사람 override 가 걸린 회사와 다른 실행이 처리 중인 회사는 제외한다.
   * 순서는 `ORDER BY` 가 정한다. 여기서 고른 차례가 곧 `selection_order` 다.
   */
  async selectCompanyTierQueue(
    collectionRunId: string,
    candidateContextVersion: string,
    contractVersion: number,
    today: string,
    limit: number,
    tx: Prisma.TransactionClient,
  ): Promise<QueuedCompanyRow[]> {
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT g.company_key, g.company_name, g.active_position_count, g.first_seen_at,
             prior.recommended_tier AS prior_tier, prior.reason AS prior_reason,
             prior.valid_until AS prior_valid_until
      FROM (
        SELECT p.company_key,
               MIN(p.company_name) AS company_name,
               COUNT(*) AS active_position_count,
               MIN(p.first_seen_at) AS first_seen_at
        FROM position_collection_items pci
        JOIN positions p ON p.position_id = pci.position_id
        WHERE pci.run_id = ${collectionRunId}
        GROUP BY p.company_key
      ) g
      LEFT JOIN LATERAL (
        SELECT a.recommended_tier, a.reason, a.valid_until
        FROM company_tier_assessments a
        WHERE a.company_key = g.company_key
          AND a.candidate_context_version = ${candidateContextVersion}
          AND a.contract_version = ${contractVersion}
        ORDER BY a.assessed_at DESC, a.company_tier_assessment_id DESC
        LIMIT 1
      ) prior ON TRUE
      WHERE NOT EXISTS (
          SELECT 1 FROM company_preferences pref WHERE pref.company_key = g.company_key
        )
        AND NOT EXISTS (
          SELECT 1 FROM company_tier_assessment_run_items li
          JOIN company_tier_assessment_runs lr ON lr.company_tier_run_id = li.company_tier_run_id
          WHERE li.company_key = g.company_key AND li.result_status = 'pending'
            AND lr.collection_run_id <> ${collectionRunId}
        )
        AND NOT EXISTS (
          SELECT 1 FROM company_tier_assessments va
          WHERE va.company_key = g.company_key
            AND va.candidate_context_version = ${candidateContextVersion}
            AND va.contract_version = ${contractVersion}
            AND va.valid_until >= ${today}
        )
      ORDER BY
        (prior.recommended_tier IS NOT NULL) ASC,
        CASE WHEN prior.recommended_tier IS NULL
             THEN -g.active_position_count ELSE prior.recommended_tier END ASC,
        CASE WHEN prior.recommended_tier IS NULL THEN g.first_seen_at ELSE NULL END ASC,
        CASE WHEN prior.recommended_tier IS NULL THEN NULL ELSE prior.valid_until END ASC,
        g.company_key ASC
      LIMIT ${Math.trunc(limit)}
    `;
    return rows.map((row) => ({
      companyKey: String(row.company_key),
      companyName: String(row.company_name),
      activePositionCount: number(row.active_position_count),
      assessmentStatus: row.prior_tier === null ? "new" : "stale",
      priorTier: row.prior_tier === null ? null : number(row.prior_tier),
      priorReason: row.prior_reason === null ? null : String(row.prior_reason),
      priorValidUntil: row.prior_valid_until === null ? null : dateOnly(row.prior_valid_until),
    }));
  }

  async insertCompanyTierRun(
    run: CompanyTierRunRow,
    completedAt: string | null,
    items: QueuedCompanyRow[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO company_tier_assessment_runs
        (company_tier_run_id, collection_run_id, candidate_context_version, contract_version,
         status, assessed_now_count, created_at, completed_at)
      VALUES (${run.companyTierRunId}, ${run.collectionRunId}, ${run.candidateContextVersion},
              ${run.contractVersion}, ${run.status}, ${run.assessedNowCount}, ${at(run.createdAt)},
              ${completedAt === null ? null : at(completedAt)})
    `;
    for (const [index, company] of items.entries()) {
      await tx.$executeRaw`
        INSERT INTO company_tier_assessment_run_items
          (company_tier_run_id, company_key, company_name, selection_order, assessment_status,
           selection_reason, prior_tier, active_position_count, result_status,
           company_tier_assessment_id, failure_code, attempt_count, completed_at)
        VALUES (${run.companyTierRunId}, ${company.companyKey}, ${company.companyName},
                ${index + 1}, ${company.assessmentStatus},
                ${company.assessmentStatus === "new" ? "discovery" : "refresh"},
                ${company.assessmentStatus === "new" ? null : company.priorTier},
                ${company.activePositionCount}, 'pending', NULL, NULL, 0, NULL)
      `;
    }
  }

  // ------------------------------------------------------------ 회사 tier 평가

  /** 회사의 유효한 모델 평가를 찾는다. 만료된 것은 담지 않는다. */
  async findValidAssessments(
    companyKeys: string[],
    candidateContextVersion: string,
    contractVersion: number,
    today: string,
    client: DbClient,
  ): Promise<Map<string, StoredCompanyTierAssessment>> {
    if (companyKeys.length === 0) return new Map();
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_tier_assessment_id, company_key, company_name, candidate_context_version,
             contract_version, created_by_company_tier_run_id, recommended_tier, confidence,
             reason, assessment, signals_json, evidence_json, assumptions_json, assessed_at, valid_until
      FROM company_tier_assessments
      WHERE company_key IN (${Prisma.join(companyKeys)})
        AND candidate_context_version = ${candidateContextVersion}
        AND contract_version = ${contractVersion}
        AND valid_until >= ${today}
      ORDER BY assessed_at ASC, company_tier_assessment_id ASC
    `;
    const latest = new Map<string, StoredCompanyTierAssessment>();
    for (const row of rows) latest.set(String(row.company_key), this.toAssessment(row));
    return latest;
  }

  /** 만료 여부와 무관하게 회사마다 가장 최근 평가를 찾는다. */
  async findLatestAssessments(
    companyKeys: string[],
    candidateContextVersion: string,
    contractVersion: number,
    client: DbClient,
  ): Promise<Map<string, StoredCompanyTierAssessment>> {
    if (companyKeys.length === 0) return new Map();
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_tier_assessment_id, company_key, company_name, candidate_context_version,
             contract_version, created_by_company_tier_run_id, recommended_tier, confidence,
             reason, assessment, signals_json, evidence_json, assumptions_json, assessed_at, valid_until
      FROM company_tier_assessments
      WHERE company_key IN (${Prisma.join(companyKeys)})
        AND candidate_context_version = ${candidateContextVersion}
        AND contract_version = ${contractVersion}
      ORDER BY assessed_at ASC, company_tier_assessment_id ASC
    `;
    const latest = new Map<string, StoredCompanyTierAssessment>();
    for (const row of rows) latest.set(String(row.company_key), this.toAssessment(row));
    return latest;
  }

  private toAssessment(row: RawRow): StoredCompanyTierAssessment {
    return {
      companyTierAssessmentId: String(row.company_tier_assessment_id),
      companyKey: String(row.company_key),
      companyName: String(row.company_name),
      candidateContextVersion: String(row.candidate_context_version),
      contractVersion: number(row.contract_version),
      createdByCompanyTierRunId:
        row.created_by_company_tier_run_id === null
          ? null
          : String(row.created_by_company_tier_run_id),
      recommendedTier: row.recommended_tier === null ? null : number(row.recommended_tier),
      confidence: row.confidence as "low" | "medium" | "high" | null,
      reason: String(row.reason),
      assessment: row.assessment === null ? null : String(row.assessment),
      signals: jsonValue<Record<string, unknown>>(row.signals_json),
      evidence: jsonValue<unknown[]>(row.evidence_json),
      assumptions: jsonValue<string[]>(row.assumptions_json),
      assessedAt: iso(row.assessed_at),
      validUntil: dateOnly(row.valid_until),
    };
  }

  /** 평가는 더하기만 한다. 과거 행을 고치거나 지우지 않는다. */
  async insertCompanyTierAssessments(
    assessments: StoredCompanyTierAssessment[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const assessment of assessments) {
      await tx.$executeRaw`
        INSERT INTO company_tier_assessments
          (company_tier_assessment_id, company_key, company_name, candidate_context_version,
           contract_version, created_by_company_tier_run_id, recommended_tier, confidence,
           reason, assessment, signals_json, evidence_json, assumptions_json, assessed_at, valid_until)
        VALUES (${assessment.companyTierAssessmentId}, ${assessment.companyKey},
                ${assessment.companyName}, ${assessment.candidateContextVersion},
                ${assessment.contractVersion}, ${assessment.createdByCompanyTierRunId},
                ${assessment.recommendedTier}, ${assessment.confidence}, ${assessment.reason}, ${assessment.assessment ?? null},
                ${JSON.stringify(assessment.signals)}, ${JSON.stringify(assessment.evidence)},
                ${JSON.stringify(assessment.assumptions)}, ${at(assessment.assessedAt)},
                ${assessment.validUntil})
      `;
    }
  }

  async updateCompanyTierRunItems(
    updates: CompanyTierRunItemUpdate[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const update of updates) {
      await tx.$executeRaw`
        UPDATE company_tier_assessment_run_items
        SET result_status = ${update.resultStatus},
            company_tier_assessment_id = ${update.companyTierAssessmentId},
            failure_code = ${update.failureCode},
            attempt_count = attempt_count + 1,
            completed_at = ${at(update.completedAt)}
        WHERE company_tier_run_id = ${update.companyTierRunId}
          AND company_key = ${update.companyKey}
      `;
    }
  }

  async closeCompanyTierRun(
    companyTierRunId: string,
    status: "partial" | "completed",
    assessedNowCount: number,
    completedAt: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE company_tier_assessment_runs
      SET status = ${status}, assessed_now_count = ${assessedNowCount},
          completed_at = ${at(completedAt)}
      WHERE company_tier_run_id = ${companyTierRunId}
    `;
  }
  // ------------------------------------------------------------ 공고 분석 실행

  /**
   * 분석 실행 행을 잠그고 읽는다.
   *
   * 멱등 키가 다른 두 요청이 같은 실행에 동시에 오면 뒤의 것이 여기서 기다린다.
   * 이 잠금이 없으면 둘이 같은 대기 항목을 각자 읽고 서로의 결과를 덮어쓴다.
   */
  async lockAnalysisRun(
    analysisRunId: string,
    tx: Prisma.TransactionClient,
  ): Promise<AnalysisRunRow | undefined> {
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT analysis_run_id, collection_run_id, candidate_context_version, contract_version,
             status, analyzed_now_count, created_at
      FROM position_analysis_runs WHERE analysis_run_id = ${analysisRunId}
      FOR UPDATE
    `;
    return rows[0] ? this.toAnalysisRun(rows[0]) : undefined;
  }

  private toAnalysisRun(row: RawRow): AnalysisRunRow {
    return {
      analysisRunId: String(row.analysis_run_id),
      collectionRunId: String(row.collection_run_id),
      candidateContextVersion: String(row.candidate_context_version),
      contractVersion: number(row.contract_version),
      status: row.status as "pending" | "partial" | "completed",
      analyzedNowCount: number(row.analyzed_now_count),
      createdAt: iso(row.created_at),
    };
  }

  /** 실행과 그 항목을 함께 읽는다. 항목은 응답에 필요한 공고 본문까지 담는다. */
  async findAnalysisRunWithItems(
    analysisRunId: string,
    client: DbClient,
  ): Promise<{ run: AnalysisRunRow; items: AnalysisRunItemRow[] } | undefined> {
    const runRows = await client.$queryRaw<RawRow[]>`
      SELECT analysis_run_id, collection_run_id, candidate_context_version, contract_version,
             status, analyzed_now_count, created_at
      FROM position_analysis_runs WHERE analysis_run_id = ${analysisRunId}
    `;
    if (!runRows[0]) return undefined;
    const itemRows = await client.$queryRaw<RawRow[]>`
      SELECT i.position_id, i.position_version_id, i.selection_order, i.analysis_status,
             i.selection_reason, i.company_tier, i.company_tier_source,
             i.company_tier_assessment_id, i.result_status, i.analysis_id, i.failure_code,
             i.attempt_count, pv.content_hash, pv.snapshot_json
      FROM position_analysis_run_items i
      JOIN position_versions pv ON pv.position_version_id = i.position_version_id
      WHERE i.analysis_run_id = ${analysisRunId}
      ORDER BY i.selection_order
    `;
    return {
      run: this.toAnalysisRun(runRows[0]),
      items: itemRows.map((row) => {
        const posting = jsonValue<PostingCandidate>(row.snapshot_json);
        return {
          positionId: String(row.position_id),
          positionVersionId: String(row.position_version_id),
          candidateId: posting.id,
          contentHash: String(row.content_hash),
          selectionOrder: number(row.selection_order),
          analysisStatus: row.analysis_status as "new" | "changed" | "stale",
          selectionReason: row.selection_reason as "priority" | "aging" | "overflow",
          companyTier: number(row.company_tier),
          companyTierSource: row.company_tier_source as CompanyTierSource,
          companyTierAssessmentId:
            row.company_tier_assessment_id === null ? null : String(row.company_tier_assessment_id),
          resultStatus: row.result_status as "pending" | "created" | "reused" | "failed",
          analysisId: row.analysis_id === null ? null : String(row.analysis_id),
          failureCode: (row.failure_code ?? null) as AnalysisFailureCode | null,
          attemptCount: number(row.attempt_count),
          posting,
        };
      }),
    };
  }

  /**
   * 아직 분석이 필요한 공고를 회사 tier 와 함께 읽는 조각이다.
   *
   * 회사 tier 는 사람 override, 유효한 모델 평가, 정책 기본값 순으로 해결한다.
   * 그 순서를 `COALESCE` 와 `CASE` 로 표현해 애플리케이션이 다시 고르지 않게 한다.
   * 유효한 분석이 이미 있는 공고는 `NOT EXISTS` 로 여기서 빠진다.
   */
  private analysisCandidatesSql(spec: AnalysisQueueSpec): Prisma.Sql {
    return Prisma.sql`
      SELECT p.position_id, pci.position_version_id, pv.content_hash, pv.snapshot_json,
             COALESCE(p.pending_since, ${at(spec.collectedAt)}) AS pending_since,
             CAST(pci.close_urgency AS CHAR) AS close_urgency,
             CASE
               WHEN NOT EXISTS (
                 SELECT 1 FROM position_analyses a WHERE a.position_id = p.position_id
               ) THEN 'new'
               WHEN NOT EXISTS (
                 SELECT 1 FROM position_analyses a
                 WHERE a.position_version_id = pci.position_version_id
               ) THEN 'changed'
               ELSE 'stale'
             END AS analysis_status,
             COALESCE(pref.tier, valid.recommended_tier, ${spec.defaultCompanyTier})
               AS company_tier,
             CASE
               WHEN pref.company_key IS NOT NULL THEN 'manual'
               WHEN valid.recommended_tier IS NOT NULL THEN 'model'
               ELSE 'default'
             END AS company_tier_source,
             CASE
               WHEN pref.company_key IS NULL AND valid.recommended_tier IS NOT NULL THEN valid.company_tier_assessment_id
               ELSE NULL
             END AS company_tier_assessment_id
      FROM position_collection_items pci
      JOIN positions p ON p.position_id = pci.position_id
      JOIN position_versions pv ON pv.position_version_id = pci.position_version_id
      LEFT JOIN company_preferences pref ON pref.company_key = p.company_key
      LEFT JOIN LATERAL (
        SELECT a.company_tier_assessment_id, a.recommended_tier
        FROM company_tier_assessments a
        WHERE a.company_key = p.company_key
          AND a.candidate_context_version = ${spec.candidateContextVersion}
          AND a.contract_version = ${spec.companyTierContractVersion}
          AND a.valid_until >= ${spec.today}
        ORDER BY a.assessed_at DESC, a.company_tier_assessment_id DESC
        LIMIT 1
      ) valid ON TRUE
      WHERE pci.run_id = ${spec.collectionRunId}
        AND NOT EXISTS (
          SELECT 1 FROM position_analyses fresh
          WHERE fresh.position_version_id = pci.position_version_id
            AND fresh.candidate_context_version = ${spec.candidateContextVersion}
            AND fresh.contract_version = ${spec.analysisContractVersion}
            AND fresh.valid_until >= ${spec.today}
        )
    `;
  }

  /**
   * 분석 대기열을 고른다.
   *
   * 우선 슬롯은 회사 tier, 분석 상태, 마감 긴급도, 대기 시작 시각 순으로 고르고
   * 보장 슬롯은 남은 후보 가운데 가장 오래 기다린 것부터 고른다.
   * 두 슬롯의 합이 일일 상한과 같도록 정책 schema 가 강제하므로,
   * 두 조회로 고르지 못한 자리를 다시 채우는 단계는 필요하지 않다.
   * 순서는 `ORDER BY` 가 정한다. 여기서 고른 차례가 곧 `selection_order` 다.
   */
  async selectAnalysisQueue(
    spec: AnalysisQueueSpec,
    tx: Prisma.TransactionClient,
  ): Promise<AnalysisCandidateRow[]> {
    const candidates = this.analysisCandidatesSql(spec);
    const priority = await tx.$queryRaw<RawRow[]>`
      SELECT * FROM (${candidates}) c
      ORDER BY c.company_tier ASC,
               FIELD(c.analysis_status, 'new', 'changed', 'stale') ASC,
               FIELD(c.close_urgency, 'urgent', 'soon', 'normal', 'no_deadline', 'unknown') ASC,
               c.pending_since ASC,
               c.position_id ASC
      LIMIT ${Math.trunc(spec.prioritySlots)}
    `;
    const taken = priority.map((row) => String(row.position_id));
    const agingSlots = Math.trunc(spec.agingSlots);
    const aging =
      agingSlots === 0
        ? []
        : await tx.$queryRaw<RawRow[]>`
            SELECT * FROM (${candidates}) c
            ${
              taken.length === 0
                ? Prisma.empty
                : Prisma.sql`WHERE c.position_id NOT IN (${Prisma.join(taken)})`
            }
            ORDER BY c.pending_since ASC, c.position_id ASC
            LIMIT ${agingSlots}
          `;
    return [
      ...priority.map((row) => this.toAnalysisCandidate(row, "priority")),
      ...aging.map((row) => this.toAnalysisCandidate(row, "aging")),
    ];
  }

  private toAnalysisCandidate(
    row: RawRow,
    selectionReason: "priority" | "aging",
  ): AnalysisCandidateRow {
    const posting = jsonValue<PostingCandidate>(row.snapshot_json);
    return {
      positionId: String(row.position_id),
      positionVersionId: String(row.position_version_id),
      candidateId: posting.id,
      contentHash: String(row.content_hash),
      analysisStatus: row.analysis_status as "new" | "changed" | "stale",
      selectionReason,
      companyTier: number(row.company_tier),
      companyTierSource: row.company_tier_source as CompanyTierSource,
      companyTierAssessmentId:
        row.company_tier_assessment_id === null ? null : String(row.company_tier_assessment_id),
      posting,
    };
  }

  /**
   * 이미 만들어진 분석을 공고 version 별로 찾는다.
   *
   * 같은 공고 version 과 같은 두 버전 조합에는 분석이 하나만 있을 수 있다.
   * 결과를 반영할 때 이 조회가 비어 있지 않으면 새로 만들지 않고 그것을 다시 쓴다.
   */
  async findAnalysesForVersions(
    positionVersionIds: string[],
    candidateContextVersion: string,
    contractVersion: number,
    client: DbClient,
  ): Promise<Map<string, string>> {
    if (positionVersionIds.length === 0) return new Map();
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT position_version_id, analysis_id FROM position_analyses
      WHERE position_version_id IN (${Prisma.join(positionVersionIds)})
        AND candidate_context_version = ${candidateContextVersion}
        AND contract_version = ${contractVersion}
    `;
    return new Map(rows.map((row) => [String(row.position_version_id), String(row.analysis_id)]));
  }

  async insertAnalysisRun(
    run: AnalysisRunRow,
    completedAt: string | null,
    candidates: AnalysisCandidateRow[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO position_analysis_runs
        (analysis_run_id, collection_run_id, candidate_context_version, contract_version,
         status, analyzed_now_count, created_at, completed_at)
      VALUES (${run.analysisRunId}, ${run.collectionRunId}, ${run.candidateContextVersion},
              ${run.contractVersion}, ${run.status}, ${run.analyzedNowCount},
              ${at(run.createdAt)}, ${completedAt === null ? null : at(completedAt)})
    `;
    for (const [index, candidate] of candidates.entries()) {
      await tx.$executeRaw`
        INSERT INTO position_analysis_run_items
          (analysis_run_id, position_id, position_version_id, selection_order, analysis_status,
           selection_reason, company_tier, company_tier_source, company_tier_assessment_id,
           result_status, analysis_id, failure_code, attempt_count, completed_at)
        VALUES (${run.analysisRunId}, ${candidate.positionId}, ${candidate.positionVersionId},
                ${index + 1}, ${candidate.analysisStatus}, ${candidate.selectionReason},
                ${candidate.companyTier}, ${candidate.companyTierSource},
                ${candidate.companyTierAssessmentId}, 'pending', NULL, NULL, 0, NULL)
      `;
    }
  }

  /** 분석은 더하기만 한다. 과거 행을 고치거나 지우지 않는다. */
  async insertAnalyses(rows: NewAnalysisRow[], tx: Prisma.TransactionClient): Promise<void> {
    for (const analysis of rows) {
      await tx.$executeRaw`
        INSERT INTO position_analyses
          (analysis_id, position_id, position_version_id, candidate_context_version,
           contract_version, created_by_analysis_run_id, analyzed_at, valid_until,
           company_tier_at_analysis, decision, fit_score, role_fit, scope_upside,
           company_opportunity, constraints_score, reason, details_json, next_actions_json)
        VALUES (${analysis.analysisId}, ${analysis.positionId}, ${analysis.positionVersionId},
                ${analysis.candidateContextVersion}, ${analysis.contractVersion},
                ${analysis.createdByAnalysisRunId}, ${at(analysis.analyzedAt)},
                ${analysis.validUntil}, ${analysis.companyTierAtAnalysis}, ${analysis.decision},
                ${analysis.fitScore}, ${analysis.scoreBreakdown.roleFit},
                ${analysis.scoreBreakdown.scopeUpside},
                ${analysis.scoreBreakdown.companyOpportunity},
                ${analysis.scoreBreakdown.constraints}, ${analysis.reason},
                ${JSON.stringify(analysis.details)}, ${JSON.stringify(analysis.nextActions)})
      `;
    }
  }

  async updateAnalysisRunItems(
    updates: AnalysisRunItemUpdate[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    for (const update of updates) {
      await tx.$executeRaw`
        UPDATE position_analysis_run_items
        SET result_status = ${update.resultStatus}, analysis_id = ${update.analysisId},
            failure_code = ${update.failureCode}, attempt_count = attempt_count + 1,
            completed_at = ${at(update.completedAt)}
        WHERE analysis_run_id = ${update.analysisRunId} AND position_id = ${update.positionId}
      `;
    }
  }

  async updateAnalysisRunStatus(
    analysisRunId: string,
    status: "partial" | "completed",
    analyzedNowCount: number,
    completedAt: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE position_analysis_runs
      SET status = ${status}, analyzed_now_count = ${analyzedNowCount},
          completed_at = ${at(completedAt)}
      WHERE analysis_run_id = ${analysisRunId}
    `;
  }

  // ------------------------------------------------------------------ 추천 실행

  /**
   * 추천을 만들려는 두 요청의 순서를 세운다.
   *
   * 추천 실행 행은 아직 없으므로 그 근거인 분석 실행 행을 잠근다.
   * 이 잠금이 없으면 둘이 「추천이 아직 없다」를 함께 읽고 각자 같은 추천을 만들려 한다.
   * `lockAnalysisRun` 과 같은 행을 잠그지만 쓰기 경로가 달라 메서드를 나눈다.
   */
  async lockRecommendationRun(
    analysisRunId: string,
    tx: Prisma.TransactionClient,
  ): Promise<AnalysisRunRow | undefined> {
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT analysis_run_id, collection_run_id, candidate_context_version, contract_version,
             status, analyzed_now_count, created_at
      FROM position_analysis_runs WHERE analysis_run_id = ${analysisRunId}
      FOR UPDATE
    `;
    return rows[0] ? this.toAnalysisRun(rows[0]) : undefined;
  }

  /** 이번 수집이 담은 공고를 추천 조립에 필요한 형태로 읽는다. */
  async listRecommendationPositions(
    collectionRunId: string,
    client: DbClient,
  ): Promise<RecommendationPositionRow[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT p.position_id, pv.position_version_id, p.company_key, pv.content_hash,
             pv.snapshot_json
      FROM position_collection_items pci
      JOIN positions p ON p.position_id = pci.position_id
      JOIN position_versions pv ON pv.position_version_id = pci.position_version_id
      WHERE pci.run_id = ${collectionRunId}
      ORDER BY p.source_key, p.identity_hash
    `;
    return rows.map((row) => ({
      positionId: String(row.position_id),
      positionVersionId: String(row.position_version_id),
      companyKey: String(row.company_key),
      contentHash: String(row.content_hash),
      posting: jsonValue<PostingCandidate>(row.snapshot_json),
    }));
  }

  /**
   * 이번 수집이 담은 version 에 붙은 유효한 분석을 공고마다 하나씩 읽는다.
   *
   * 같은 조건에 여러 분석이 있으면 가장 늦게 분석한 것을 쓴다.
   */
  async findFreshAnalyses(
    collectionRunId: string,
    candidateContextVersion: string,
    contractVersion: number,
    today: string,
    client: DbClient,
  ): Promise<Map<string, RecommendationAnalysisRow>> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT pa.analysis_id, pa.position_id, pa.decision, pa.fit_score, pa.reason,
             pa.details_json, pa.next_actions_json, pa.created_by_analysis_run_id
      FROM position_collection_items pci
      JOIN position_analyses pa ON pa.position_version_id = pci.position_version_id
      WHERE pci.run_id = ${collectionRunId}
        AND pa.candidate_context_version = ${candidateContextVersion}
        AND pa.contract_version = ${contractVersion}
        AND pa.valid_until >= ${today}
      ORDER BY pa.analyzed_at ASC, pa.analysis_id ASC
    `;
    const latest = new Map<string, RecommendationAnalysisRow>();
    for (const row of rows) {
      latest.set(String(row.position_id), {
        analysisId: String(row.analysis_id),
        positionId: String(row.position_id),
        decision: row.decision as "recommend" | "consider" | "hold",
        fitScore: number(row.fit_score),
        reason: String(row.reason),
        details: jsonValue<unknown[]>(row.details_json),
        nextActions: jsonValue<string[]>(row.next_actions_json),
        createdByAnalysisRunId:
          row.created_by_analysis_run_id === null ? null : String(row.created_by_analysis_run_id),
      });
    }
    return latest;
  }

  /**
   * 추천 하나를 조립하는 데 필요한 읽기를 모은다.
   *
   * 회사 tier 실행이 없는 수집은 회사 tier 평가를 도입하기 전에 저장된 것이라
   * 그때의 계약 버전을 호출자가 준다.
   */
  async findRecommendationInputs(
    analysisRunId: string,
    today: string,
    defaultCompanyTierContractVersion: number,
    client: DbClient,
  ): Promise<RecommendationInputs | undefined> {
    const runRows = await client.$queryRaw<RawRow[]>`
      SELECT analysis_run_id, collection_run_id, candidate_context_version, contract_version,
             status, analyzed_now_count, created_at
      FROM position_analysis_runs WHERE analysis_run_id = ${analysisRunId}
    `;
    if (!runRows[0]) return undefined;
    const run = this.toAnalysisRun(runRows[0]);
    const tierRun = await this.findCompanyTierRunByCollectionRun(run.collectionRunId, client);
    const positions = await this.listRecommendationPositions(run.collectionRunId, client);
    const companyKeys = [...new Set(positions.map((position) => position.companyKey))];
    const collection = await this.findCollectionRun(run.collectionRunId, client);
    return {
      run,
      positions,
      freshAnalyses: await this.findFreshAnalyses(
        run.collectionRunId,
        run.candidateContextVersion,
        run.contractVersion,
        today,
        client,
      ),
      analyses: await this.listAnalysesForCollection(run.collectionRunId, client),
      preferences: await this.findPreferencesFor(companyKeys, client),
      validAssessments: await this.findValidAssessments(
        companyKeys,
        run.candidateContextVersion,
        tierRun?.contractVersion ?? defaultCompanyTierContractVersion,
        today,
        client,
      ),
      diagnostics: await this.listCollectionDiagnostics(run.collectionRunId, client),
      personalExcludedCount: collection?.personalExcludedCount ?? 0,
      assessmentFailedCount: tierRun
        ? await this.countFailedCompanyTierItems(tierRun.companyTierRunId, client)
        : 0,
    };
  }

  async countFailedCompanyTierItems(companyTierRunId: string, client: DbClient): Promise<number> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT COUNT(*) AS failed_count FROM company_tier_assessment_run_items
      WHERE company_tier_run_id = ${companyTierRunId} AND result_status = 'failed'
    `;
    return number(rows[0]?.failed_count ?? 0);
  }

  /** 평가 ID 로 회사 tier 평가를 읽는다. 저장된 추천의 출처를 다시 붙일 때 쓴다. */
  async findAssessmentsByIds(
    ids: string[],
    client: DbClient,
  ): Promise<Map<string, StoredCompanyTierAssessment>> {
    if (ids.length === 0) return new Map();
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT company_tier_assessment_id, company_key, company_name, candidate_context_version,
             contract_version, created_by_company_tier_run_id, recommended_tier, confidence,
             reason, assessment, signals_json, evidence_json, assumptions_json, assessed_at, valid_until
      FROM company_tier_assessments
      WHERE company_tier_assessment_id IN (${Prisma.join(ids)})
    `;
    return new Map(
      rows.map((row) => [String(row.company_tier_assessment_id), this.toAssessment(row)]),
    );
  }

  /** 추천은 더하기만 한다. 같은 분석 실행에 두 번째 추천을 만들지 않는다. */
  async insertRecommendationRun(
    run: RecommendationRunRow,
    items: RecommendationItemRow[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO position_recommendation_runs
        (recommendation_run_id, analysis_run_id, collection_run_id, generated_at,
         analyzed_now_count, reused_count, pending_count, pending_candidates_json,
         personal_excluded_count)
      VALUES (${run.recommendationRunId}, ${run.analysisRunId}, ${run.collectionRunId},
              ${at(run.generatedAt)}, ${run.analyzedNowCount}, ${run.reusedCount},
              ${run.pendingCount}, ${JSON.stringify(run.pendingCandidates)},
              ${run.personalExcludedCount})
    `;
    for (const item of items) {
      await tx.$executeRaw`
        INSERT INTO position_recommendation_items
          (recommendation_run_id, position_id, analysis_id, rank_number, decision,
           company_tier, company_tier_source, company_tier_assessment_id)
        VALUES (${run.recommendationRunId}, ${item.positionId}, ${item.analysisId},
                ${item.rankNumber}, ${item.decision}, ${item.companyTier},
                ${item.companyTierSource}, ${item.companyTierAssessmentId})
      `;
    }
  }

  /** 저장된 추천을 읽는다. 분석 실행 ID 로도 추천 실행 ID 로도 찾는다. */
  async findStoredRecommendation(
    key: { analysisRunId: string } | { recommendationRunId: string },
    client: DbClient,
  ): Promise<StoredRecommendation | undefined> {
    const where =
      "analysisRunId" in key
        ? Prisma.sql`analysis_run_id = ${key.analysisRunId}`
        : Prisma.sql`recommendation_run_id = ${key.recommendationRunId}`;
    const runRows = await client.$queryRaw<RawRow[]>`
      SELECT recommendation_run_id, analysis_run_id, collection_run_id, generated_at,
             analyzed_now_count, reused_count, pending_count, pending_candidates_json,
             personal_excluded_count
      FROM position_recommendation_runs WHERE ${where}
    `;
    const row = runRows[0];
    if (!row) return undefined;
    const recommendationRunId = String(row.recommendation_run_id);
    const collectionRunId = String(row.collection_run_id);
    const itemRows = await client.$queryRaw<RawRow[]>`
      SELECT ri.rank_number, ri.decision, ri.company_tier, ri.company_tier_source,
             ri.company_tier_assessment_id, pa.fit_score, pa.reason, pa.details_json,
             pa.next_actions_json, pv.snapshot_json
      FROM position_recommendation_items ri
      JOIN position_analyses pa ON pa.analysis_id = ri.analysis_id
      JOIN position_versions pv ON pv.position_version_id = pa.position_version_id
      WHERE ri.recommendation_run_id = ${recommendationRunId}
      ORDER BY ri.rank_number
    `;
    const activeRows = await client.$queryRaw<RawRow[]>`
      SELECT COUNT(*) AS active_count FROM position_collection_items
      WHERE run_id = ${collectionRunId}
    `;
    return {
      recommendationRunId,
      analysisRunId: String(row.analysis_run_id),
      collectionRunId,
      generatedAt: iso(row.generated_at),
      analyzedNowCount: number(row.analyzed_now_count),
      reusedCount: number(row.reused_count),
      pendingCount: number(row.pending_count),
      personalExcludedCount: number(row.personal_excluded_count),
      pendingCandidates: jsonValue<unknown[]>(row.pending_candidates_json),
      activeCount: number(activeRows[0]?.active_count ?? 0),
      items: itemRows.map((item) => {
        const posting = jsonValue<PostingCandidate>(item.snapshot_json);
        return {
          candidateId: posting.id,
          company: posting.company,
          title: posting.title,
          postingUrl: posting.url,
          companyTier: number(item.company_tier),
          companyTierSource: item.company_tier_source as CompanyTierSource,
          companyTierAssessmentId:
            item.company_tier_assessment_id === null
              ? null
              : String(item.company_tier_assessment_id),
          decision: item.decision as "recommend" | "consider" | "hold",
          fitScore: number(item.fit_score),
          reason: String(item.reason),
          details: jsonValue<unknown[]>(item.details_json),
          nextActions: jsonValue<string[]>(item.next_actions_json),
        };
      }),
    };
  }

  /**
   * 실행 ID 하나가 어느 실행을 가리키는지 정한다.
   *
   * 분석 실행 ID, 그 수집 실행 ID, 저장된 추천 실행 ID 순으로 찾는다.
   * 셋 다 아니면 아직 만들어지지 않은 추천 실행 ID 일 수 있으므로,
   * 추천이 없는 분석 실행의 추천 ID 를 만들어 대조한다.
   */
  async findRunById(id: string, client: DbClient): Promise<RunLookup | undefined> {
    const analysisRows = await client.$queryRaw<RawRow[]>`
      SELECT analysis_run_id FROM position_analysis_runs
      WHERE analysis_run_id = ${id} OR collection_run_id = ${id}
      ORDER BY analysis_run_id = ${id} DESC
      LIMIT 1
    `;
    if (analysisRows[0]) {
      return { kind: "analysis", analysisRunId: String(analysisRows[0].analysis_run_id) };
    }
    const storedRows = await client.$queryRaw<RawRow[]>`
      SELECT recommendation_run_id FROM position_recommendation_runs
      WHERE recommendation_run_id = ${id}
    `;
    if (storedRows[0]) {
      return {
        kind: "recommendation",
        recommendationRunId: String(storedRows[0].recommendation_run_id),
      };
    }
    const openRows = await client.$queryRaw<RawRow[]>`
      SELECT r.analysis_run_id FROM position_analysis_runs r
      WHERE NOT EXISTS (
        SELECT 1 FROM position_recommendation_runs pr
        WHERE pr.analysis_run_id = r.analysis_run_id
      )
    `;
    for (const row of openRows) {
      const analysisRunId = String(row.analysis_run_id);
      if (stableUuid(`recommendation:${analysisRunId}`) === id) {
        return { kind: "recommendation-missing", analysisRunId };
      }
    }
    return undefined;
  }
}
