# Phase 01 — Read-only source diagnostics dashboard

**Status**: planned

---

## Goal

Add a read-only `fos-career` dashboard page that makes source collection health easier to scan.

The page should show:

- latest source diagnostic status per source,
- collected / imported / skipped / failed counts,
- current imported DB row count per source,
- latest import run id.

## Scope

Allowed:

- `fos-career` dashboard UI,
- read-only DB queries against `collected_positions`,
- shared parser extraction if it reduces duplication,
- nav link update.

Out of scope:

- source collectors,
- career-os file writes,
- priority write actions,
- destructive DB changes,
- LLM recommendation refresh.

## Validation

Run before completion:

```bash
npm run build
git diff --check
```

Deploy validation if merged:

```bash
docker compose -f ~/apps/fos-career/docker-compose.yml build fos-career
docker compose -f ~/apps/fos-career/docker-compose.yml up -d --no-deps fos-career
```

Then confirm:

- container health is healthy,
- authenticated `/dashboard/sources` returns 200,
- page includes latest imported source counts.

## Blocked Conditions

- `PHASE_BLOCKED: source diagnostics require write access` if the page cannot be implemented read-only.
- `PHASE_FAILED: dashboard build failed` if the production build fails after implementation.
