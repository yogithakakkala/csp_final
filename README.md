# SachiSeva — సచిసేవ

A bilingual (Telugu + English) community-service web app for Andhra Pradesh citizens.
A family answers a few questions **once** and sees **every welfare scheme they qualify for**,
their personal benefit and one combined document list — then **applies for all of them in one go**.
Every scheme and Sachivalayam service (certificates, rice card, land records…) has its own page
with who qualifies, documents, steps, fee and time limit, in both languages. Applications are
tracked step by step, staff chat with citizens, and the nearest Sachivalayam / MeeSeva is one tap away.

**Stack:** React 19 + Vite + Tailwind 4 (static SPA) · Supabase (auth, Postgres, storage, realtime) ·
two Vercel Functions in `/api` · OpenStreetMap for maps and centre search.

---

## Deploy to Vercel (10 minutes)

### 1. Database

**Option A — keep the database the app already uses.** The `.env` file already points to it,
so the site works as soon as it's deployed. To get the security fixes and the all-AP centre
import, run **`supabase/UPGRADE.sql`** once (it combines the files below), or run them one by one, in order:
`supabase/migrations/20261014000000_vercel_hardening.sql`, then
`supabase/migrations/20261015000000_catalog_profile.sql` (adds every scheme and service, and the family profile), then
`supabase/migrations/20261015010000_staff_key.sql` (staff key **4040** for staff login and sign-up).

**Option B — your own free Supabase project (recommended; you get the dashboard).**
1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query →** paste all of `supabase/schema.sql` → **Run**. It creates every
   table, security rule, the storage bucket for documents, and seeds 21 schemes, 16 Sachivalayam services and ~100 centres.
3. **Authentication → URL Configuration:** set *Site URL* to your Vercel URL
   (e.g. `https://sachiseva.vercel.app`) and add `https://sachiseva.vercel.app/**` to *Redirect URLs*.
   Without this, email confirmation and password-reset links point to localhost.
4. **Project Settings → API:** copy the *Project URL*, the *publishable* (or `anon`) key and the
   `service_role` key.

### 2. Vercel

1. Push this folder to GitHub, then **Vercel → Add New → Project →** import the repo.
   Vercel detects Vite automatically (`vercel.json` is included).
2. **Settings → Environment Variables:**

| Name | Value | Needed for |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL | everything |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable / anon key | everything |
| `GEMINI_API_KEY` | free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | SachiBot AI answers |
| `STAFF_SIGNUP_KEY` | `4040` (optional) | only for databases without the staff-key migration |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | importing all AP centres; staff-key fallback |
| `GOOGLE_MAPS_API_KEY` | *optional* — Google Cloud key with **Places API (New)** enabled | most accurate nearest-centre results |

   Instead of Gemini you can set `OPENAI_API_KEY`, `GROQ_API_KEY` or `OPENROUTER_API_KEY`
   (optionally `AI_MODEL`). **Without any AI key SachiBot still works** — it answers from a
   built-in bilingual FAQ.
3. **Deploy.** Deep links like `/my-applications/…` work thanks to the rewrite in `vercel.json`.

### 3. Check that everything works

Log in as staff → **System check**. It tests the live site in one go: database tables,
the v2 upgrade, document storage, live updates, centre search, Google Places, SachiBot
(it asks the AI a real question and shows the answer) and staff sign-up. Anything red
comes with the exact fix.

You can also paste `supabase/verify.sql` into the Supabase SQL editor — it lists every
table, column, function, trigger, policy and bucket the app needs and marks each OK or MISSING.

### 4. Staff accounts — staff key 4040

**Using the existing database without the upgrade?** Staff login with 4040 already works for accounts that are
staff. To let *new* staff register with 4040 (and get the security fixes, all schemes & services,
and saved family answers), run **`supabase/UPGRADE.sql`** once in the database's SQL editor. It's safe to run more than once. Until then, new staff can be promoted by an
existing staff member under **Staff accounts**, or by setting the Supabase secret
`ADMIN_SIGNUP_KEY` to `4040` (used by the `claim-staff-role` Edge Function).

