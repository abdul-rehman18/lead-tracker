# Security

This document answers one question: **where exactly is account A stopped from
reaching account B's leads, and why was it done that way?**

## The boundary is Postgres Row Level Security

The `leads` table has `user_id` on every row and four policies (see
`supabase/schema.sql`):

| Operation | Rule |
| --- | --- |
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id` (checked on the new row) |
| UPDATE | `auth.uid() = user_id` (checked on the existing row and the new row) |
| DELETE | `auth.uid() = user_id` |

`auth.uid()` is the user id that Postgres reads out of the JWT attached to the
current connection. Supabase sets it for every request that carries a user's
access token. A query made with account B's token therefore cannot return,
change, or delete a row whose `user_id` is account A, no matter what the
application code asks for. The database itself refuses; the row simply does
not exist from B's point of view.

This is the *only* place the check lives. The app does not add a
`.eq("user_id", ...)` filter anywhere, on purpose: if application-level
filtering were the boundary, forgetting it once, in one query, would leak data.
Here there is nothing to forget.

## Every query carries the caller's own token

`lib/supabase/server.ts` is the single Supabase client in the app. It is
created per request with `@supabase/ssr`, using:

- the project URL and the **public** (anon / publishable) key, and
- the session cookie of whoever made the request.

The public key on its own grants nothing beyond what RLS allows. The session
cookie is what tells Postgres *who* is asking. So a request from B is a
request as B, everywhere: the leads list, the detail page, the add-lead
action, and the status-update action all go through this client.

The **service-role key**, which would bypass RLS, is not present anywhere in
this repository, not in code, not in `.env.example`, not in any route or
action. A repo-wide grep for it returns nothing (see
`scripts/verify-isolation.md`). There is no code path capable of bypassing
RLS, because there is no client that could.

## `user_id` is never taken from the client

The add-lead action (`app/leads/actions.ts`) inserts only `name`, `email`, and
`source`. It does not read `user_id` from the form, the query string, or the
body, and does not set it at all. The column's default is `auth.uid()`, so
Postgres fills it in from the caller's token. Even if a client crafted a
request that included a `user_id`, the INSERT policy's `with check` would
reject any value other than the caller's own id.

## The detail page returns 404, not 403

`app/leads/[id]/page.tsx` looks the lead up by id through the session-scoped
client. Because of the SELECT policy, a lead that belongs to another account
comes back as *no row*, exactly the same as an id that was never created. The
page calls `notFound()` in both cases.

Returning 403 would say "this id exists, but it is not yours." That confirms
the existence of another user's record and lets someone enumerate valid ids.
404 says nothing either way, which is the correct amount of information.

The status-update action follows the same rule. The UPDATE matches zero rows
for a lead the caller does not own, and the action calls `notFound()` rather
than reporting a permission error.

## Status values are validated before the database is touched

`updateStatus` checks the submitted status against the allowlist in
`lib/statuses.ts` (`New`, `Contacted`, `Signed`) and throws if it is anything
else. The database `CHECK` constraint enforces the same list as a second line
of defence.

## `proxy.ts` is a convenience, not a security control

`proxy.ts` (Next.js 16's name for `middleware.ts`) refreshes the session cookie
and redirects visitors without a session from `/leads/*` to `/login`. That is
a nicer experience than showing an empty page. It is **not** what protects the
data. If the redirect were removed, an unauthenticated request would still hit
Postgres with no user id, `auth.uid()` would be null, and RLS would return
nothing.

## Why this design

- **One boundary, in the database.** RLS applies to every query regardless of
  which page, action, or future feature issues it. There is no way to write a
  query in this app that reaches another user's rows, so the boundary cannot
  be forgotten or bypassed by application code.
- **No privileged client.** With no service role key in the codebase there is
  nothing to leak and no code path to misuse.
- **Fail closed.** Missing session, wrong session, forged `user_id`, guessed
  id: every one of these ends in an empty result, and the app treats an empty
  result as 404.
