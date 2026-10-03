---
name: sync-profile
description: 원티드, LinkedIn, GitHub 프로필을 이력서 원고 기준으로 갱신하는 career-os 스킬. "프로필 갱신", "원티드 이력서 업데이트", "링크드인 최신화", "깃허브 프로필 만들어줘", "이력서 바뀐 내용 프로필에도 반영"처럼 외부 프로필을 손봐야 할 때 사용한다. 실제 반영은 사용자 승인을 받은 뒤에만 수행한다.
---

# 프로필 갱신

**목표: 이력서 원고에서 검증된 문장만 프로필에 올리고, 서버에 실제로 저장됐는지 확인한다.**

프로필은 여러 회사가 상시로 본다. 한 회사에 내는 지원본과 노출 범위가 다르다.
같은 문장이라도 지원본에서는 맞고 프로필에서는 과할 수 있다.

판단이 갈릴 때 따르는 원칙이다.

- **무엇을 어떻게 바꿀지 보여주고 확인받은 뒤에 넣는다.** 프로필은 외부에 공개되는 것이다
- **이력서에 남아 있는 문장만 올리고 지원본과 같은 기준으로 검증한다.** 프로필이라고 검증이 느슨해질 이유가 없다
- **대상마다 형식을 다시 정한다.** 원티드는 항목이 정해진 폼이고 GitHub 은 자유 문서다. 독자도 다르다
- **이미 로그인된 브라우저 세션만 쓴다.** 로그인 화면이 나오면 멈추고 사용자에게 알린다. 자격 증명을 대신 입력하지 않는다

## 워크플로우 개요

| 단계 | 이름 | 통과 조건 | reference |
| --- | --- | --- | --- |
| 1 | 원고 받기 | `documents list` 의 응답을 받았고, 있는 원고마다 `documents get` 으로 받은 본문과 `version` 이 있다 | |
| 2 | 원본과 대상 확인 | 세 프로필의 현재 값과 원고의 차이가 표로 보고됐다 | 대상별 참조 |
| 3 | 공개 범위 결정 | 아래 표의 항목마다 사용자의 답이 있다 | |
| 4 | 근거 확인 | 새로 쓴 문장마다 확인한 근거가 있다 | `resume-preparer` 의 판정 모델 |
| 5 | 반영 | 넣은 항목마다 넣은 직후의 되읽기 결과가 있다 | 대상별 참조 |
| 6 | 저장 검증 | 대상마다 아래 표의 방법으로 다시 읽은 값이 원고와 같다 | 대상별 참조 |
| 7 | 원고 저장 | 고친 원고마다 `documents put` 의 응답에 올라간 `version` 이 있다 | |

대상별 참조는 그 대상에 진입할 때 읽는다.

- [`references/wanted.md`](references/wanted.md)
- [`references/linkedin.md`](references/linkedin.md)
- [`references/github.md`](references/github.md)

## 1. 원고 받기

원고는 커리어 Backend 가 갖는다. 저장소 루트에서 실행한다.

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun --env-file=career-os/.env career-os/scripts/profile/manage_profile.ts documents list
```

`bun` 은 `~/.bun/bin` 에 설치돼 있고 셸의 PATH 에 없을 수 있다.
`bun` 을 부르는 블록마다 첫 줄이 그것을 맡는다. Bash 호출은 앞 호출의 PATH 를 이어받지 않는다.
`documents list` 가 있는 원고와 `version` 을 낸다.

원고마다 저장소 밖 임시 경로에 받는다. 개인 내용이 저장소에 남지 않게 하려는 것이다.
받은 `version` 을 7단계의 `--expected-version` 으로 쓴다.

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun --env-file=career-os/.env career-os/scripts/profile/manage_profile.ts documents get --key <wanted|linkedin|github> --out "${TMPDIR:-/tmp}/<key>-profile.md"
```

**Backend 에 닿지 못하면 멈추고 사용자에게 알린다.** 로컬 파일로 대신하지 않는다.
파일과 Backend 에 원고가 따로 생기면 한쪽만 고쳐진다.

