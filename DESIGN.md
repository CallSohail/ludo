# League dashboard design

Mode: Operate. A working league dashboard, replacing the rejected marketing layout.

## User tasks and composition

Players open the site to see the current standings, understand score changes, inspect their own history, and compare the available records. The scorekeeper signs in to maintain players and scores. A left navigation rail gives access to Overview, Players, Activity, and House rules. The first viewport contains a compact page heading, four summary figures, a large score movement panel and a narrower standings panel. The next row holds daily volume and distribution. There is no promotional hero or decorative chart.

A player profile is a navigable workspace with a back control, identity and score summary, date filters, labelled score timeline, player comparison, daily activity, distribution, and a paginated event table. Empty history is explicit and does not become a fake zero-value chart. Public reasons remain private. Every chart has an accessible summary or data table.

## Tokens

- Page #0c0e10, sidebar #101215, panel #14171b, raised #1c2025, border #2b3037.
- Primary text #f2f4f6, secondary #acb4bf, muted #929ca9.
- Green #a7dc7c, pink #dda5bc, cyan #8ebccc; consistent series assignments, no color-only labels.
- Light: page #f3f5f6, panel #ffffff, raised #edf0f2, border #d6dce1, ink #20272e, secondary #53616d; accessible dark green and rose.
- One interface sans family; fixed scale 12, 13, 14, 16, 20, 24, 30px. Tabular numbers for metrics and axes.
- Desktop sidebar 224px; main fluid, capped at 1600px; 28px outer padding. Panels use 20px padding, 12px radius. Controls 40–44px, inputs 44px.
- Responsive: sidebar becomes a horizontal navigation on tablets and a compact header with menu on phones. Charts stack, table columns reduce, profile remains in the page flow.

## Engineering constraints

History analytics use available events, not assumed match data. Positive awards, negative corrections, missing dates, zero totals, partial history, archived IDs, and ties need explicit handling. Date grouping uses Europe/Paris. Charts preserve true time spacing, provide tick labels and hover/focus values, and avoid stretched SVG points. All/7/30/90 day filters apply to history metrics and charts; current standings remain all-time and are labelled accordingly. CSV output escapes spreadsheet formula prefixes.

## Guidance

[Unslop](https://github.com/heydamir/unslop), by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0; [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design); [Impeccable](https://github.com/pbakaus/impeccable), by Paul Bakaus; and [Grafana dashboard guidance](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/). Interface implementation is original. The user explicitly requested autonomous direction and replacement of the prior design; no concept-selection wait is required. Impeccable's engine could not run in the default cache location; its references were read directly.

## Verification record

Eight analytics tests, five production-configuration tests, and ten browser tests cover the shipped flows. The automated WCAG AA checks cover overview themes, a player workspace and the sign-in dialog; they are not a substitute for a complete accessibility audit. Desktop (1695px) and phone (390px) captures were inspected with live public data copied into a local browser fixture. An independent reviewer identified compressed calendar gaps in daily bars; normalized day anchors and numeric time axes fixed it, and the reviewer scored that finding resolved. The frontend does not change Supabase schema or production score data.

## Certificate extension

The screen retains the dashboard's tokens, navigation, and controls. A searchable player collection sits beside a landscape print preview; mobile stacks the bounded roster above the preview. All certificate content is repeated as accessible HTML. Print artwork uses ivory #f7f3e9, forest #183c31, gold #94703a for the first position, silver-green #667b75 for second, bronze #a16c51 for third, and rose #9b7383 for the remaining league. Cormorant Garamond carries certificate titles and names; DM Sans carries factual detail. Finely ruled borders and geometric seals remain within the print artifact.

The user explicitly requested a shining #1. The current leader is therefore highlighted across the site, with a thin gold border sweep; reduced-motion settings make this static. The certificate never equates penalty rank with match wins. Ties, missing history, and an all-zero opening table receive qualified wording. Personal messages remain device-local. Preview and export share a high-resolution renderer, and downloads stay disabled until the exact current player/message snapshot is ready.