Staff choose **Sachivalayam staff** on the sign-up or login page and type the staff key.
It is needed **every time** a staff member logs in; a staff account that tries to log in as a
citizen is told to use the staff option. The key is checked inside the database (nobody can read
it through the app), and 5 wrong tries lock that account out for 15 minutes.

The key is **4040**. To change it, run in the Supabase SQL editor:

```sql
update public.app_secrets set value = 'your-new-key' where name = 'staff_key';
```

From **Staff accounts** you can also promote existing accounts; they still need the key to log in.

---

## Schemes, services and one-click eligibility

* **Catalogue** — `src/data/catalog.ts` holds every scheme (with its status: open, opens in rounds,
  or announced-not-open) and every Sachivalayam service, in English and Telugu: summary, benefit,
  who qualifies, documents, steps, where to go, official fee and time limit, links, and
  machine-checkable rules. Edit this one file when a G.O. changes something, then run
  `npm run gen:catalog` (also runs on every build). That regenerates SachiBot's knowledge
  (`api/_knowledge.ts`) and `supabase/catalog_seed.sql` — paste the seed into the SQL editor to
  add new schemes/services to the database.
* **My schemes** (`/eligible`) — three short steps (about you, family & home, the government's
  six-step check). Anything skipped shows as "likely — confirm X" instead of a wrong "no".
  Results: qualify / likely / coming soon / not eligible (with reasons), personal benefits
  (e.g. pension amount by category, ₹15,000 × number of school children), and one deduplicated
  document list ticked against *My documents*. Answers are saved on the phone and in the account.
* **Apply for all** (`/apply-all`) — pick schemes, fill details once, upload each document once;
  one application (with its own number) is created per scheme, with the family answers attached
  for staff.
* Staff see services in the same queue as schemes (ids start with `svc-`). Staff can still add
  their own schemes in **Schemes**; if they edit a scheme's document list, the app shows their list.

## Nearest Sachivalayam & MeeSeva in one tap

Opening **Nearest centre** (or tapping it on Home / the landing page) asks for GPS once and
immediately shows **the nearest Sachivalayam and the nearest MeeSeva** with distance, travel
time, **Directions** (opens Google Maps navigation) and **Call**. It:

* uses a precise GPS fix (falls back to network location if GPS is slow) and shows how accurate it is;
  if the phone only gives an approximate location it says so and suggests turning on GPS;
* searches three sources at once and merges duplicates: your database (with staff crowd levels) →
  **Google Places** (if `GOOGLE_MAPS_API_KEY` is set — the most complete listing of AP offices) →
  OpenStreetMap;
* widens 3 → 8 → 20 → 45 km automatically until it finds both kinds;
* lets people type any village, town or PIN code instead of using GPS.

## All Sachivalayam & MeeSeva locations

The old version only knew ~50 hand-typed Visakhapatnam centres. Now:

* **Live search, all of AP.** *Find a centre* searches OpenStreetMap around the citizen's GPS
  location — or any village, town, mandal or PIN code they type — and merges the results with
  your database centres. It widens the search automatically in rural areas, and has a
  “Search this area” button when the map is moved. Results are cached on the phone for 3 days.
