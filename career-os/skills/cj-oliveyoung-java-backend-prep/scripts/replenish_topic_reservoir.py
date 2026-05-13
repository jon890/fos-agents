#!/usr/bin/env python3
import json
import os
import re
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

TASK_ROOT = Path.home() / "ai-nodes" / "career-os"
CONFIG = TASK_ROOT / "config"
RUNTIME = TASK_ROOT / "data" / "runtime"
RUNTIME.mkdir(parents=True, exist_ok=True)

PRIMARY_TARGET = 8
CANDIDATE_TARGET = 18
LIVE_PRIMARY_TARGET = 3
MAX_GENERATION_BATCH = 12
RECENT_ARTIFACT_LIMIT = 24
MODEL = "claude-sonnet-4-5"

ALLOWED_CANDIDATE_DOMAINS = {
    "mysql", "redis", "architecture", "spring", "java",
    "message-queue", "search", "interview", "observability",
    "security", "testing",
}
ALLOWED_PROMOTION_DOMAINS = {
    "mysql", "redis", "architecture", "spring", "java", "kafka",
    "rabbitmq", "message-queue", "opensearch", "interview", "observability",
    "security", "testing",
}
ALLOWED_TAGS = {"new", "deepen", "review"}
ALLOWED_DIFFICULTIES = {"중", "중상", "상"}
WEAK_AREAS = {"mysql", "redis"}
PROMOTION_TAG_PRIORITY = {"new": 0, "deepen": -1, "review": -3}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def normalize_text(text: str) -> str:
    return re.sub(r"[^a-z0-9가-힣]+", " ", text.lower()).strip()


def token_set(text: str) -> set[str]:
    return {tok for tok in normalize_text(text).split() if tok}


def basename_tokens(path: str) -> set[str]:
    return token_set(Path(path).stem)


