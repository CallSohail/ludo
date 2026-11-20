# League dashboard design

Mode: Operate. A working league dashboard, replacing the rejected marketing layout.

## User tasks and composition

The scorebook opens with a compact season heading and crown card. A single leaderboard contains every active player. On a wide screen, it sits beside recent changes and the penalty race. On a phone, these sections stack in reading order. The navigation stays anchored across routes.

Player sheets open from the standings and player directory. They show the current total, rank, an estimated rank trend among currently active players, recent entries, and the certificate action. Full analysis is available inside the sheet. Rules use a single column with disclosure controls.

## Glass materials

- Off-white #edf0ec, charcoal #151c19, soft gray #e1e6e3 and deep forest #273c30 form the fixed backdrop. Green carries actions and gold marks the crown.
- Glass blurs at 20px with 1.4 saturation. Light panels use 64% white and dark panels use 10%. Buttons, form fields and plotted chart areas have solid backgrounds. Reduced transparency and unsupported blur use opaque surfaces.
- System typography uses tight display tracking and tabular figures. Controls, cards and sheets use 12px, 20px and 28px radii, respectively.
- A small dice icon identifies the league. Printed certificates use the Midnight Trophy design.

## Engineering constraints

History analytics use available events, not assumed match data. Positive awards, negative corrections, missing dates, zero totals, partial history, archived IDs, and ties need explicit handling. Date grouping uses Europe/Paris. Charts preserve true time spacing, provide tick labels and hover/focus values, and avoid stretched SVG points. All/7/30/90 day filters apply to history metrics and charts; current standings remain all-time and are labelled accordingly. CSV output escapes spreadsheet formula prefixes.

## Guidance

Glass material and lighting reference from the [Liquid Glass prompt library](https://liquidglassdesign.com/prompts).

[Unslop](https://github.com/heydamir/unslop), by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0; [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design); [Impeccable](https://github.com/pbakaus/impeccable), by Paul Bakaus; and [Grafana dashboard guidance](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/). Interface implementation is original. The user explicitly requested autonomous direction and replacement of the prior design; no concept-selection wait is required. Impeccable's engine could not run in the default cache location; its references were read directly.

## Verification record

Eight analytics tests, five production-configuration tests, and ten browser tests cover the shipped flows. The automated WCAG AA checks cover overview themes, a player workspace and the sign-in dialog; they are not a substitute for a complete accessibility audit. Desktop (1695px) and phone (390px) captures were inspected with live public data copied into a local browser fixture. An independent reviewer identified compressed calendar gaps in daily bars; normalized day anchors and numeric time axes fixed it, and the reviewer scored that finding resolved. The dashboard redesign left scoring tables and production scores unchanged; the later certificate extension adds its isolated registry.

## Certificate extension

A searchable roster sits beside the certificate preview, downloads, issued records and editing controls. Mobile stacks the bounded roster above the preview; a native full-size preview dialog supports Escape and keyboard focus. Accessible HTML repeats the entire certificate, message and approved comments.

The Midnight Trophy design pairs an original 3D Ludo board with a navy-and-brass Cinzel cover for **BETORA OF THE YEAR** and an ivory Baskervville cover for the other recipients. Player IDs select portraits, with monograms when a portrait is unavailable. The footer carries record verification. Longer comments and commendations flow onto attachment pages in the same palette.

The current #1 has a persistent site spotlight with reduced-motion support. Rank never means match wins. Ties and all-zero tables receive qualified wording; exact timestamp ties use ID order. Preview/export stay disabled until the exact model/message/page has finished rendering. Long comment collections and personal messages use attachment pages, preserving readable print sizes rather than silently clipping.

Oil UI guided a fresh independent visual and real-page UX review. Evidence: visual agent `/root/oil_certificate_visual_review`, screenshots in the working evidence directory; UX agent `/root/oil_certificate_ux_review`, actual localhost browser path and captures in `ux-certificate-review/`. Findings addressed: stronger crown distinction, full-size mobile inspection, paragraph orphans, missing-data emphasis, return from authentication directly to certificates, and consistent demo success wording. Preview screenshots use localhost URLs; production exports derive the deployed public origin and are checked after release.

Issued production records are immutable server snapshots in the public certificate registry. Only approved scorekeepers can publish selected private comments with explicit consent. Unissued previews, browser-local demo issuance, unavailable records and revoked certificates have distinct language. A fingerprint identifies the stored snapshot; verification does not authenticate an edited raster image.
