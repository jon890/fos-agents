import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildImportPayload, formatImportSummary } from "./import_position_state.ts";

const observedAt = "2026-01-01T00:00:00.000Z";

function fact(factId: string, sourceType: string, overrides: Record<string, unknown> = {}) {
  return {
    factId,
    topic: "보상",
    statement: `${factId} 근거 문장`,
    source: {
      url: `https://example.com/${factId}`,
      title: `${factId} 제목`,
      publisher: "발행처",
      sourceType,
      observedAt,
    },
    ...overrides,
  };
}

function writeSource(
  facts: unknown[],
  options: { inferences?: unknown[]; exclusions?: unknown } = {},
): string {
  const root = mkdtempSync(join(tmpdir(), "position-state-import-"));
  mkdirSync(join(root, "company-research"), { recursive: true });
  writeFileSync(
    join(root, "company-research", "example-company.json"),
    JSON.stringify({
      schemaVersion: 1,
      profile: {
        companyKey: "example-company",
        company: "예시 회사",
        researchedAt: observedAt,
        facts,
        inferences: options.inferences ?? [],
      },
    }),
  );
  if (options.exclusions !== undefined) {
    mkdirSync(join(root, "private-config"), { recursive: true });
    writeFileSync(
      join(root, "private-config", "position-exclusions.json"),
      JSON.stringify(options.exclusions),
    );
  }
  return root;
}

