import assert from "node:assert/strict";
import { test } from "node:test";
import { isNonServerTitle, isServerRole } from "./policy.ts";

test("keeps a backend and AI productivity role when frontend is only a preferred adjacent skill", () => {
  const jd = "Java/Kotlin 기반 백엔드 역량과 LLM 적용 경험이 필요합니다. 우대사항으로 프론트엔드 프레임워크 경험이 있습니다.";

  assert.equal(isNonServerTitle("카카오페이 FDE - AI 기반 업무 생산성 향상"), false);
  assert.equal(isServerRole(jd), true);
});

test("excludes a compliance title even when its JD mentions system construction", () => {
  assert.equal(isNonServerTitle("컴플라이언스 담당자 - 개인(신용)정보 보호"), true);
});
