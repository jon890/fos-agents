# Phase 03 — TossPlace Applied AI Engineer fixture 생성

## 목표

TossPlace `Applied AI Engineer` 공고를 첫 application agent 검증 fixture로 저장한다.

## 입력

- URL: `https://toss.im/career/job-detail?gh_jid=7746700003`
- 목적: MVP 검증용 샘플. 실제 지원 목적 아님.

## 작업 항목

1. 공식 Toss career API 또는 공개 페이지에서 최신 공고 내용을 확인한다.
2. `data/applications/tossplace/applied-ai-engineer/posting.md`를 작성한다.
3. `data/applications/ledger.jsonl`에 fixture record를 추가한다.
4. Toss 계열 쿨다운 risk flag를 기록한다.
5. 공고가 closed 상태이면 fixture 생성은 하되 `blocked` 또는 `closed`로 명시한다.

## 검증 기준

- `posting.md`에 source URL, fetchedAt, company, role, employment, location, key requirements가 있다.
- ledger record가 JSONL 한 줄로 parse 가능하다.
- 실제 제출 또는 로그인 자동화가 없다.

## 산출물

- `data/applications/tossplace/applied-ai-engineer/posting.md`
- `data/applications/ledger.jsonl`
