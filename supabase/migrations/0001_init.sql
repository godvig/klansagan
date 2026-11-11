-- Kinsaga · Supabase schema v1
--
-- One family tree = one row in `trees`. All people, places, sources and views
-- of a tree are JSON documents in `docs` (same document model as the app).
--
-- Access: a browser signs in anonymously (Supabase "anonymous sign-ins") and
-- joins a tree with its secret share link -> becomes a row in `tree_members`.
-- Row level security only lets members read and write a tree's documents.
-- Switching to e-mail login later keeps the same user ids and memberships.

-- ------------------------------------------------------------------ tables

create table public.trees (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Min släkt',
  share_secret text not null unique
               default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_by   uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table public.tree_members (
  tree_id   uuid not null references public.trees (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'editor' check (role in ('owner', 'editor')),
  joined_at timestamptz not null default now(),
  primary key (tree_id, user_id)
);

create table public.docs (
  tree_id    uuid not null references public.trees (id) on delete cascade,
  id         text not null,
  kind       text not null check (kind in ('person', 'place', 'source', 'view')),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (tree_id, id)
);

create index docs_tree_kind on public.docs (tree_id, kind);

-- ------------------------------------------------------------------ helpers

create or replace function public.is_member(t uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tree_members m
    where m.tree_id = t and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_owner(t uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tree_members m
    where m.tree_id = t and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- Stamp who changed a document and when.
create or replace function public.touch_doc()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger docs_touch
before insert or update on public.docs
for each row execute function public.touch_doc();

-- ------------------------------------------------------------------ RPCs

-- Create a tree; the caller becomes its owner. Returns id + share secret.
create or replace function public.create_tree(tree_name text default 'Min släkt')
returns table (id uuid, share_secret text)
language plpgsql security definer set search_path = ''
as $$
declare
  t public.trees;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.trees (name, created_by)
  values (coalesce(nullif(trim(tree_name), ''), 'Min släkt'), auth.uid())
  returning * into t;
  insert into public.tree_members (tree_id, user_id, role) values (t.id, auth.uid(), 'owner');
  return query select t.id, t.share_secret;
end;
$$;

-- Join a tree with its secret share link. Returns the tree id.
create or replace function public.join_tree(secret text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  t uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select tr.id into t from public.trees tr where tr.share_secret = secret;
  if t is null then
    raise exception 'invalid share link';
  end if;
  insert into public.tree_members (tree_id, user_id) values (t, auth.uid())
  on conflict do nothing;
  return t;
end;
$$;

-- Owner only: invalidate the old link and get a new secret.
create or replace function public.rotate_share_secret(t uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  s text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_owner(t) then
    raise exception 'only the owner can rotate the link';
  end if;
  update public.trees set share_secret = s where id = t;
  return s;
end;
$$;

revoke execute on function public.create_tree(text), public.join_tree(text), public.rotate_share_secret(uuid) from public, anon;
grant execute on function public.create_tree(text), public.join_tree(text), public.rotate_share_secret(uuid) to authenticated;

-- ------------------------------------------------------------------ row level security

alter table public.trees        enable row level security;
alter table public.tree_members enable row level security;
alter table public.docs         enable row level security;

create policy "members read their trees" on public.trees
  for select to authenticated using (public.is_member(id));
create policy "owner renames tree" on public.trees
  for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));
create policy "owner deletes tree" on public.trees
  for delete to authenticated using (public.is_owner(id));

create policy "members see co-members" on public.tree_members
  for select to authenticated using (public.is_member(tree_id));
create policy "members leave, owner removes" on public.tree_members
  for delete to authenticated using (user_id = auth.uid() or public.is_owner(tree_id));

create policy "members read docs" on public.docs
  for select to authenticated using (public.is_member(tree_id));
create policy "members add docs" on public.docs
  for insert to authenticated with check (public.is_member(tree_id));
create policy "members edit docs" on public.docs
  for update to authenticated using (public.is_member(tree_id)) with check (public.is_member(tree_id));
create policy "members delete docs" on public.docs
  for delete to authenticated using (public.is_member(tree_id));

-- ------------------------------------------------------------------ realtime

alter publication supabase_realtime add table public.docs;
