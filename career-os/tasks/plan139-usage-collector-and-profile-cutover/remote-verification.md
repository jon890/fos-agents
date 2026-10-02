# 원격 검증

실제 Backend, 실제 세션 기록, 실제 `launchd` 가 있어야 끝나는 검증이다. 위에서 아래 순서로 한다.
명령은 모두 저장소 루트에서 실행한다. `<profiles>` 는 비공개 작업본의 `library/profiles` 경로다.

| 선행 조건 | 실행 위치 | 명령 | 기대값 |
|---|---|---|---|
| 프로필 저장 모듈이 배포되고 이 PR 을 머지한 뒤 | 세션 기록이 있는 노트북 | `bun --env-file=career-os/.env career-os/scripts/profile/manage_profile.ts usage list` | 종료 코드 0. 기록이 아직 없다 |
| 위와 같다. **지난달의 세션 기록이 기기에 남아 있을 때만** 이전보다 먼저 한다 | 세션 기록이 있는 노트북 | `bun --env-file=career-os/.env career-os/scripts/agent-usage/collect_usage.ts` | `<지난달> CREATED` 한 줄, 종료 코드 0. 지난달이 환산 비용과 세션 수를 가진 `MEASURED` 로 남는다 |
| 위 측정을 했거나 건너뛴 뒤 | 세션 기록이 있는 노트북 | `bun career-os/scripts/profile/migrate_library_profiles.ts --profiles-dir <profiles> --dry-run` | 원고 셋과 표의 달이 모두 `WOULD_CREATE` 다. `MISSING_FILE` 이 없다 |
| dry-run 을 확인한 뒤 | 세션 기록이 있는 노트북 | `bun --env-file=career-os/.env career-os/scripts/profile/migrate_library_profiles.ts --profiles-dir <profiles>` 에, 수집기로 측정하지 못했고 표의 값이 한 달 전체를 측정한 달이면 `--measured <그 달>` 을 더한다 | 원고 셋이 `CREATED`. 수집기가 이미 올린 달은 `EXISTS`, 나머지 달은 `CREATED BACKFILLED`. 종료 코드 0 |
| 이전을 실행한 뒤 | 세션 기록이 있는 노트북 | `bun --env-file=career-os/.env career-os/scripts/profile/manage_profile.ts usage list` | 표의 달이 오름차순으로 모두 있다. `BACKFILLED` 인 달은 환산 비용과 세션 수가 비어 있다 |
| 이전을 실행한 뒤 | 세션 기록이 있는 노트북 | `manage_profile.ts documents get --key github --out "${TMPDIR:-/tmp}/github-profile.md"` 뒤에 `diff "${TMPDIR:-/tmp}/github-profile.md" <profiles>/github-profile.md`. `wanted`, `linkedin` 도 같다 | 세 원고 모두 차이가 없다 |
| 이전을 실행한 뒤 | 세션 기록이 있는 노트북 | 이전 명령과 수집기를 한 번씩 다시 실행하고 `usage list` 를 다시 읽는다 | 이전 명령은 모두 `EXISTS`, 수집기는 `- UP_TO_DATE`. `usage list` 의 값이 앞의 결과와 같다. 이미 기록된 달이 바뀌지 않는다 |
| 이전을 확인한 뒤 | 세션 기록이 있는 노트북 | `bun career-os/scripts/agent-usage/manage_launchd.ts install` 뒤에 `bun career-os/scripts/agent-usage/manage_launchd.ts status` | `LOADED` 와 `PLIST_PRESENT`. `grep -c "CAREER_BACKEND\|TOKEN" ~/Library/LaunchAgents/com.fos-agents.career-os.agent-usage.plist` 가 0 |
| `launchd` 에 등록한 뒤 | 세션 기록이 있는 노트북 | `launchctl kickstart gui/$(id -u)/com.fos-agents.career-os.agent-usage` 뒤에 `bun career-os/scripts/agent-usage/manage_launchd.ts status` | 로그의 마지막 줄이 `- UP_TO_DATE` 다. `launchd` 가 준 환경에서 `bun`, `.env`, `python3` 을 찾는다는 뜻이다 |
| 등록한 다음 달 1일 10시가 지나고 노트북이 한 번 깨어난 뒤 | 세션 기록이 있는 노트북 | `bun --env-file=career-os/.env career-os/scripts/profile/manage_profile.ts usage list` 와 `bun career-os/scripts/agent-usage/manage_launchd.ts status` | 지난달이 한 줄로 있고 토큰, 환산 비용, 세션 수, 측정한 날이 차 있으며 `source` 가 `MEASURED` 다. 로그에 `<지난달> CREATED` 가 있다 |
| 이전을 확인한 뒤 | 세션 기록이 있는 노트북 | `sync-profile` 스킬을 실행해 1단계까지 진행한다 | 홈서버 SSH 없이 원고 셋의 본문과 `version` 을 받는다. `skill begin` 을 부르지 않는다 |
| 위 확인이 모두 끝난 뒤 | 세션 기록이 있는 노트북 | 비공개 작업본의 `library/profiles/` 에서 원고 셋, `github-agent-usage-snapshots.md`, `github-agent-usage.svg` 를 지우고 작업본을 발행한다 | `library/profiles/` 에 원고와 사용량 표가 없다. 원고의 원본은 Backend 하나다(ADR-133) |
| 파일을 지운 뒤 | 저장소 | `career-os/scripts/profile/migrate_library_profiles.ts` 와 그 테스트를 지우고, 이 명령을 적은 `docs/code-architecture.md` 의 행을 지우는 PR 을 올린다 | 다시 돌 일이 없는 일회성 명령이 저장소에 남지 않는다. `git grep migrate_library_profiles` 의 결과가 없다 |

## 지난달을 수집기로 측정하지 못했을 때

세션 기록이 지워진 뒤에는 수집기가 그 달을 정확히 셀 수 없다.
그 달의 측정 출력을 따로 보관해 두었으면(`agent_usage.py --json` 의 출력 파일) 그 값을 `manage_profile.ts usage put` 으로 올린다.
보관한 값은 달 전체를 측정한 것이므로 `source` 는 `MEASURED` 이고, 측정한 날은 그 출력을 만든 날이다.
이전 명령이 표에서 옮긴 `BACKFILLED` 행이 먼저 들어가 있으면 `--replace` 와 사유를 함께 준다.

