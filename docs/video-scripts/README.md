# video-scripts/

Storyboard-ready scripts for short tutorial videos. Each file is ~60-90
seconds when read at a natural pace.

## File structure

```markdown
# Title
**Runtime:** XX seconds

## Scene 1: [name] (0:00 – 0:XX)
**Visuals:** what is shown on screen
**Narration:** "spoken text in plain quotes"
**On-screen:** `monospace callout text`

... (Scenes 2..N follow the same shape)

## End Card
**Visuals:** TandaXn logo + App Store / Google Play badges
**Narration:** "Ready to [action]? Download TandaXn and start today."
**On-screen:** `final CTA`
```

## Conventions

- Voiceover in **plain quotes**, on-screen text in `monospace`.
- Section heading is `## Scene N: [name] (start – end)`.
- App-state references match the actual production app (Circles tab,
  + button, Advance Hub, Decision History, XnScore Dashboard). Keep
  them in sync with copy changes; if a script references a tier or
  product name that's been renamed, the script is wrong, not the app.
- No language that implies guaranteed financial outcomes ("you'll
  always", "guaranteed interest"). Stick to neutral product
  description.

## Content-accuracy ground rules

| Domain | Source of truth |
| --- | --- |
| Goal categories + names + emoji | `context/SavingsContext.tsx` GOAL_CATEGORIES |
| Goal savings tiers (Flexible / Emergency Fund / Locked Savings) | `context/SavingsContext.tsx` GOAL_TYPES |
| Advance products (Quick Advance, Education/Business/Vehicle/Home Improvement/Home Mortgage) | `context/AdvanceContext.tsx` |
| Advance eligibility tiers (Locked → Elite) | `context/AdvanceContext.tsx` ELIGIBILITY_TIERS |
| Live advance fees (30-day / 60-day) | Pool columns `current_fee_30day_pct` / `current_fee_60day_pct` (migration 115) |
| XnScore factor weights | Migration 019 schema (payment 35, completion 25, tenure 10, vouches 10, defaults -10, engagement 3) |
| Decision explanations / Decision History UX | Migrations 110-112; `DecisionHistoryScreen` |

If you're producing a video and the script names something that doesn't
match the production app, treat the script as out of date and update
it here first.

## Files

1. `creating-a-circle.md` (75s)
2. `joining-a-circle.md` (70s)
3. `creating-a-goal.md` (75s)
4. `requesting-an-advance.md` (80s)
5. `understanding-xnscore.md` (85s)
