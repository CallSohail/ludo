# League dashboard design

Mode: Operate. A working league dashboard, replacing the rejected marketing layout.

## User tasks and composition

Players open the site to review penalty standings, understand score changes, and explore individual records. The top dock links to Overview, Players, Activity, Certificates, and House rules. On smaller screens the same dock floats along the bottom, with standings before metrics and charts. A compact, illustrated season header offers a direct path to the player directory.

Player profiles combine identity and score in one header, with date filters, a score timeline, comparisons, and event history below. Empty history has an explicit state. Every chart has an accessible data table or summary. The separate scorekeeper dialog uses the same theme and control styles as the public site.

## Glass materials

- Dark uses forest charcoal with mint highlights. Light uses pale mint with darker green controls. Rose provides a secondary tint, and gold marks the crown.
- The header, dock, and dialog backdrop use frosted blur. Denser panels support readable text, tables, and charts. Reduced-transparency preferences use solid surfaces.
- DM Sans, tabular figures, and persistent control labels keep dense scores readable. The content column is capped at 1328px and narrows to a single column on phones.
- The overview uses an original transparent WebP illustration. The certificate workspace follows the active theme and the print artwork retains its charcoal palette.

## Engineering constraints

History analytics use available events, not assumed match data. Positive awards, negative corrections, missing dates, zero totals, partial history, archived IDs, and ties need explicit handling. Date grouping uses Europe/Paris. Charts preserve true time spacing, provide tick labels and hover/focus values, and avoid stretched SVG points. All/7/30/90 day filters apply to history metrics and charts; current standings remain all-time and are labelled accordingly. CSV output escapes spreadsheet formula prefixes.

## Guidance

Glass material and lighting reference from the [Liquid Glass prompt library](https://liquidglassdesign.com/prompts).

[Unslop](https://github.com/heydamir/unslop), by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0; [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design); [Impeccable](https://github.com/pbakaus/impeccable), by Paul Bakaus; and [Grafana dashboard guidance](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/). Interface implementation is original. The user explicitly requested autonomous direction and replacement of the prior design; no concept-selection wait is required. Impeccable's engine could not run in the default cache location; its references were read directly.

## Verification record

Eight analytics tests, five production-configuration tests, and ten browser tests cover the shipped flows. The automated WCAG AA checks cover overview themes, a player workspace and the sign-in dialog; they are not a substitute for a complete accessibility audit. Desktop (1695px) and phone (390px) captures were inspected with live public data copied into a local browser fixture. An independent reviewer identified compressed calendar gaps in daily bars; normalized day anchors and numeric time axes fixed it, and the reviewer scored that finding resolved. The dashboard redesign left scoring tables and production scores unchanged; the later certificate extension adds its isolated registry.

## Certificate extension

A searchable roster sits beside the certificate preview, downloads, issued records and editing controls. Mobile stacks the bounded roster above the preview; a native full-size preview dialog supports Escape and keyboard focus. Accessible HTML repeats the entire certificate, message and approved comments.

The redesigned certificate is charcoal #101512 with green #b3e77f, white #f0f3e9, muted #b1bfae and a restrained pink #e1b0c3. DM Sans carries centered Recognition and recipient typography. The first position adds a gold #dec18b crown emblem and stronger inset border. Missing-history data receives secondary emphasis. A QR, printed verification link and explicit issuance status sit in the footer. The preview remains charcoal in both website themes.

The current #1 has a persistent site spotlight with reduced-motion support. Rank never means match wins. Ties and all-zero tables receive qualified wording; exact timestamp ties use ID order. Preview/export stay disabled until the exact model/message/page has finished rendering. Long comment collections and personal messages use attachment pages, preserving readable print sizes rather than silently clipping.

Oil UI guided a fresh independent visual and real-page UX review. Evidence: visual agent `/root/oil_certificate_visual_review`, screenshots in the working evidence directory; UX agent `/root/oil_certificate_ux_review`, actual localhost browser path and captures in `ux-certificate-review/`. Findings addressed: stronger crown distinction, full-size mobile inspection, paragraph orphans, missing-data emphasis, return from authentication directly to certificates, and consistent demo success wording. Preview screenshots use localhost URLs; production exports derive the deployed public origin and are checked after release.

Issued production records are immutable server snapshots in the public certificate registry. Only approved scorekeepers can publish selected private comments with explicit consent. Unissued previews, browser-local demo issuance, unavailable records and revoked certificates have distinct language. A fingerprint identifies the stored snapshot; verification does not authenticate an edited raster image.
