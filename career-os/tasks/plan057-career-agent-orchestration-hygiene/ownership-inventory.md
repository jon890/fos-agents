# Phase 01 Ownership Inventory

## 요약

career workspace는 OpenClaw에서 career-os를 호출하기 위한 얇은 orchestration 계층이다.
career-os는 durable prompt, workflow, script, output contract의 단일 출처다.

따라서 career-specific wrapper skill은 OpenClaw career workspace에 두고,
실제 workflow 본체는 `career-os/.claude/skills/`와 `career-os/scripts/`가 소유한다.
main workspace에는 career-specific wrapper skill을 두지 않는 것이 기본 원칙이다.

## 확인한 경계

- `career-os/.claude/skills/`
  - Claude native skill 본체.
  - career-os config, data, scripts, docs, fos-study source tree를 직접 다룬다.
- career OpenClaw workspace `skills/`
  - Discord/OpenClaw 요청을 career-os로 보내는 wrapper skill 계층.
  - durable business logic을 새로 만들지 않는다.
- main workspace `skills/`
  - cross-domain 또는 다른 workspace wrapper만 둔다.
  - career-specific 요청 라우팅은 career workspace로 넘긴다.

## career workspace가 소유해야 하는 wrapper skill

아래 항목은 career-specific wrapper skill로 보고 career OpenClaw workspace가 소유한다.
단, workflow 본체는 career-os에 남긴다.

- `study-pack-writer`
  - career-os `/study-pack-writer` 또는 알림 래퍼로 라우팅한다.
  - fos-study 공개 문서 생성과 중복 검사는 career-os native skill이 소유한다.
- `study-topic-recommender`
  - career-os `/study-topic-recommender`로 라우팅한다.
  - 추천 후보, 중복 판단, runtime 산출물은 career-os가 소유한다.
- `interview-asset-writer`
  - 후보자 경험 기반 면접 자산 생성을 career-os `/interview-asset-writer`로 라우팅한다.
  - 공개 가능 산출물 경계와 후보자 근거 사용은 career-os native skill이 소유한다.
- `position-recommender`
  - career-os `/position-recommender`와 관련 daily runner로 라우팅한다.
  - active/open 공고 판단, private recommendation report는 career-os가 소유한다.
- `docs-audit`
  - fos-study 콘텐츠 감사 wrapper다.
  - agent-facing docs/ADR health를 보는 main/root `docs-check`와 구분한다.
- `interview-prep-analyzer`
  - 현재 career OpenClaw workspace에서는 얇은 Claude wrapper가 아니라 OpenClaw/Codex native workflow로 기록되어 있다.
  - 이 항목은 즉시 삭제 후보가 아니라 migration decision이 필요한 예외다.

## main workspace 잔여 후보

확인 시점에 main workspace에는 career-specific wrapper skill이 직접 남아 있지 않았다.
main workspace의 skill은 apartment, stock, brain, cooking, planning 계열로 확인했다.

따라서 이번 phase에서 main workspace 잔여물을 삭제하거나 이동할 항목은 없다.
다만 이후 main workspace에 아래 이름이 생기면 혼선을 만드는 후보로 분류한다.

- `study-pack-writer`
- `study-topic-recommender`
- `interview-asset-writer`
- `interview-prep-analyzer`
- `position-recommender`
- `candidate-baseline-suggester`
- `application-package-writer`
- `application-reviewer`
- `daily-application-digest`
- `docs-audit`
- `interview-coffeechat-prep`

## archive 또는 migration decision 필요 항목

즉시 삭제가 아니라 archive 또는 migration 결정을 별도로 잡아야 하는 항목이다.

- `interview-prep-analyzer`
  - career-os에는 Claude native skill 본체가 있다.
  - career OpenClaw workspace에는 `claude -p`를 호출하지 않는 OpenClaw/Codex native workflow가 있다.
  - 두 구현의 책임이 다르므로, 어떤 쪽을 canonical execution으로 유지할지 별도 migration 결정이 필요하다.
- `interview-coffeechat-prep`
  - career-os native skill은 ADR-048 기준 deprecated tombstone이다.
  - career OpenClaw workspace에는 같은 이름의 wrapper가 없다.
  - 삭제보다 archive/tombstone 유지 여부를 phase 후속 결정으로 다룬다.
- `docs-audit`
  - career-os 쪽은 fos-study 내부 skill symlink를 통해 동작한다.
  - symlink target 존재와 공개 콘텐츠 감사 범위는 별도 검증이나 migration decision에서 확인할 수 있다.
- `candidate-baseline-suggester`, `application-package-writer`, `application-reviewer`, `daily-application-digest`
  - career-os에는 native skill 본체가 있다.
  - career OpenClaw workspace wrapper는 아직 없다.
  - OpenClaw에서 자연어 라우팅이 필요하면 wrapper 추가를 migration 후보로 잡되, 본체 소유권은 career-os에 둔다.

## 후속 작업

1. career OpenClaw workspace wrapper 목록을 career-os native skill 목록과 맞춘다.
2. `interview-prep-analyzer`의 OpenClaw native workflow와 career-os Claude native skill 중 canonical execution을 결정한다.
3. deprecated `interview-coffeechat-prep`는 삭제가 아니라 tombstone archive 정책으로 다룬다.
4. main workspace에 career-specific wrapper skill이 추가되지 않도록 운영 문서에 경계를 반영한다.

## 범위 메모

- 이 inventory는 삭제, 이동, OpenClaw config 변경을 수행하지 않았다.
- session log, cache, token, secret 파일은 열지 않았다.
- private path 세부 정보는 workspace 이름과 repo-relative path 수준으로만 기록했다.
