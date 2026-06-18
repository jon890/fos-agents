#!/usr/bin/env bash
# build-with-teams 정식 팀원 스폰 검증 게이트
#
# 목적: critic/executor/code-reviewer/docs-verifier 를 TeamCreate 정식 멤버로
#       스폰했는지 config.json 으로 정적 확인한다. Agent 단발 호출(team_name 없이)로
#       우회하면 이 게이트가 잡아낸다 — 정식 멤버가 아니면 config 에 등록되지 않는다.
#
# 사용:
#   scripts/verify_team_members.sh <team_name> <기대멤버1> [기대멤버2 ...]
#   예) scripts/verify_team_members.sh plan047 critic executor
#
# 동작:
#   - ~/.claude/teams/<team_name>/config.json 의 members[].name 을 읽는다.
#   - 기대 멤버가 전원 등록돼 있으면 exit 0, 하나라도 없으면 exit 1 (PHASE_BLOCKED).
#
# team-lead 는 각 팀원 스폰 직후 이 게이트를 통과해야 다음 단계로 진입한다.
set -euo pipefail

TEAM="${1:?team_name 필요 — 사용: verify_team_members.sh <team_name> <기대멤버...>}"
shift
EXPECTED=("$@")
[ ${#EXPECTED[@]} -gt 0 ] || { echo "기대 멤버를 1개 이상 지정하라"; exit 2; }

CONFIG="$HOME/.claude/teams/$TEAM/config.json"
if [ ! -f "$CONFIG" ]; then
  echo "TEAM_CONFIG_MISSING: $CONFIG"
  echo "  → TeamCreate 가 실행되지 않았다 (Agent 단발 호출로 우회됐을 가능성). 정식 팀을 먼저 생성하라."
  exit 1
fi

ACTUAL=$(python3 -c '
import json, sys
try:
    members = json.load(open(sys.argv[1]))["members"]
except Exception as e:
    print(f"CONFIG_PARSE_ERROR: {e}", file=sys.stderr)
    sys.exit(3)
print("\n".join(m["name"] for m in members))
' "$CONFIG") || {
  echo "CONFIG_PARSE_ERROR: $CONFIG 파싱 실패 (JSON 깨짐 또는 members 키 부재)"
  exit 1
}
echo "등록된 멤버 (team=$TEAM):"
echo "$ACTUAL" | sed 's/^/  - /'

MISSING=()
for e in "${EXPECTED[@]}"; do
  echo "$ACTUAL" | grep -Fqx "$e" || MISSING+=("$e")
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "MEMBER_MISSING: ${MISSING[*]}"
  echo "  → 정식 멤버로 스폰되지 않았다. 직전 Agent 호출에서 name/team_name 누락 가능. name 파라미터를 넣어 재스폰하라."
  exit 1
fi

echo "OK: 기대 멤버 전원 정식 등록 확인 (${EXPECTED[*]})"
