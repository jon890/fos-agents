# Code Architecture — health-care

이 문서는 현재 구조와 skill 경계를 설명한다.
민감 데이터는 `private/` 아래에만 둔다.

## 디렉터리

```text
health-care/
├── AGENTS.md
├── README.md
├── TOOLS.md
├── .env.example
├── config/
├── private/
│   ├── conditions/
│   └── reports/
├── docs/
├── .claude/skills/
└── .codex/skills/
```

| 경로 | 책임 |
|---|---|
| `config/` | 공개 가능한 정책과 일반 재활·생활 관리 기준 |
| `private/conditions/` | 질환·증상별 개인 문맥과 경과 |
| `private/reports/` | 병원 제출, 진료 준비, 개인 리포트 |
| `.claude/skills/` | skill 정본 |
| `.codex/skills/` | Codex용 skill 링크 |
| `docs/` | 현재 구조, 흐름, 스키마, 결정 |

## Skill 경계

| skill | 입력 | 출력 |
|---|---|---|
| `daily-health-coaching` | private 건강 문맥, 공개 재활 config | 하루 체크인과 보수적 행동 안내 |
| `knee-progress-intake` | 사용자의 증상·운동 보고 | `progress-log.jsonl` append와 최신 요약 갱신 제안 |
| `weekly-knee-clinic-summary` | 최신 context와 경과 로그 | 병원 제출용 요약과 질문 리스트 |
| `personalized-healthy-meal-research` | 건강 목표, 조리 환경, 공개·공신력 자료 | 메뉴 후보, 대체 규칙, 장보기 목록, 선택적 비식별 리포트 |

## 외부 의존

- agent runtime은 `.claude/skills` 또는 `.codex/skills`를 실행한다.
- 웹 검색은 최신 의료기관·공공기관 자료가 필요할 때만 사용한다.
- 외부 전송과 공개 게시 기본값은 금지다.

## 변경 기준

- 개인 상태 변화는 `private/conditions/<track>/`에 남긴다.
- 일반화 가능한 기준만 `config/`로 승격한다.
- 새 skill은 `.claude/skills/<name>/`과 `.codex/skills/<name>/` 관계를 맞춘다.
- 구조가 바뀌면 이 문서와 `docs/data-schema.md`, `docs/flow.md`를 함께 확인한다.
