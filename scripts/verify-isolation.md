# Verifying that account B cannot reach account A's leads

These checks were run on 13 September 2026 against a local Supabase stack
(`supabase start`, Postgres 17, GoTrue, PostgREST) with `supabase/schema.sql`
applied, and the app served by `next build && next start` on
<http://localhost:3000>. Everything below is real output, trimmed only for
width. Re-run it against any project by pointing `.env.local` at it.

Test accounts (created through the Auth API, the same as adding them in the
dashboard; the app has no sign-up page):

| User | Email | user id |
| --- | --- | --- |
| A | a@example.com | `fd62e9ec-9c0a-487e-ac29-88c94825385c` |
| B | b@example.com | `6c87a97e-09f0-4e00-ad75-84614d2d4797` |

Only the public (publishable) key is used anywhere in these checks.

## 0. Seed two leads under A and two under B

Done through the real UI (headless Chromium: sign in, fill the add-lead form
twice, sign out, repeat as B). The add-lead action sends no `user_id`; the
column default `auth.uid()` fills it.

```
logged in as a@example.com, now at http://localhost:3000/leads
  added lead "Alice One"
  added lead "Alice Two"
logged in as b@example.com, now at http://localhost:3000/leads
  added lead "Bob One"
  added lead "Bob Two"
```

Rows as seen by the Postgres superuser (test harness only, never the app):

```
$ docker exec -i supabase_db_lead-tracker psql -U postgres -d postgres -c \
  "select l.id, u.email as owner, l.name, l.status from leads l join auth.users u on u.id = l.user_id order by u.email, l.created_at;"
                  id                  |     owner     |   name    | status
--------------------------------------+---------------+-----------+--------
 d9c9cb27-603a-4499-991b-ff95994ba014 | a@example.com | Alice One | New
 735833be-6240-4e79-81a4-457e41680a4e | a@example.com | Alice Two | New
 ed754668-8890-4ec7-8efb-9cfd97ba11cb | b@example.com | Bob One   | New
 b6a7bc75-572a-42ee-aeeb-c09d5b53451b | b@example.com | Bob Two   | New
(4 rows)
```

`user_id` was set correctly for all four rows without the app ever sending it.

For the rest of this document:
A's lead = `d9c9cb27-603a-4499-991b-ff95994ba014` (Alice One),
B's lead = `ed754668-8890-4ec7-8efb-9cfd97ba11cb` (Bob One).

## 1. As B, open `/leads/<A's id>` in the browser. Expect 404.

Headless Chromium signs in as B through the login form, then navigates to
A's lead.

```
logged in as b@example.com
GET /leads/d9c9cb27-603a-4499-991b-ff95994ba014 as B -> HTTP 404, final url http://localhost:3000/leads/d9c9cb27-603a-4499-991b-ff95994ba014
contains "Alice": false
```

Result: **404**, no redirect, no lead data. Screenshot:
[b-opens-a-lead-404.png](b-opens-a-lead-404.png).

## 2. As B, curl the route that reads a single lead with B's cookie and A's id

Get B's session cookie in the exact format `@supabase/ssr` writes:

```
$ COOKIE=$(node scripts/session-cookie.mjs b@example.com password123)
$ echo "$COOKIE" | cut -d= -f1
sb-127-auth-token
```

A's lead, as B:

```
$ curl -s -o /tmp/a-lead-as-b.html -w "HTTP %{http_code}\n" -H "Cookie: $COOKIE" \
    http://localhost:3000/leads/d9c9cb27-603a-4499-991b-ff95994ba014
HTTP 404
$ grep -c Alice /tmp/a-lead-as-b.html
0
```

Control, B's own lead, same cookie:

```
$ curl -s -o /tmp/b-lead-as-b.html -w "HTTP %{http_code}\n" -H "Cookie: $COOKIE" \
    http://localhost:3000/leads/ed754668-8890-4ec7-8efb-9cfd97ba11cb
HTTP 200
$ grep -c 'Bob One' /tmp/b-lead-as-b.html
1
```

Does the 404 for A's lead differ from the 404 for an id that does not exist
at all? Fetch a made-up id, then diff the two bodies with the id normalised:

```
$ curl -s -o /tmp/none.html -w "HTTP %{http_code}\n" -H "Cookie: $COOKIE" \
    http://localhost:3000/leads/00000000-0000-0000-0000-000000000000
HTTP 404
$ diff <(sed 's/d9c9cb27-603a-4499-991b-ff95994ba014/<ID>/g' /tmp/a-lead-as-b.html | tr '>' '\n') \
       <(sed 's/00000000-0000-0000-0000-000000000000/<ID>/g' /tmp/none.html | tr '>' '\n')
(no output: identical)
```

"Someone else's lead" and "no such lead" are indistinguishable to B.

### 2b. Same check one layer down, straight at PostgREST with B's JWT

This bypasses Next.js entirely and talks to Supabase the way the app's client
does, to show the boundary is the database and not the page code.

