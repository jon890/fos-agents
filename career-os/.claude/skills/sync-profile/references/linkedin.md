# LinkedIn

절마다 편집 화면이 따로 있고, 명시적인 저장 버튼을 눌러야 반영된다.
원티드와 달리 저장 시점이 분명해 확인이 쉽다.

## 시작하기

```bash
B=~/.claude/scripts/browser-driver
H=$($B open "https://www.linkedin.com/in/" 25000 | tail -1)
$B url "$H"
```

로그인돼 있으면 본인 프로필 주소로 이동한다. 그 주소가 이후 편집 경로의 앞부분이 된다.
로그인 화면이면 사용자에게 알리고 멈춘다.

## 편집 진입점

**`aria-label` 이 절마다 다른 낱말로 끝난다.** 「편집」 하나로 찾으면 아무것도 나오지 않는다.

| 절 | 실제 표기 |
| --- | --- |
| 소개, 헤드라인 | `정보 변경` |
| 경력, 학력 | `수정` |
| 항목 추가 | `추가` |

넷을 함께 걸어 찾는다.

```javascript
Array.from(document.querySelectorAll("button,a"))
  .filter(function(x){ return /수정|변경|편집|추가/.test(x.getAttribute("aria-label")||""); })
  .map(function(x){ return x.tagName + " | " + x.getAttribute("aria-label"); })
```

경로로 바로 갈 수도 있다. 프로필 주소 뒤에 붙인다.

| 절 | 경로 |
| --- | --- |
| 이름, 헤드라인, 지역, 업계 | `/edit/intro/` |
| 소개와 대표 보유기술 | `/edit/forms/summary/new/` |
| 경력 | `/details/experience/` |

**「소개」 절에는 편집 버튼이 목록에 잡히지 않는다.** 그 절까지 스크롤해야 나타난다.

## 입력 방식

**헤드라인과 소개는 `contenteditable` 인 div 다.** `input` 이나 `textarea` 가 아니다.

```javascript
var el = document.querySelector("[contenteditable=true]");
el.focus();
document.execCommand("selectAll", false, null);
document.execCommand("insertText", false, "새 헤드라인");
```

이름과 지역, 업계는 보통의 `input` 이다. 같은 `execCommand` 로 넣는다.

### 문단 구분

**`insertText` 는 문자열 안의 줄바꿈을 버린다.**
여러 문단짜리 소개를 한 번에 넣으면 네 문단이 한 덩어리로 붙는다.
저장하기 전에 화면에서 발견해야 되돌릴 수 있다.

문단마다 나눠 넣고 사이에 `insertLineBreak` 를 두 번 부른다.
한 번은 줄바꿈이고, 두 번이라야 빈 줄 하나가 들어간 문단 구분이 된다.

```javascript
var paras = ["첫 문단", "둘째 문단", "셋째 문단"];
paras.forEach(function(p, i){
  if(i > 0){
    document.execCommand("insertLineBreak", false, null);
    document.execCommand("insertLineBreak", false, null);
  }
  document.execCommand("insertText", false, p);
});
```

## 대표 보유기술

**보유기술 목록과는 다른 화면이다.** 목록의 순서를 바꿔도 대표가 바뀌지 않는다.
소개 편집 화면(`/edit/forms/summary/new/`)에서 최대 다섯 개를 지정한다.

기술을 더할 때는 이름을 치고 자동완성 목록에서 골라야 한다.
직접 친 문자열은 그대로 등록되지 않는다.

**자동완성 목록에는 `role` 속성이 없다.** `[role=option]` 으로 찾으면 하나도 나오지 않는다.
`textContent` 로 잡는다.

```javascript
Array.from(document.querySelectorAll("div,li,span"))
  .filter(function(x){ return (x.textContent||"").trim() === "Python" && x.children.length === 0; })
```

### 기술 이름 표기

**영문으로 치면 LinkedIn 이 매핑해 둔 번역어가 나온다.**
실측으로 `Python` 을 치면 「파이톤」이 나왔고, 한글로 「파이썬」을 치면 그 이름의 별도 항목이 있었다.

**등록하기 전에 목록에 뜬 문자열을 그대로 읽는다.**
어색한 번역어면 한글로 다시 쳐서 자연스러운 항목이 있는지 본다.
잘못 등록한 것은 프로필에서 삭제한 뒤 다시 넣는다.

## 저장

**「저장」 버튼을 눌러야 반영된다.** 자동 저장이 아니다.

```javascript
Array.from(document.querySelectorAll("button"))
  .filter(function(x){ return /^(저장|Save)$/.test((x.textContent||"").trim()); })[0].click();
```

버튼이 `disabled` 면 필수 항목이 비어 있다는 뜻이다. 무엇이 비었는지 화면에서 확인한다.

## 확인해야 할 것

**프로필 언어가 여럿이면 각각 따로 고쳐야 한다.** 한국어와 영어 프로필이 별도로 존재한다.
한쪽만 고치면 다른 쪽이 낡은 채로 남는다.

**「대표 보유기술」은 본문 근거가 있는 것만 남긴다.**
이력서에서 뺀 기술이 여기 남아 있으면 면접에서 물었을 때 답할 수 없다.

**구직 중 표시가 켜져 있으면 그 상태도 함께 본다.**
희망 지역과 근무 형태가 지금 조건과 맞는지 확인한다.
