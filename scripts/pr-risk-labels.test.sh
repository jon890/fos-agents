#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
labeler="$script_dir/pr-risk-labels.sh"

assert_labels() {
  local expected=$1
  local paths=$2
  local actual
  actual=$(printf '%s' "$paths" | bash "$labeler")
  if [[ "$actual" != "$expected" ]]; then
    printf '예상 라벨: %q\n실제 라벨: %q\n' "$expected" "$actual" >&2
    exit 1
  fi
}

assert_labels $'위험:마이그레이션\n위험:보안\n위험:배포설정\n위험:스킬' $'career-os/services/career-backend/prisma/migrations/001/init.sql\ncareer-os/services/career-backend/.env.example\n.github/workflows/review.yml\ncareer-os/.claude/skills/example/SKILL.md\n'
assert_labels '위험:보안' $'career-os/services/career-backend/src/common/auth/guard.ts\ncareer-os/secrets/token.txt\ncareer-os/.claude/settings.local.json\n'
assert_labels '위험:배포설정' $'career-os/services/career-backend/Dockerfile\ncareer-os/compose.dev.yaml\n'
assert_labels '' $'career-os/docs/README.md\ncareer-os/services/career-backend/package.json\n'
assert_labels '' ''

printf '위험 라벨 경로 규칙 통과\n'