describe("파일에 있던 포지션 상태 이관", () => {
  test("sourceType을 표대로 옮기고 원본 fact를 payloadJson에 담는다", () => {
    const root = writeSource([
      fact("fact-filing", "regulatory-filing"),
      fact("fact-compensation", "public-compensation"),
      fact("fact-posting", "job-posting"),
      fact("fact-official", "official"),
      fact("fact-investor", "investor-relations"),
      fact("fact-news", "reputable-news"),
      fact("fact-other", "other"),
    ]);
    try {
      const payload = buildImportPayload(root);
      const evidence = payload.companies[0].evidence;

      expect(payload.companies.map((company) => company.companyKey)).toEqual(["example-company"]);
      expect(evidence.map((item) => item.sourceType)).toEqual([
        "dart-financial",
        "review",
        "job-posting",
        "official",
        "official",
        "other",
        "other",
      ]);
      expect(evidence[0].summary).toBe("fact-filing 근거 문장");
      expect(evidence[0].title).toBe("fact-filing 제목");
      expect(evidence[0].url).toBe("https://example.com/fact-filing");
      expect(evidence[0].payloadJson).toEqual(fact("fact-filing", "regulatory-filing"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("validUntil이 없으면 옮긴 뒤의 source_type이 정한 기간을 붙인다", () => {
    const root = writeSource([
      fact("fact-filing", "regulatory-filing"),
      fact("fact-compensation", "public-compensation"),
      fact("fact-official", "official"),
      fact("fact-kept", "official", { validUntil: "2027-12-31" }),
    ]);
    try {
      const evidence = buildImportPayload(root).companies[0].evidence;

      // 2026-01-01 에 dart-financial 180일, review 60일, official 90일을 더한 날이다.
      expect(evidence.map((item) => item.validUntil)).toEqual([
        "2026-06-30",
        "2026-03-02",
        "2026-04-01",
        "2027-12-31",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("url을 가진 버전 1 규칙이 그 url을 evidenceUrls에 담아 버전 2로 올라간다", () => {
    const root = writeSource([fact("fact-official", "official")], {
      inferences: [
        {
          inferenceId: "inference-one",
          topic: "보상",
          statement: "추론 문장",
          basisFactIds: ["fact-official"],
          inferredAt: observedAt,
        },
      ],
      exclusions: {
        schemaVersion: 1,
        exclusions: [
          {
            source: "wanted",
            identityHash: "wanted:example-id",
            url: "https://www.wanted.co.kr/wd/example-id",
          },
        ],
      },
    });
    try {
      const payload = buildImportPayload(root, { decidedAt: "2026-09-22" });

      expect(payload.droppedInferenceCount).toBe(1);
      expect(payload.exclusions).toEqual([
        {
          scope: "posting",
          source: "wanted",
          identityHash: "wanted:example-id",
          url: "https://www.wanted.co.kr/wd/example-id",
          decisionKind: "manual",
          reason: "이관 전 규칙",
          evidenceUrls: ["https://www.wanted.co.kr/wd/example-id"],
          decidedAt: "2026-09-22",
        },
      ]);
      expect(payload.evidenceUrlMissingCount).toBe(0);
      expect(payload.rejectedExclusionCount).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("url이 없는 버전 1 규칙은 근거를 지어내지 않고 집계에 잡는다", () => {
    const root = writeSource([fact("fact-official", "official")], {
      exclusions: {
        schemaVersion: 1,
        exclusions: [{ source: "wanted", identityHash: "wanted:example-id" }],
      },
    });
    try {
      const payload = buildImportPayload(root, { decidedAt: "2026-09-22" });
      const lines = formatImportSummary(payload);

      expect(payload.evidenceUrlMissingCount).toBe(1);
      expect(payload.rejectedExclusionCount).toBe(1);
      expect(lines).toContain("근거 URL이 원본에 없는 버전 1 제외 규칙 1건");
      expect(lines).toContain("Backend 계약을 만족하지 못하는 제외 규칙 1건");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("집계에 회사 수와 근거와 제외 규칙과 버린 추론 건수를 낸다", () => {
    const root = writeSource([fact("fact-official", "official")], {
      exclusions: {
        schemaVersion: 1,
        exclusions: [
          {
            source: "wanted",
            identityHash: "wanted:example-id",
            url: "https://www.wanted.co.kr/wd/example-id",
          },
        ],
      },
    });
    try {
      const lines = formatImportSummary(buildImportPayload(root, { decidedAt: "2026-09-22" }));

      expect(lines).toEqual(["회사 1개, 회사 근거 1건", "버린 추론 0건", "제외 규칙 1건"]);
      expect(lines.join("\n")).not.toContain("예시 회사");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("근거 URL이 없는 규칙이 있으면 --commit이 아무것도 보내지 않고 종료 코드 1로 끝낸다", async () => {
    const root = writeSource([fact("fact-official", "official")], {
      exclusions: {
        schemaVersion: 1,
        exclusions: [{ source: "wanted", identityHash: "wanted:example-id" }],
      },
    });
    try {
      const child = Bun.spawn(
        [
          "bun",
          `${import.meta.dir}/import_position_state.ts`,
          "--source-dir",
          root,
          "--decided-at",
          "2026-09-22",
          "--commit",
        ],
        { stdout: "pipe", stderr: "pipe" },
      );
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);

      expect(exitCode).toBe(1);
      expect(stdout).toContain("근거 URL이 원본에 없는 버전 1 제외 규칙 1건");
      expect(stderr).toContain("아무것도 보내지 않았습니다");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  test("버전 1 규칙이 있는데 --decided-at이 없으면 종료 코드 1로 끝낸다", async () => {
    const root = writeSource([fact("fact-official", "official")], {
      exclusions: {
        schemaVersion: 1,
        exclusions: [
          {
            source: "wanted",
            identityHash: "wanted:example-id",
            url: "https://www.wanted.co.kr/wd/example-id",
          },
        ],
      },
    });
    try {
      const child = Bun.spawn(
        ["bun", `${import.meta.dir}/import_position_state.ts`, "--source-dir", root, "--dry-run"],
        { stdout: "pipe", stderr: "pipe" },
      );
      const [stderr, exitCode] = await Promise.all([
        new Response(child.stderr).text(),
        child.exited,
      ]);

      expect(exitCode).toBe(1);
      expect(stderr).toContain("--decided-at");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  test("원본 디렉터리가 없으면 종료 코드 1로 중단하고 찾은 경로를 낸다", async () => {
    const missing = join(tmpdir(), "position-state-import-missing-directory");
    const child = Bun.spawn(
      ["bun", `${import.meta.dir}/import_position_state.ts`, "--source-dir", missing, "--dry-run"],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stderr, exitCode] = await Promise.all([new Response(child.stderr).text(), child.exited]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain(missing);
  }, 30_000);

  test("빈 디렉터리는 0건으로 집계하고 종료 코드 0으로 끝낸다", async () => {
    const root = mkdtempSync(join(tmpdir(), "position-state-import-empty-"));
    try {
      const child = Bun.spawn(
        ["bun", `${import.meta.dir}/import_position_state.ts`, "--source-dir", root, "--dry-run"],
        { stdout: "pipe", stderr: "pipe" },
      );
      const [stdout, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        child.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("회사 근거 0건");
      expect(stdout).toContain("제외 규칙 0건");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  test("옮기는 표에 없는 sourceType 이 있으면 종료 코드 1로 중단한다", async () => {
    // 이관 표와 파일 계약은 지금 같은 일곱 값을 담는다.
    // 둘 중 하나가 늘어 어긋나면 이 명령이 조용히 지나가지 않고 멈춰야 한다.
    const root = writeSource([fact("fact-unknown", "analyst-report")]);
    try {
      const child = Bun.spawn(
        ["bun", `${import.meta.dir}/import_position_state.ts`, "--source-dir", root, "--dry-run"],
        { stdout: "pipe", stderr: "pipe" },
      );
      const [stderr, exitCode] = await Promise.all([
        new Response(child.stderr).text(),
        child.exited,
      ]);

      expect(exitCode).toBe(1);
      expect(stderr.length).toBeGreaterThan(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
