# TOOLS.md - career-os task notes

Current MVP target:
- Repository: https://github.com/jon890/fos-study
- Branch: main
- Preferred source sync path: `~/ai-nodes/career-os/sources/fos-study`
- Analyze markdown files only
- Ignore `.claude/**`
- Focus area: Java backend interview preparation
- Company target: see `config/mvp-target.json` (single source of truth)
- Self-assessed weak area: DB
- Use `config/.env` for task-local secrets such as `GITHUB_TOKEN`

Claude skill invocation:
- Run native skills from this workspace root.
- Prefer background execution for long skill calls.
- Use `claude --permission-mode bypassPermissions -p "/<skill> ..."` by default so edit approval prompts do not stall unattended runs.
- Do not use this permission mode to bypass user approval for applications, emails, public posts, or external messages.
