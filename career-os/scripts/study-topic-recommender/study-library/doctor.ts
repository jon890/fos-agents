import { resolveCareerBackendConnection } from "../../lib/career-backend-config.ts";

export type DoctorCheck = { name: string; ok: boolean; message: string };
export type DoctorResult = { passed: boolean; checks: DoctorCheck[] };
type Fetch = (input: URL, init: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 10_000;
const SETUP_HINT =
  "career-os/.env 에 CAREER_BACKEND_URL 과 CAREER_BACKEND_TOKEN 또는 CAREER_BACKEND_TOKEN_FILE 을 둔다. 운영 값은 홈서버 인프라 저장소가 소유한다";

/**
 * 공부 추천이 Backend 에 닿는지 요청 전에 확인한다.
 * 연결값이나 토큰 값은 출력하지 않는다. 무엇이 빠졌는지만 알린다.
 * 실패하면 git 이력의 옛 설정 같은 사본으로 이어 가지 않고 멈춘다. 사본은 Backend 에서 바뀐 것을 모른다.
 */
export async function checkStudyBackend(
  environment: Record<string, string | undefined> = process.env,
  fetchImpl: Fetch = fetch,
): Promise<DoctorResult> {
  let connection: { baseUrl: string; token: string };
  try {
    connection = resolveCareerBackendConnection(environment);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { passed: false, checks: [{ name: "connection", ok: false, message: `${reason} ${SETUP_HINT}` }] };
  }
  const checks: DoctorCheck[] = [{ name: "connection", ok: true, message: "연결값이 있다" }];
  const call = (path: string) =>
    fetchImpl(new URL(path, connection.baseUrl), {
      method: "GET",
      headers: { Authorization: `Bearer ${connection.token}`, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  try {
    const auth = await call("/api/v1/auth/check");
    await auth.body?.cancel();
    if (auth.status !== 204) {
      checks.push({
        name: "auth",
        ok: false,
        message: auth.status === 401 ? "토큰이 거절됐다. 토큰 값을 다시 확인한다" : `인증 확인이 ${auth.status} 로 실패했다`,
      });
      return { passed: false, checks };
    }
    checks.push({ name: "auth", ok: true, message: "Backend 에 닿고 토큰이 유효하다" });
  } catch {
    checks.push({ name: "auth", ok: false, message: "Backend 에 닿지 못했다. 주소와 네트워크 경로를 확인한다" });
    return { passed: false, checks };
  }

  try {
    const document = await call("/api/candidate-context/v1/documents/learning-interests");
    await document.body?.cancel();
    if (document.status === 404) {
      checks.push({
        name: "learning-interests",
        ok: false,
        message: "learning-interests 문서가 없다. manage_candidate_context.ts put --key learning-interests --expected-version 0 으로 저장한다",
      });
    } else if (!document.ok) {
      checks.push({ name: "learning-interests", ok: false, message: `문서 조회가 ${document.status} 로 실패했다` });
    } else {
      checks.push({ name: "learning-interests", ok: true, message: "learning-interests 문서가 있다" });
    }
  } catch {
    checks.push({ name: "learning-interests", ok: false, message: "문서를 조회하지 못했다" });
  }
  return { passed: checks.every((check) => check.ok), checks };
}
