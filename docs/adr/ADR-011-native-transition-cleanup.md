## ADR-011 — track_task·extract_claude_result·update_artifacts 폐기 (native 전환 완료)

- Status: Accepted
- Date: 2026-05-29

### 맥락

ai-nodes 워크스페이스가 외부 subprocess 패턴에서 Claude native skill 직접 호출로 순차 전환됐다.

- career-os — plan023(ADR-031)에서 dispatcher + 통합 헬퍼 폐기.
- apartment — plan010(ADR-010)에서 daily-report native 전환.
- stock-investment — plan006(ADR-003)에서 3 skill native 전환.

이 전환들로 세 공용 자산의 호출처가 0이 됐다.

- `_shared/bin/track_task.sh` — runner self-wrap 트래커. 모든 러너가 native wrapper로 바뀌어 호출 0.
- `_shared/lib/extract_claude_result.ts` — `claude --output-format json` envelope 파서. native skill이 report.md를 직접 Write하면서 호출 0.
- `_shared/bin/update_artifacts.py` — track_task 보조 스냅샷. 이미 호출 0(orphan).

track_task가 남기던 `logs/task-runs.jsonl` / `token-usage.jsonl`은 읽는 소비자가 없는 write-only 계측이었다.

### 결정

세 공용 자산을 git rm으로 폐기한다.

- `_shared/bin/track_task.sh`, `_shared/bin/update_artifacts.py`, `_shared/lib/extract_claude_result.ts` 삭제.
- `_shared/types/index.ts`의 `ClaudeUsage` interface 제거(extract 전용 orphan). `TopicEntry`는 career-os가 사용하므로 유지.
- 모노레포 AGENTS.md 2번(실행 모델)·4번(CLI 패턴)·11번(외부 의존성)을 native 단일 모델로 갱신.

폐기 전 전수 확인으로 5 워크스페이스 + `skills/` + `_shared/` 코드 호출처 0을 검증했다(주석 참조만 잔존).

거절한 대안:

- 자산 보존(미사용 유지) — 죽은 공용 헬퍼가 매 audit·세션 컨텍스트 노이즈. load-bearing 오인 지속.
- 계측만 비활성화하고 파일 보존 — 호출처 0인 스크립트를 남길 이유 없음. git history로 복원 가능.

### 결과

- `_shared/bin/`이 빈 디렉터리가 되고, `_shared/lib/`은 `notify_discord.ts`만 남는다.
- 모노레포 실행 모델이 native 직접 호출 단일 패턴으로 명문화 — 신규 워크스페이스도 이 패턴만 따른다.
- 운영 계측(토큰·실행 로그)은 일시 손실 — 필요 시 별도 plan으로 재설계(ADR-002 career-os 선례와 동일 판단).
- 외부 brain의 `task-run-tracking` 페이지도 본 폐기에 맞춰 삭제(brain repo 작업).

**적용**: `ai-nodes/tasks/plan004-shared-helper-retirement` phase 참조. brain 페이지 삭제는 `~/personal/fos-brain` 별도 repo 커밋.

---
