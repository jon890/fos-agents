# 원티드

이력서를 항목 단위로 저장하는 폼이다. 화면에 값이 들어가도 저장되지 않는 경우가 있어,
서버에 반영됐는지를 매번 확인해야 한다.

## 시작하기

브라우저는 `~/.claude/scripts/browser-driver` 로 연다. `open` 이 내는 한 줄이 `handle` 이고,
이 스킬의 스크립트가 모두 첫 인자로 받는 값이다.

```bash
B=~/.claude/scripts/browser-driver
H=$($B open "https://www.wanted.co.kr/cv/list" 25000 | tail -1)
$B url "$H"
```

**주소가 로그인 화면이면 사용자에게 알리고 멈춘다.** 자동 로그인을 시도하지 않는다.

이력서 목록에서 대상을 골라 편집 화면으로 들어간다.

```bash
$B js "$H" 'document.querySelector("[class*=ResumeItem_ResumeItem__title__]").click(); "clicked"'
sleep 4
$B url "$H"
```

주소가 `https://www.wanted.co.kr/cv/<resumeKey>` 로 바뀐다.
`<resumeKey>` 는 뒤의 저장 확인에서 쓰므로 적어 둔다.

## 필드 인덱스 읽기

```bash
scripts/wanted_list_fields.sh "$H"        # 제목과 본문만
scripts/wanted_list_fields.sh "$H" all    # 직무와 직책까지
```

**항목을 추가하면 그 아래 인덱스가 전부 밀린다.** 새 성과 항목은 회사 블록의 맨 위에 생기므로
아래 항목이 4씩 늘어난다. 값을 넣기 전과 항목을 추가한 뒤에 매번 다시 읽는다.

## 저장이 되는 조건

**React `onBlur` 핸들러를 직접 호출해야 PATCH 요청이 나간다.**
`value` 를 대입하고 `input` 이벤트를 보내면 화면은 바뀌지만 서버로 가지 않는다.
저장 버튼이 없어 자동 저장으로 보이지만, 실제로는 이 핸들러가 저장을 맡는다.

`scripts/wanted_set_field.sh` 가 이 순서를 담고 있다.

1. `execCommand('insertText')` 로 실제 입력 경로를 탄다
2. 요소의 `__reactProps` 키를 찾아 `onBlur` 를 부른다

## 필드를 찾는 방법

**`data-agent-field-key` 속성으로 식별한다.** 값은 `title`, `description`, `about` 이다.
직무와 직책 입력에는 이 속성이 없어 인덱스로만 잡을 수 있다.

인덱스 조회는 `scripts/wanted_list_fields.sh` 가 담당한다.

## 기간 선택기

년도 그리드를 먼저 보여주고, 년도를 고르면 월 그리드로 바뀐다. 마지막에 확인을 누른다.

**선택기 안의 항목은 `innerText` 가 비어 있다.** `textContent` 로 잡아야 한다.
컨테이너는 `div.wds-z4o2j` 다.

**항목 경계를 넘어 옆 프로젝트의 기간을 건드리는 사고가 난다.**
`scripts/wanted_set_period.sh` 는 컨테이너가 `title` 을 하나만 담는지 확인한 뒤에 클릭한다.

**선택기가 겹쳐 열리면 둘 다 닫아야 한다.** 앞의 것이 닫히지 않은 채 다음을 열면
`div.wds-z4o2j` 가 둘이 되어 어느 쪽을 조작하는지 알 수 없다. `Escape` 를 여러 번 보낸다.

## 폼이 강제하는 것

**프로젝트 항목은 종료월이 필수다.** 「진행 중」 옵션이 없다.
진행 중인 프로젝트는 갱신하는 달을 종료월로 넣고, 본문 첫 불릿에 현재 담당 중이라고 적는다.
그러지 않으면 맡던 것을 모두 정리하고 나가려는 것으로 읽힌다.

**스킬은 정해진 목록에서만 고른다.** 검색해서 나오지 않으면 등록할 수 없다.
실측으로 `Spring Batch`, `OpenSearch`, `NestJS` 가 목록에 없었다.
등록하지 못한 기술은 각 프로젝트의 「기술」 줄에 남겨 본문에서 읽히게 한다.

**AI 활용 경험은 자유 입력이 아니다.** 원티드가 이력서 본문을 읽어 후보 문장을 만들고
그중 최대 셋을 고르게 한다. 경력 항목을 다 채운 뒤에 돌려야 최근 경험이 후보에 들어온다.

선택은 `label` 을 클릭한다. `li` 를 클릭하면 아무 일도 일어나지 않는다.
체크 여부는 `[role=checkbox]` 의 `aria-checked` 로 확인한다.

## 저장 확인

**편집 화면에 값이 보이는 것은 저장의 증거가 아니다.** 서버에서 다시 읽는다.

```bash
$B js "$H" '(async function(){
  var r = await fetch("/api/chaos/resumes/v2/<resumeKey>", {headers:{accept:"application/json"}});
  var d = (await r.json()).data;
  return (d.careers||[]).flatMap(function(c){ return (c.projects||[]); })
    .map(function(p){ return p.title + " | " + (p.description||"").length + "자"; }).join("\n");
})()'
```

**AI 활용 경험은 저장돼도 편집 화면에 렌더링되지 않을 때가 있다.**

```bash
$B js "$H" '(async function(){
  var r = await fetch("/api/chaos/resumes/v1/<resumeKey>/ai-competencies", {headers:{accept:"application/json"}});
  return JSON.stringify((await r.json()).data);
})()'
```

## AI 이력서 리뷰

**리뷰용 PDF 는 본문 갱신이 늦게 반영된다.**
실측으로 소개만 새 것이고 프로젝트 본문은 옛 것인 PDF 를 대상으로 리뷰가 나왔다.
개선 효과를 재는 용도로는 쓸 수 없다.

리뷰 지적 중 사실과 다른 것이 있다. 두 차례 모두 「경력 요약 섹션이 없다」고 했으나
간단 소개가 PDF 1쪽 맨 위에 있었다. 「글머리 기호가 부족하다」도 사실과 달랐다.
정량 성과 지적은 볼 만하지만 예시로 드는 수치는 리뷰가 지어낸 값이다.

키워드 분석은 참고가 된다. 이력서에서 뽑힌 키워드와 합격자 키워드를 나란히 보여준다.
조사가 붙은 명사가 키워드로 잡히기도 하므로 그 수준을 감안해서 읽는다.
