## ADR-091 — career-os 스크립트 root는 위치 기준으로 해석한다

- Status: Accepted
- Date: 2026-06-16

### 맥락

career-os TS·셸 헬퍼들이 작업 root를 `~/ai-nodes/career-os`로 하드코딩하고 있었다.
일부는 `homedir()/ai-nodes/career-os`, 일부는 Linux 절대경로 `/home/bifos/ai-nodes/career-os`로 기본값이 제각각이었고, 일부만 `CAREER_OS_ROOT` env override를 지원했다.

이 때문에 repo가 `~/ai-nodes/career-os`가 아닌 다른 위치(예: `~/personal/fos-agents/career-os`)에 체크아웃되면 스크립트가 엉뚱한 디렉터리를 읽고 빈 결과를 냈다.
실제로 study-topic-recommender 실행이 비어 있는 추천을 생성한 원인이 이 하드코딩이었다.

### 결정

career-os 스크립트는 작업 root를 다음 우선순위로 해석한다.

1. `CAREER_OS_ROOT` 환경변수가 있으면 그 값을 사용한다.
2. 없으면 스크립트 자기 파일 위치에서 career-os root를 도출한다.

스크립트는 항상 `career-os/scripts/<skill>/` 아래에 있으므로, 자기 위치에서 두 단계 위가 career-os root다.
이 방식은 repo가 어디에 체크아웃되든 자동으로 따라오므로 별도 설정 없이 모든 환경에서 동작한다.

config 파일로 root 경로를 분리하는 방식은 채택하지 않는다.
config 자체가 root 아래에 있어 "root 위치를 config에 적는다"는 닭-달걀 문제가 생기기 때문이다.

### 결과

- 운영 머신(repo가 `~/ai-nodes/career-os`)과 개발 체크아웃(`~/personal/fos-agents/career-os`) 양쪽에서 같은 스크립트가 정상 동작한다.
- 새 스크립트도 위치 기준 도출 + `CAREER_OS_ROOT` override 패턴을 따른다.
- 하드코딩된 홈 절대경로가 사라져 OS·사용자명 의존이 제거된다.

### 적용

- 위치 기준 도출은 Bun `import.meta.dir` 기준이다(모노레포 Bun 표준, [[ADR-020]]).
- 셸 스크립트는 `BASH_SOURCE` 기준으로 동일하게 도출한다.
