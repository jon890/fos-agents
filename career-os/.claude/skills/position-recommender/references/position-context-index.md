# 포지션 추천 컨텍스트 인덱스

이 문서는 `position-recommender`가 포지션 추천 시 함께 참고해야 하는 durable context 파일 목록이다.

## Source of truth

- `config/candidate-profile.md`
  - 후보자의 실제 이력/프로젝트/강점/약점.
  - 근거 없는 성과나 수치는 만들지 않는다.

## Decision rubric

- `references/position-decision-criteria.md`
  - 포지션 추천의 기본 의사결정 축.
  - JD fit, 차별화 가능성, 회사/도메인 업사이드, 역할 구성, 쿨다운, 하드필터/소프트랭킹, 고용 형태를 다룬다.

## Company / scale upside

- `references/company-upside-reference.md`
  - NHN 대비 브랜드/보상/트래픽/도메인/엔지니어링 규모 업사이드 판단 기준.
  - 배민/우아한형제들처럼 회사는 좋지만 사업 리스크나 팀 선별이 필요한 케이스도 여기서 판단한다.

## Verified company discovery targets

- `references/verified-company-research-targets.json`
  - 네이버/네이버파이낸셜/LINE, 쿠팡, 오늘의집, 우아한형제들, 당근 등 검증된 회사군 탐색 대상.
  - 공식 career URL, Wanted 검색 키워드, 기술블로그 URL, 선호 도메인, 주의 메모를 포함한다.

## Engineering blog signals

- `config/sources.json` (`techBlog` 카테고리)
  - 기술블로그/엔지니어링 블로그 소스.
  - 회사의 엔지니어링 문화, 대규모 운영, 결제/정산/커머스/플랫폼/SRE 시그널을 판단할 때 사용한다.

## Runtime posting snapshots

- `data/runtime/live-position-postings.md`
- `data/runtime/verified-company-postings-raw.md`
- `data/runtime/*position*.md`

실제 수집 결과와 추천 리포트가 저장되는 위치다. 추천 전 최신성이 중요하면 새로 수집한다.

## Usage rule

포지션 추천 시 최소한 아래 세 축을 함께 본다.

1. Candidate fit: 후보자 경험과 JD가 맞는가?
2. Company upside: NHN 대비 회사/규모/도메인/보상/브랜드 레버리지가 있는가?
3. Evidence freshness: 공고가 active이고 공식 career/Wanted/기술블로그 근거가 충분한가?
