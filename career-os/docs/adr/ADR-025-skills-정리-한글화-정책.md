## ADR-025 — Skills 정리 + 한글화 정책

- Status: 채택됨
- Date: 2026-05-14

### 맥락

career-os skills 11개가 plan005·plan010·plan011을 거치며 도메인·언어 자산이 안정됐으나 세 가지 문제가 남아 있었다. (1) `fos-study-pack`은 dispatcher 미연결 + `run_from_request` deferred 상태로 1개월 이상 방치돼 사용 가치 없음. (2) 7개 SKILL.md가 영문 위주(한글 비율 ≤15%)라 다른 skill·docs와 톤 비대칭. (3) maintainer가 update-vs-new 판단 시 fos-study 전체 상태 점검이 필요하지만 `docs-audit`과 명시적 연계가 없어 일관성 유지가 어려움.

### 결정

- `fos-study-pack` 폴더(`scripts/` + `skills/`) 제거. 자연어 라우팅 의도는 `study-pack-writer` SKILL.md의 trigger pattern으로 흡수.
- 한글화 정책: description + prose는 한글, 코드 식별자(skill명·command명·파일경로·함수명)는 영어 유지.
- `study-pack-maintainer` SKILL.md 안에 docs-audit 활용 권장 안내 한 줄 추가(수동 링크, cross-skill 자동 호출 없음).

### 거절한 대안

- fos-study-pack을 dispatcher에 wire-up: 미사용 자산을 살려둘 정당화 없음.
- 한글 비율 100%(코드 식별자까지 한글화): trigger pattern 매칭·grep에 영향.
- maintainer에서 docs-audit subprocess 자동 호출: cross-skill 결합도 상승.

### 결과

skill 수 11 → 10. SKILL.md 톤 일관성 확보. 한글화로 한국어 native 유지보수성 향상. 코드 식별자 영어 유지로 Claude Code skill trigger 매칭 보존. 단점: 한글화 후 영문 grep 시 일부 안내 누락 가능 — 코드 식별자는 영어라 핵심 검색은 영향 없음. 적용: `tasks/plan012-skills-korean-and-cleanup/`. depends_on: plan010(skills 추상화 완료).
