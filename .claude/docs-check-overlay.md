# docs-check 오버레이

공용 `docs-check`에 fos-agents의 문서 경계와 실측 검사를 추가한다.

## 범위

- scope가 워크스페이스 이름이면 해당 디렉터리의 `AGENTS.md`, `README.md`, `docs/`와 변경된 스킬 문서를 검사한다.
- `fos-agents` 또는 `root`는 루트 문서와 공용 하네스를 검사한다.
- `all`은 모든 워크스페이스를 검사한다.
- scope가 없으면 현재 작업 경로와 변경 파일에서 가장 좁은 범위를 추론한다. 여러 범위가 섞였을 때만 `all`을 사용한다.

`career-os`는 `.claude/agents/career-os-docs-verifier.md`의 경계를 적용한다. 별도 검토 역할을 사용할 때는 읽기 전용 컨텍스트로 격리하고 수정, commit, push 권한을 주지 않는다.

## 구조 검사

ADR 파일과 INDEX는 제목의 Markdown 단계와 관계없이 식별자가 같아야 한다.

```bash
scope=career-os
files=$(find "$scope/docs/adr" -maxdepth 1 -type f -name 'ADR-[0-9]*.md' -exec basename {} \; | grep -oE '^ADR-[0-9]+' | sort -u)
index=$(grep -oE 'ADR-[0-9]+' "$scope/docs/adr/INDEX.md" | sort -u)
diff <(printf '%s\n' "$files") <(printf '%s\n' "$index")
```

문서에 적힌 설정과 스킬은 확장자나 개수를 가정하지 않고 실제 경로와 소비 코드를 함께 확인한다.

```bash
rg -n 'config/[^ )`]+' <scope>/README.md <scope>/AGENTS.md <scope>/docs
rg -n '<skill-name>|<config-name>' <scope>/scripts <scope>/.claude/skills <scope>/docs
```

경로 문자열의 존재만으로 사용 중이라고 판정하지 않는다. 실행 진입점에서 읽는지, 문서 전용 참조인지, 생성 산출물인지 구분한다.

## 저장소 고유 실패 조건

- 다른 워크스페이스 자산을 실행 의존성으로 사용한다.
- 공개 문서에 환경 종속 절대 경로, 내부 호스트, 계정이나 비공개 식별자가 남는다.
- 제거된 스킬, 런타임, 전달 매체 또는 실행 명령을 현재 경로처럼 안내한다.
- 코드에서 자명한 목록과 범용 작업 요령을 장문으로 반복해 에이전트 판단을 제한한다.

고정 개수와 순서는 제품 계약, 안전 경계 또는 실측 회귀 조건일 때만 유지한다.
