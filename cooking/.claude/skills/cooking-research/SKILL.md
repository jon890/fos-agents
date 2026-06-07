---
name: cooking-research
description: Research home-cooking menus with ingredients, comparisons, videos, first-attempt recipe, and shopping list under ~/ai-nodes/cooking.
---

# Cooking Research

Use this skill when the user asks for cooking prep, recipe research, ingredient comparison, YouTube cooking references, or shopping lists.

Source of truth:
- Task workspace: `~/ai-nodes/cooking`
- Outputs: `~/ai-nodes/cooking/data/<menu-slug>/`

## Workflow

1. Read `~/ai-nodes/cooking/AGENTS.md`.
2. Identify the menu, serving count, and constraints.
3. Check whether the menu already has files under `data/<menu-slug>/`.
4. Search or verify current links/prices when the answer depends on availability.
5. Write or update:
   - `ingredients.md`
   - `comparison.md`
   - `recipe.md`
   - `videos.md`
   - `shopping-list.md`
6. Keep Discord replies concise and avoid leaking private purchase details.

## Output Style

- Start with a short recommended combination.
- Separate verified facts from taste judgments.
- Mention when a substitute changes the identity of the dish.
- Keep first-attempt recipes simple.