* **Import everything into your database (optional, recommended).** One command loads every
  secretariat, panchayat office, MeeSeva and Aadhaar centre mapped in AP, so staff can set crowd
  levels on them and they load instantly:

  ```bash
  npm install
  # put SUPABASE_SERVICE_ROLE_KEY in .env first
  npm run import:centers -- --dry-run      # see how many will be imported
  npm run import:centers                   # import (safe to re-run; updates in place)
  npm run import:centers -- --district=Guntur   # one district only
  ```

  Re-run it every few months to pick up newly mapped offices. Staff can correct any pin from
  **Centres & crowd** (“I'm at this centre — use my location” fills exact coordinates).

OpenStreetMap coverage is good in towns and patchier in villages; the page always offers a
Google Maps fallback link, and every centre staff add or fix makes it better for everyone.

---

## Tests

```bash
# database: every app operation as citizen / other citizen / staff / anonymous, with RLS on
psql "$DATABASE_URL" -f supabase/tests/app_flows.sql      # run on a throwaway database built from schema.sql
```

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173 — /api functions run too
npm run build      # type-check + production build into dist/
```

## What's where

```
api/chat.ts                 SachiBot (streams from Gemini/OpenAI/Groq/OpenRouter)
api/claim-staff.ts          verifies the staff key and grants staff access
api/places.ts               optional Google Places search for nearby centres
scripts/import-osm-centers.mjs   bulk-imports all AP centres from OpenStreetMap
supabase/schema.sql         complete setup for a new Supabase project
supabase/verify.sql         read-only check of your live database
supabase/tests/app_flows.sql  61 database checks covering every app flow
supabase/migrations/        history + 20261014000000_vercel_hardening.sql (run on existing DBs)
src/pages/                  citizen pages;  src/pages/admin/  staff panel
src/lib/places.ts           live OpenStreetMap search + geocoding + merge with DB centres
src/data/catalog.ts         every scheme & service, bilingual, with rules (edit here)
src/lib/rules.ts            eligibility rules that cope with unanswered questions
src/lib/profile.ts          the "answer once" family profile
src/lib/schemes.ts          merges the catalogue with the database; matches a profile to schemes
scripts/gen-catalog.mjs     regenerates SachiBot knowledge + catalog_seed.sql from the catalogue
src/components/ui.tsx       shared buttons, fields, sheets, badges
```

## Changes in v3

* Staff must enter the staff key (4040) to register **and** to log in; checked in the database.

* Full bilingual catalogue: 21 schemes (updated to 2026 amounts and names — NTR Bharosa ₹4,000–₹15,000,
  Talliki Vandanam, Annadata Sukhibhava, Deepam 2.0, Stree Shakti, Auto Driver Sevalo, Matsyakarula
  Sevalo, Nethanna Sevalo…) and 16 Sachivalayam services with fees and time limits.
* One-click eligibility for every scheme, combined document list, Apply for all.
* Scheme and service pages in both languages; documents shown in Telugu with the English name.
* Old Recommender and Eligibility Calculator pages replaced by My schemes (old links redirect).
* SachiBot knows every scheme and service (generated from the catalogue).

## Changes in v2

**Deployment:** removed TanStack Start, Nitro and the old hosted build config. The app was a
server-rendered shell around a client-side router, built for Cloudflare, so it couldn't run
correctly on Vercel. It's now a plain static SPA with Vercel Functions, and every page is
lazy-loaded.

**Features fixed**
* SachiBot works on Vercel (provider-agnostic, streaming, offline fallback, voice in/out).
* Scheme recommender no longer marks every scheme “eligible” (DB rules were empty `{}`).
* Staff crowd buttons were writing `'less'`, which the database rejected — fixed (`'low'`).
* Staff sign-up works with email confirmation on, and no longer needs an Edge Function.
* Certificate tokens (SC-…) can be tracked; the tracker shows the full timeline.
* Admin pages that existed but weren't reachable are wired in: Overview, Certificates, Staff accounts.
* Password reset flow added.
* Documents upload as soon as they're picked (no full-page reload), file names with Telugu or spaces
  no longer break uploads, 10 MB limit, documents saved once are offered again on the next application.
* Drafts save 2.5 s after you stop typing (was 30 s) and restore automatically.
* Typing indicators reach the other side; unread counts and live toasts fixed.

**Security (in the hardening migration)**
* Citizens could create an application already marked *approved* → forced to *submitted*.
* Citizens could post chat messages as *staff* → blocked.
* All certificate requests (names, phones, emails) were publicly readable → staff only; public lookup by token.
* Public tracker shows only the applicant's first name.
* Storage bucket for documents is created (old migrations never created it).
* One open grievance per application; no duplicate documents.
* Edge function no longer falls back to the staff key `1234`.

This is a community project and not an official Government of Andhra Pradesh website.
