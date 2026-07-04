#!/usr/bin/env python3
"""YouTube learning digest candidate collector for stock-investment.

Cron pattern:
- script stdout empty => no candidates; the cron prompt returns an empty final
- script stdout non-empty => LLM receives transcript context and writes a higher-quality digest

The script can also generate a legacy extractive summary with --auto-summary for smoke tests.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import textwrap
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "config" / "youtube-learning-channels.json"
STATE_PATH = ROOT / "data" / "youtube-learning-digest" / "seen-videos.json"
OUT_DIR = ROOT / "data" / "youtube-learning-digest"
TRANSCRIPT_HELPER = Path("/opt/data/skills/media/youtube-content/scripts/fetch_transcript.py")
KST = ZoneInfo("Asia/Seoul")
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}

INCLUDE_TERMS = {
    "투자 원칙": 4, "원칙": 2, "리스크": 3, "위험": 2, "자산배분": 4,
    "포트폴리오": 4, "분산": 2, "금리": 3, "환율": 3, "물가": 3,
    "인플레이션": 3, "유동성": 3, "연준": 3, "채권": 3, "경기": 2,
    "밸류에이션": 4, "가치평가": 4, "사이클": 3, "하락장": 3, "조정": 2,
    "손실": 2, "심리": 3, "편향": 4, "행동경제": 4, "의사결정": 3,
    "검증": 2, "확률": 3, "기대수익": 3,
}
EXCLUDE_TERMS = {
    "무조건": 3, "몰빵": 5, "급등주": 4, "상한가": 4, "단타": 4,
    "지금 사": 5, "매수하세요": 5, "매도하세요": 5, "100%": 3,
    "비법": 2, "대박": 3, "인생역전": 4,
}
LEARNING_AXES = [
    ("행동경제학/투자심리", ["심리", "편향", "공포", "탐욕", "손실", "하락장", "행동경제"]),
    ("위험관리/포트폴리오", ["리스크", "위험", "포트폴리오", "자산배분", "분산", "손절", "비중"]),
    ("거시경제 구조", ["금리", "환율", "물가", "인플레이션", "연준", "채권", "유동성", "경기"]),
    ("시장 사이클/밸류에이션", ["사이클", "밸류에이션", "가치평가", "버블", "과열", "조정"]),
    ("투자 의사결정", ["의사결정", "원칙", "검증", "확률", "기대수익", "시나리오"]),
]

@dataclass
class Video:
    channel: str
    video_id: str
    title: str
    url: str
    published_utc: datetime


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch_url(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Hermes stock-youtube-learning-digest/2.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def fetch_feed(channel: dict) -> list[Video]:
    root = ET.fromstring(fetch_url(channel["feed_url"]))
    out: list[Video] = []
    for entry in root.findall("atom:entry", ATOM_NS):
        vid = entry.findtext("yt:videoId", default="", namespaces=ATOM_NS)
        title = entry.findtext("atom:title", default="", namespaces=ATOM_NS).strip()
        published = entry.findtext("atom:published", default="", namespaces=ATOM_NS)
        if not vid or not title or not published:
            continue
        out.append(Video(channel["name"], vid, title, f"https://www.youtube.com/watch?v={vid}", parse_dt(published)))
    return out


def fetch_transcript(video: Video) -> dict | None:
    if not TRANSCRIPT_HELPER.exists():
        return None
    cmd = [
        "uv", "run", "--with", "youtube-transcript-api", "python3",
        str(TRANSCRIPT_HELPER), video.url, "--timestamps", "--language", "ko,en",
    ]
    proc = subprocess.run(cmd, cwd=str(ROOT), text=True, capture_output=True, timeout=180)
    if proc.returncode != 0 or not proc.stdout.strip():
        return None
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None


def normalize_text(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def split_sentences(text: str) -> list[str]:
    text = normalize_text(text)
    parts = re.split(r"(?<=[.!?。！？])\s+|(?<=죠)\s+|(?<=니다)\s+|(?<=어요)\s+|(?<=예요)\s+", text)
    cleaned = [p.strip() for p in parts if 25 <= len(p.strip()) <= 220]
    if len(cleaned) < 8:
        cleaned = [c.strip() for c in textwrap.wrap(text, width=120, break_long_words=False, replace_whitespace=False) if len(c.strip()) >= 25]
    return cleaned


def score_text(title: str, transcript: str) -> tuple[int, list[str], list[str]]:
    blob = f"{title}\n{transcript[:12000]}"
    include_hits: list[str] = []
    exclude_hits: list[str] = []
    score = 0
    for term, weight in INCLUDE_TERMS.items():
        count = blob.count(term)
        if count:
            score += min(count, 5) * weight
            include_hits.append(term)
    for term, weight in EXCLUDE_TERMS.items():
        count = blob.count(term)
        if count:
            score -= min(count, 3) * weight
            exclude_hits.append(term)
    if any(x in blob for x in ["왜", "이유", "원리", "구조", "기준", "방법"]):
        score += 4
    return score, sorted(set(include_hits)), sorted(set(exclude_hits))


def detect_axes(text: str) -> list[str]:
    axes = [axis for axis, terms in LEARNING_AXES if any(t in text for t in terms)]
    return axes[:3] or ["투자 일반론"]


def pick_sentences(transcript: str, limit: int = 5) -> list[str]:
    sentences = split_sentences(transcript)
    if not sentences:
        return []
    ranked = []
    for idx, sent in enumerate(sentences):
        score = 0
        for term, weight in Counter(INCLUDE_TERMS).items():
            if term in sent:
                score += weight
        if any(x in sent for x in ["중요", "핵심", "결국", "그래서", "즉", "반면", "주의", "기준"]):
            score += 2
        score -= idx / max(len(sentences), 1)
        ranked.append((score, idx, sent))
    selected = sorted([r for r in ranked if r[0] > 0], reverse=True)[:limit]
    if len(selected) < limit:
        selected += ranked[: limit - len(selected)]
    selected = sorted({idx: sent for _, idx, sent in selected}.items())
    return [sent for _, sent in selected[:limit]]


def build_candidates(config: dict, state: dict, *, lookback_hours: int, max_videos: int, ignore_seen: bool) -> tuple[list[dict], list[dict]]:
    seen = state.setdefault("seen", {})
    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
    feed_candidates: list[Video] = []
    run_meta: list[dict] = []

    for channel in config.get("channels", []):
        if not channel.get("enabled", True):
            continue
        try:
            for video in fetch_feed(channel):
                if video.published_utc < cutoff:
                    continue
                if not ignore_seen and video.video_id in seen:
                    continue
                feed_candidates.append(video)
        except Exception as e:
            print(f"[stock-youtube-learning-digest] feed fetch failed: {channel.get('name')}: {e}", file=sys.stderr)

    feed_candidates.sort(key=lambda v: v.published_utc, reverse=True)
    feed_candidates = feed_candidates[:max_videos]

    candidates: list[dict] = []
    for video in feed_candidates:
        meta: dict[str, object] = {
            "channel": video.channel,
            "video_id": video.video_id,
            "title": video.title,
            "url": video.url,
            "published_utc": video.published_utc.isoformat(),
            "published_kst": video.published_utc.astimezone(KST).strftime("%Y-%m-%d %H:%M KST"),
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
        transcript = fetch_transcript(video)
        if not transcript:
            meta.update({"status": "skipped", "reason": "transcript_unavailable"})
            run_meta.append(meta)
            if not ignore_seen:
                seen[video.video_id] = meta
            continue

        full_text = normalize_text(transcript.get("full_text", ""))
        if len(full_text) < 500:
            meta.update({"status": "skipped", "reason": "transcript_too_short"})
            run_meta.append(meta)
            if not ignore_seen:
                seen[video.video_id] = meta
            continue

        score, include_hits, exclude_hits = score_text(video.title, full_text)
        axes = detect_axes(f"{video.title}\n{full_text[:10000]}")
        if score < 8:
            meta.update({"status": "skipped", "reason": "low_learning_score", "score": score, "axes": axes})
            run_meta.append(meta)
            if not ignore_seen:
                seen[video.video_id] = meta
            continue

        item = {
            **meta,
            "status": "queued_for_llm",
            "score": score,
            "axes": axes,
            "include_hits": include_hits[:12],
            "exclude_hits": exclude_hits[:8],
            "duration": transcript.get("duration") or "확인 불가",
            "extractive_hints": pick_sentences(full_text, limit=5),
            # Keep enough transcript for LLM quality while staying within cron context limits.
            "transcript_excerpt": full_text[:18000],
        }
        candidates.append(item)
        run_meta.append({k: v for k, v in item.items() if k not in {"transcript_excerpt", "extractive_hints"}})
        if not ignore_seen:
            seen[video.video_id] = {k: v for k, v in item.items() if k not in {"transcript_excerpt", "extractive_hints"}}

    return candidates, run_meta


def render_agent_context(candidates: list[dict]) -> str:
    if not candidates:
        return ""
    checked = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")
    payload = {
        "task": "stock_youtube_learning_digest_llm_summary",
        "checked_at_kst": checked,
        "output_path": str(OUT_DIR / f"{datetime.now(KST).strftime('%Y-%m-%d')}-llm.md"),
        "policy": {
            "language": "ko-KR",
            "audience": "주식·경제 일반론을 공부하는 개인 투자자",
            "not_financial_advice": True,
            "exclude_if_not_learning_value": "이미 후보 필터를 통과했지만, LLM 판단에서 학습 가치가 낮으면 제외 가능",
            "format": "영상별 링크, 학습 가치, 주제, 핵심 요약 3~5개, 배울 점 2개, 주의 1개",
        },
        "candidates": candidates,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def render_auto_summary(candidates: list[dict]) -> str:
    if not candidates:
        return ""
    checked = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")
    sections = []
    for item in candidates:
        learning_value = "높음" if item["score"] >= 20 else "보통"
        bullets = "\n".join(f"- {s}" for s in item.get("extractive_hints", [])[:4])
        why = ", ".join(item.get("include_hits", [])[:6]) or "일반 투자 원칙"
        caution = "특정 매수·매도 지시가 아니라 개인 학습용 관찰 자료로만 보는 게 안전합니다."
        if item.get("exclude_hits"):
            caution += f" 단, 과장 가능 단어({', '.join(item['exclude_hits'][:3])})가 있어 보수적으로 해석하세요."
        sections.append(f"""### {item['channel']} — {item['title']}
