# Learn Index

career-os 운영·실험·실패에서 얻은 짧은 회고를 누적하는 디렉터리. 결정이 굳어지면 docs/adr.md 로 흡수되고 learn 파일은 삭제된다.

## 언제 learn 에 적는가

learn 노트는 다음 성격일 때 적당하다.

- 운영 중 발견한 사소하지만 재현 가능한 함정
- 시도해 봤지만 채택하지 않은 대안 (가벼운 회고)
- 결정 직전 단계의 사고 흐름 (아직 ADR 로 굳지 않은)
- 외부 의존성·도구 사용 시 알아둘 점

다음은 learn 이 아닌 다른 곳에 적는다.

- 채택된 결정 → `docs/adr.md` 맨 아래에 ADR 형식으로
- 새 워크플로 / 명세 / 스키마 → 5문서 중 해당 문서
- 외부 위임·인수인계 → `docs/hand-off/`
- 회사·이벤트별 일회성 준비 → `docs/prep/`

## 파일명 규칙

`NNN-topic-name.md` (3자리 번호 + kebab-case). 다음 가용 번호:

```bash
ls career-os/docs/learn/ | grep -oE '^[0-9]+' | sort -n | tail -1
```

## 문서 구조

각 learn 파일은 다음 셋을 짧게 적는다.

1. 문제 상황 또는 시도
2. 결론
3. 언제 이 문서를 다시 읽어야 하는지

길이는 1 페이지 이하 목표. 더 길어지면 ADR 로 흡수할 시점.

## 흡수 + 삭제 흐름

learn 노트가 ADR 로 흡수될 때:

1. adr.md 에 새 ADR 추가 — learn 노트의 결정 부분이 흡수됨.
2. learn 파일 삭제 — git rm. history 는 git log 로 추적 가능.
3. 다른 곳(AGENTS.md / hand-off / 다른 learn) 에서 그 learn 파일을 참조하면 ADR 번호 링크로 교체.

이 흐름은 ADR-018 에 명문화. 어기면 docs drift.

## 현행 learn 노트

- `008-docs-audit-quality-loop.md` — docs-audit 스킬 운영 회고. 향후 fos-study 측 docs-audit SKILL.md 로 흡수 예정 (별도 plan).

(plan003 phase-02 시점에 001-007 은 모두 5문서·스킬 본체로 흡수 후 삭제됨.)
