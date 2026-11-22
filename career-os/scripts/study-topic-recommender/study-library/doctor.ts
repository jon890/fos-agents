import { readContextDocument } from "../../lib/career-store/context.ts";
import { openCareerStore, resolveCareerStoreRoot } from "../../lib/career-store/database.ts";
import { CareerStoreError } from "../../lib/career-store/errors.ts";
import { StudyStore } from "../../lib/career-store/study/store.ts";

export type DoctorCheck = { name: string; ok: boolean; message: string };
export type DoctorResult = { passed: boolean; checks: DoctorCheck[] };

/**
 * 공부 추천이 작업 폴더 저장소를 쓸 수 있는지, 켜진 소스와 learning-interests 문서가 있는지 실행 전에 확인한다.
 * 저장소가 열리지 않으면 다른 사본으로 이어 가지 않고 멈춘다.
 */
export async function checkStudyStore(
  environment: Record<string, string | undefined> = process.env,
): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];
  let store: StudyStore;
  try {
    store = new StudyStore(openCareerStore(environment));
    checks.push({ name: "store", ok: true, message: "커리어 데이터 파일을 열었다" });
  } catch (error) {
    const reason = error instanceof CareerStoreError ? `${error.code}: ${error.message}` : "커리어 데이터 파일을 열지 못했다. CAREER_WORKSPACE_ROOT 가 쓸 수 있는 작업 폴더인지 확인한다";
    return { passed: false, checks: [{ name: "store", ok: false, message: reason }] };
  }
  // 새 저장소는 소스 없이 시작한다. 켜진 소스가 없으면 수집이 0건으로 조용히 끝나므로 여기서 막는다.
  const enabled = (await store.listSources()).sources.filter((source) => source.enabled).length;
  checks.push(
    enabled > 0
      ? { name: "sources", ok: true, message: `켜진 소스가 ${enabled}개 있다` }
      : {
          name: "sources",
          ok: false,
          message: "켜진 읽을거리 소스가 없다. study-sources add 로 소스를 먼저 넣는다",
        },
  );
  try {
    readContextDocument(resolveCareerStoreRoot(environment), "learning-interests");
    checks.push({ name: "learning-interests", ok: true, message: "learning-interests 문서가 있다" });
  } catch {
    checks.push({
      name: "learning-interests",
      ok: false,
      message: "learning-interests 문서가 없다. 문서 본문을 작업 폴더의 context/learning-interests.md 에 쓴 뒤 다시 실행한다",
    });
  }
  return { passed: checks.every((check) => check.ok), checks };
}
