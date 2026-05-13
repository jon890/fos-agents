#!/usr/bin/env python3
import json
import shlex
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("usage: resolve_maintainer_topic.py <config-json> <topic>", file=sys.stderr)
    sys.exit(1)

config = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
topic = sys.argv[2]
namespace = "study-pack-maintainer"
ns_cfg = config.get(namespace, {})
entry = ns_cfg.get(topic)
if not entry:
    print(f"unknown topic: {topic}", file=sys.stderr)
    sys.exit(2)

exports = {
    "MAINTAINER_TOPIC": topic,
    "REQUESTED_TOPIC": entry["requestedTopic"],
    "CANDIDATE_FILES_JSON": json.dumps(entry.get("candidateFiles", []), ensure_ascii=False),
    "PREFERRED_DOMAIN": entry.get("preferredDomain", "interview"),
}

for key, value in exports.items():
    print(f"export {key}={shlex.quote(value)}")