원고가 없는 대상이 있으면 가장 최근 지원의 `evidence/resume-draft.md` 를 출발점으로 삼는다.
**이때만** 작업본을 받는다. `applications/` 를 읽기 때문이다.

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun career-os/scripts/career-workspace/cli.ts skill begin sync-profile --json
```

**응답이 `TRANSPORT_UNAVAILABLE` 이면 홈서버에 닿지 못한 것이다.** 우회하지 않는다.
사용자에게 알리고 새 원고를 만들지 못한다고 알린다.

2026-10 실측으로 `CAREER_BACKEND_URL` 이 비어 있어 `career-status` 를 읽지 못했다.

## 2. 원본과 대상 확인

**갱신할 내용의 출처를 먼저 정한다.**

프로필은 특정 지원 건에 매이지 않으므로 대상별 원고를 쓴다. 원고는 1단계에서 받은 것이다.

원고가 없으면 1단계에서 정한 대로 가장 최근 지원의 `evidence/resume-draft.md` 를 출발점으로 삼고, 공개 범위를 조정해 새 원고를 만든다.
현재 경력과 경험 경계는 `manage_candidate_context.ts get --key career-status` 로 확인한다.

**사용자가 한 곳만 말해도 나머지를 함께 본다.**
현재 각 프로필에 무엇이 들어 있는지 읽고, 원본과 어긋나는 곳을 표로 보고한다.
낡은 곳이 어디인지 알아야 어디까지 고칠지 정할 수 있다.

**달이 바뀌었으면 두 가지가 낡아 있다.**

- 원티드의 진행 중 프로젝트 종료월. 폼이 종료월을 요구해 갱신한 달을 넣어 둔다
- GitHub 의 에이전트 사용량. 지난달 기록이 없으면 수집기를 한 번 실행한다. 방법은 [`references/github.md`](references/github.md) 의 「에이전트 사용량」 이 갖는다

## 3. 공개 범위 결정

지원본에 있던 것을 그대로 옮기기 전에 확인받는다.

| 대상 | 판단할 것 |
| --- | --- |
| 사내 운영 수치 | 여러 회사가 상시로 보는 곳에 둘지. 대상마다 따로 묻는다 |
| 사내 조직명과 도구 이름 | 조직 밖에서 뜻이 통하는지 |
| 진행 중인 프로젝트 | 폼이 종료월을 요구할 때 어떻게 표기할지 |
| 개인 프로젝트 | 무엇을 만드는지까지 적을지, 운영 여부까지 적을지, 링크만 둘지 |

**결정은 사용자만 할 수 있다.** 근거를 붙여 묻고, 정해진 것을 원고에 기록한다.

같은 수치라도 대상마다 답이 다를 수 있다.
2026-10 실측으로 원티드에 올라가 있던 주간 호출량을 LinkedIn 에서는 빼기로 정했다. LinkedIn 은 로그인 없이도 검색에 노출된다.

## 4. 근거 확인

**프로필에 새로 쓰는 문장은 근거를 확인한 뒤에 넣는다.**
이력서 원고에서 그대로 가져온 문장은 이미 검증됐다. 다른 언어로 옮긴 문장도 같은 주장이면 검증된 것으로 본다.
프로필 형식에 맞춰 새로 쓴 문장은 [`resume-preparer` 의 판정 모델](../resume-preparer/references/claim-model.md)로 다시 본다.

코드가 남아 있는 프로젝트는 실제로 확인할 수 있다.
커밋 작성자까지 보면 소유권 축이 갈린다. 코드가 있어도 본인이 쓴 것인지는 별개다.

커밋에 AI 코딩 도구의 공동 작성 표기가 있으면 「설계와 검토는 직접 맡고 구현은 에이전트가 수행」 의 범위로 서술한다.
직접 구현했다고 쓰지 않는다.

## 5. 반영

저장 방식이 서로 달라 넣는 방법도 확인하는 방법도 다르다.

| | 원티드 | LinkedIn | GitHub |
| --- | --- | --- | --- |
| 입력 | `input`, `textarea` | `contenteditable`, `input`, `textarea` 혼합 | 마크다운 파일 |
| 저장 | React `onBlur` 를 직접 호출 | 「저장」 버튼 클릭 | `git push` |
| 함정 | 화면에 보여도 저장 안 됨 | 소개의 문단 구분이 저장할 때 사라짐 | 외부 서비스가 응답하지 않음 |

대화에서 하려면 fos-assistant 의 커리어 커넥터로도 GitHub 의 README 와 차트를 올릴 수 있다.

원티드와 LinkedIn 은 브라우저를 쓴다. `~/.claude/scripts/browser-driver` 로 조작한다.
`open` 이 내는 마지막 줄이 `handle` 이고 이 스킬의 스크립트가 모두 첫 인자로 받는다.

**`open` 이 `browser permission prompt` 로 실패하면 사용자가 그 창을 처리할 때까지 기다린다.**
알림 권한 창이 뜨면 브라우저가 그 공간의 조작을 사용자에게 넘긴다. 사용자가 처리했다고 답한 뒤에 다시 연다.

스크립트는 `scripts/` 에 있다. 사용법은 각 파일의 머리 주석이 갖는다.

| 스크립트 | 하는 일 |
| --- | --- |
| `wanted_list_fields.sh` | 원티드 편집 화면의 필드 인덱스를 낸다 |
| `wanted_set_field.sh` | 원티드 필드 하나에 값을 넣고 저장한다 |
| `wanted_set_period.sh` | 원티드 프로젝트의 시작월이나 종료월을 바꾼다 |
| `linkedin_set_paragraphs.sh` | LinkedIn 소개처럼 여러 문단인 글을 문단이 남게 넣는다 |
| `linkedin_fill_project.sh` | LinkedIn 프로젝트 추가 폼을 채우고 되읽는다 |

**한 번에 하나씩 넣고 결과를 확인한다.** 여러 필드를 연달아 넣으면
어느 단계에서 실패했는지 알 수 없다. 인덱스가 밀리는 폼에서는 특히 그렇다.

## 6. 저장 검증

**화면에 값이 보이는 것은 저장의 증거가 아니다.**

| 대상 | 확인 방법 |
| --- | --- |
| 원티드 | 서버 API 로 다시 조회한다. 긴 본문은 원고와 글자 단위로 대조한다 |
| LinkedIn | 편집 화면을 다시 열어 값과 문단 수를 읽는다. 프로젝트는 목록에 한 번만 있는지 본다 |
| GitHub | 원격 파일을 조회하고 프로필 화면에서 이미지 로드 상태를 확인한다 |

**한 곳이라도 실패하면 그것을 먼저 알린다.** 나머지가 성공했다고 넘어가지 않는다.

## 7. 원고 저장

**반영한 내용을 원고에 다시 적는다.**
다음에 갱신할 때 무엇이 올라가 있는지 알 수 있어야 한다.

폼 제약 때문에 원고와 다르게 넣은 것이 있으면 그 사실과 이유를 임시 경로의 원고에 함께 남긴다.
등록하지 못한 기술, 종료월을 넣은 진행 중 프로젝트, 넣지 못한 링크가 여기 해당한다.

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun --env-file=career-os/.env career-os/scripts/profile/manage_profile.ts documents put --key <key> --file "${TMPDIR:-/tmp}/<key>-profile.md" --expected-version <1단계의 version> --note "<무엇을 바꿨는지>"
```

새 원고는 `--expected-version 0` 이다.

**저장이 `409` 로 거절되면 다른 곳에서 원고가 바뀐 것이다.**
다시 받아 차이를 사용자에게 보여 준 뒤에 저장한다. 덮어쓰지 않는다.

저장한 뒤 임시 파일을 지운다.

1단계에서 작업본을 받았을 때만 발행한다.

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun career-os/scripts/career-workspace/cli.ts skill finish sync-profile --json
```
