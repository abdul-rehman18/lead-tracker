-- Paste into the Supabase SQL editor. Row Level Security is the security
-- boundary of this app: every row is tied to the user who created it, and the
-- four policies below make sure a session can only see or touch its own rows.

create table leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id)
    on delete cascade default auth.uid(),
  name text not null,
  email text,
  source text,
  status text not null default 'New'
    check (status in ('New','Contacted','Signed')),
  created_at timestamptz not null default now()
);

alter table leads enable row level security;

create policy "own_select" on leads for select
  using (auth.uid() = user_id);
create policy "own_insert" on leads for insert
  with check (auth.uid() = user_id);
create policy "own_update" on leads for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_delete" on leads for delete
  using (auth.uid() = user_id);
