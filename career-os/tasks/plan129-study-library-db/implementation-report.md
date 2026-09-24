# 공부 추천 저장 전환 구현 보고

## 결과

계획의 5개 단계를 구현하고 단계별로 커밋했다. 공부 소스, 수집 자료, 추천 이력과 제외 판정을 MySQL 기반 Backend에 저장하며, 공부 추천 CLI의 파일 이력 모드는 제거했다. 코드 검토와 문서 정합성 재검토는 모두 `PASS`를 받았다.

| 단계 | 커밋 | 구현 결과 | 단계 검증 |
| --- | --- | --- | --- |
| [01](phase-01.md) | `4b15e69` | 공부 소스와 cursor용 테이블을 포함한 study 테이블 10개, 소스 API와 DB 저장 | Backend 타입 검사 통과, MySQL 테스트 146건 통과 |
| [02](phase-02.md) | `eca4dcf` | 자료와 cursor의 일괄 저장, 누적 후보 조회와 페이지 처리 | Backend 타입 검사 통과, MySQL 테스트 156건 통과 |
| [03](phase-03.md) | `f07f003` | 추천 실행, 제외 판정, 게시 기록과 기준 버전 저장 | Backend 타입 검사 통과, MySQL 테스트 163건 통과 |
| [04](phase-04.md) | `0057aa0` | CLI의 Backend 단일 흐름, 소스 편집·기준 변경·이관 명령, 공용 API 연결값 | 공부 추천 테스트 108건과 포지션 client 테스트 9건 통과, 타입 검사 통과, 실제 Backend fixture dry-run 성공 |
| [05](phase-05.md) | `d52edfd` | 새 실행 흐름과 소스 편집 절차를 스킬 문서에 반영 | 공부 추천 테스트 110건, 스킬 테스트 125건 통과, 타입·한국어·스킬 구조 검사 통과 |

검토 지적은 `b682e88`에 함께 반영했다. 이관 재실행의 멱등 키, 소스 category와 note 계약, 동시 생성 충돌, CLI 옵션 검증, 후보 버전과 추천 요청 파일의 회귀 검사를 고쳤다. 문서에는 Backend 구현 상태, 환경값, 후보 페이지 충돌과 추천 요청 파일 계약을 맞췄다.

## 계획을 고친 자리

구현 전 검토에서 발견한 계약 누락을 `8d5cb74`에 반영했다. [01](phase-01.md)에는 전체 study 테이블과 소스 `note` 계약을, [03](phase-03.md)에는 이관 시 기존 리포트를 건너뛰기 위한 상태 조회 API를 적었다. [04](phase-04.md)에는 추천 요청의 헤더 멱등 키, 기준 버전, 선택하지 않은 후보의 판정, 이관 재실행 조건과 fixture 검증을 명시했다. [05](phase-05.md)에는 lockfile 설치, 스킬 전체 테스트와 구조 검사까지 완료 조건으로 추가했다.

원본 `state/morning-study-history.json`은 읽지 않았다. 작업 공간 지침에 따라 운영 원본 확인은 코디네이터의 별도 동기화 단계에 남겼고, 이번 검증에는 같은 구조의 임시 fixture를 사용했다.

## 최종 검증

| 명령 또는 검사 | 결과 |
| --- | --- |
| `bun install --frozen-lockfile` | 종료 코드 0, 설치 변경 없음 |
| `bun test career-os/scripts/study-topic-recommender` | 종료 코드 0, 21개 파일의 121건 통과, 실패·건너뜀 없음 |
| `bunx tsc --noEmit` | 종료 코드 0 |
| `bun test ./career-os/.claude/skills/` | 종료 코드 0, 11개 파일의 125건 통과, 실패·건너뜀 없음 |
| Backend `npm run typecheck` | 종료 코드 0 |
| 로컬 MySQL을 연결한 Backend `npm test` | 종료 코드 0, 17개 파일의 165건 통과, 실패·건너뜀 없음 |
| `quick_validate.py career-os/.claude/skills/study-topic-recommender` | 종료 코드 0, `Skill is valid!` |
| 한국어 검사기 | 변경한 스킬·문서 파일 모두 종료 코드 0 |
| 제거한 환경값·파일모드 참조 검사와 `git diff --check` | 종료 코드 0 |

로컬 MySQL에 migration을 적용해 Nest Backend를 띄운 뒤, 리포트 3건과 자료 15건을 담은 임시 이력과 YouTube 소스를 `import_study_state.ts --dry-run`에 전달했다. 종료 코드 0, 표준 출력은 `{"sources":1,"reports":3,"materials":15,"skipped":0}`이었고 표준 오류는 비어 있었다. 검증용 Backend를 중지하고 임시 database와 fixture를 정리했다.

초기 통합 테스트 한 번은 `SHADOW_DATABASE_URL`을 지정하지 않아 Prisma migration 비교 1건이 실패했다. 테스트 환경에 이 값을 지정해 다시 실행했고 위의 Backend 165건이 모두 통과했다. 검사 입력 누락이었으며 코드 변경은 필요하지 않았다.

## 역할과 남은 작업

계획 검토에는 `agent_type: critic`, 단계 구현과 검토 반영에는 `agent_type: executor`, 누적 코드 검토에는 `agent_type: code-reviewer`, 문서 정합성 검토에는 `agent_type: verifier`를 사용했다. 두 최종 검토의 판정은 모두 `PASS`다.

운영 원본을 대상으로 한 dry-run과 실제 이관, 운영 migration, 홈서버 정기 작업 설정 변경은 아직 하지 않았다. 원격 push, PR, 배포도 수행하지 않았다. 코디네이터가 운영 원본을 동기화해 건수를 확인한 뒤 별도 절차로 진행한다.
