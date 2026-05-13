#!/usr/bin/env python3
"""Resolve a study-pack topic key to shell export lines for run_now.sh."""
import json
import shlex
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("usage: resolve_study_pack_topic.py <config-json> <topic>", file=sys.stderr)
    sys.exit(1)

config_path = Path(sys.argv[1])
topic = sys.argv[2]
config = json.loads(config_path.read_text(encoding="utf-8"))
namespace = "study-pack"
ns_cfg = config.get(namespace, {})
entry = ns_cfg.get(topic)
if not entry:
    print(f"unknown topic: {topic}", file=sys.stderr)
    sys.exit(2)

exports = {
    "STUDY_TOPIC": topic,
    "STUDY_DOMAIN": entry["domain"],
    "OUTPUT_REL_PATH": entry["outputPath"],
    "COMMIT_TOPIC": entry.get("commitTopic", topic),
    "STUDY_APPEND_PROMPT": entry.get("appendPrompt", entry.get("promptAppend", "")),
}
for key, value in exports.items():
    print(f"export {key}={shlex.quote(value)}")
