#!/usr/bin/env python3
"""Validate Claude's structured JSON output and render it as markdown.

Usage: render_question_bank.py <raw-json> <output-md>

Expected JSON shape (schema enforced by --json-schema at claude CLI layer):
    {
      "title": str,
      "trackSummary": [str, ...],
      "selfIntro": {"oneMinute": [...], "targetRoleFit": [...]},
      "motivationAndFit": {"whyChange": [...], "whyTargetCompany": [...], "whyThisRole": [...]},
      "questions": [  # exactly 5
        {
          "question": str,
          "addedDate": str?, "updatedDate": str?,
          "interviewerIntent": [...], "answerPoints": [...],
          "oneMinuteAnswer": [...], "pressureDefense": [...],
          "weakAnswers": [...], "followUps": [str, ... 5]
        },
        ...
      ],
      "finalChecklist": [str, ...]
    }
"""
import json
import sys
from pathlib import Path

EXPECTED_MAIN_QUESTIONS = 5
EXPECTED_FOLLOWUPS = 5


def bullets(items):
    return [f"- {item}" for item in items]


def render(data: dict) -> str:
    questions = data.get("questions", [])
    if len(questions) != EXPECTED_MAIN_QUESTIONS:
        raise SystemExit(
            f"question-bank validation failed: expected {EXPECTED_MAIN_QUESTIONS} questions, got {len(questions)}"
        )
    for i, q in enumerate(questions, start=1):
        followups = q.get("followUps", [])
        if len(followups) != EXPECTED_FOLLOWUPS:
            raise SystemExit(
                f"question-bank validation failed: question {i} followUp count is {len(followups)}"
            )

    lines: list[str] = [
        f"# {data['title']}",
        "",
        "---",
        "",
        "## 이 트랙의 경험 요약",
        "",
        *bullets(data["trackSummary"]),
        "",
        "## 1분 자기소개 준비",
        "",
        *bullets(data["selfIntro"]["oneMinute"]),
        "",
        "## 타깃 회사/포지션 맞춤 연결 포인트",
        "",
        *bullets(data["selfIntro"]["targetRoleFit"]),
        "",
        "## 지원 동기 / 회사 핏",
        "",
        "### 왜 이직하려는가",
        *bullets(data["motivationAndFit"]["whyChange"]),
        "",
        "### 왜 카카오헬스케어 케어챗인가",
        *bullets(data["motivationAndFit"]["whyTargetCompany"]),
        "",
        "### 왜 이 역할에 맞는가",
        *bullets(data["motivationAndFit"]["whyThisRole"]),
        "",
    ]

    for idx, q in enumerate(questions, start=1):
        added = q.get("addedDate", "2026-04-18")
        updated = q.get("updatedDate", "2026-04-18")
        lines += [
            f"## 메인 질문 {idx}. {q['question']}",
            "",
            f"> 추가: {added} | 업데이트: {updated}",
            "",
            "### 면접관이 실제로 보는 것",
            "",
            *bullets(q["interviewerIntent"]),
            "",
            "### 실제 경험 기반 답변 포인트",
            "",
            *bullets(q["answerPoints"]),
            "",
            "### 1분 답변 구조",
            "",
            *bullets(q["oneMinuteAnswer"]),
            "",
            "### 압박 질문 방어 포인트",
            "",
            *bullets(q["pressureDefense"]),
            "",
            "### 피해야 할 약한 답변",
            "",
            *bullets(q["weakAnswers"]),
            "",
            "### 꼬리 질문 5개",
            "",
        ]
        for f_idx, item in enumerate(q["followUps"], start=1):
            lines += [f"**F{idx}-{f_idx}.** {item}", ""]
        lines += ["---", ""]

    lines += ["## 최종 준비 체크리스트", "", *bullets(data["finalChecklist"])]
    return "\n".join(lines).rstrip() + "\n"


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: render_question_bank.py <raw-json> <output-md>", file=sys.stderr)
        return 1

    src = Path(argv[1])
    out = Path(argv[2])

    text = src.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        raise SystemExit("question-bank validation failed: JSON output is empty")

    envelope = json.loads(text)
    data = envelope.get("structured_output", envelope)

    out.write_text(render(data), encoding="utf-8")
    print(f"Wrote question bank: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
