#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("usage: resolve_freeform_study_pack.py <topics.json> <freeform-text>", file=sys.stderr)
    sys.exit(1)

topics_cfg = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
study_cfg = topics_cfg.get('study-pack', {})
maint_cfg = topics_cfg.get('study-pack-maintainer', {})
text = sys.argv[2].strip()
normalized = re.sub(r'\s+', ' ', text).strip().lower()
normalized = normalized.removeprefix('/study-pack').strip()

alias_map = {
    'jvm gc 튜닝 가이드': 'jvm-tuning',
    'jvm gc 튜닝': 'jvm-tuning',
    'redis cache-aside': 'redis-cache-aside',
    'redis 캐시 어사이드': 'redis-cache-aside',
    'innodb gap lock': 'gap-lock-next-key-lock',
    'gap lock': 'gap-lock-next-key-lock',
    'next key lock': 'gap-lock-next-key-lock',
    'innodb gap lock next key lock': 'gap-lock-next-key-lock',
    'spring 트랜잭션 전파 격리수준 after_commit requires_new': 'spring-transaction-propagation-isolation-after-commit',
}

if normalized in alias_map:
    topic = alias_map[normalized]
    print(json.dumps({
        'topic': topic,
        'mode': 'study-pack',
        'source': 'alias-map',
        'maintainer': topic in maint_cfg,
    }, ensure_ascii=False))
    sys.exit(0)

for key in maint_cfg:
    if normalized == key or normalized.replace(' ', '-') == key:
        print(json.dumps({
            'topic': key,
            'mode': 'study-pack',
            'source': 'maintainer-key',
            'maintainer': True,
        }, ensure_ascii=False))
        sys.exit(0)

for key in study_cfg:
    if normalized == key or normalized.replace(' ', '-') == key:
        print(json.dumps({
            'topic': key,
            'mode': 'study-pack',
            'source': 'study-key',
            'maintainer': False,
        }, ensure_ascii=False))
        sys.exit(0)

slug = re.sub(r'[^a-z0-9]+', '-', normalized).strip('-') or 'custom-study-pack'
print(json.dumps({
    'topic': slug,
    'mode': 'unresolved',
    'source': 'freeform',
    'maintainer': False,
    'requestedText': text,
}, ensure_ascii=False))