```
$ JWT=$(curl -s -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
    -H "apikey: $KEY" -H "Content-Type: application/json" \
    -d '{"email":"b@example.com","password":"password123"}' | jq -r .access_token)

$ curl -s -w "\nHTTP %{http_code}\n" -H "apikey: $KEY" -H "Authorization: Bearer $JWT" \
    "http://127.0.0.1:54321/rest/v1/leads?id=eq.d9c9cb27-603a-4499-991b-ff95994ba014&select=*"
[]
HTTP 200

$ curl -s -w "\nHTTP %{http_code}\n" -H "apikey: $KEY" -H "Authorization: Bearer $JWT" \
    "http://127.0.0.1:54321/rest/v1/leads?select=name,status"
[{"name":"Bob One","status":"New"},
 {"name":"Bob Two","status":"New"}]
HTTP 200
```

B sees exactly B's two rows and nothing of A's, even with no filter at all.

## 3. As B, attempt a status update on A's lead id. Expect failure.

### 3a. Through the app's real `updateStatus` server action

Next.js renders each form with a hidden `$ACTION_ID_…` field so the form also
works without JavaScript. Take that id from B's own lead page and POST the
form as B, first at B's own lead (control) and then at A's.

```
$ ACTION=$(grep -o '\$ACTION_ID_[a-f0-9]*' /tmp/b-lead-as-b.html | sort -u | tail -1)

# control: own lead
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST -H "Cookie: $COOKIE" \
    -F "$ACTION=" -F "id=ed754668-8890-4ec7-8efb-9cfd97ba11cb" -F "status=Contacted" \
    http://localhost:3000/leads/ed754668-8890-4ec7-8efb-9cfd97ba11cb
HTTP 200
$ psql ... -c "select name||' -> '||status from leads where id='ed754668-...'"
Bob One -> Contacted

# A's lead, as B
$ curl -s -o /tmp/update-as-b.html -w "HTTP %{http_code}\n" -X POST -H "Cookie: $COOKIE" \
    -F "$ACTION=" -F "id=d9c9cb27-603a-4499-991b-ff95994ba014" -F "status=Signed" \
    http://localhost:3000/leads/d9c9cb27-603a-4499-991b-ff95994ba014
HTTP 404
$ grep -c Alice /tmp/update-as-b.html
0
$ psql ... -c "select name||' -> '||status from leads where id='d9c9cb27-...'"
Alice One -> New
```

The action ran, matched zero rows, answered 404, and A's lead is unchanged.

Allowlist check (requirement 5), own lead, status not in the list:

```
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST -H "Cookie: $COOKIE" \
    -F "$ACTION=" -F "id=ed754668-8890-4ec7-8efb-9cfd97ba11cb" -F "status=Bogus" \
    http://localhost:3000/leads/ed754668-8890-4ec7-8efb-9cfd97ba11cb
HTTP 500
# server log:
⨯ Error: Invalid status.
$ psql ... -c "select name||' -> '||status from leads where id='ed754668-...'"
Bob One -> Contacted
```

Rejected in the action before any query was sent.

### 3b. Straight at PostgREST with B's JWT

```
$ curl -s -w "\nHTTP %{http_code}\n" -X PATCH -H "apikey: $KEY" -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" -H "Prefer: return=representation" \
    -d '{"status":"Signed"}' \
    "http://127.0.0.1:54321/rest/v1/leads?id=eq.d9c9cb27-603a-4499-991b-ff95994ba014"
[]
HTTP 200
```

Zero rows updated. And two extra checks while here:

```
# B tries to insert a lead owned by A (requirement 3)
$ curl -s -w "\nHTTP %{http_code}\n" -X POST -H "apikey: $KEY" -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d '{"name":"Forged","user_id":"fd62e9ec-9c0a-487e-ac29-88c94825385c"}' \
    "http://127.0.0.1:54321/rest/v1/leads"
{"code":"42501","details":null,"hint":null,"message":"new row violates row-level security policy for table \"leads\""}
HTTP 403

# B sets an invalid status on its own lead, bypassing the app (DB CHECK constraint)
$ curl -s -w "\nHTTP %{http_code}\n" -X PATCH -H "apikey: $KEY" -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" -d '{"status":"Bogus"}' \
    "http://127.0.0.1:54321/rest/v1/leads?id=eq.ed754668-8890-4ec7-8efb-9cfd97ba11cb"
{"code":"23514","details":null,"hint":null,"message":"new row for relation \"leads\" violates check constraint \"leads_status_check\""}
HTTP 400
```

## 4. grep the whole repo for the service-role key name. Expect no matches.

Run after the local Supabase config used for these checks was removed, so
the tree is exactly what gets committed (`node_modules` and `.next` excluded).
The `[_]` in the pattern is a one-character class that matches a plain
underscore, so the command finds the key name in every file while this file
does not contain the plain string and cannot match itself.

```
$ grep -rn "service[_]role" . --exclude-dir=node_modules --exclude-dir=.next
$ echo $?
1
```

No matches (exit code 1). The only Supabase clients in the repo are
`createServerClient` in `lib/supabase/server.ts` and `proxy.ts`, both built
with the public key plus the request's cookies.

## Final database state

```
   name    |     owner     | status
-----------+---------------+-----------
 Alice One | a@example.com | New
 Alice Two | a@example.com | New
 Bob One   | b@example.com | Contacted
 Bob Two   | b@example.com | New
```

A's rows were never read, changed, or created by B.
