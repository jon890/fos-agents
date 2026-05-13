#!/usr/bin/env python3
"""
Build a target file list for daily or baseline interview prep analysis.

Topic mode (--topic + --topic-map):
    Returns the exact files mapped to the given topic (3-5 files).
    New topics are added by editing config/topic-file-map.json only.

Fallback mode (no --topic):
    Returns all markdown files under INCLUDE_DIRS (original behavior).
    Used for baseline or ad-hoc runs.
"""
import argparse
import json
import sys
from pathlib import Path

INCLUDE_DIRS = ["database", "architecture", "java", "interview", "kafka"]
PRIORITY_FILES = ["interview/kakao-healthcare-carechat-ai-agent.md"]
EXCLUDE_PARTS = {".claude", ".git", "node_modules"}


def allowed(path: Path, root: Path) -> bool:
    rel = path.relative_to(root)
    parts = set(rel.parts)
    if parts & EXCLUDE_PARTS:
        return False
    if path.suffix.lower() != ".md":
        return False
    rel_str = rel.as_posix()
    if rel_str in PRIORITY_FILES:
        return True
    return any(rel_str.startswith(prefix + "/") for prefix in INCLUDE_DIRS)


def files_for_topic(topic: str, topic_map_path: Path, source_root: Path) -> list:
    topic_map = json.loads(topic_map_path.read_text(encoding="utf-8"))
    candidates = topic_map.get(topic, [])
    if not candidates:
        print(f"Warning: no files mapped for topic '{topic}'", file=sys.stderr)
        return []
    valid = []
    for f in candidates:
        if (source_root / f).exists():
            valid.append(f)
        else:
            print(f"Warning: mapped file not found, skipping: {f}", file=sys.stderr)
    return valid


def all_files_fallback(root: Path) -> list:
    files = []
    for p in root.rglob("*.md"):
        if allowed(p, root):
            files.append(p.relative_to(root).as_posix())
    return sorted(set(files), key=lambda x: (x not in PRIORITY_FILES, x))


def main():
    parser = argparse.ArgumentParser(
        description="Build target file list for interview prep analysis."
    )
    parser.add_argument("source_root", help="Root of fos-study repository")
    parser.add_argument("output_file", help="Path to write the file list")
    parser.add_argument(
        "--topic", default=None,
        help="Topic key from topic-file-map.json (e.g. jpa-n+1, redis-cache-aside)"
    )
    parser.add_argument(
        "--topic-map", default=None,
        help="Path to config/topic-file-map.json"
    )
    args = parser.parse_args()

    root = Path(args.source_root).resolve()
    out = Path(args.output_file).resolve()

    if args.topic and args.topic_map:
        files = files_for_topic(args.topic, Path(args.topic_map).resolve(), root)
        if not files:
            print("Warning: topic mapping empty, falling back to full scan", file=sys.stderr)
            files = all_files_fallback(root)
    else:
        files = all_files_fallback(root)

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(files) + "\n", encoding="utf-8")
    print(f"Wrote {len(files)} targets to {out}")


if __name__ == "__main__":
    main()
