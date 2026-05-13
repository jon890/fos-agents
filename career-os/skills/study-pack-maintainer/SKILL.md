---
name: study-pack-maintainer
description: Decide whether a requested backend study topic should update an existing fos-study markdown file or create a new one, then generate the final markdown body via Claude based on existing related documents. Use when the user asks for a study pack but wants overlap checked first, wants duplicate files avoided, wants existing documents reviewed before writing, or wants Claude to own both the update-vs-new-file judgment and the final content draft.
---

# Study Pack Maintainer

Use Claude as the primary writer and structure judge for study-pack maintenance work.

## Purpose

This skill is for cases where a new topic may overlap with existing `fos-study` documents.
The goal is not just to write a new article, but to:

1. inspect relevant existing documents,
2. decide whether to update one of them or create a new file,
3. generate the final markdown body accordingly,
4. publish through the existing `fos-study` git flow.

## Required workflow

1. Read `references/maintainer-prompt.md`.
2. Use `scripts/run_maintainer.sh` for actual generation.
3. Feed Claude both:
   - the requested topic description,
   - the candidate existing documents that may overlap.
4. Let Claude decide one of two modes inside the generated result:
   - `update-existing`
   - `create-new`
5. Always make the final output markdown start with `# [초안]`.
6. Always write only one final target file per run.
7. Always commit and push if the content changed.

## Output contract

The Claude result must include:
- chosen action (`update-existing` or `create-new`)
- chosen output path inside `fos-study`
- short rationale
- full final markdown body

The runner is responsible for extracting these fields and publishing the markdown.

## Files

- Prompt reference: `references/maintainer-prompt.md`
- Runner: `scripts/run_maintainer.sh`
- Config: `config/topics.json` (study-pack-maintainer namespace)

## Invocation

```bash
skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh maintain-study-pack <topic>
```

Use this instead of plain `study-pack` when overlap / update strategy matters.
