# Phase 02. 학습자료 HTTP 계약 구현

**Execution profile**: deep

## 목표

기존 `/api/study/v1`의 14개 동작을 같은 DTO와 오류 계약으로 Backend에 구현하고,
현재 career-os client가 주소만 바꿔 사용할 수 있게 한다.

**범위 외**: `fos-blog` 관리자 화면 전환과 기존 route·table 제거, 운영 환경 주소 변경은 다른 저장소 작업이 담당한다.

## 컨텍스트

현재 `scripts/study-topic-recommender/study-library/`는 mock HTTP로 계약을 검증한다.
새 Backend는 기본 경로, DTO, 상태 code, URL 정규화, cursor와 멱등 hash를 유지한다.
인증만 기존 단일 service token에서 역할별 token으로 나눈다.

**근거 문서**: `docs/data-schema.md`의 「학습자료 HTTP 계약」,
`docs/flow.md`의 「학습자료 API 연동모드」,
`docs/code-architecture.md`의 「아침 읽을거리」

## 의도 메모

- 자료 원문 전체, 이미지와 영상 자막을 저장하지 않는다.
- cursor는 opaque JSON이며 Backend가 adapter별 내부 구조를 해석하지 않는다.
- 수집 실패는 빈 ingestion으로 바꾸지 않는다.
- 추천 저장은 기존 추천 이력과 직전 주제 중복을 transaction 안에서 다시 검사한다.

## 작업 항목

### 1. source, cursor와 ingestion route 구현

`routes/study.ts`에 source 저장과 목록, mode별 cursor 조회, ingestion 저장을 구현한다.
자료 묶음은 100개 이하이고 cursor JSON은 64 KiB 이하로 제한한다.
ingestion은 source version을 잠그고 material, source 연결, tag, 다음 cursor와 영수증을 한 transaction으로 저장한다.

### 2. material와 개인 상태 route 구현

자료 목록은 기존 필터, 정렬과 cursor pagination을 유지한다.
단건 조회는 source, tag와 현재 개인 상태를 함께 반환한다.
개인 상태 변경은 expected version을 검사하고 즐겨찾기, 읽음과 메모를 독립적으로 보존한다.

### 3. 후보, 추천과 publication route 구현

후보 조회는 누적 추천 집합을 제외하고 최근 주제 key와 `historyVersion`을 반환한다.
추천 저장은 report, topic, item snapshot과 누적 추천 집합을 한 transaction으로 반영한다.
같은 report와 idempotency key 재시도는 기존 응답을 반환한다.
publication은 외부 게시 성공 뒤에만 별도 영수증과 함께 저장한다.

### 4. import dry-run과 commit 구현

dry-run은 legacy history와 Pages manifest를 검증하고 변경 요약, `previewHash`와 현재 `historyVersion`을 반환한다.
commit은 같은 preview hash와 version일 때만 반영하고 한 항목이라도 달라지면 `409`로 거부한다.
dry-run은 DB를 변경하지 않는다.

### 5. 기존 client와 Backend 계약 테스트

Backend를 임시 loopback port에서 실행하고 현재 `study-library` client 테스트를 실제 route에 연결한다.
14개 정상 동작과 `400`, `401`, `403`, `404`, `409`, `413`, `429`, `503` 오류 envelope를 검사한다.
응답에는 `private, no-store`, `noindex, nofollow`와 request ID가 있어야 한다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/services/recommendation-api/study career-os/scripts/study-topic-recommender/study-library
bunx tsc --noEmit
git diff --check
```

현재 client fixture와 새 Backend 응답의 JSON 모양과 상태 code가 같아야 한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/recommendation-api/routes/study.ts` | 신규 |
| `services/recommendation-api/study/sources.ts` | 신규 |
| `services/recommendation-api/study/ingestion.ts` | 신규 |
| `services/recommendation-api/study/materials.ts` | 신규 |
| `services/recommendation-api/study/recommendations.ts` | 신규 |
| `services/recommendation-api/study/imports.ts` | 신규 |
| `services/recommendation-api/study/*.test.ts` | 신규 |
| `scripts/study-topic-recommender/study-library/*.test.ts` | Backend 계약 검증 추가 |