링크: {item['url']}
업로드: {item['published_kst']} / 길이: {item['duration']}
학습 가치: {learning_value}
주제: {', '.join(item['axes'])}

핵심 요약:
{bullets}

배울 점:
- 이 영상은 `{why}` 관점에서 투자 판단의 기준을 점검하는 데 쓸 수 있습니다.
- 가격 예측보다 의사결정 기준, 리스크, 시장 구조를 분리해서 보는 연습 자료로 적합합니다.

주의:
- {caution}""")
    return f"""## 오늘의 주식·경제 학습 영상

기준시각: {checked}

{"\n\n---\n\n".join(sections)}

※ 자동 자막 기반 요약입니다. 투자 조언이 아니라 주식·경제 일반론 학습용 메모로만 봐주세요.
""".strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=str(CONFIG_PATH))
    ap.add_argument("--state", default=str(STATE_PATH))
    ap.add_argument("--lookback-hours", type=int, default=None)
    ap.add_argument("--ignore-seen", action="store_true", help="검증용: seen 상태와 무관하게 후보를 처리하되 state는 갱신하지 않음")
    ap.add_argument("--max-videos", type=int, default=None)
    ap.add_argument("--agent-context", action="store_true", help="LLM 요약용 후보 JSON을 출력한다. 후보가 없으면 빈 stdout.")
    ap.add_argument("--auto-summary", action="store_true", help="LLM 없이 추출식 요약을 출력한다. smoke test용.")
    args = ap.parse_args()

    config = load_json(Path(args.config), {})
    state_path = Path(args.state)
    state = load_json(state_path, {"version": 1, "seen": {}})
    lookback_hours = args.lookback_hours or int(config.get("default_lookback_hours", 72))
    max_videos = args.max_videos or int(config.get("max_videos_per_run", 4))

    candidates, run_meta = build_candidates(config, state, lookback_hours=lookback_hours, max_videos=max_videos, ignore_seen=args.ignore_seen)

    if not args.ignore_seen and run_meta:
        state["updated_at"] = datetime.now(timezone.utc).isoformat()
        save_json(state_path, state)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.now(KST).strftime("%Y-%m-%d")
    if run_meta:
        (OUT_DIR / f"{today}-run.json").write_text(json.dumps(run_meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.auto_summary:
        output = render_auto_summary(candidates)
        if output:
            (OUT_DIR / f"{today}.md").write_text(output + "\n", encoding="utf-8")
            print(output)
        return 0

    output = render_agent_context(candidates)
    if output:
        # Save the exact LLM input for audit/debugging, but do not include it in Discord.
        (OUT_DIR / f"{today}-llm-input.json").write_text(output + "\n", encoding="utf-8")
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
