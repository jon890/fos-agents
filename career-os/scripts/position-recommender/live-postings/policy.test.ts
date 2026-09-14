import assert from "node:assert/strict";
import { test } from "node:test";
import { isNonTargetTitle, isTargetRole, isTargetRoleTitle } from "./policy.ts";

test("keeps a backend and AI productivity role when frontend is only a preferred adjacent skill", () => {
  const jd =
    "Java/Kotlin 기반 백엔드 역량과 LLM 적용 경험이 필요합니다. 우대사항으로 프론트엔드 프레임워크 경험이 있습니다.";

  assert.equal(isNonTargetTitle("카카오페이 FDE - AI 기반 업무 생산성 향상"), false);
  assert.equal(isTargetRole(jd), true);
});

test("excludes a compliance title even when its JD mentions system construction", () => {
  assert.equal(isNonTargetTitle("컴플라이언스 담당자 - 개인(신용)정보 보호"), true);
});

test("excludes Korean security roles before broad JD keywords are evaluated", () => {
  assert.equal(isNonTargetTitle("[인프라] 보안 엔지니어"), true);
});

test("requires an engineering role in ambiguous platform and infrastructure titles", () => {
  assert.equal(isTargetRoleTitle("상담팀 리드 (토스플랫폼 전담팀)"), false);
  assert.equal(isTargetRoleTitle("Category MD (생활 - 가구/홈데코/주방용품)"), false);
  assert.equal(isTargetRoleTitle("FE Platform Engineer"), false);
  assert.equal(isTargetRoleTitle("Data Analytics Engineer (Platform)"), false);
  assert.equal(isTargetRoleTitle("AI Platform Engineer (Serving)"), true);
  assert.equal(isTargetRoleTitle("Platform Engineer"), true);
  assert.equal(isTargetRoleTitle("Node.js Developer"), true);
});
