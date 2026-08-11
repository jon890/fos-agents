# health-care

개인 건강 기록, 재활 경과, 진료 준비를 관리하는 워크스페이스다.
의료진 판단을 대체하지 않고, 기록 정리와 안전한 체크인 생성을 돕는다.

## 범위

- 증상, 진료, 검사, 운동 반응 기록
- 무릎 재활 경과 추적
- 건강검진 기반 생활 관리 메모
- 병원 방문 전 요약과 질문 리스트 생성
- 공개 가능한 일반 재활 기준 관리

하지 않는 일:

- 진단
- 처방
- 약물 변경 지시
- 응급 상황 판단 대체
- 민감 의료 정보 공개

## 구조

| 경로 | 용도 |
|---|---|
| `config/` | 공개 가능한 정책과 일반 플랜 |
| `private/conditions/` | 민감한 개인 건강 기록 |
| `private/reports/` | 진료 준비, 병원 후보 조사, 개인 리포트 |
| `.claude/skills/` | health-care skill 정본 |
| `.codex/skills/` | Codex 노출용 skill 링크 |
| `docs/` | 구조, 흐름, 스키마, 결정 이력 |

`private/`는 git에 커밋하지 않는다.

## 설정

```bash
cp health-care/.env.example health-care/.env
```

현재 공개 문서만으로도 구조 확인은 가능하다.
개인 리포트를 만들 때는 필요한 private context가 있는지 먼저 확인한다.

## 실행

agent skill 이름:

- `/daily-health-coaching`
- `/knee-progress-intake`
- `/weekly-knee-clinic-summary`
- `/personalized-healthy-meal-research`

각 skill은 private context와 공개 config를 읽고 결과를 생성한다.
외부 전달이나 공개 게시가 필요하면 별도 사용자 승인을 받는다.

## 검증

```bash
# 문서 변경 기본 검사
git diff --check -- health-care

# private 파일이 실수로 staged 됐는지 확인
git status --short -- health-care/private health-care/config health-care/docs
```

진료 제출용 문서는 최신 `current-context.md`와 `progress-log.jsonl`을 확인한 뒤 만든다.
