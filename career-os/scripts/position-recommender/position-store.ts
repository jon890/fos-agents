import { openCareerStore } from "../lib/career-store/database.ts";
import { PositionStore } from "../lib/career-store/positions/store.ts";

export { PositionStore };

type Environment = Record<string, string | undefined>;

/**
 * 공고 추천의 저장 모듈을 연다. 데이터는 커리어 작업 폴더의 SQLite 파일에 있다(ADR-146).
 * 작업 폴더는 `CAREER_WORKSPACE_ROOT` 이고 없으면 `/workspace/career` 다.
 */
export function createPositionStore(environment: Environment = process.env): PositionStore {
  return new PositionStore(openCareerStore(environment));
}
