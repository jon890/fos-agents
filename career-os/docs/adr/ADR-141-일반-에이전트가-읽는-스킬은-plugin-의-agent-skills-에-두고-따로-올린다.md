## ADR-141: 일반 에이전트가 읽는 스킬은 plugin 의 agent-skills 에 두고 따로 올린다

> **개정(2026-11-20, 사용자 결정, fos-assistant PR #811)**: fos-assistant 가 플러그인 manifest 의 `agent_skills` 항목을 열었다. 붙이기가 이 디렉터리의 스킬을 함께 설치하고, `sandbox_env` 를 선언한 스킬은 에이전트의 셸 설정이 그 env 를 모두 넘길 때만 설치한다(fos-assistant `docs/features/agent-skill/spec.md` 의 DECISION2).
> 그래서 아래 결정의 일부를 바꾼다.
> - `connector.json` 의 `agent_skills.path` 가 이 디렉터리를 가리킨다. 따로 올리지 않고 붙이기와 다시 설치로 반영된다.
> - 이 디렉터리에는 Claude Code 전용 `skills/` 의 실행기 스킬 사본(`position-recommender`, `study-collection`)을 둔다. 사본은 셸에서 실행기를 부르고, 실행기 명령의 `${CLAUDE_PLUGIN_ROOT}` 는 Hermes 가 바꾸지 않아 실행 공간의 셸이 env 로 푼다. 필요한 env 는 `sandbox_env` 로 선언한다. 「셸과 로컬 실행기를 부르지 않는다」 는 이 사본에는 적용하지 않는다.
> - 사본은 원본과 이름이 같다. Claude Code 는 이 디렉터리를 읽지 않으므로 `skills/` 와 이름이 같아도 겹치지 않는다. `connector-skills/` 와는 지금처럼 겹치지 않게 둔다(fos-assistant 가 manifest 전체를 거절한다).
> - 「evals/ 와 실제 모델로 평가한다」 는 사본에 적용하지 않는다. 사본의 판단 지침은 원본과 같고 실행 환경 문장만 다르므로, 판단 평가는 원본 쪽에서 한다.
> - 사본은 `plugin/scripts/agent-skills.ts` 가 원본에서 실행 환경 문장만 바꿔 만들고, `plugin/scripts/agent-skills.test.ts` 가 어긋남과 manifest 규칙을 검사한다.

> **개정(2026-11-05, 사용자 결정, fos-assistant PR #699)**: `proactive-check` 스킬을 모든 살펴보기에서 뺐다. 살펴보기는 사용자별 메인 에이전트가 스킬 없이 돌고, 공통 지침은 fos-assistant Control Plane 이 가진다(fos-assistant ADR-080 개정).
> 그래서 `plugin/agent-skills/proactive-check/` 와 `plugin/scripts/agent-skill-eval.ts`, 합성 fixture 평가를 지웠다. `agent-skills/` 폴더는 외부 환경이 경로를 마운트하므로 `README.md` 만 두고 남긴다.
> 아래 결정은 이 폴더에 스킬을 다시 둘 때의 규칙으로만 남는다. 「지금 이 폴더에 올릴 스킬은 없다」 는 2026-11-20 개정으로 바뀌었다.

- **status**: `accepted`
- **결정**:
  - **fos-assistant 의 일반 커리어 에이전트가 읽는 스킬은 `plugin/agent-skills/` 에 둔다.** 첫 스킬이던 먼저 살펴보기의 커리어 지침 `proactive-check` 는 개정으로 지웠다.
    `plugin.json` 의 `skills` 는 `connector-skills/` 그대로 둔다. 그래서 이 디렉터리는 연결용 에이전트의 지침에도, Claude Code 의 plugin 스킬에도 실리지 않는다.
  - 세 디렉터리에 같은 이름의 스킬을 두지 않는다.
  - **이 디렉터리의 스킬은 커넥터 설치와 따로 일반 에이전트에 올린다.** fos-assistant 의 스킬 올리기는 `SKILL.md` 와 `references/`, `templates/` 만 받으므로 그 밖의 파일(`evals/`)은 올리지 않는다.
    fos-assistant 가 커넥터 manifest 의 일반 에이전트용 스킬 칸을 열면 그 칸이 이 디렉터리를 가리키게 바꾼다.
  - **이 스킬은 커넥터의 읽기 도구만 위임으로 쓴다.** 셸과 로컬 실행기를 부르지 않고 저장소 경로를 가리키지 않는다. 쓰기 도구 이름을 적지 않는다.
  - **지침의 판단은 합성 fixture 와 실제 모델로 평가한다(스킬을 다시 둘 때의 규칙).** fixture 와 기대 판정은 스킬 디렉터리의 `evals/` 에 두고, 실행기와 채점은 `plugin/scripts/` 에 새로 만든다(옛 `agent-skill-eval.ts` 는 지웠다).
    fixture 가 도구 결과를 대신한다. 조회 선택 평가는 원문을 열기 전에 멈추고 바로 침묵했는지, 위임과 직접 호출, 고른 영역과 검색어를 채점한다. 결과 작성 평가는 이번 실행에서 이미 맥락과 원문을 확인한 합성 결과를 받아 v3 블록의 문제 후보 수, 필수 칸과 같은 블록 발견의 근거 참조를 채점한다. 실제 도구 호출 기록이나 Control Plane 의 저장·그리기는 평가하지 않는다.
- **맥락**:
  - fos-assistant 의 먼저 살펴보기(fos-assistant ADR-080, ADR-081)는 에이전트에 켜진 `proactive-check` 스킬을 Control Plane 이 읽게 해 분야의 판단을 맡긴다. 그 분야 지침을 분야 패키지가 소유한다.
  - 살펴보기는 커넥터 에이전트가 아니라 웹 도구와 위임 도구를 가진 일반 에이전트에서 돈다. 커넥터 에이전트는 Memory 를 받지 않아 개인화를 할 수 없다.
  - `connector-skills/` 는 연결용 에이전트의 지침으로 합쳐지고 8,000자 상한이 있다. 대화용 스킬 셋이 이미 그 대부분을 쓴다. `skills/` 는 로컬 실행기를 부르는 Claude Code 전용이다([ADR-139](ADR-139-plugin-의-대화용-스킬과-claude-code-전용-스킬을-디렉터리로-나눈다.md)).
  - 지침이 맥락에 따라 다른 영역을 고르는지는 Control Plane 의 시험 대역으로 보일 수 없다. 모델과 지침의 몫이라 분야 패키지 쪽 평가가 필요하다.
- **대안 기각**:
  - `connector-skills/` 에 둔다: 커넥터와 함께 배포된다. 그러나 연결용 에이전트 지침에 합쳐져 그 에이전트가 따를 수 없는 위임 지시가 섞이고, 8,000자 상한을 넘는다.
  - `skills/` 에 둔다: 예산과 무관하다. 그러나 Claude Code 에서 plugin 스킬로 보여 노트북 세션의 스킬 목록에 쓸 수 없는 스킬이 생기고, 「Claude Code 에서만 돈다」 는 그 디렉터리의 규칙과 어긋난다.
  - 저장소의 `.claude/skills/` 에 둔다: ADR-139 가 그 사본을 줄여 가는 중이고, plugin 으로 배포하는 사람에게 닿지 않는다.
  - 평가를 fos-assistant 의 e2e 로 한다: Control Plane 계약은 그쪽이 시험한다. 그러나 대역 Hermes 는 판단을 하지 않아 지침의 선택을 볼 수 없다.
- **결과**(개정 전 기록. 스킬이 있던 때의 판단이다):
  - 얻는 것: 분야 지침이 도구 이름과 같은 plugin 안에서 바뀐다. 커넥터 지침 예산을 쓰지 않는다. 지침을 고치면 같은 fixture 로 실제 모델이 고르는 영역과 침묵을 다시 확인한다.
  - 감당할 것: 커넥터를 다시 등록해도 이 스킬은 반영되지 않는다. 스킬을 고친 버전을 배포할 때 일반 에이전트의 스킬을 따로 다시 올린다. 실제 모델 평가는 비용이 들어 자동 검사에 넣지 않고, 지침을 고칠 때 사람이 돌린다.
