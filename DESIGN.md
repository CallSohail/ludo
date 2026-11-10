# Ludo Super League interface

## Direction

- Product: a public penalty table and private scorekeeper for a group of Ludo players in Évry.
- Character: friendly, competitive, accountable.
- World: the scorebook beside the game table.
- Moments: actual top-three score comparisons and a readable penalty table.
- Signature: numbered entries repeated in rankings, house rules, and score receipts.

Charcoal surfaces keep the table quiet. Lime green identifies scores and primary actions; dusty pink provides a small secondary accent. These choices support visual hierarchy and a warmer tone, rather than claiming universal psychological effects. Light mode uses darker green and rose for readable contrast.

## What changed

Replaced decorative signal charts, looping effects, texture, and scroll scenes with actual score comparisons. Added a house-rules guide explaining penalty totals, tie ordering, corrections, and scoring limits. Public activity uses the existing public score history; private reasons remain in the scorekeeper. Empty, preview, loading, offline, search, and error states have explicit messages.

The admin dialog traps keyboard focus, restores the opening control on close, and prevents background scrolling. Consent is unchecked for each new award. Player profiles retain keyboard navigation and explain when history is unavailable. Score history charts describe net recorded changes, which may differ from a total when initial or older entries are unavailable.

## Validation

`npm test` runs Playwright against isolated browser demo data, with production Supabase variables explicitly disabled. It covers stable ties, search recovery, sorting with original ranks, scoring consent, activity updates, sign-in failure, password visibility, focus trapping, Escape, profile focus restoration, empty leagues, long names, large scores, 320–1440px layouts, themes, and offline status.

`npm run build` creates the Pages bundle. CI runs browser tests before building and deploying. A successful demo test does not establish that a production Supabase project has the required schema or admin permissions; production scoring must use its existing database setup.

## Design guidance credit

This redesign follows [Unslop](https://github.com/heydamir/unslop), created by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The interface code is original; no reference artwork is copied.
