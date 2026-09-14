import { expect, test } from "bun:test";
import { tossDetailRejectReason } from "./toss.ts";

test("삭제되거나 종료된 토스 상세 링크는 수집 실패로 세지 않는다", () => {
  expect(tossDetailRejectReason(404)).toBe("closed_or_removed");
  expect(tossDetailRejectReason(410)).toBe("closed_or_removed");
  expect(tossDetailRejectReason(403)).toBe("http");
  expect(tossDetailRejectReason(500)).toBe("http");
});
