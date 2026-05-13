#!/usr/bin/env python3
"""morning topic recommendation pipeline.

ADR-009: reservoir-based, file-backed.
ADR-010: score-based backend selection with mix targets.
ADR-012: 10-item daily curation (backend 3 / tech-blog 3 / AI 3 / geek 1) + today pick 3.
ADR-013: secondary 카테고리에 RSS/Atom discovery로 실제 최신 글 1편을 부착.
"""
import json
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from feed_discovery import discover_for_item  # noqa: E402

TASK_ROOT = Path.home() / 'ai-nodes' / 'career-os'
CONFIG = TASK_ROOT / 'config'
RUNTIME = TASK_ROOT / 'data' / 'runtime'
RUNTIME.mkdir(parents=True, exist_ok=True)
HISTORY_PATH = RUNTIME / 'topic-inventory-history.jsonl'
FEED_CACHE_DIR = RUNTIME / 'feed-cache'
FEED_CACHE_TTL = timedelta(hours=6)
FEED_TIMEOUT_SECONDS = 8
RECENT_ARTICLE_URL_LOOKBACK = 7  # 최근 N개 history entry의 article URL은 회피

# ADR-010: backend 추천 점수 기반 + mix target (3-item version per ADR-012)
BACKEND_TARGET_TOTAL = 3
BACKEND_MIX_TARGET = {'new': 1, 'deepen': 1, 'live-coding': 1}
WEAK_AREAS = {'ai-agent', 'llm-serving', 'rag', 'python', 'security', 'observability'}
# Weak areas still matter, but they should not dominate the daily list.
# The user is now targeting Kakao Healthcare CareChat; keep recommendations broad but prioritize AI Agent/service-readiness topics.
WEAK_AREA_BONUS = 1
RECENT_PENALTY_PER = 3
CARRYOVER_PENALTY = 2
# Strongly suppress topics already shown in recent recommendation history.
# Domain diversity alone is not enough: otherwise the same top item per domain repeats for a week.
RECENT_KEY_PENALTY_PER = 8
BACKEND_KEY_COOLDOWN_ENTRIES = 7
TAG_PRIORITY = {'new': 0, 'deepen': -1, 'review': -2, 'live-coding': 0}

