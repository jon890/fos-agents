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
- Do not delete the legacy OpenClaw workspace memory until the migration has been stable and the user asks for cleanup.
