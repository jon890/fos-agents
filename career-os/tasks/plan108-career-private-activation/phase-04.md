# Phase 04 다중 환경 end-to-end 검증

**Execution profile**: deep

---

## 목표

Codex CLI, Claude Code와 Hermes에 대응하는 독립 환경이 같은 current release를 사용하고 충돌 시 결과를 잃지 않는지 검증한다.

**범위 외**: 실제 지원서 제출, 공개 리포트 게시, 원본 backup 삭제와 자동 release 정리는 수행하지 않는다.

---

## 작업 항목 (5)

### 1. 외부 client 두 개 재현

서로 다른 임시 root에서 SSH transport로 같은 current release를 prepare한다.
revision, manifest, 전체 파일 hash와 현재 TossPlace 지원 패키지의 읽기 가능 상태가 일치해야 한다.

### 2. Hermes local transport 재현

Hermes와 같은 mount·환경 설정을 가진 검증 container에서 local transport `check`와 `prepare`를 실행한다.
호스트 SSH 설정 없이 같은 revision을 읽고 관리 root 밖 파일을 열지 않는지 확인한다.

### 3. 동시 발행과 장애 주입

한 client가 publish한 뒤 오래된 parent revision을 가진 다른 client의 publish가 거절되는지 검사한다.
전송 중단과 서버 오류에서도 remote current, 직전 release와 양쪽 로컬 결과가 그대로 남아야 한다.

### 4. 실제 skill smoke 검증

세 환경에서 지원 패키지 읽기와 면접 상태 갱신의 prepare·publish 경로를 실행한다.
resume 환경은 Chrome과 `pdftoppm`이 있는 client에서만 HTML·PDF 렌더링을 검사하고, 없는 환경은 capability 판정으로 안전하게 중단해야 한다.

### 5. 완료 상태와 운영 기록

모든 검증이 통과하면 `career-os/tasks/plan108-career-private-activation/index.json`의 `status`를 `completed`, `current_phases`를 `4`로 갱신한다.
검증한 revision, 환경별 transport, 충돌 판정과 파일 hash 비교 결과를 비밀값 없이 실행 기록에 남긴다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/scripts/career-workspace/*.test.ts` | 외부 client·Hermes·충돌 검증 |
| `career-os/tasks/plan108-career-private-activation/index.json` | 완료 상태 갱신 |
| `career-os/docs/retrospectives/RUNS.md` | 다중 환경 검증 근거 |

## 검증

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/career-workspace
bunx tsc --noEmit --pretty false
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/application-package-writer
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/resume-preparer
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/interview-practice
git diff --check
```

## Blocked 조건

- 세 환경 중 하나라도 다른 revision이나 file hash를 읽으면 완료 처리하지 않는다.
- 충돌 또는 전송 실패에서 remote current와 로컬 결과 보존을 증명하지 못하면 `PHASE_BLOCKED: 다중 환경 원본 보존 미검증`으로 끝낸다.
