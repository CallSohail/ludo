# Ludo Super League, Evry 2026

A playful, live leaderboard for your Ludo nights. Standings and limited score history are public; the scorekeeper deck is protected by Supabase Auth. Production score awards are stored as signed, hash-linked events.

## What is included

- Public standings, top-three cards, player profiles, search, sorting, score comparisons, house rules, recent activity, and dark/light themes.
- Admin panel for adding players and awarding 1 to 999 points (with the CRUD upgrade applied).
- Consent checkbox before every point is published.
- Hash-linked point ledger, each event records the previous hash, current time, admin identity, reason, and points.
- Supabase Auth, Row Level Security, explicit Data API grants, and optional Supabase Realtime updates.
- Demo mode with local browser storage, so the design can be previewed before Supabase is configured.
- GitHub Pages workflow, using Vite's relative asset paths.

## Run it locally

```bash
npm install
cp .env.example .env
npm run dev
```

Without Supabase values, the app runs in demo mode. The preview login is:

```text
username: admin
password: ludo2026
```

Demo data is stored only in the current browser. Do not use demo mode for the public league.

## Connect Supabase

1. Create a Supabase project.
2. Open the SQL Editor and run [`supabase/schema.sql`](./supabase/schema.sql). For the current public leaderboard and scorekeeper features, apply the existing [`enable-public-leaderboard.sql`](./supabase/enable-public-leaderboard.sql) and [`complete-crud-upgrade.sql`](./supabase/complete-crud-upgrade.sql) scripts after the schema. Review these scripts against an existing project before applying them; this frontend redesign does not change the database.
3. Create the shared viewer in **Authentication → Users → Add user**:
   - Email: `sohail.cs951+ludoguys@gmail.com`
   - Password: set the shared password privately in Supabase
   - Enable auto-confirm when the dashboard offers it
4. The site maps the public username `ludoguys` to that internal Auth email. Never put the shared password in this repository.
5. Create a separate Auth user for the scorekeeper, using the email and password you want for the admin deck.
6. Add the scorekeeper to the admin allow-list. Replace the email in this query:

```sql
insert into public.admin_profiles (user_id, display_name, is_admin)
select id, 'Sohail, chief scorekeeper', true
from auth.users
where email = 'your-admin-email@example.com'
on conflict (user_id) do update
set is_admin = true, display_name = excluded.display_name;
```

7. Copy your project URL and publishable key into `.env`:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Use only the publishable key in this frontend. Never place a `service_role` or secret key in GitHub Pages code.

## Your Sohail Hand font

The app supports the font URL you supplied. The URL currently contains the placeholder `YOUR-USERNAME`, so replace it with the GitHub username that owns the `sohail-hand` repository:

```text
VITE_SOHAIL_FONT_URL=https://cdn.jsdelivr.net/gh/YOUR-USERNAME/sohail-hand@v1.0/SohailHand-Regular.woff2
```

If that value is left unchanged, the site gracefully falls back to the included Google fonts, Baloo 2 and Space Grotesk.

## Publish on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository settings, add these Actions secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SOHAIL_FONT_URL`
3. In **Settings → Pages**, choose **GitHub Actions** as the source.
4. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes the static app.

The Supabase URL and publishable key are public frontend values. The real protection comes from Auth, RLS, and the admin-only database functions in the schema.

## Important edge cases handled

- Duplicate player names are rejected, case-insensitively.
- Blank or very short names and reasons are rejected.
- Awards use whole numbers from 1 through 999 with the existing CRUD database upgrade. The original schema alone supports only 1 through 9.
- Inactive or missing players cannot receive points.
- Two simultaneous point submissions are serialized before the previous hash is read.
- Equal scores are ordered by the earlier player's creation time, so the board does not jump randomly.
- A failed network request leaves the visible board unchanged and shows a retry message.
- Fireworks are also disabled for users who prefer reduced motion.

## Verify the chain

In Supabase SQL Editor, this query should return zero rows when the event chain is intact:

```sql
with ordered as (
  select *, lag(event_hash) over (order by event_number) as expected_previous_hash
  from public.point_events
)
select event_number, previous_hash, expected_previous_hash
from ordered
where event_number > 1 and previous_hash <> expected_previous_hash;
```

## Frontend verification

```bash
npm ci
npx playwright install chromium
npm test
npm run build
```

Tests use isolated local demo data and do not write to the production league. See [DESIGN.md](./DESIGN.md) for the visual direction, accessibility work, test coverage, and Unslop attribution.
