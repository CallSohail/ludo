# Ludo Super League · Évry 2026

A public penalty dashboard and private scorekeeper, built with React, Vite, Recharts, and Supabase. Higher totals mean more recorded penalties, not more wins.

## Dashboard

- Overview with current totals, the top-three penalty race, daily awards and corrections, penalty-size distribution, standings, and recent changes.
- Searchable player directory with stable ranks, name sorting, and latest recorded activity.
- Linkable player workspaces with date filters, comparisons, score timelines, daily activity, award distribution, record details, paginated history, and CSV export.
- Accessible chart data tables, tooltips, keyboard controls, and dark/light themes. Dates use Europe/Paris.
- Scorekeeper sign-in, player creation/editing/archival, awards, explicit consent, negative-score protection, and signed correction workflows.
- Cached public data, automatic refresh, separate history/standings/receipt failures, demo storage recovery, and a rendering recovery screen.

Public history includes player IDs, point changes, timestamps and event numbers. Private score reasons and signed receipts stay in the scorekeeper unless an approved scorekeeper explicitly publishes selected reasons on an issued certificate. The database does not record complete matches: win rates, games played, opponents and winning streaks are deliberately not inferred from penalty events.

## Run and verify

```bash
npm ci
npm run dev
```

Without Supabase configuration, the app uses isolated browser demo storage. Demo scorekeeper credentials: `admin` / `ludo2026`. Demo scores do not update the live league. When persistent storage is blocked, demo state lasts only for the browser session.

```bash
npx playwright install chromium
npm test
npm run build
```

Tests cover analytics, production configuration and browser flows: awards, corrections, consent, search, ranking, date filters, comparison, pagination, CSV downloads, dialog keyboard behavior, missing profiles, empty/corrupted/blocked storage, long names, large scores, mobile/tablet layouts, themes, offline status, and automated WCAG AA checks. Analytics cases cover signed changes, real timestamps, daylight-saving boundaries, deduplication, date ranges, empty data and CSV formula protection. Tests explicitly disable production Supabase variables.

Fonts are bundled locally. Charts and database libraries are split into cacheable bundles.

## Production setup

The existing live site uses GitHub Pages and Supabase. The certificate registry adds the isolated schema, table and guarded RPCs in `supabase/verified-certificates.sql`; existing scoring tables and totals are unchanged.

1. Put the public frontend values in GitHub Actions secrets: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Use a publishable key or the legacy public anon key. Never use a secret/service-role key.
2. Set **Settings → Pages → Source → GitHub Actions**.
3. Production builds run `npm run build:production`; this blocks missing backend configuration and privileged frontend keys. Pull requests use a demo build, run all tests, and never deploy.
4. A push to `main` runs tests, builds with the configured production values, and deploys the Pages artifact. The existing URL is <https://callsohail.github.io/ludo/>.
5. Verify the live overview, player profile, current scores, history, fonts, chart assets and network requests after deployment. Validate scoring permissions with an authorized scorekeeper account before changing production scores.

For a **new Supabase project**, inspect the existing SQL files and apply the relevant setup in order: `supabase/schema.sql`, `supabase/enable-public-leaderboard.sql`, and `supabase/complete-crud-upgrade.sql`. The original schema alone supports 1–9 awards; the existing CRUD upgrade supports 1–999 and corrections. Create a separate scorekeeper Auth user and add its user ID to `public.admin_profiles` with `is_admin = true`. Review these scripts against an existing project before running them; do not reapply old repair scripts blindly.

Keep RLS and the admin-only RPC permission checks enabled. Public history must expose only the permitted fields. Backend backups, database advisor checks, email delivery, user provisioning, and live admin write permissions require access to the Supabase project; frontend tests do not establish those settings.

## Data interpretation

Current standings are all-time totals. Charts show available recorded changes within the selected period, starting at zero for that period. They can differ from current totals when earlier entries or opening balances are absent. Daily bars omit days without available entries and say so. Corrections are negative values and do not inflate the number or average of positive awards. Equal totals use player creation order.

See [DESIGN.md](./DESIGN.md) and [PRODUCT.md](./PRODUCT.md) for the design and product contracts. Design guidance includes [Unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0; [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design); [Impeccable](https://github.com/pbakaus/impeccable); and [Grafana dashboard guidance](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/).

## Player certificates

Open **Certificates** in the navigation, or **View player certificate** on a profile. Every active player has an individual certificate based on current all-time position and available history. The current #1 has a gold crown edition; other positions have matching podium or league editions. The #1 spotlight follows the current table and respects reduced-motion preferences.

Certificates use centered DM Sans typography on charcoal, with lime green, a small pink accent and a gold crown emblem for position #1. The same renderer drives the preview and exports. Use **Open full-size preview** to inspect small text on a phone.

Add a personal message and download an explicitly marked **unissued preview**, or sign in as scorekeeper to issue a permanent record. Scorekeepers can select up to 100 table comments from the latest 1,000 entries for that player. Comments are never included automatically: publication requires explicit approval. Issuance freezes the server-side recipient, rank, points, complete-history metrics, message and selected original comments. The server rejects stale rank/points, invalid comment ownership, unauthorised users and mismatched duplicate requests.

Issued certificates have a UUID, a SHA-256 snapshot fingerprint and a public verification page at `#verify=UUID`. QR codes and printed links appear on every page; PDFs also contain clickable link annotations. The page displays the original recipient, facts and published comments, with explicit missing, unavailable, demo and revoked states. It compares the public record, not the authenticity of a potentially modified image. Scorekeepers can revoke with a public reason; the original snapshot remains visible. Latest issued records for a player can be reopened from their certificate section, including after later changes to the standings.

**PDF** exports use A4 landscape pages with 3500 × 2475 artwork (about 300 DPI). **PNG** exports use the same resolution. Multiple-page recognitions include every selected comment on attachment pages; long or multiline personal commendations also receive an attachment. Multiple PNG pages download together as a ZIP. PDF is image-based, not tagged or digitally signed; the complete content is also available as accessible HTML.

Draft messages stay on the current device separately for each player. Issued production records are persisted in Supabase. Demo issuance is clearly labelled and stores records only in that browser; its links do not verify on another device.

For a new project, apply `supabase/verified-certificates.sql` after the existing league setup. The live Ludo project already has the registry migration. Public clients can read only approved published record fields. Only approved authenticated scorekeepers can issue/revoke through guarded functions; no client can directly insert, update or delete registry records. Backend transaction tests verified real-role issuance, comment ownership, replay, stale-score rejection, revocation, anonymous lookup and non-admin denial, with all test writes rolled back.

Tests cover per-player drafts, all-player render readiness, empty/archived/zero/tied states, long names and messages, comment publication consent, issuance/read-back/revocation, genuine PDF link targets, multipage PNG ZIP contents and dimensions, sign-in return, full-size preview keyboard behavior and responsive accessibility checks.

Current automated suite: 19 Node tests and 20 browser tests (39 total).
