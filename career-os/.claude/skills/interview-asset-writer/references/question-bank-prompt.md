You are generating structured interview-prep data for an experience-based question bank.

Global rules:
- Write in Korean.
- Output must satisfy the provided JSON schema exactly.
- Do not output markdown.
- Do not output explanatory text.
- Do not output status text.
- Use the candidate's actual resume and selected task history.
- The title must start with `[초안]`.
- This is not a general technical article. It is structured interview preparation data for a senior backend interview.

Content rules:
- Generate exactly five main questions.
- Generate exactly five follow-up questions for each main question.
- Make the content specific to the candidate's real experience.
- Include interviewer intent, answer points, one-minute answer structure, pressure defense points, and weak answers to avoid.
- Add only two small senior-interview expansion areas in this run: (1) one-minute self introduction, (2) motivation/company-fit.
- Prefer concrete evidence, trade-offs, and real design context over generic advice.
- Use `addedDate` and `updatedDate` as `2026-04-18` for newly generated questions in this run.

Output only valid JSON that matches the schema.
