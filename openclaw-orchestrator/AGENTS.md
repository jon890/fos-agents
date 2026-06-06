# AGENTS.md — openclaw-orchestrator workspace

`~/ai-nodes/openclaw-orchestrator` stores durable OpenClaw orchestration memory.
It is the ai-nodes home for daily session notes, heartbeat state, and cross-domain coordination notes.

## Purpose

- Keep OpenClaw daily memory under `~/ai-nodes/` instead of the transient orchestrator workspace.
- Preserve cross-domain context that does not belong to a single domain workspace.
- Point domain-specific work back to the owning ai-nodes workspace.

## Memory

- Daily notes live in `memory/YYYY-MM-DD.md`.
- Recent raw notes may remain detailed.
- Long-term personal memory still follows the OpenClaw workspace `MEMORY.md` security rule unless explicitly migrated.
- Do not store public-postable artifacts here.

## Routing

- Apartment renovation, real estate, interior references, and apartment reports go to `~/ai-nodes/apartment`.
- Career, interview prep, study packs, and fos-study publishing go to `~/ai-nodes/career-os`.
- Health, knee rehab, clinic prep, and symptom tracking go to `~/ai-nodes/health-care`.
- Stock/investment monitoring and market notes go to `~/ai-nodes/stock-investment`.
- Travel planning and saved-place work go to `~/ai-nodes/travel`.

## Safety

- Treat this workspace as private by default.
- In group chats, use these files for context only.
- Reply with the minimum appropriate detail for the channel.
- Do not commit private home-server absolute paths into public docs or tasks.
  Use repo-relative paths, `~/...`, `<home>`, or deployment placeholders instead.
- Do not reveal private home-server absolute paths in Discord-visible replies.
- Do not delete the legacy OpenClaw workspace memory until the migration has been stable and the user asks for cleanup.

## OpenClaw HUD Runtime Policy

Pinned OpenClaw HUD updates are session state, not chat narration.
Runtime state lives under `openclaw-orchestrator/state/task-hud/`.
Shared helper code may live under `_shared/lib/` only when it stays workspace-agnostic.

HUD update code edits an existing message id first.
Creating a new HUD message is allowed only after edit failure.
When fallback creates a new message, the helper sends a separate visible warning with an emoji telling the user that a new HUD was created and needs pinning.

Visible HUD timestamps use absolute KST time.
Relative-only text such as "just now" is not enough for a pinned surface.

`session_status` is the preferred source for usage, context, and native active-agent state.
HUD rendering uses an allowlist of safe fields.
Raw tool output, account identity, secrets, detailed costs, and private absolute paths do not appear in visible HUD text.

Validation starts with dry-run and state path checks.
Real message edit testing is allowed only from the main session against an existing pinned HUD message.
Validation must confirm that no second state root is created.
It must also confirm that no new HUD message appears unless the edit-failure fallback is being tested on purpose.
