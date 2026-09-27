#!/usr/bin/env bash
# 바뀐 파일 경로를 표준 입력으로 받아 경로 규칙에 맞는 위험 라벨을 출력한다.

set -euo pipefail

migration=0
security=0
deploy=0
skill=0

while IFS= read -r path; do
  [ -z "$path" ] && continue
  case "$path" in
    */prisma/migrations/*)
      migration=1 ;;
  esac
  case "$path" in
    *.env* | */src/common/auth* | */secrets/* | */.claude/settings*.json)
      security=1 ;;
  esac
  case "$path" in
    .github/workflows/* | */Dockerfile | */compose*.yaml)
      deploy=1 ;;
  esac
  case "$path" in
    */.claude/skills/*/SKILL.md)
      skill=1 ;;
  esac
done

[ "$migration" = 1 ] && echo "위험:마이그레이션"
[ "$security" = 1 ] && echo "위험:보안"
[ "$deploy" = 1 ] && echo "위험:배포설정"
[ "$skill" = 1 ] && echo "위험:스킬"
exit 0
