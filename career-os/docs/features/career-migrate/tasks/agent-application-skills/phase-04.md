# Phase 04. 작업본 동기화와 공통 프로필 client 를 지우고 실행기에서 그 명령을 뺀다

**Execution profile**: standard

## 목표

홈서버와 작업본을 주고받던 `career-os/scripts/career-workspace/` 와 fos-assistant 서비스 토큰으로 공통 프로필을 읽던 `career-os/scripts/application-profile/` 를 지운다. 번들 실행기의 `workspace` 는 `paths` 만 남기고 `application-profile` 실행기를 뺀다.

**범위 외**: `scripts/candidate-context/`, `scripts/profile/`, `scripts/lib/career-backend-*`(Backend 를 부르는 노트북 CLI, 5단계). 책임 문서와 버전(phase 05).

## 컨텍스트

- phase 02 뒤로 어떤 스킬도 `workspace begin|finish` 와 `application-profile` 을 부르지 않는다.
- `career-os/scripts/plugin-local/workspace.ts` 가 `career-workspace/cli.ts`, `contracts.ts`, `transport.ts` 를 import 한다. `main.ts` 는 `TransportError`, `makeRemoteError` 로 `workspace` 의 실패를 낸다.
- `career-os/scripts/application-package/application_form_schema.ts` 가 `application-profile/contracts.ts` 의 `APPLICATION_PROFILE_SOURCE` 를 import 한다. 이미 만든 `evidence/application-form.json` 을 다시 검증하려면 이 값이 남아야 한다.
- `career-os/scripts/lib/access-credentials.ts` 는 Backend client 도 쓰므로 지우지 않는다. `resolveAccessCredentials` 의 `prefix` 타입 `"CAREER_BACKEND" | "FOS_ASSISTANT"` 가운데 `FOS_ASSISTANT` 는 공통 프로필 client 만 썼다.

**요구사항**: REQ9(스펙 DECISION7, 설계 REQ9 줄)

**근거 문서**: `career-os/docs/adr/ADR-147-후보자-맥락-문서는-비서의-기억이-프로필-원고는-작업-폴더-파일이-갖는다.md`

## 의도 메모

- 운영의 작업본 release 와 저장 공간을 지우는 일은 운영 단계 4 다(스펙 DECISION10). 이 phase 는 코드만 지운다.
- `workspace paths` 는 남긴다. 스킬이 `root` 와 `evidenceDir` 를 이 명령으로 확인한다. 출력의 `mode` 칸은 뺀다.
- `profileSource` 값은 바꾸지 않는다. 공통 프로필의 원본은 여전히 fos-assistant Memory 다.

## 작업 항목

### 1. 삭제

- `career-os/scripts/career-workspace/` 전체.
- `career-os/scripts/application-profile/` 전체.

### 2. `career-os/scripts/application-package/application_form_schema.ts`

`APPLICATION_PROFILE_SOURCE = "fos-assistant-memory:identity/career-application-profile"` 를 이 파일에서 정의하고 export 한다. `check_evidence_sources.ts` 머리 주석의 `application-profile get`, `workspace begin` 문장을 기억에서 읽는다는 말로 고친다.

### 3. `career-os/scripts/plugin-local/`

- `workspace.ts`: `runPluginWorkspace(args, environment)` 가 `paths` 만 받는다. 결과는 `{ schemaVersion: 1, action: "paths", ok: true, root, evidenceDir }` 다. 다른 하위 명령은 `UsageError("사용법: workspace paths --json")` 를 던진다. `resolvePluginWorkspace` 의 `mode` 를 지운다.
- `main.ts`: `runWorkspace` 가 `UsageError` 면 사용법을 stderr 에 쓰고 2 로 끝난다. `application-profile` 과 그 import, `career-workspace` import 를 지운다. `workspace` 설명을 「작업 폴더와 프로젝트 근거 위치를 알려 준다 (paths) --json」 으로 고친다.
- `executors.ts`: `application-profile` 을 뺀다.
- `career-os/scripts/lib/career-store/test-support.ts`, `career-os/scripts/study-topic-recommender/runtime-paths.test.ts` 의 `career-workspace` 는 임시 폴더 이름일 뿐이라 고치지 않는다.

### 4. 설정과 지침

- `career-os/.env.example`: `CAREER_WORKSPACE_SSH_*`, `CAREER_STORAGE_*` 같은 동기화 값과 `FOS_ASSISTANT_*` 를 지운다.
- `.claude/implementation-overlay.md`: 「career-os 경계」 의 작업본 동기화 두 줄을 지우고 「`applications/`, `library/`, `state/` 는 커리어 에이전트의 작업 폴더에만 있고 저장소에 두지 않는다」 로 바꾼다.
- `career-os/scripts/lib/access-credentials.ts`: `prefix` 타입을 `"CAREER_BACKEND"` 하나로 줄인다. `access-credentials.test.ts` 와 `access-client-wiring.test.ts` 의 `FOS_ASSISTANT` 사례를 지운다.

### 5. 테스트

- `workspace.test.ts`: 원격 모드, `begin`, `finish` 사례를 지운다. `paths` 결과에 `mode` 가 없고, `begin` 은 `UsageError` 다.
- `main.test.ts`: 실행기 목록과 수를 고친다. `workspace begin x` 는 2, `application-profile` 은 모르는 실행기로 2 다.
- `career-os/plugin/scripts/local-bundle.test.ts`: `mode` 기대와 `application-profile` 테스트를 지운다. 「번들에 `career-workspace` 의 SSH 실행 코드가 없다」(`CAREER_WORKSPACE_SSH_TARGET` 문자열이 번들에 없다)를 더한다.
- `career-os/scripts/application-package/` 의 테스트는 `profileSource` 값을 그대로 쓰므로 통과해야 한다.
- `cd career-os/plugin && bun run build` 로 번들을 다시 만든다.

## 검증

```bash
bun test ./career-os/scripts ./career-os/plugin
bunx tsc --noEmit -p .
cd career-os/plugin && bun run typecheck
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/career-workspace/**` | 삭제 |
| `career-os/scripts/application-profile/**` | 삭제 |
| `career-os/scripts/application-package/application_form_schema.ts` | 수정 |
| `career-os/scripts/application-package/check_evidence_sources.ts` | 수정 (주석) |
| `career-os/scripts/plugin-local/workspace.ts` | 수정 |
| `career-os/scripts/plugin-local/workspace.test.ts` | 수정 |
| `career-os/scripts/plugin-local/main.ts` | 수정 |
| `career-os/scripts/plugin-local/main.test.ts` | 수정 |
| `career-os/scripts/plugin-local/executors.ts` | 수정 |
| `career-os/scripts/lib/access-credentials.ts` | 수정 |
| `career-os/scripts/lib/access-credentials.test.ts` | 수정 |
| `career-os/scripts/lib/access-client-wiring.test.ts` | 수정 |
| `career-os/plugin/scripts/local-bundle.test.ts` | 수정 |
| `career-os/plugin/dist/career-local.js` | 수정 (빌드) |
| `career-os/.env.example` | 수정 |
| `.claude/implementation-overlay.md` | 수정 |
