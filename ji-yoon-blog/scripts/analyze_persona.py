"""수집한 글을 집계해 페르소나 문서에 쓰는 수치를 모두 만든다.

`references/ji-yung-persona.md` 와 `references/category-style-map.md` 가 인용하는
수치는 전부 여기서 나와야 한다. 문서에만 있고 여기 없는 값이 생기면
다음 갱신 때 옛 값이 남는다.

빈도로 셀 수 있는 것만 여기서 처리한다.
문장의 뉘앙스 판단은 사람이 표본을 읽어 정한다.

사용법:
    python3 analyze_persona.py --posts data/posts --out data/persona-stats.json
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

# 이모지 하나를 통째로 잡는다. 피부색 보정과 결합 문자를 붙여 세야
# 👍🏻 이 👍 와 🏻 둘로 갈라지지 않는다.
EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F2FF]"
    "[\U0001F3FB-\U0001F3FF]?(?:‍[\U0001F300-\U0001FAFF\U00002600-\U000027BF]"
    "[\U0001F3FB-\U0001F3FF]?)*️?"
)

EXPRESSIONS = [
    "안녕하세요", "안뇽하세요", "지융입니다", "지융이에요", "오늘은", "다녀왔어요",
    "바로", "ㅎㅎ", "ㅋㅋ", "넘", "더라고요", "같아요", "좋았어요", "답니다",
    "참고하세요", "가보세요", "찾으신다면", "여기가 바로", "이렇게", "추천해요",
    "괜찮았어요", "맛있었어요", "예뻤어요", "있더라고요", "했어요",
    "저는", "저희는", "남편이랑", "친구랑", "요즘", "그래서", "근데", "진짜", "정말",
]

# 협찬 판정 낱말. 무엇을 협찬으로 셌는지 문서가 밝힐 수 있도록 유형별로 나눈다.
SPONSOR_KINDS = {
    "체험단": r"체험단",
    "제공받음": r"제공받|제공을 받|무상으로 제공",
    "수수료": r"수수료",
    "쇼핑 커넥트": r"쇼핑\s?커넥트",
    "원고료": r"원고료|소정의",
    "서포터즈": r"서포터즈",
}
SPONSOR_ANY = re.compile("|".join(SPONSOR_KINDS.values()))

# 생활 반경을 재는 지역. 제목과 태그에 나온 것을 센다.
REGIONS = [
    "구리", "잠실", "남양주", "판교", "다산", "성수", "강동", "하남",
    "송파", "분당", "제주", "서울",
]

PRACTICAL = {
    "메뉴판": r"메뉴판",
    "가격": r"가격",
    "주차": r"주차",
    "웨이팅": r"웨이팅",
}

# 문단이 존댓말인지 평서체인지 가른다. 뒤에 붙는 이모지와 부호는 무시한다.
PLAIN_ENDING = re.compile(r"(했다|왔다|이다|였다|간다|먹었다|좋다|없다|있다|았다|었다|린다|한다)(?![가-힣])")
POLITE_ENDING = re.compile(r"(어요|에요|예요|답니다|습니다|세요|아요|네요|죠)(?![가-힣])")

GREETING = re.compile(r"^안(녕|뇽)하세[요용융]")


def normalize(text: str) -> str:
    """NFKC 는 ㅎㅎ 같은 호환 자모를 초성 자모로 바꿔 검색이 어긋나므로 NFC 를 쓴다."""
    return unicodedata.normalize("NFC", text).replace("\xa0", " ").strip()


def load(posts_dir: Path) -> list[dict]:
    records = []
    for f in sorted(posts_dir.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if "error" in d or not d.get("paragraphs"):
            continue
        d["_paras"] = [p for p in (normalize(p) for p in d["paragraphs"]) if p]
        d["_body"] = " ".join(d["_paras"])
        d["_title"] = normalize(d.get("title", ""))
        d["_category"] = normalize(d.get("categoryName") or "미상")
        d["_year"] = (d.get("resolvedDate") or "")[:4]
        records.append(d)
    return records


def dist(values: list[int]) -> dict:
    if not values:
        return {}
    s = sorted(values)
    return {
        "count": len(s),
        "min": s[0],
        "p25": s[len(s) // 4],
        "median": s[len(s) // 2],
        "p75": s[len(s) * 3 // 4],
        "max": s[-1],
        "mean": round(sum(s) / len(s), 1),
    }


def pct(part: int, whole: int) -> str:
    return f"{part / whole * 100:.1f}%" if whole else "0.0%"


def share(records: list[dict], pattern: str, field: str = "_body") -> tuple[int, str]:
    r = re.compile(pattern)
    n = sum(1 for d in records if r.search(d[field]))
    return n, pct(n, len(records))


def voice_of(paras: list[str]) -> str:
    """본문 문단의 종결어미를 세어 그 글이 존댓말인지 평서체인지 판정한다."""
    body = paras[3:-3] or paras
    plain = sum(1 for p in body if PLAIN_ENDING.search(p))
    polite = sum(1 for p in body if POLITE_ENDING.search(p))
    if plain > polite:
        return "평서체"
    return "존댓말"


def overall(records: list[dict]) -> dict:
    total = len(records)

    # 인사와 소개는 본문 어디든 있는지가 아니라 그 자리에 오는지를 센다.
    greeting_first = sum(1 for d in records if GREETING.match(d["_paras"][0]))
    hello_first = sum(1 for d in records if d["_paras"][0].startswith("안녕하세요"))
    today_second = sum(
        1 for d in records if len(d["_paras"]) > 1 and d["_paras"][1].startswith("오늘은")
    )

    name_forms = Counter()
    for d in records:
        head = d["_paras"][0]
        for form in ("지융입니다", "지융이에요"):
            if form in head:
                name_forms[form] += 1
    greeting_forms = Counter(
        d["_paras"][0].split()[0] for d in records if GREETING.match(d["_paras"][0])
    )

    # 마무리가 실제로 뒤쪽에 오는지 위치로 확인한다.
    closing_positions = []
    for d in records:
        for i, p in enumerate(d["_paras"]):
            if "찾으신다면" in p:
                closing_positions.append(i / max(len(d["_paras"]) - 1, 1))
                break

    first_emoji = sum(1 for d in records if EMOJI.search(d["_paras"][0]))
    body_emoji = Counter()
    opening_emoji = Counter()
    for d in records:
        body_emoji.update(EMOJI.findall(d["_body"]))
        opening_emoji.update(EMOJI.findall(d["_paras"][0]))

    expressions = Counter()
    for d in records:
        for e in EXPRESSIONS:
            if e in d["_body"]:
                expressions[e] += 1

    # 부호 습관은 전체 기준과 그 부호를 쓴 글 기준을 함께 낸다.
    punctuation = {}
    for label, mark in [("느낌표", "!"), ("물결표", "~"), ("물음표", "?")]:
        used = [d for d in records if mark in d["_body"]]
        spaced = [d for d in used if f" {mark}" in d["_body"]]
        punctuation[label] = {
            "전체 기준": pct(len(spaced), total),
            "그 부호를 쓴 글 기준": pct(len(spaced), len(used)),
            "그 부호를 쓴 글": len(used),
        }

    blocks_first = Counter()
    blocks_last = Counter()
    for d in records:
        b = d.get("block_sequence") or []
        if b:
            blocks_first[b[0]] += 1
            blocks_last[b[-1]] += 1
    has_map = sum(1 for d in records if "placesMap" in (d.get("block_sequence") or []))
    has_sticker = sum(1 for d in records if d.get("sticker_count", 0) > 0)

    # 영업시간은 핀 이모지와 글자 표기를 갈라서 센다. 둘을 섞으면 값이 어긋난다.
    pin_n, pin_p = share(records, "📍")
    hours_n, hours_p = share(records, r"OPEN|영업시간|정기휴무")

    practical = {}
    for label, pat in PRACTICAL.items():
        n, p = share(records, pat)
        practical[label] = {"글 수": n, "비율": p}
    price_notation = sum(1 for d in records if re.search(r"가격|\d{1,3},\d{3}|\d+원", d["_body"]))
    practical["가격 표기까지"] = {
        "글 수": price_notation,
        "비율": pct(price_notation, total),
        "설명": "가격이라는 낱말이 없어도 금액을 적은 글까지 센다",
    }

    sponsor_by_kind = {}
    for label, pat in SPONSOR_KINDS.items():
        r = re.compile(pat)
        sponsor_by_kind[label] = sum(1 for d in records if r.search(d["_body"]))
    sponsor_all = [d for d in records if SPONSOR_ANY.search(d["_body"])]
    recent = [d for d in records if d["_year"] in ("2025", "2026")]
    sponsor_recent = [d for d in recent if SPONSOR_ANY.search(d["_body"])]
    own_money_body = sum(1 for d in records if "내돈내산" in d["_body"])

    fetched = [d for d in records if d.get("tagsFetched")]
    tag_counts_all = [len(d.get("tags", [])) for d in records]
    tag_counts_fetched = [len(d.get("tags", [])) for d in fetched]

    regions = {}
    for name in REGIONS:
        hit = [d for d in records if name in d["_title"] + " " + " ".join(d.get("tags", []))]
        hit_recent = [d for d in hit if d["_year"] in ("2025", "2026")]
        regions[name] = {"전체": len(hit), "2025년 이후": len(hit_recent)}

    # 제목 끝 낱말은 괄호와 문장부호를 떼고 센다. 후기와 후기) 를 따로 세면 갈린다.
    title_tail = Counter()
    for d in records:
        if d["_title"]:
            tail = re.sub(r"[()\[\]{}!?.,]", "", d["_title"].split()[-1])
            if tail:
                title_tail[tail] += 1

    inline_tag = Counter()
    voices = defaultdict(Counter)
    for d in records:
        if sum(1 for p in d["_paras"] if p.startswith("#")) > 2:
            inline_tag[d["_category"]] += 1
        voices[d["_category"]][voice_of(d["_paras"])] += 1

    return {
        "전체 글": total,
        "연도별": sorted(Counter(d["_year"] for d in records).items()),
        "카테고리": Counter(d["_category"] for d in records).most_common(),
        "분량": {
            "문단 길이": dist([len(p) for d in records for p in d["_paras"]]),
            "글당 문단": dist([len(d["_paras"]) for d in records]),
            "글당 사진": dist([d.get("image_count", 0) for d in records]),
            "글당 본문 글자": dist([d.get("char_count", 0) for d in records]),
            "제목 길이": dist([len(d["_title"]) for d in records if d["_title"]]),
            "글당 태그(전수)": dist(tag_counts_all),
            "글당 태그(조회 성공분)": dist(tag_counts_fetched),
            "태그 조회 실패": total - len(fetched),
        },
        "인사": {
            "첫 문단이 인사로 시작": {"글 수": greeting_first, "비율": pct(greeting_first, total)},
            "첫 문단이 안녕하세요로 시작": {"글 수": hello_first, "비율": pct(hello_first, total)},
            "인사 변형": greeting_forms.most_common(),
            "첫 문단의 이름 표기": name_forms.most_common(),
            "첫 문단에 이모지": {"글 수": first_emoji, "비율": pct(first_emoji, total)},
        },
        "두 번째 문단이 오늘은으로 시작": {"글 수": today_second, "비율": pct(today_second, total)},
        "마무리": {
            "찾으신다면을 쓴 글": expressions.get("찾으신다면", 0),
            "비율": pct(expressions.get("찾으신다면", 0), total),
            "등장 위치 중앙값": round(sorted(closing_positions)[len(closing_positions) // 2], 2)
            if closing_positions
            else None,
            "설명": "위치는 0이 글 처음, 1이 글 끝이다",
        },
        "표현 출현율": [
            (e, c, pct(c, total)) for e, c in expressions.most_common()
        ],
        "부호 앞 공백": punctuation,
        "본문 이모지 상위": body_emoji.most_common(20),
        "첫 문단 이모지 상위": opening_emoji.most_common(20),
        "블록 구조": {
            "첫 블록": blocks_first.most_common(5),
            "마지막 블록": blocks_last.most_common(5),
            "첫 블록이 스티커": pct(blocks_first.get("sticker", 0), total),
            "마지막 블록이 스티커": pct(blocks_last.get("sticker", 0), total),
            "지도 블록 포함": {"글 수": has_map, "비율": pct(has_map, total)},
            "스티커 사용": {"글 수": has_sticker, "비율": pct(has_sticker, total)},
            "스티커 개수": dist([d.get("sticker_count", 0) for d in records]),
        },
        "영업시간": {
            "핀 이모지": {"글 수": pin_n, "비율": pin_p},
            "글자 표기": {"글 수": hours_n, "비율": hours_p, "설명": "OPEN, 영업시간, 정기휴무"},
        },
        "실용 정보": practical,
        "협찬": {
            "판정 낱말": list(SPONSOR_KINDS),
            "전체": {"글 수": len(sponsor_all), "비율": pct(len(sponsor_all), total)},
            "2025년 이후": {
                "글 수": len(sponsor_recent),
                "모수": len(recent),
                "비율": pct(len(sponsor_recent), len(recent)),
            },
            "유형별": sponsor_by_kind,
            "본문에 내돈내산": {"글 수": own_money_body, "비율": pct(own_money_body, total)},
        },
        "지역": regions,
        "제목 끝 낱말": title_tail.most_common(20),
        "인라인 해시태그": inline_tag.most_common(),
        "카테고리별 문체": {k: dict(v) for k, v in voices.items()},
    }


def by_category(records: list[dict]) -> dict:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for d in records:
        grouped[d["_category"]].append(d)

    out = {}
    for name, group in sorted(grouped.items(), key=lambda kv: -len(kv[1])):
        years = Counter(d["_year"] for d in group)
        tags = Counter(t for d in group for t in d.get("tags", []))
        n = len(group)
        out[name] = {
            "글 수": n,
            "연도별": sorted(years.items()),
            "마지막 글": max((d.get("resolvedDate", "") for d in group), default=""),
            "사진 중앙값": sorted(d.get("image_count", 0) for d in group)[n // 2],
            "본문 중앙값": sorted(d.get("char_count", 0) for d in group)[n // 2],
            "문체": dict(Counter(voice_of(d["_paras"]) for d in group)),
            "인라인 해시태그": sum(
                1 for d in group if sum(1 for p in d["_paras"] if p.startswith("#")) > 2
            ),
            "최근 제목": [d["_title"] for d in sorted(group, key=lambda x: x["logNo"], reverse=True)[:10]],
            "상위 태그": tags.most_common(15),
        }
    return out


def voice_timeline(records: list[dict], category: str) -> list:
    """평서체로 넘어간 시점을 보려면 연도가 아니라 글 순서로 봐야 한다."""
    group = sorted(
        (d for d in records if d["_category"] == category),
        key=lambda d: d.get("resolvedDate", ""),
    )
    return [(d.get("resolvedDate", ""), voice_of(d["_paras"])) for d in group]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--posts", default="data/posts")
    parser.add_argument("--out", default="data/persona-stats.json")
    args = parser.parse_args()

    records = load(Path(args.posts))
    result = {
        "전체": overall(records),
        "카테고리별": by_category(records),
        "포토로그 문체 흐름": voice_timeline(records, "포토로그"),
    }
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(records)}건 분석, {args.out} 저장")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
