import { readContextDocument } from "../../lib/career-store/context.ts";
import { openCareerStore, resolveCareerStoreRoot } from "../../lib/career-store/database.ts";
import { CareerStoreError } from "../../lib/career-store/errors.ts";

export type DoctorCheck = { name: string; ok: boolean; message: string };
export type DoctorResult = { passed: boolean; checks: DoctorCheck[] };

/**
 * 공부 추천이 작업 폴더 저장소를 쓸 수 있는지 실행 전에 확인한다.
 * 저장소가 열리지 않으면 다른 사본으로 이어 가지 않고 멈춘다.
 */
export async function checkStudyStore(
  environment: Record<string, string | undefined> = process.env,
): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [];
  try {
    openCareerStore(environment);
    checks.push({ name: "store", ok: true, message: "커리어 데이터 파일을 열었다" });
  } catch (error) {
    const reason = error instanceof CareerStoreError ? `${error.code}: ${error.message}` : "커리어 데이터 파일을 열지 못했다. CAREER_WORKSPACE_ROOT 가 쓸 수 있는 작업 폴더인지 확인한다";
    return { passed: false, checks: [{ name: "store", ok: false, message: reason }] };
  }
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
