import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contextVersion } from "../lib/career-store/context.ts";
import {
  cleanupCareerWorkspaces,
  createCareerWorkspace,
} from "../lib/career-store/test-support.ts";
import { prepareCandidateContext } from "./candidate-context.ts";

afterEach(cleanupCareerWorkspaces);

describe("공고 추천의 후보자 맥락 준비", () => {
  test("작업 폴더 context/ 의 두 문서를 읽어 실행 폴더에 쓰고 기준 버전을 돌려준다", () => {
    const { root } = createCareerWorkspace({
      "position-preferences": "- 백엔드 플랫폼\r\n",
      "application-state": "- 지원 중인 곳 없음",
    });
    const output = join(root, "candidate-context.json");
    const version = contextVersion("position-preferences", "- 백엔드 플랫폼");

    expect(prepareCandidateContext({ candidateContext: output }, root)).toEqual({
      candidateContextVersion: version,
    });
    expect(JSON.parse(readFileSync(output, "utf8"))).toEqual({
      candidateContextVersion: version,
      documents: {
        "position-preferences": { body: "- 백엔드 플랫폼" },
        "application-state": { body: "- 지원 중인 곳 없음" },
      },
    });
  });

  test("문서가 없으면 어느 문서를 어디에 써야 하는지 알리고 파일을 쓰지 않는다", () => {
    const { root } = createCareerWorkspace({ "position-preferences": "- 백엔드" });
    const output = join(root, "candidate-context.json");
    expect(() => prepareCandidateContext({ candidateContext: output }, root)).toThrow(
      `후보자 맥락 문서가 없다: application-state. 문서 본문을 ${join(root, "context", "application-state.md")} 에 쓴 뒤 다시 실행한다.`,
    );
    expect(() => readFileSync(output, "utf8")).toThrow();
  });
});
