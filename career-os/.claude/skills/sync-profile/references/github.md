# GitHub 프로필

저장소에 파일을 커밋하면 프로필 화면에 렌더된다. 브라우저 조작이 없어 셋 중 가장 단순하다.

## 저장소

**이름이 계정명과 같아야 한다.** `<username>/<username>` 이다.
다른 이름이면 프로필에 나타나지 않는다.

```bash
gh repo create <username> --public --source=. --push
```

**공개여야 프로필에 보인다.** 비공개로 만들면 본인에게만 보인다.

## 렌더 확인

**작성한 마크다운을 GitHub 엔진으로 렌더해 확인한다.** 로컬 미리보기와 다르게 보인다.

```bash
gh api --method POST /markdown -f mode=gfm -f text="$(cat README.md)"
```

**이미지가 실제로 로드되는지 본다.** 외부 서비스가 죽어 있으면 빈 자리가 남는다.

```javascript
Array.from(document.querySelector("article.markdown-body").querySelectorAll("img"))
  .filter(function(i){ return i.naturalWidth === 0; })
  .map(function(i){ return i.src; })
```

## 외부 서비스 상태

무료 공용 인스턴스는 자주 죽는다. 넣기 전에 응답 코드를 확인한다.

```bash
curl -s -o /dev/null -w "%{http_code}" --max-time 12 "<url>"
```

2026년 9월 실측이다.

| 서비스 | 상태 |
| --- | --- |
| `github-readme-stats.vercel.app` | 503. 배포가 중단됨 |
| `streak-stats.demolab.com` | 정상 |
| `github-readme-activity-graph.vercel.app` | 402 |
| `ghchart.rshah.org` | 정상 |
| `capsule-render.vercel.app` | 정상 |
| `readme-typing-svg.demolab.com` | 정상 |
| `skillicons.dev` | 정상 |
| `img.shields.io` | 정상 |

**프로필 화면에 이미 있는 것은 빼고 없는 것만 넣는다.** 기여 잔디가 그렇다.

## 직접 그리는 차트

외부 서비스에 기대지 않고 SVG 를 만들어 저장소에 커밋하면 디자인을 통제할 수 있다.
`scripts/agent_usage.py --json` 이 월별 수치를 내므로 그것으로 그린다.

- 배경은 `#0d1117` 로 두어 GitHub 다크 테마와 맞춘다
- `<animate>` 로 막대가 올라오게 하면 정적 이미지보다 눈에 띈다
- 마크다운에서 `./agent-usage.svg` 처럼 상대 경로로 참조한다

## 수치를 쓸 때

**환산값이라고 밝힌다.** 「공개 API 단가로 환산하면」이라고 적으면 지출액과 구분된다.

**단가를 모르는 모델은 토큰만 세고 비용에서 뺀다.** 추정으로 채우면 근거가 사라진다.
`agent_usage.py` 가 그 토큰 수와 비율을 함께 낸다.
