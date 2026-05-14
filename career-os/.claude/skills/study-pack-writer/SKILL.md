---
name: study-pack-writer
description: backend 면접 준비용 study pack 마크다운을 생성하고 sources/fos-study 저장소에 자동 발행. /study-pack <topic-key-or-자연어> 슬래시 명령 또는 "<주제> study pack 만들어줘" / "<주제> 학습 정리해줘" / "<주제>에 대한 스터디팩" 같은 자연어 요청 시 무조건 사용. backend·db·infrastructure·언어·아키텍처 주제로 fos-study에 즉시 commit/push해야 하는 작업이면 이 skill을 호출.
---

# Study Pack Writer

backend 면접 준비용 학습 마크다운(study pack) 생성·검증·발행 workflow.

## When to use

- 사용자가 `/study-pack <topic>` 슬래시 호출
- 자연어 요청: "MySQL 인덱스 study pack 만들어줘", "Redis 캐시 전략 학습 자료 정리해줘"
- fos-study repo에 즉시 publish할 study pack이 필요한 모든 경우

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

1. `career-os/config/topics.json` — `study-pack` namespace에서 `<topic-key>` 검색 → `outputPath` / `domain` / `title` / `promptAppend`
2. `career-os/config/candidate-profile.md` — 11섹션 prose, 후보자 이력
3. `career-os/config/mvp-target.json` — `primary.company`, `primary.role` (현재 면접 타깃)
4. `references/study-pack-prompt.md` — prompt 구조 가이드
5. `references/study-pack-writing-rules.md` — 작성 규칙 상세
6. (선택) `sources/fos-study/<유사 outputPath>.md` — overlap 회피

## Workflow

### 1. Topic 해석

인자가 topic-key (kebab-case)면 `topics.json["study-pack"]` 매칭. 자연어면 description/domain으로 유사 매칭. 매칭 실패 시 **freeform 모드**: domain·outputPath 본인이 결정. stderr에 결정 근거 1줄 로그.

### 2. Context 로드 (4 Read)

위 Inputs 1~5 모두 Read.

### 3. Overlap 점검 (선택)

`sources/fos-study/<outputPath 디렉터리>`에 유사 파일 있으면 update 의도 확인. update면 기존 본문 Read해서 통합 작성.

### 4. 마크다운 작성 (Write)

생성 구조:
- 첫 줄: `# <topic-title>` (단일 `#`, `## ` 시작 금지, `# 초안:` / `# Draft:` 금지)
- ≥80줄
- 모든 ` ``` ` 코드 펜스에 언어 명시 (`bash`, `ts`, `sql`, `java` 등)
- 백엔드 면접 관점: 개념 → 작동 원리 → 흔한 오해 → 면접 질문 시뮬레이션
- `references/study-pack-writing-rules.md` 모든 규칙 준수

`Write` 도구로 `career-os/sources/fos-study/<outputPath>.md`에 직접 저장.

### 5. Self-check (재작성 ≤3회)

작성 후 자기 출력 점검 5항목:

1. 첫 줄 `# ` 시작 (`## ` 아닌)
2. 총 줄 수 ≥80
3. 모든 펜스 언어 지정
4. 금지 prefix 부재
5. `references/study-pack-writing-rules.md` 명시 규칙 준수

실패 항목이 있으면 그 항목 수정 후 재작성·재검증. **최대 3회 시도**. 4회째도 실패 시 stderr에 `study-pack 검증 실패: <실패 항목>` + 종료 (exit 1).

검증 명세를 본 skill 안에 박는 이유: 객관적(첫 줄·줄 수·펜스 언어) 기준은 self-check가 신뢰 가능. 3회 cap은 무한 루프 차단.

### 6. Publish (Bash)

```bash
cd career-os/sources/fos-study
git pull --rebase --autostash
git add <outputPath>
git commit -m "docs(<domain>): add|update <topic-key>"
git push origin main
```

`<domain>`은 topic에서 추출(database/redis/kafka/java/infra/architecture). add vs update는 `git status --porcelain`으로 자동 판단. push 실패 시 stderr + exit 1 (silent 실패 금지).

### 7. Discord 알림 (Bash)

```bash
bun --env-file=career-os/.env _shared/lib/notify_discord.ts \
  "[완료] study-pack <topic-key>: sources/fos-study/<outputPath>.md"
```

알림 실패는 비치명적 — stderr warn만, skill 자체는 success 종료.

## Error handling

| 상황 | 처리 |
|---|---|
| topic-key 매칭 실패 + 자연어 해석 불가 | stderr + exit 1, 사용자에게 명시적 topic 요청 |
| sources/fos-study 없음 or git pull 실패 | stderr + exit 1, 환경 설정 안내 |
| self-check 3회 실패 | stderr + exit 1, 실패 항목 명시 |
| git push 실패 (권한/충돌) | stderr + exit 1, git stderr 그대로 |
| Discord notify 실패 | stderr warn, skill은 success |

## Why this design

- **Self-check 본 skill 안에 박는 이유**: 옛 외부 validator를 Claude 자체 검증으로. SKILL.md 단일 진실 출처.
- **재작성 ≤3회**: 무한 루프 차단. 3회로도 통과 못 하면 본질 문제 (topic 모호, 입력 부족) — 사용자 개입 필요.
- **Publish + notify 통합**: 옛 외부 publish/notify shell을 Bash 도구로 직접. 의존 줄임.

## References

- `references/study-pack-prompt.md` — 옛 prompt 구조 (Claude가 참고)
- `references/study-pack-writing-rules.md` — 작성 규칙 상세
