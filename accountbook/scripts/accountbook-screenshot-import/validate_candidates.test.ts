import { describe, expect, test } from "bun:test";
import type { ExtractedImport } from "./contracts.ts";
import { validateImport } from "./validate_candidates.ts";

const IMAGE_HASH = "a".repeat(64);

function fixture(): ExtractedImport {
  return {
    schemaVersion: 1 as const,
    source: "toss-consumption-screenshot" as const,
    sourceImage: {
      fileName: "sample.png",
      sha256: IMAGE_HASH,
      capturedAt: "2026-08-20T10:17:53+09:00",
      width: 1179,
      height: 2556,
    },
    extraction: {
      engine: "agent-vision",
      runtime: "test",
      extractedAt: "2026-08-20T10:20:00+09:00",
    },
    reviewStatus: "pending" as const,
    days: [
      {
        date: "2026-08-19",
        dateSource: "file-metadata" as const,
        completeness: "complete" as const,
        selectedForImport: true,
        expectedTotals: { expense: 12000, income: 500 },
        transactions: [
          {
            rowIndex: 1,
            type: "expense" as const,
            amount: 12000,
            description: "  예시 상점  ",
            paymentMethod: "예시 카드",
            categoryName: null,
            confidence: { amount: "high" as const, description: "high" as const, date: "high" as const },
            evidence: { amountText: "-12,000원", detailText: "예시 상점 | 예시 카드" },
          },
          {
            rowIndex: 2,
            type: "income" as const,
            amount: 500,
            description: "예시 이자",
            paymentMethod: null,
            categoryName: null,
            confidence: { amount: "high" as const, description: "medium" as const, date: "high" as const },
            evidence: { amountText: "500원", detailText: "예시 이자" },
          },
        ],
      },
    ],
  };
}

describe("validateImport", () => {
  test("일별 합계가 맞으면 등록 가능한 후보를 만든다", () => {
    const result = validateImport(fixture(), { now: () => new Date("2026-08-20T01:30:00Z") });

    expect(result.batchId).toBe(`toss-${IMAGE_HASH.slice(0, 16)}`);
    expect(result.days[0].validation.status).toBe("exact");
    expect(result.days[0].validation.calculatedTotals).toEqual({ expense: 12000, income: 500 });
    expect(result.days[0].transactions[0].description).toBe("예시 상점");
    expect(result.days[0].transactions[0].candidateId).toHaveLength(24);
    expect(result.validation.submissionReady).toBe(true);
    expect(result.validation.selectedTransactionCount).toBe(2);
  });

  test("상세 합계와 화면 요약이 다르면 등록을 막는다", () => {
    const input = fixture();
    input.days[0].expectedTotals = { expense: 13000, income: 500 };

    const result = validateImport(input);

    expect(result.days[0].validation.status).toBe("mismatch");
    expect(result.validation.submissionReady).toBe(false);
    expect(result.validation.errors).toContain("2026-08-19:validation_mismatch");
  });

  test("잘린 날짜는 선택에서 제외한다", () => {
    const input = fixture();
    input.days[0].completeness = "partial";

    const result = validateImport(input);

    expect(result.days[0].selectedForImport).toBe(false);
    expect(result.days[0].validation.status).toBe("incomplete");
    expect(result.validation.errors).toContain("no_complete_day_selected");
  });

  test("같은 날짜의 행 번호가 중복되면 실패한다", () => {
    const input = fixture();
    input.days[0].transactions[1].rowIndex = 1;

    expect(() => validateImport(input)).toThrow("DUPLICATE_ROW_INDEX:2026-08-19:1");
  });

  test("필수 필드 신뢰도가 낮으면 등록을 막는다", () => {
    const input = fixture();
    input.days[0].transactions[0].confidence.amount = "low";

    const result = validateImport(input);

    expect(result.validation.submissionReady).toBe(false);
    expect(result.validation.errors).toContain("low_confidence_required_field");
  });
});
