#!/usr/bin/env python3
"""Resolve a question-bank topic key to shell export lines for run_now.sh."""
import json
import shlex
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("usage: resolve_question_bank_topic.py <config-json> <topic>", file=sys.stderr)
    sys.exit(1)

config_path = Path(sys.argv[1])
topic = sys.argv[2]
config = json.loads(config_path.read_text(encoding="utf-8"))
namespace = "question-bank"
ns_cfg = config.get(namespace, {})
entry = ns_cfg.get(topic)
if not entry:
    print(f"unknown question-bank topic: {topic}", file=sys.stderr)
    sys.exit(2)

exports = {
    "QUESTION_BANK_TOPIC": topic,
    "OUTPUT_REL_PATH": entry["outputPath"],
    "INPUT_FILES_JSON": json.dumps(entry["inputFiles"], ensure_ascii=False),
    "QUESTION_BANK_APPEND_PROMPT": entry.get("promptAppend", ""),
}
for key, value in exports.items():
    print(f"export {key}={shlex.quote(value)}")
