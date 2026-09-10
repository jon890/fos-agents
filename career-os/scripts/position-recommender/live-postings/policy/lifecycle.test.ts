import { expect, test } from "bun:test";
import { closeWindow } from "./lifecycle.ts";

test("마감 상태는 주입한 기준 시각으로 결정한다", () => {
  const evaluatedAt = new Date("2026-09-10T00:00:00Z");
  expect(closeWindow("2026-09-13T00:00:00Z", evaluatedAt)).toEqual({
    closesAt: "2026-09-13T00:00:00Z",
    daysUntilClose: "3",
    closeUrgency: "urgent",
  });
  expect(closeWindow("2026-09-17T00:00:01Z", evaluatedAt).closeUrgency).toBe("normal");
  expect(closeWindow("", evaluatedAt).closeUrgency).toBe("no_deadline");
  expect(closeWindow("확인 중", evaluatedAt).closeUrgency).toBe("unknown");
});
