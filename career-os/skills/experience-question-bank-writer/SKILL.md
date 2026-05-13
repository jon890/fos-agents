---
name: experience-question-bank-writer
description: Generate and publish experience-based interview question bank markdown documents into the local fos-study repository using the candidate's actual resume and selected task history. Use when the output should focus on likely interview questions, follow-up questions, answer points, one-minute answer structure, and pressure-question defense rather than a general technical article.
---

# Experience Question Bank Writer

Create a complete experience-based interview question bank and publish it directly into the local `fos-study` repository.

## Purpose

This skill is for resume/task-driven interview prep documents that should help the user answer:

- "What exactly did you do?"
- "Why did you design it that way?"
- "What trade-offs did you consider?"
- "How would you defend this under pressure?"

Unlike a technical study pack, this output is a question-bank + answer-prep document.

## Output policy

- Always write directly into `sources/fos-study`.
- Always mark the title with `[초안]`.
- Always create a git commit for the changed file.
- Always push the commit after creation/update.
- Keep execution logs and intermediate artifacts under `data/reports/`.

## Expected document shape

Each generated document should usually contain:

1. target experience summary
2. five main interview questions
3. five follow-up questions for each main question
4. what the interviewer is testing
5. answer points with real evidence / metrics / examples
6. one-minute answer structure
7. pressure-question defense points
8. weak answers to avoid

## Input strategy

Use selected inputs only.

Default pattern:
- latest resume: 1 file
- selected task docs: 2-4 files
- target company JD/interview context: 1 file

Avoid feeding the entire task tree in one run.

## Files

- Runner: `scripts/run_question_bank.sh`
- Topic resolver: `scripts/resolve_question_bank_topic.py` (emits `export KEY=value` lines consumed via `eval` by `run_now.sh`)
- Output renderer + validator: `scripts/render_question_bank.py` (enforces exactly 5 main questions × 5 follow-ups)
- Generic prompt: `references/question-bank-prompt.md`
- JSON schema enforced by Claude CLI `--json-schema`: `references/question-bank-schema.json`
- Topic config: `career-os/config/topics.json` (question-bank namespace)

## External dependencies

- `_shared/bin/track_task.sh` — runner is wrapped through this tracker.
- `_shared/bin/update_artifacts.py` — updates `data/generated-artifacts.json` (kind=`question-bank`) after a successful push.
- `claude` CLI on PATH (used with `--output-format json --json-schema`).
- Upstream git remote for `sources/fos-study` (push destination for the generated markdown).

## Topic tracks

Current intended tracks:
- AI service team
- Slot team

## Publishing rules

Use commit messages like:
- `docs(interview): add draft ai-service-team question bank`
- `docs(interview): update draft slot-team question bank`

If push fails, surface it clearly.
