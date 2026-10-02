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

## 계정 소개

프로필 이름 밑의 한 줄(bio)은 README 와 따로 있다. README 를 고칠 때 함께 본다.

```bash
gh api user --jq .bio
gh api user -X PATCH -f bio="$BIO"
```

**`gh` 토큰에 `user` 권한이 없으면 404 로 거절된다.** 권한 범위는 대신 넓히지 않는다.
사용자에게 `gh auth refresh -h github.com -s user` 를 실행해 달라고 한다.

## 에이전트 사용량

프로필에 AI 도구 사용량을 수치로 넣는다. 「AI 를 적극 활용한다」는 말보다 실측이 근거가 된다.

**지난달 값은 그 달이 끝난 직후에 한 번 측정해 기록하고, 이후에는 다시 세지 않는다.**
세션 기록은 시간이 지나면 기기에서 지워진다. 2026-10 실측으로 Claude Code 의 가장 오래된 기록이 두 달 전이었고,
한 달 전에 24.6B 로 측정한 달을 다시 세니 8.2B 가 나왔다.

측정값은 `library/profiles/github-agent-usage-snapshots.md` 에 달마다 한 줄로 적는다.
토큰, 환산 비용, 세션 수와 측정한 날을 함께 적는다. 기록이 없는 달의 비용과 세션 수는 뒤늦게 채울 수 없다.

```bash
A=career-os/.claude/skills/sync-profile/scripts
python3 "$A/agent_usage.py" --months 2
```

Claude Code 와 Codex 세션 기록을 전수 읽어 월별 토큰과 API 환산 비용을 낸다.
단가표는 스크립트 안에 있다. 모델이 바뀌면 그곳을 고친다.

차트는 측정 기록의 값으로 그린다. 외부 서비스에 기대지 않고 SVG 를 저장소에 커밋한다.

```bash
python3 "$A/agent_usage_chart.py" --month 2026.07=1.3,11.6 --month 2026.08=18.9,5.7 --out "$OUT"
```

`--month` 의 두 수는 Claude Code 와 Codex 의 십억 토큰이다. `$OUT` 은 프로필 저장소의 `agent-usage.svg` 다.
스크립트가 내는 합계를 Tokens 배지에 쓴다. 마크다운에서는 `./agent-usage.svg` 처럼 상대 경로로 참조한다.

**환산 비용을 쓰면 환산값이라고 밝힌다.** 구독제로 결제한 것이라 지출액과 구분해야 한다.
「공개 API 단가로 환산하면」이라고 적는다.

**단가를 모르는 모델은 토큰만 세고 비용에서 뺀다.** 추정으로 채우면 근거가 사라진다.
`agent_usage.py` 가 그 토큰 수와 비율을 함께 낸다.

**기록이 없는 달이 섞이면 그 수치는 배지에서 뺀다.**
2026-10 실측으로 7월과 8월의 비용과 세션 수를 달별로 적어 두지 않아, 석 달 합계를 낼 수 없어 두 배지를 뺐다.
