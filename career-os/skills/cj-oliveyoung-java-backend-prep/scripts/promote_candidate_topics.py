#!/usr/bin/env python3
"""Candidate를 primary curated config로 승격하는 도구.

usage:
  promote_candidate_topics.py study <key> [--dry-run]
  promote_candidate_topics.py live-coding <slug> [--dry-run]

ADR-009/010 후속 동작:
- study mode: config/topics.json의 study-pack-candidates namespace에서 key를 찾아 promotionTarget을
  study-pack namespace에 key로 추가. 동일 key가 primary에 이미 있으면 abort.
- live-coding mode: live-coding-seed-candidates.json에서 slug를 찾아 그대로
  live-coding-seed-pool.json의 seeds 배열에 append. 동일 slug가 이미 primary에
  있으면 abort.
- 성공 시 candidate 파일에서 해당 항목을 제거 (중복 추천/promotion 방지).
- --dry-run: 변경 없이 시뮬레이션만 출력.
"""
import argparse
import json
from pathlib import Path

TASK_ROOT = Path.home() / "ai-nodes" / "career-os"
CONFIG = TASK_ROOT / "config"


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def promote_study(target: str, dry_run: bool) -> None:
    topics_path = CONFIG / "topics.json"
    topics_data = json.loads(topics_path.read_text(encoding="utf-8"))
    main_cfg = topics_data["study-pack"]
    candidates_doc = topics_data["study-pack-candidates"]
    candidates = candidates_doc.get("topics", [])

    idx = next((i for i, c in enumerate(candidates) if c.get("key") == target), None)
    if idx is None:
        raise SystemExit(f"study candidate not found: {target}")

    item = candidates[idx]
    promotion = item.get("promotionTarget")
    if not promotion:
        raise SystemExit(f"candidate has no promotionTarget: {target}")
    if target in main_cfg:
        raise SystemExit(f"primary study-pack already has key: {target}")

    if dry_run:
        print(f"[dry-run] would promote study candidate: {target}")
        print(f"[dry-run]   into key      : {target}")
        print(f"[dry-run]   outputPath    : {promotion.get('outputPath')}")
        print(f"[dry-run]   commitTopic   : {promotion.get('commitTopic')}")
        print(f"[dry-run]   would also remove candidate entry at index {idx}")
        return

    main_cfg[target] = promotion
    candidates.pop(idx)
    candidates_doc["topics"] = candidates
    write_json(topics_path, topics_data)

    print(f"promoted study candidate: {target}")


def promote_live_coding(slug: str, dry_run: bool) -> None:
    candidates_path = CONFIG / "live-coding-seed-candidates.json"
    main_path = CONFIG / "live-coding-seed-pool.json"
    candidates_doc = json.loads(candidates_path.read_text(encoding="utf-8"))
    candidates = candidates_doc.get("seeds", [])
    main_cfg = json.loads(main_path.read_text(encoding="utf-8"))

    idx = next((i for i, c in enumerate(candidates) if c.get("slug") == slug), None)
    if idx is None:
        raise SystemExit(f"live-coding candidate not found: {slug}")

    if any(seed.get("slug") == slug for seed in main_cfg.get("seeds", [])):
        raise SystemExit(f"live-coding seed already exists in primary pool: {slug}")

    item = candidates[idx]

    if dry_run:
        print(f"[dry-run] would promote live-coding candidate: {slug}")
        print(f"[dry-run]   slug         : {item.get('slug')}")
        print(f"[dry-run]   outputPath   : {item.get('outputPath')}")
        print(f"[dry-run]   would also remove candidate entry at index {idx}")
        return

    main_cfg.setdefault("seeds", []).append(item)
    write_json(main_path, main_cfg)

    candidates.pop(idx)
    candidates_doc["seeds"] = candidates
    write_json(candidates_path, candidates_doc)

    print(f"promoted live-coding candidate: {slug}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("mode", choices=["study", "live-coding"])
    parser.add_argument("target", help="study mode: candidate key / live-coding mode: candidate slug")
    parser.add_argument("--dry-run", action="store_true", help="변경 없이 시뮬레이션만 출력")
    args = parser.parse_args()

    if args.mode == "study":
        promote_study(args.target, args.dry_run)
    else:
        promote_live_coding(args.target, args.dry_run)


if __name__ == "__main__":
    main()