# ADR-012: 보조 카테고리 슬롯
TECH_BLOG_SLOTS = 3
AI_SLOTS = 3
GEEK_SLOTS = 1
# 최근 N개 history entry 안에 있던 key는 가급적 회피 (cooldown)
SECONDARY_COOLDOWN_ENTRIES = 3


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def load_recent_history(max_entries: int):
    """최근 max_entries개의 history line을 dict 형태로 반환."""
    if not HISTORY_PATH.exists():
        return []
    entries = []
    try:
        with HISTORY_PATH.open(encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except OSError:
        return []
    return entries[-max_entries:]


def load_yesterday_keys():
    recent = load_recent_history(1)
    if not recent:
        return set()
    return set(recent[-1].get('keys', []))


def collect_recent_keys(entries, field):
    keys = set()
    for entry in entries:
        for key in entry.get(field, []) or []:
            keys.add(key)
    return keys


def append_history(payload):
    entry = {'generatedAt': datetime.now(timezone.utc).isoformat(), **payload}
    with HISTORY_PATH.open('a', encoding='utf-8') as f:
        f.write(json.dumps(entry, ensure_ascii=False) + '\n')


def safe_load(path: Path, fallback):
    if not path.exists():
        return fallback
    try:
        return read_json(path)
    except json.JSONDecodeError:
        return fallback


_topics_cfg = read_json(CONFIG / 'topics.json')
study_topics = _topics_cfg['study-pack']
study_candidates = _topics_cfg.get('study-pack-candidates', {}).get('topics', [])
live_seeds = read_json(CONFIG / 'live-coding-seed-pool.json').get('seeds', [])
live_seed_candidates = read_json(CONFIG / 'live-coding-seed-candidates.json').get('seeds', [])
artifacts = read_json(TASK_ROOT / 'data' / 'generated-artifacts.json').get('artifacts', [])

_sources = safe_load(CONFIG / 'sources.json', {})
tech_blog_items = _sources.get('techBlog', {}).get('items', [])
ai_topic_items  = _sources.get('ai', {}).get('items', [])
geek_news_items = _sources.get('geek', {}).get('items', [])

study_paths = {a.get('outputPath') for a in artifacts if a.get('kind') == 'study-pack'}
live_paths = {a.get('outputPath') for a in artifacts if a.get('kind') == 'live-coding'}

uncovered_curated = []
for key, entry in study_topics.items():
    if entry.get('outputPath') not in study_paths:
        uncovered_curated.append({
            'key': key,
            'title': key,
            'domain': entry.get('domain', 'unknown'),
            'outputPath': entry.get('outputPath'),
            'source': 'curated',
            'tag': 'new',
        })

remaining_live = [seed for seed in live_seeds if seed.get('outputPath') not in live_paths]
remaining_live_candidates = [seed for seed in live_seed_candidates if seed.get('outputPath') not in live_paths]

recent_study_artifacts = []
for artifact in artifacts:
    if artifact.get('kind') != 'study-pack':
        continue
    try:
        ts = datetime.fromisoformat(artifact.get('updatedAt', artifact.get('createdAt')))
    except Exception:
        ts = datetime(1970, 1, 1, tzinfo=timezone.utc)
    recent_study_artifacts.append((ts, artifact))
recent_study_artifacts.sort(key=lambda x: x[0], reverse=True)

recent_domains = []
for _, artifact in recent_study_artifacts[:10]:
    path = artifact.get('outputPath', '')
    if path.startswith('database/mysql/'):
        recent_domains.append('mysql')
    elif path.startswith('database/redis/'):
        recent_domains.append('redis')
    elif path.startswith('java/spring/'):
        recent_domains.append('spring')
    elif path.startswith('java/'):
        recent_domains.append('java')
    elif path.startswith('architecture/'):
        recent_domains.append('architecture')
    elif path.startswith('search/'):
        recent_domains.append('search')
    elif path.startswith('kafka/') or path.startswith('rabbitmq/'):
        recent_domains.append('message-queue')
    elif path.startswith('interview/'):
        recent_domains.append('interview')
    else:
        recent_domains.append('other')
recent_domain_counts = Counter(recent_domains)

candidate_recommendations = []
for item in study_candidates:
    promoted_path = item.get('promotionTarget', {}).get('outputPath')
    if promoted_path and promoted_path in study_paths:
        continue
    candidate_recommendations.append(item)


def backend_domain_group(domain):
    """Collapse adjacent domains for visible diversity in a 3-item daily set."""
    if domain in {'database', 'mysql', 'postgresql'}:
        return 'database'
    if domain in {'redis', 'cache'}:
        return 'cache'
    if domain in {'kafka', 'rabbitmq', 'sqs', 'message-queue'}:
        return 'message-queue'
    if domain in {'spring', 'java', 'security'}:
        return 'java-spring'
    return domain or 'unknown'


def pick_backend_recommendations(yesterday_keys):
    """ADR-010 점수 기반 + ADR-012 3-item mix target."""
    pool = [dict(item) for item in candidate_recommendations]

    live_item_source = remaining_live[:3] or remaining_live_candidates[:3]
    for seed in live_item_source:
        pool.append({
            'key': f"live-coding-{seed['slug']}",
            'title': f"라이브코딩 — {seed['title']}",
            'domain': 'live-coding',
            'tag': 'live-coding',
            'difficulty': seed.get('difficulty', '중'),
            'estMinutes': 40,
            'whyNow': [
                '1차 면접 live-coding 축을 유지하기 좋다',
                '주제 풀이와 설명 연습을 같이 할 수 있다',
            ],
        })

    for item in pool:
        key = item.get('key')
        domain = item.get('domain', '')
        tag = item.get('tag', 'new')
        score = -RECENT_PENALTY_PER * recent_domain_counts.get(domain, 0)
        score -= RECENT_KEY_PENALTY_PER * recent_backend_key_counts.get(key, 0)
        if domain in WEAK_AREAS:
            score += WEAK_AREA_BONUS
        score += TAG_PRIORITY.get(tag, -3)
        if item.get('key') in yesterday_keys:
            score -= CARRYOVER_PENALTY
        item['_score'] = score

    pool.sort(key=lambda x: -x['_score'])

    chosen = []
    used_tags = Counter()
    chosen_keys = set()
    used_domains = set()

    # First pass: satisfy the tag mix while avoiding repeated backend domain groups
    # and recently shown exact keys. This keeps the daily backend set from feeling
    # like only the top DB/Spring/architecture card every morning.
    for item in pool:
        key = item.get('key')
        tag = item.get('tag', 'new')
        domain = backend_domain_group(item.get('domain', ''))
        if recent_backend_key_counts.get(key, 0):
            continue
        if domain in used_domains:
            continue
        if used_tags[tag] < BACKEND_MIX_TARGET.get(tag, 0):
            chosen.append(item)
            chosen_keys.add(item.get('key'))
            used_domains.add(domain)
            used_tags[tag] += 1
            if len(chosen) >= BACKEND_TARGET_TOTAL:
                break

    # Second pass: if one mix slot is impossible, still prefer a fresh domain and non-recent key.
    if len(chosen) < BACKEND_TARGET_TOTAL:
        for item in pool:
            key = item.get('key')
            domain = backend_domain_group(item.get('domain', ''))
            if key in chosen_keys or domain in used_domains or recent_backend_key_counts.get(key, 0):
                continue
            chosen.append(item)
            chosen_keys.add(key)
            used_domains.add(domain)
            if len(chosen) >= BACKEND_TARGET_TOTAL:
                break

    # Final fallback: only repeat domains when the reservoir is genuinely narrow.
    if len(chosen) < BACKEND_TARGET_TOTAL:
        for item in pool:
            key = item.get('key')
            if key in chosen_keys:
                continue
            chosen.append(item)
            chosen_keys.add(key)
            if len(chosen) >= BACKEND_TARGET_TOTAL:
                break

    return chosen[:BACKEND_TARGET_TOTAL]


def pick_secondary(items, recently_shown_keys, limit):
    """비-backend 카테고리(tech-blog / AI / geek) 추천 선택.

    1차: cooldown(최근 history N개) 안에 없는 항목을 reservoir 순서대로 선택.
    2차: 부족하면 recently_shown 포함해서라도 채움.
    reservoir 순서는 사람이 큐레이션한 우선도이므로 추가 정렬을 하지 않는다.
    """
    if not items:
        return []
    fresh = [item for item in items if item.get('key') not in recently_shown_keys]
    chosen = list(fresh[:limit])
    if len(chosen) >= limit:
        return chosen
    chosen_keys = {item.get('key') for item in chosen}
    for item in items:
        if item.get('key') in chosen_keys:
            continue
        chosen.append(item)
        chosen_keys.add(item.get('key'))
        if len(chosen) >= limit:
            break
    return chosen[:limit]


recent_history = load_recent_history(SECONDARY_COOLDOWN_ENTRIES)
backend_key_history = load_recent_history(BACKEND_KEY_COOLDOWN_ENTRIES)
recent_backend_key_counts = Counter(
    key
    for entry in backend_key_history
    for key in (entry.get('keys', []) or [])
)
yesterday_keys = load_yesterday_keys()
recent_tech_blog_keys = collect_recent_keys(recent_history, 'techBlogKeys')
recent_ai_keys = collect_recent_keys(recent_history, 'aiKeys')
recent_geek_keys = collect_recent_keys(recent_history, 'geekKeys')

# 최근 추천된 article URL을 모아 두면 동일 글이 며칠 연속 노출되는 것을 막을 수 있다.
# discoverHistory[*].articleUrls 필드를 누적해서 사용.
article_url_history = load_recent_history(RECENT_ARTICLE_URL_LOOKBACK)
recent_article_urls = set()
for entry in article_url_history:
    for url in entry.get('articleUrls', []) or []:
        if url:
            recent_article_urls.add(url)

backend_recommendations = pick_backend_recommendations(yesterday_keys)
ai_recommendations = pick_secondary(ai_topic_items, recent_ai_keys, AI_SLOTS)
geek_recommendations = pick_secondary(geek_news_items, recent_geek_keys, GEEK_SLOTS)


def attach_discovered_articles(items, exclude_urls):
    """ADR-013: feedUrl이 있는 reservoir 항목에 최신 글을 부착.

    실패 항목은 조용히 reservoir 원본 그대로 둔다. 새로 선택된 URL은
    exclude_urls 셋에 누적해 같은 morning 안에서 중복 추천을 방지한다.
    """
    discovery_log = []
    for item in items:
        feed_url = item.get('feedUrl')
        if not feed_url:
            discovery_log.append({'key': item.get('key'), 'status': 'no-feed'})
            continue
        article = discover_for_item(
            item,
            cache_dir=FEED_CACHE_DIR,
            exclude_urls=exclude_urls,
            ttl=FEED_CACHE_TTL,
            timeout=FEED_TIMEOUT_SECONDS,
        )
        if not article:
            discovery_log.append({'key': item.get('key'), 'status': 'no-match', 'feedUrl': feed_url})
            continue
        item['discoveredArticle'] = {
            'title': article.get('title') or item.get('title', ''),
            'url': article.get('link') or '',
            'published': article.get('published') or '',
        }
        if item['discoveredArticle']['url']:
            exclude_urls.add(item['discoveredArticle']['url'])
        discovery_log.append({
            'key': item.get('key'),
            'status': 'ok',
            'feedUrl': feed_url,
            'articleUrl': item['discoveredArticle']['url'],
        })
    return discovery_log


def pick_tech_blog_articles(items, recently_shown_keys, limit, exclude_urls):
    """Pick tech-blog recommendations that resolve to concrete article URLs.

    Company blog cards are only useful when they point to a real post. Unlike AI/geek
    secondary cards, do not show vague source-level fallback cards for tech blogs.
    """
    discovery_log = []
    chosen = []
    ordered = [item for item in items if item.get('key') not in recently_shown_keys]
    ordered.extend(item for item in items if item.get('key') in recently_shown_keys)
    seen_keys = set()
    for raw_item in ordered:
        key = raw_item.get('key')
        if key in seen_keys:
            continue
        seen_keys.add(key)
        item = dict(raw_item)
        item_log = attach_discovered_articles([item], exclude_urls)
        discovery_log.extend(item_log)
        if item.get('discoveredArticle', {}).get('url'):
            chosen.append(item)
        if len(chosen) >= limit:
            break
    return chosen, discovery_log


discovery_exclude = set(recent_article_urls)
tech_blog_recommendations, tech_blog_discovery_log = pick_tech_blog_articles(
    tech_blog_items,
    recent_tech_blog_keys,
    TECH_BLOG_SLOTS,
    discovery_exclude,
)
discovery_log = list(tech_blog_discovery_log)
for group in (ai_recommendations, geek_recommendations):
    discovery_log.extend(attach_discovered_articles(group, discovery_exclude))


def first_or_none(items):
    return items[0] if items else None


today_pick = {
    'backend': first_or_none(backend_recommendations),
    'techBlog': first_or_none(tech_blog_recommendations),
    'ai': first_or_none(ai_recommendations),
}

inventory = {
    'generatedAt': datetime.now(timezone.utc).isoformat(),
    'counts': {
        'curatedStudyTopics': len(study_topics),
        'uncoveredCuratedStudyTopics': len(uncovered_curated),
        'studyTopicCandidates': len(candidate_recommendations),
        'liveCodingPrimarySeeds': len(live_seeds),
        'liveCodingRemainingPrimarySeeds': len(remaining_live),
        'liveCodingCandidateSeeds': len(live_seed_candidates),
        'liveCodingRemainingCandidateSeeds': len(remaining_live_candidates),
        'techBlogReservoir': len(tech_blog_items),
        'aiReservoir': len(ai_topic_items),
        'geekReservoir': len(geek_news_items),
    },
    'recentDomainCounts': dict(recent_domain_counts),
    'pools': {
        'uncoveredCuratedStudyTopics': uncovered_curated,
        'candidateStudyTopics': candidate_recommendations,
        'remainingLiveCodingSeeds': remaining_live,
        'remainingLiveCodingCandidateSeeds': remaining_live_candidates,
    },
    'recommendations': backend_recommendations,
    'techBlogRecommendations': tech_blog_recommendations,
    'aiRecommendations': ai_recommendations,
    'geekRecommendations': geek_recommendations,
    'todayPick': today_pick,
    'discovery': {
        'cacheDir': str(FEED_CACHE_DIR),
        'cacheTtlHours': FEED_CACHE_TTL.total_seconds() / 3600,
        'log': discovery_log,
    },
}

(RUNTIME / 'topic-inventory.json').write_text(
    json.dumps(inventory, ensure_ascii=False, indent=2) + '\n',
    encoding='utf-8',
)


def render_backend_item(idx, item):
    tag_label = {
        'new': '신규',
        'deepen': '심화',
        'review': '복습',
        'live-coding': 'live-coding',
    }.get(item.get('tag', 'new'), item.get('tag', 'new'))
    out = [
        f"{idx}. **{tag_label} 추천 — {item['title']}**",
        f"   - 분야: {item.get('domain', 'unknown')}",
        f"   - 난이도: {item.get('difficulty', '중')}",
        f"   - 예상 학습 시간: {item.get('estMinutes', 45)}분",
        '   - 왜 지금 추천하는지',
    ]
    for reason in item.get('whyNow', []):
        out.append(f"     - {reason}")
    return out


def render_secondary_item(idx, item, source_field, source_label='출처'):
    source = item.get(source_field) or item.get('source') or item.get('category', '')
    article = item.get('discoveredArticle')
    if article and article.get('url'):
        # ADR-013: 실 글 제목/URL을 1순위로 노출하고, 원본 reservoir 카드는 fallback 컨텍스트로만 둔다.
        title = article.get('title') or item.get('title') or item.get('key', '제목 없음')
        out = [f"{idx}. **{title}**"]
        if source:
            out.append(f"   - {source_label}: {source}")
        out.append(f"   - 링크: {article['url']}")
        if article.get('published'):
            out.append(f"   - 게시: {article['published']}")
        if item.get('tags'):
            out.append(f"   - 태그: {', '.join(item['tags'])}")
        if item.get('estMinutes'):
            out.append(f"   - 예상 시간: {item['estMinutes']}분")
        if item.get('whyNow'):
            out.append('   - 왜 지금 보면 좋은지')
            for reason in item['whyNow']:
                out.append(f"     - {reason}")
        return out

    out = [f"{idx}. **{item['title']}**"]
    if source:
        out.append(f"   - {source_label}: {source}")
    if item.get('url'):
        out.append(f"   - 링크: {item['url']}")
    if item.get('feedUrl'):
        out.append(f"   - (피드 fetch 실패 또는 매칭 글 없음 — reservoir 카드로 표시)")
    if item.get('tags'):
        out.append(f"   - 태그: {', '.join(item['tags'])}")
    if item.get('estMinutes'):
        out.append(f"   - 예상 시간: {item['estMinutes']}분")
    if item.get('whyNow'):
        out.append('   - 왜 지금 보면 좋은지')
        for reason in item['whyNow']:
            out.append(f"     - {reason}")
    return out


lines = ['# 오늘의 학습/리딩 추천 (10픽 + 오늘의 3선)', '']

lines.append('## 백엔드 스터디 주제 (3)')
lines.append('')
if backend_recommendations:
    for idx, item in enumerate(backend_recommendations, start=1):
        lines.extend(render_backend_item(idx, item))
        lines.append('')
else:
    lines.append('- (reservoir 비어 있음 — `run_now.sh replenish-topics` 필요)')
    lines.append('')

lines.append('## 회사·엔지니어링 기술 블로그 (3)')
lines.append('')
if tech_blog_recommendations:
    for idx, item in enumerate(tech_blog_recommendations, start=1):
        lines.extend(render_secondary_item(idx, item, 'source'))
        lines.append('')
else:
    lines.append('- (`config/sources.json` techBlog 비어 있음)')
    lines.append('')

lines.append('## AI 관련 (3)')
lines.append('')
if ai_recommendations:
    for idx, item in enumerate(ai_recommendations, start=1):
        lines.extend(render_secondary_item(idx, item, 'category', source_label='분야'))
        lines.append('')
else:
    lines.append('- (`config/sources.json` ai 비어 있음)')
    lines.append('')

lines.append('## Geek/뉴스/산업 흐름 (1)')
lines.append('')
if geek_recommendations:
    for idx, item in enumerate(geek_recommendations, start=1):
        lines.extend(render_secondary_item(idx, item, 'source'))
        lines.append('')
else:
    lines.append('- (`config/sources.json` geek 비어 있음)')
    lines.append('')

lines.append('## 오늘의 3선 (각 카테고리에서 1개씩)')
lines.append('')
pick_labels = [
    ('백엔드', today_pick['backend']),
    ('기술 블로그', today_pick['techBlog']),
    ('AI', today_pick['ai']),
]
for label, pick in pick_labels:
    if not pick:
        lines.append(f"- {label}: (없음)")
        continue
    article = pick.get('discoveredArticle') if isinstance(pick, dict) else None
    if article and article.get('url'):
        title = article.get('title') or pick.get('title', pick.get('key', '제목 없음'))
        lines.append(f"- **{label}**: {title}")
        lines.append(f"  - {article['url']}")
    else:
        title = pick.get('title', pick.get('key', '제목 없음'))
        lines.append(f"- **{label}**: {title}")

lines.append('')
lines.append('## 재고 메모')
lines.append(f"- 신규 curated study topic 남음: {len(uncovered_curated)}개")
lines.append(f"- live-coding primary seed 남음: {len(remaining_live)}개")
lines.append(f"- live-coding candidate seed 남음: {len(remaining_live_candidates)}개")
lines.append(f"- tech-blog reservoir: {len(tech_blog_items)}개 / AI reservoir: {len(ai_topic_items)}개 / geek reservoir: {len(geek_news_items)}개")
lines.append('')
lines.append('백엔드 항목은 `run_now.sh study-pack <key>`로 즉시 만들 수 있다.')
lines.append('나머지 카테고리는 외부 reading 추천이라 별도 생성 단계 없이 그대로 학습한다.')

(RUNTIME / 'morning-topic-recommendation.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')

discovered_article_urls = []
for group in (tech_blog_recommendations, ai_recommendations, geek_recommendations):
    for item in group:
        article = item.get('discoveredArticle')
        if article and article.get('url'):
            discovered_article_urls.append(article['url'])

append_history({
    'keys': [r.get('key') for r in backend_recommendations if r.get('key')],
    'techBlogKeys': [r.get('key') for r in tech_blog_recommendations if r.get('key')],
    'aiKeys': [r.get('key') for r in ai_recommendations if r.get('key')],
    'geekKeys': [r.get('key') for r in geek_recommendations if r.get('key')],
    'articleUrls': discovered_article_urls,
    'todayPickKeys': {
        label: (pick.get('key') if pick else None)
        for label, pick in (
            ('backend', today_pick['backend']),
            ('techBlog', today_pick['techBlog']),
            ('ai', today_pick['ai']),
        )
    },
})

discovery_ok = sum(1 for entry in discovery_log if entry.get('status') == 'ok')
discovery_attempted = sum(1 for entry in discovery_log if entry.get('status') in ('ok', 'no-match'))

print(json.dumps({
    'inventory': str(RUNTIME / 'topic-inventory.json'),
    'recommendation': str(RUNTIME / 'morning-topic-recommendation.md'),
    'backendCount': len(backend_recommendations),
    'techBlogCount': len(tech_blog_recommendations),
    'aiCount': len(ai_recommendations),
    'geekCount': len(geek_recommendations),
    'discovery': {
        'attempted': discovery_attempted,
        'ok': discovery_ok,
        'cacheDir': str(FEED_CACHE_DIR),
    },
    'history': str(HISTORY_PATH),
}, ensure_ascii=False))
