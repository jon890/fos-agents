# Phase 01 — fos-career pnpm 전환과 lockfile 정리

**Model**: sonnet
**Status**: completed

완료 기록:

- fos-career commit: `9817856 build(fos-career): pnpm lockfile로 전환`
- 검증: `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`, `pnpm build`
- 결과: `packageManager`를 `pnpm@10.24.0`으로 고정하고 `pnpm-lock.yaml`을 생성했다.
- `package-lock.json`은 제거했다.

---

## 목표

fos-career를 npm lockfile 기반에서 pnpm 기반으로 전환하고, 이후 phase의 검증 명령을 pnpm 중심으로 고정한다.

**범위 외**: DB schema 변경, dashboard route 변경, career-os docs/ADR 수정, 기능 구현.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 path와 fos-career 절대 경로를 함께 사용하므로 첫 bash에서 cwd=ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/AGENTS.md`의 Docs-first and Task Files, Validation and Git
- `/home/bifos/services/fos-career/AGENTS.md`
- `/home/bifos/services/fos-career/package.json`
- `career-os/docs/adr.md`의 ADR-081
- `career-os/tasks/plan073-dashboard-application-candidate-state/index.json`

---

## 작업 항목

### 1. 현재 패키지 관리자 상태 확인

`/home/bifos/services/fos-career`에서 `package.json`, `package-lock.json`, 기존 lockfile 존재 여부, 현재 git 상태를 확인한다.
unrelated dirty 변경이 있으면 건드리지 않고 phase 보고에 분리한다.

### 2. pnpm lockfile 생성

fos-career에서 pnpm을 사용해 dependency lockfile을 생성한다.
`package-lock.json`은 pnpm 전환 범위에서 제거 대상이지만, 삭제 전에 `pnpm install --lockfile-only` 또는 동등한 lockfile 생성이 성공해야 한다.

### 3. package script 검증 명령 정리

`package.json`에 이미 있는 `build`, `dev`, processor script를 보존한다.
필요하면 `lint`, `typecheck`, `db:generate`, `db:migrate` 같은 검증용 script를 기존 Next/Drizzle 패턴에 맞춰 추가한다.
새 script가 docs 결정을 요구하면 코드 수정 없이 `PHASE_BLOCKED`로 종료한다.

### 4. lockfile 전환 검증

pnpm 기반 설치와 정적 검증을 실행한다.
Next 16 관련 판단이 필요하면 `/home/bifos/services/fos-career/node_modules/next/dist/docs/`의 해당 문서를 먼저 확인한다.

### 5. phase commit

의도한 fos-career 패키지 관리자 변경만 stage하고 commit한다.
career-os task 파일이나 docs는 이 phase commit 범위에 포함하지 않는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `/home/bifos/services/fos-career/package.json` | pnpm 기반 검증 script가 필요하면 최소 변경 |
| `/home/bifos/services/fos-career/pnpm-lock.yaml` | 신규 |
| `/home/bifos/services/fos-career/package-lock.json` | pnpm 전환 후 삭제 |

읽기 전용 확인 파일:

- `/home/bifos/services/fos-career/AGENTS.md`
- `career-os/docs/adr.md`
- `career-os/tasks/plan073-dashboard-application-candidate-state/index.json`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd /home/bifos/services/fos-career

test -f pnpm-lock.yaml
test ! -f package-lock.json
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build

git status --short
```

---

## 성공 기준

- `/home/bifos/services/fos-career/pnpm-lock.yaml`이 생성된다.
- `/home/bifos/services/fos-career/package-lock.json`은 제거된다.
- `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`, `pnpm build`가 통과한다.
- 기능 코드, DB schema, dashboard route, career-os docs/ADR은 변경하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- pnpm 전환 방식이 배포 환경 또는 Docker 계약 변경 결정을 요구한다.
- Next 16 문서 확인 없이는 build script 또는 app convention 변경을 판단할 수 없다.
- fos-career에 unrelated dirty 변경이 있어 lockfile 전환을 안전하게 분리할 수 없다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- `pnpm-lock.yaml` 없이 성공 보고하려는 경우.
- npm lockfile과 pnpm lockfile을 동시에 남기는 경우.
- 검증 명령을 실행하지 못한 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.

---

## common-pitfalls self-check

- [ ] 성공 기준은 `test`, `pnpm`, `git status` exit code로 판정 가능하다.
- [ ] phase 단독 실행에 필요한 경로와 docs를 모두 적었다.
- [ ] career-os docs/ADR 수정은 범위 밖이다.
- [ ] unrelated dirty 변경을 stage하지 않는다.
- [ ] 첫 bash 블록에서 ai-nodes 루트로 이동한다.
