# Lead Tracker

A minimal lead-tracking demo: email/password login, a list of your leads
grouped by status (New / Contacted / Signed), a form to add a lead, and a
detail page per lead where you can move it between statuses.

Stack: Next.js (App Router), TypeScript, Tailwind, Supabase (Auth + Postgres),
Vercel.

The interesting part is access control. Read [SECURITY.md](SECURITY.md) for
where one account is stopped from reaching another account's data, and
[scripts/verify-isolation.md](scripts/verify-isolation.md) for the checks that
were run to prove it.

## Files

| File | Purpose |
| --- | --- |
| `supabase/schema.sql` | The `leads` table and its Row Level Security policies. |
| `lib/supabase/server.ts` | The one and only Supabase client: request-scoped, built from the session cookie. |
| `lib/statuses.ts` | The `New / Contacted / Signed` allowlist. |
| `proxy.ts` | Refreshes the session cookie and redirects logged-out visitors away from `/leads/*`. (Next.js 16 name for `middleware.ts`.) |
| `app/layout.tsx` | Page shell and the hardcoded footer. |
| `app/login/page.tsx`, `app/login/actions.ts` | Sign-in form, `login` and `logout` server actions. |
| `app/leads/page.tsx` | Your leads grouped by status, plus the add-lead form. |
| `app/leads/actions.ts` | `addLead` and `updateStatus` server actions. |
| `app/leads/[id]/page.tsx` | One lead, with buttons to change its status. Returns 404 for leads you do not own. |

## Setup

1. **Create a Supabase project** at <https://supabase.com/dashboard>.

2. **Create the table.** In the dashboard open *SQL Editor*, paste the
   contents of `supabase/schema.sql`, and run it.

3. **Create the two test users.** In the dashboard open
   *Authentication → Users → Add user → Create new user*. Enter an email and
   password and tick *Auto Confirm User*. Do this twice (user A and user B).
   There is intentionally no sign-up page in the app.

4. **Configure the app.**

   ```bash
   cp .env.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   from *Project Settings → API*. Either the newer publishable key
   (`sb_publishable_...`) or the legacy anon key works. Do **not** use the
   service role key anywhere; the app has no place for it.

5. **Run it.**

   ```bash
   npm install
   npm run dev
   ```

   Open <http://localhost:3000>, sign in as one of the test users, add a few
   leads.

## Deploy to Vercel

1. Push this folder to a Git repository and import it in Vercel.
2. Add the same two environment variables from `.env.local` under
   *Settings → Environment Variables*.
3. Deploy. No other configuration is required.

## Verify isolation yourself

Follow [scripts/verify-isolation.md](scripts/verify-isolation.md). It walks
through seeding leads for two users, then trying to read and update user A's
lead while signed in as user B, in the browser and with `curl`.