def similar_tokens(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def domain_from_output_path(path: str) -> str:
    if path.startswith("database/mysql/"):
        return "mysql"
    if path.startswith("database/redis/"):
        return "redis"
    if path.startswith("java/spring/"):
        return "spring"
    if path.startswith("java/"):
        return "java"
    if path.startswith("architecture/"):
        return "architecture"
    if path.startswith("search/"):
        return "search"
    if path.startswith("kafka/") or path.startswith("rabbitmq/"):
        return "message-queue"
    if path.startswith("interview/"):
        return "interview"
    if path.startswith("observability/"):
        return "observability"
    if path.startswith("security/"):
        return "security"
    if path.startswith("testing/"):
        return "testing"
    return "other"


def build_context(primary_cfg, candidates_doc, artifacts):
    recent_study = [a for a in artifacts if a.get("kind") == "study-pack"]
    recent_study.sort(key=lambda a: a.get("updatedAt", a.get("createdAt", "")), reverse=True)
    recent_study = recent_study[:RECENT_ARTIFACT_LIMIT]
    recent_domains = Counter(domain_from_output_path(a.get("outputPath", "")) for a in recent_study)
    return {
        "recent_domains": dict(recent_domains),
        "primary_keys": list(primary_cfg.keys()),
        "candidate_titles": [t.get("title", "") for t in candidates_doc.get("topics", [])],
        "recent_lines": [f"- {a.get('topic')} -> {a.get('outputPath')}" for a in recent_study],
    }


def build_prompt(request_count: int, context: dict) -> str:
    template = (TASK_ROOT / "skills" / "cj-oliveyoung-java-backend-prep" / "references" / "topic-replenishment-prompt.md").read_text(encoding="utf-8")
    return "\n\n".join([
        template,
        f"이번에 생성할 후보 topic 개수: {request_count}",
        "최근 study-pack 도메인 분포:",
        json.dumps(context["recent_domains"], ensure_ascii=False, indent=2),
        "이미 primary config에 있는 topic key들:",
        json.dumps(context["primary_keys"], ensure_ascii=False, indent=2),
        "이미 candidate reservoir에 있는 title들:",
        json.dumps(context["candidate_titles"], ensure_ascii=False, indent=2),
        "최근 생성된 study-pack 목록:",
        "\n".join(context["recent_lines"]),
        "추가 지시:",
        "- 최근 생성된 주제와 겹치지 않는 후보만 만든다.",
        "- MySQL/Redis 약점 영역 보강을 우선하되 한 도메인에 몰아넣지 않는다.",
        "- review는 최대 2개, deepen은 최대 3개, 나머지는 new로 구성한다.",
        "- outputPath는 이미 존재하는 파일과 겹치지 않게 새 경로를 잡는다.",
    ])


def call_claude(prompt: str) -> dict:
    proc = subprocess.run(
        [
            "timeout", "900s", "claude",
            "--model", MODEL,
            "--permission-mode", "bypassPermissions",
            "--print",
            "--output-format", "json",
            "--no-session-persistence",
            prompt,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"claude failed ({proc.returncode}): {proc.stderr.strip() or proc.stdout.strip()}")
    usage_file = os.environ.get("TRACK_TASK_CLAUDE_USAGE_FILE")
    if usage_file:
        try:
            Path(usage_file).write_text(proc.stdout, encoding="utf-8")
        except OSError:
            pass
    outer = json.loads(proc.stdout)
    raw = (outer.get("result") or "").strip()
    raw = re.sub(r"^```json\s*|^```\s*|\s*```$", "", raw, flags=re.DOTALL).strip()
    parsed = json.loads(raw)
    if not isinstance(parsed, dict) or not isinstance(parsed.get("topics"), list):
        raise ValueError("Claude output did not contain {topics:[...]} JSON")
    return parsed


def validate_topic(item, existing_keys, existing_output_paths, existing_titles, existing_reference_tokens):
    errors = []
    key = item.get("key", "")
    if not re.fullmatch(r"[a-z0-9-]{8,120}", key or ""):
        errors.append("invalid key")
    if key in existing_keys:
        errors.append("duplicate key")

    title = item.get("title", "")
    if not isinstance(title, str) or len(title.strip()) < 8:
        errors.append("invalid title")
    elif normalize_text(title) in existing_titles:
        errors.append("duplicate title")

    domain = item.get("domain")
    if domain not in ALLOWED_CANDIDATE_DOMAINS:
        errors.append("invalid candidate domain")

    tag = item.get("tag")
    if tag not in ALLOWED_TAGS:
        errors.append("invalid tag")

    if item.get("difficulty") not in ALLOWED_DIFFICULTIES:
        errors.append("invalid difficulty")

    minutes = item.get("estMinutes")
    if not isinstance(minutes, int) or not (20 <= minutes <= 70):
        errors.append("invalid estMinutes")

    why_now = item.get("whyNow")
    if not isinstance(why_now, list) or len(why_now) != 2 or not all(isinstance(x, str) and x.strip() for x in why_now):
        errors.append("invalid whyNow")

    promotion = item.get("promotionTarget") or {}
    promo_domain = promotion.get("domain")
    output_path = promotion.get("outputPath", "")
    commit_topic = promotion.get("commitTopic", "")
    append_prompt = promotion.get("appendPrompt", "")

    if promo_domain not in ALLOWED_PROMOTION_DOMAINS:
        errors.append("invalid promotion domain")
    if not output_path.endswith(".md") or output_path in existing_output_paths:
        errors.append("duplicate/invalid outputPath")
    if not re.fullmatch(r"[a-z0-9-]{8,120}", commit_topic or ""):
        errors.append("invalid commitTopic")
    if "[초안]" not in append_prompt or len(append_prompt.strip()) < 60:
        errors.append("weak appendPrompt")

    ref_tokens = token_set(key) | token_set(title) | basename_tokens(output_path)
    if any(similar_tokens(ref_tokens, tokens) >= 0.72 for tokens in existing_reference_tokens):
        errors.append("too similar to existing topic")

    return errors, ref_tokens, normalize_text(title)


def clean_existing_candidates(primary_cfg, candidates_doc, artifacts):
    existing_output_paths = {v.get("outputPath") for v in primary_cfg.values()} | {
        a.get("outputPath") for a in artifacts if a.get("outputPath")
    }
    existing_keys = set(primary_cfg.keys())
    existing_titles = set()
    existing_reference_tokens = []
    for key, value in primary_cfg.items():
        existing_reference_tokens.append(token_set(key) | basename_tokens(value.get("outputPath", "")))
    for artifact in artifacts:
        existing_reference_tokens.append(token_set(artifact.get("topic", "")) | basename_tokens(artifact.get("outputPath", "")))

    kept = []
    removed = []
    seen_keys = set()
    seen_output_paths = set()
    seen_titles = set()

    for item in candidates_doc.get("topics", []):
        promotion = item.get("promotionTarget") or {}
        key = item.get("key")
        output_path = promotion.get("outputPath")
        norm_title = normalize_text(item.get("title", ""))
        ref_tokens = token_set(key or "") | token_set(item.get("title", "")) | basename_tokens(output_path or "")

        reason = None
        if key in existing_keys or key in seen_keys:
            reason = "duplicate key"
        elif output_path in existing_output_paths or output_path in seen_output_paths:
            reason = "duplicate outputPath"
        elif norm_title and (norm_title in seen_titles or norm_title in existing_titles):
            reason = "duplicate title"
        elif any(similar_tokens(ref_tokens, tokens) >= 0.72 for tokens in existing_reference_tokens):
            reason = "too similar to existing topic"

        if reason:
            removed.append({"key": key, "reason": reason})
            continue

        kept.append(item)
        seen_keys.add(key)
        seen_output_paths.add(output_path)
        seen_titles.add(norm_title)
        existing_titles.add(norm_title)
        existing_reference_tokens.append(ref_tokens)

    candidates_doc["topics"] = kept
    return removed, existing_keys | seen_keys, existing_output_paths | seen_output_paths, existing_titles, existing_reference_tokens


def merge_generated_topics(primary_cfg, candidates_doc, artifacts, generated_topics):
    removed, existing_keys, existing_output_paths, existing_titles, existing_reference_tokens = clean_existing_candidates(primary_cfg, candidates_doc, artifacts)
    accepted = []
    rejected = []
    for item in generated_topics:
        errors, ref_tokens, norm_title = validate_topic(
            item, existing_keys, existing_output_paths, existing_titles, existing_reference_tokens
        )
        if errors:
            rejected.append({"key": item.get("key"), "errors": errors})
            continue
        candidates_doc.setdefault("topics", []).append(item)
        accepted.append(item)
        existing_keys.add(item["key"])
        existing_output_paths.add(item["promotionTarget"]["outputPath"])
        existing_titles.add(norm_title)
        existing_reference_tokens.append(ref_tokens)
    return accepted, rejected, removed


def score_for_promotion(item, recent_domain_counts):
    domain = item.get("promotionTarget", {}).get("domain") or item.get("domain") or "other"
    score = -2 * recent_domain_counts.get(domain, 0)
    if domain in WEAK_AREAS:
        score += 3
    score += PROMOTION_TAG_PRIORITY.get(item.get("tag", "new"), -4)
    return score


def promote_candidates(primary_cfg, candidates_doc, artifacts):
    study_paths = {a.get("outputPath") for a in artifacts if a.get("kind") == "study-pack"}
    uncovered = [k for k, v in primary_cfg.items() if v.get("outputPath") not in study_paths]
    need = max(0, PRIMARY_TARGET - len(uncovered))
    if need <= 0:
        return []

    recent_domains = Counter(
        domain_from_output_path(a.get("outputPath", "")) for a in artifacts if a.get("kind") == "study-pack"
    )
    indexed = list(enumerate(candidates_doc.get("topics", [])))
    ranked = sorted(indexed, key=lambda pair: -score_for_promotion(pair[1], recent_domains))
    chosen_indices = {idx for idx, _ in ranked[:need]}

    promoted = []
    remaining = []
    for idx, item in enumerate(candidates_doc.get("topics", [])):
        if idx not in chosen_indices:
            remaining.append(item)
            continue
        promotion = item.get("promotionTarget")
        if not promotion or item["key"] in primary_cfg:
            remaining.append(item)
            continue
        primary_cfg[item["key"]] = promotion
        promoted.append(item["key"])
    candidates_doc["topics"] = remaining
    return promoted


def promote_live_coding_candidates(live_primary_doc, live_candidate_doc, artifacts):
    covered = {a.get("outputPath") for a in artifacts if a.get("kind") == "live-coding"}
    remaining_primary = [s for s in live_primary_doc.get("seeds", []) if s.get("outputPath") not in covered]
    need = max(0, LIVE_PRIMARY_TARGET - len(remaining_primary))
    if need <= 0:
        return []

    promoted = []
    kept_candidates = []
    for seed in live_candidate_doc.get("seeds", []):
        if len(promoted) < need and seed.get("outputPath") not in covered:
            live_primary_doc.setdefault("seeds", []).append(seed)
            promoted.append(seed.get("slug"))
        else:
            kept_candidates.append(seed)
    live_candidate_doc["seeds"] = kept_candidates
    return promoted


def refresh_inventory():
    script = TASK_ROOT / "skills" / "cj-oliveyoung-java-backend-prep" / "scripts" / "refresh_topic_inventory.py"
    subprocess.run(["python3", str(script)], check=True, cwd=TASK_ROOT)


def main():
    topics_path = CONFIG / "topics.json"
    live_primary_path = CONFIG / "live-coding-seed-pool.json"
    live_candidate_path = CONFIG / "live-coding-seed-candidates.json"
    artifacts_path = TASK_ROOT / "data" / "generated-artifacts.json"
    report_json_path = RUNTIME / "topic-replenishment.json"
    report_md_path = RUNTIME / "topic-replenishment.md"

    topics_data = read_json(topics_path)
    primary_cfg = topics_data["study-pack"]
    candidates_doc = topics_data["study-pack-candidates"]
    live_primary_doc = read_json(live_primary_path)
    live_candidate_doc = read_json(live_candidate_path)
    artifacts = read_json(artifacts_path).get("artifacts", [])

    study_paths = {a.get("outputPath") for a in artifacts if a.get("kind") == "study-pack"}
    live_paths = {a.get("outputPath") for a in artifacts if a.get("kind") == "live-coding"}
    before_candidate_count = len(candidates_doc.get("topics", []))
    before_primary_uncovered = sum(1 for v in primary_cfg.values() if v.get("outputPath") not in study_paths)
    before_live_primary_remaining = sum(1 for s in live_primary_doc.get("seeds", []) if s.get("outputPath") not in live_paths)
    before_live_candidate_remaining = sum(1 for s in live_candidate_doc.get("seeds", []) if s.get("outputPath") not in live_paths)

    cleaned, _, _, _, _ = clean_existing_candidates(primary_cfg, candidates_doc, artifacts)
    context = build_context(primary_cfg, candidates_doc, artifacts)
    current_candidates = len(candidates_doc.get("topics", []))
    current_uncovered = sum(1 for v in primary_cfg.values() if v.get("outputPath") not in study_paths)
    promote_need = max(0, PRIMARY_TARGET - current_uncovered)
    request_count = min(MAX_GENERATION_BATCH, max(0, CANDIDATE_TARGET + promote_need - current_candidates))

    claude_invoked = False
    accepted = []
    rejected = []
    if request_count > 0:
        claude_invoked = True
        generated = call_claude(build_prompt(request_count, context)).get("topics", [])
        accepted, rejected, cleaned_again = merge_generated_topics(primary_cfg, candidates_doc, artifacts, generated)
        cleaned.extend(cleaned_again)

    promoted = promote_candidates(primary_cfg, candidates_doc, artifacts)
    promoted_live_coding = promote_live_coding_candidates(live_primary_doc, live_candidate_doc, artifacts)

    write_json(topics_path, topics_data)
    write_json(live_primary_path, live_primary_doc)
    write_json(live_candidate_path, live_candidate_doc)
    refresh_inventory()

    after_candidate_count = len(candidates_doc.get("topics", []))
    after_primary_uncovered = sum(1 for v in primary_cfg.values() if v.get("outputPath") not in study_paths)
    after_live_primary_remaining = sum(1 for s in live_primary_doc.get("seeds", []) if s.get("outputPath") not in live_paths)
    after_live_candidate_remaining = sum(1 for s in live_candidate_doc.get("seeds", []) if s.get("outputPath") not in live_paths)

    report = {
        "generatedAt": utc_now(),
        "claudeInvoked": claude_invoked,
        "requestedGenerationCount": request_count,
        "requestedPromotionGap": promote_need,
        "before": {
            "candidateCount": before_candidate_count,
            "primaryUncovered": before_primary_uncovered,
            "livePrimaryRemaining": before_live_primary_remaining,
            "liveCandidateRemaining": before_live_candidate_remaining,
        },
        "after": {
            "candidateCount": after_candidate_count,
            "primaryUncovered": after_primary_uncovered,
            "livePrimaryRemaining": after_live_primary_remaining,
            "liveCandidateRemaining": after_live_candidate_remaining,
        },
        "accepted": [item["key"] for item in accepted],
        "rejected": rejected,
        "cleaned": cleaned,
        "promoted": promoted,
        "promotedLiveCoding": promoted_live_coding,
    }
    write_json(report_json_path, report)

    lines = [
        "# topic replenishment",
        "",
        f"- generatedAt: {report['generatedAt']}",
        f"- claudeInvoked: {claude_invoked}",
        f"- requestedGenerationCount: {request_count}",
        f"- requestedPromotionGap: {promote_need}",
        f"- candidateCount: {before_candidate_count} -> {after_candidate_count}",
        f"- primaryUncovered: {before_primary_uncovered} -> {after_primary_uncovered}",
        f"- livePrimaryRemaining: {before_live_primary_remaining} -> {after_live_primary_remaining}",
        f"- liveCandidateRemaining: {before_live_candidate_remaining} -> {after_live_candidate_remaining}",
        f"- accepted: {', '.join(report['accepted']) if report['accepted'] else '-'}",
        f"- promoted: {', '.join(promoted) if promoted else '-'}",
        f"- promotedLiveCoding: {', '.join(promoted_live_coding) if promoted_live_coding else '-'}",
        "",
        "## cleaned",
    ]
    if cleaned:
        lines.extend([f"- {item['key']}: {item['reason']}" for item in cleaned])
    else:
        lines.append("- none")
    lines.extend(["", "## rejected"])
    if rejected:
        lines.extend([f"- {item.get('key')}: {', '.join(item.get('errors', []))}" for item in rejected])
    else:
        lines.append("- none")
    report_md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
