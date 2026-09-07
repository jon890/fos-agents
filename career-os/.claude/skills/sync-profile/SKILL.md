---
name: sync-profile
description: 원티드, LinkedIn, GitHub 프로필을 이력서 원고 기준으로 갱신하는 career-os 스킬. "프로필 갱신", "원티드 이력서 업데이트", "링크드인 최신화", "깃허브 프로필 만들어줘", "이력서 바뀐 내용 프로필에도 반영"처럼 외부 프로필을 손봐야 할 때 사용한다. 실제 반영은 사용자 승인을 받은 뒤에만 수행한다.
---

# 프로필 갱신

**목표: 이력서 원고에서 검증된 문장만 프로필에 올리고, 서버에 실제로 저장됐는지 확인한다.**

프로필은 여러 회사가 상시로 본다. 한 회사에 내는 지원본과 노출 범위가 다르다.
같은 문장이라도 지원본에서는 맞고 프로필에서는 과할 수 있다.

## 세 곳의 차이

저장 방식이 서로 달라 확인하는 방법도 다르다. 이것이 이 스킬이 존재하는 이유다.

| | 원티드 | LinkedIn | GitHub |
| --- | --- | --- | --- |
| 입력 | `input`, `textarea` | `contenteditable` 과 `input` 혼합 | 마크다운 파일 |
| 저장 | React `onBlur` 를 직접 호출 | 「저장」 버튼 클릭 | `git push` |
| 확인 | 서버에서 다시 조회 | 프로필 화면 재확인 | 이미지 로드 확인 |
| 함정 | 화면에 보여도 저장 안 됨 | 편집 버튼 표기가 절마다 다름 | 외부 서비스가 응답하지 않음 |

대상에 진입할 때 해당 참조를 읽는다.

- [`references/wanted.md`](references/wanted.md)
- [`references/linkedin.md`](references/linkedin.md)
- [`references/github.md`](references/github.md)

## 비공개 작업본 동기화

`applications/` 나 `library/` 를 읽고 쓰기 전에 작업본을 받아 온다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill begin sync-profile --json
```

작업을 마치면 발행한다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill finish sync-profile --json
```

## 실행 흐름

### 1. 원본과 대상 확인

**갱신할 내용의 출처를 먼저 정한다.**

프로필은 특정 지원 건에 매이지 않으므로 대상별 원고를 `library/resume-baselines/` 에 둔다.
원티드는 `wanted-profile.md`, GitHub 은 `github-profile.md`, LinkedIn 은 `linkedin-profile.md` 다.

원고가 없으면 가장 최근 지원의 `applications/<company>/<role>/evidence/resume-draft.md` 를
출발점으로 삼고, 공개 범위를 조정해 새 원고를 만든다.
현재 경력과 경험 경계는 `brain-search` 로 확인한다.

**사용자가 한 곳만 말해도 나머지를 함께 본다.**
현재 각 프로필에 무엇이 들어 있는지 읽고, 원본과 어긋나는 곳을 표로 보고한다.
낡은 곳이 어디인지 알아야 어디까지 고칠지 정할 수 있다.

### 2. 공개 범위 결정

지원본에 있던 것을 그대로 옮기기 전에 확인받는다.

| 대상 | 판단할 것 |
| --- | --- |
| 사내 운영 수치 | 여러 회사가 상시로 보는 곳에 둘지 |
| 사내 조직명과 도구 이름 | 조직 밖에서 뜻이 통하는지 |
| 진행 중인 프로젝트 | 폼이 종료월을 요구할 때 어떻게 표기할지 |

**결정은 사용자만 할 수 있다.** 근거를 붙여 묻고, 정해진 것을 원고에 기록한다.

### 3. 근거 확인

**프로필에 새로 쓰는 문장은 근거를 확인한 뒤에 넣는다.**
이력서 원고에서 그대로 가져온 문장은 이미 검증됐다.
프로필 형식에 맞춰 새로 쓴 문장은 [`resume-preparer` 의 판정 모델](../resume-preparer/references/claim-model.md)로 다시 본다.

코드가 남아 있는 과거 프로젝트는 실제로 확인할 수 있다.
커밋 작성자까지 보면 소유권 축이 갈린다. 코드가 있어도 본인이 쓴 것인지는 별개다.

### 4. 반영

**대상별 참조를 읽고 그 절차를 따른다.**

원티드와 LinkedIn 은 브라우저를 쓴다. `~/.claude/scripts/browser-driver` 로 조작한다.
`open` 이 내는 한 줄이 `handle` 이고 아래 스크립트가 모두 첫 인자로 받는다.

경로는 이 스킬 디렉터리 기준이다.

```bash
S=career-os/.claude/skills/sync-profile/scripts
$S/wanted_list_fields.sh <handle> [all]
$S/wanted_set_field.sh <handle> <field-index> <본문파일>
$S/wanted_set_period.sh <handle> <title-index> start|end <YYYY> <M>
```

**한 번에 하나씩 넣고 결과를 확인한다.** 여러 필드를 연달아 넣으면
어느 단계에서 실패했는지 알 수 없다. 인덱스가 밀리는 폼에서는 특히 그렇다.

### 5. 저장 검증

**화면에 값이 보이는 것은 저장의 증거가 아니다.**

| 대상 | 확인 방법 |
| --- | --- |
| 원티드 | 새로고침 뒤 서버 API 로 조회 |
| LinkedIn | 프로필 화면으로 돌아가 값 확인 |
| GitHub | 프로필 페이지에서 이미지 로드 상태 확인 |

**한 곳이라도 실패하면 그것을 먼저 알린다.** 나머지가 성공했다고 넘어가지 않는다.

### 6. 원고 갱신

**반영한 내용을 원고에 다시 적는다.**
다음에 갱신할 때 무엇이 올라가 있는지 알 수 있어야 한다.

폼 제약 때문에 원고와 다르게 넣은 것이 있으면 그 사실과 이유를 함께 남긴다.
등록하지 못한 기술, 종료월을 넣은 진행 중 프로젝트가 여기 해당한다.

## 에이전트 사용량

GitHub 프로필에 AI 도구 사용량을 수치로 넣을 수 있다.
「AI 를 적극 활용한다」는 말보다 실측이 근거가 된다.

```bash
python3 scripts/agent_usage.py --months 3
python3 scripts/agent_usage.py --json
```

Claude Code 와 Codex 세션 기록을 전수 읽어 월별 토큰과 API 환산 비용을 낸다.
단가표는 스크립트 안에 있다. 모델이 바뀌면 그곳을 고친다.

**환산값이라고 밝힌다.** 구독제로 결제한 것이라 지출액과 구분해야 한다.

## 반영 전에 지키는 것

**무엇을 어떻게 바꿀지 보여주고 확인받은 뒤에 넣는다.** 프로필은 외부에 공개되는 것이다.

**이력서에 남아 있는 문장만 올리고 지원본과 같은 기준으로 검증한다.**
프로필이라고 검증이 느슨해질 이유가 없다.

**대상마다 형식을 다시 정한다.**
원티드는 항목이 정해진 폼이고 GitHub 은 자유 문서다. 독자도 다르다.

**이미 로그인된 브라우저 세션만 쓴다.**
로그인 화면이 나오면 멈추고 사용자에게 알린다. 자격 증명을 대신 입력하지 않는다.
