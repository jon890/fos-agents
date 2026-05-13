---
name: study-pack-writer
description: Generate and publish reusable study-pack markdown documents into the local fos-study repository for interview preparation and technical blogging. Use when a study topic changes day to day and you want one complete article-like learning package with draft labeling, practical examples, runnable exercises, interview framing, and immediate git commit/push to fos-study.
---

# Study Pack Writer

Create a complete study pack for a selected topic and publish it directly into the local `fos-study` repository.

## Purpose

This skill is for topic-driven learning documents that should work as both:

- interview preparation material
- blog-synced technical study articles

Each generated document should be readable as a full standalone learning package, not just a memo.

## Output policy

- Always write the generated document directly into `sources/fos-study`.
- Always mark the title with `[초안]`.
- Always create a git commit for the changed file.
- Always push the commit after creation/update.
- Keep execution logs and intermediate artifacts under `data/reports/`.

## Expected study-pack shape

Every generated document should usually contain:

1. why the topic matters
2. core concept explanation
3. practical usage in backend work
4. interview framing and answer guidance
5. runnable local practice setup
6. executable examples (SQL/code/commands)
7. bad vs improved examples
8. checklist or exercises

## Template strategy

Use a shared base structure across all topics, then extend it by domain.

Common base:
- `[초안]` title
- why it matters
- core explanation
- practical usage
- interview connection
- local hands-on section
- practice checklist

Domain-specific extensions:
- MySQL / DB topics: execution plans, indexes, locking, SQL practice
- Redis topics: cache patterns, consistency, expiry/eviction, local Redis practice
- Kafka topics: partitions, delivery semantics, consumer groups, docker-based practice
- Spring/JPA topics: transaction boundaries, flush behavior, N+1, SQL verification

## Files

- Runner: `scripts/run_study_pack.sh`
- Topic resolver: `scripts/resolve_study_pack_topic.py` (emits `export KEY=value` lines consumed via `eval` by `run_now.sh`)
- Output extractor + validator: `scripts/extract_and_validate_study_pack.py`
- Generic prompt: `references/study-pack-prompt.md`
- Topic profiles (reference only): `references/topic-profiles.md`
- Topic config (actual per-topic metadata): `config/topics.json (study-pack namespace)` (at `career-os/config/`, not inside the skill dir)

## External dependencies

- `_shared/bin/track_task.sh` — runner is wrapped through this tracker.
- `_shared/bin/update_artifacts.py` — updates `data/generated-artifacts.json` after a successful push.
- `claude` CLI on PATH.
- Upstream git remote for `sources/fos-study` (push destination for the generated markdown).

## Invocation

This skill is normally invoked via the `cj-oliveyoung-java-backend-prep` skill runner:

```bash
skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh study-pack <topic>
```

Where `<topic>` is a key in `config/topics.json (study-pack namespace)` (e.g. `explain-plan`, `composite-index`).

The runner resolves domain, output path, and `promptAppend` from the config,
then passes them as env vars to `run_study_pack.sh`.

To add a new topic, add an entry to `config/topics.json (study-pack namespace)` with:
- `domain`: commit message prefix (e.g. `mysql`, `redis`)
- `outputPath`: relative path inside `sources/fos-study`
- `promptAppend`: topic-specific generation instructions

## Publishing rules

- Prefer topic-specific output path conventions aligned with ADR-005.
- Use commit messages like:
  - `docs(mysql): add draft explain-plan study pack`
  - `docs(redis): update draft cache-aside study pack`
- If push fails, surface that clearly instead of silently stopping.
