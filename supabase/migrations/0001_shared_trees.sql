-- Släktsagan: shared family trees, end-to-end encrypted.
--
-- The server stores only ciphertext. The key lives in the share link's #fragment,
-- which browsers never send to a server, so neither Supabase nor the site owner
-- can read a tree. Anyone with the link can read and publish; the server checks
-- a write secret derived from the key (it stores only its SHA-256 hash).
--
-- Tables are closed to the API (RLS on, no policies). All access goes through
-- the security-definer functions below, which anon may execute.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.kl_trees (
  id          uuid primary key default gen_random_uuid(),
  write_hash  text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.kl_versions (
  tree_id     uuid not null references public.kl_trees(id) on delete cascade,
  version     integer not null,
  payload     text not null,
  created_at  timestamptz not null default now(),
  primary key (tree_id, version)
);

alter table public.kl_trees    enable row level security;
alter table public.kl_versions enable row level security;
revoke all on public.kl_trees, public.kl_versions from anon, authenticated;

-- 20 MB of ciphertext per version is plenty for text and small photos.
create or replace function public.kl_check_payload(payload text) returns void
language plpgsql immutable as $$
begin
  if payload is null or left(payload, 3) <> 'k1.' then raise exception 'bad payload'; end if;
  if length(payload) > 20000000 then raise exception 'payload too large'; end if;
end $$;

create or replace function public.kl_create_tree(write_secret text, payload text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare tid uuid;
begin
  perform public.kl_check_payload(payload);
  if length(write_secret) < 32 then raise exception 'bad secret'; end if;
  insert into kl_trees(write_hash) values (encode(digest(write_secret, 'sha256'), 'hex')) returning id into tid;
  insert into kl_versions(tree_id, version, payload) values (tid, 1, payload);
  return tid;
end $$;

-- Newest version number, cheap enough to poll.
create or replace function public.kl_head(tree uuid)
returns integer language sql stable security definer set search_path = public as $$
  select max(version) from kl_versions where tree_id = tree;
$$;

-- A given version, or the newest when ver is null.
create or replace function public.kl_get(tree uuid, ver integer default null)
returns table(version integer, payload text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select v.version, v.payload, v.created_at from kl_versions v
  where v.tree_id = tree and (ver is null or v.version = ver)
  order by v.version desc limit 1;
$$;

-- Publish on top of base_version. Fails with 'conflict' if someone else published first;
-- the client then merges and tries again. Keeps the latest 30 versions as history.
create or replace function public.kl_publish(tree uuid, base_version integer, write_secret text, payload text)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare latest integer; h text;
begin
  perform public.kl_check_payload(payload);
  select write_hash into h from kl_trees where id = tree for update;
  if h is null then raise exception 'not found'; end if;
  if h <> encode(digest(write_secret, 'sha256'), 'hex') then raise exception 'forbidden'; end if;
  select max(version) into latest from kl_versions where tree_id = tree;
  if latest <> base_version then raise exception 'conflict'; end if;
  insert into kl_versions(tree_id, version, payload) values (tree, latest + 1, payload);
  delete from kl_versions where tree_id = tree and version <= latest + 1 - 30;
  return latest + 1;
end $$;

revoke all on function public.kl_create_tree(text, text), public.kl_head(uuid), public.kl_get(uuid, integer),
  public.kl_publish(uuid, integer, text, text), public.kl_check_payload(text) from public;
grant execute on function public.kl_create_tree(text, text), public.kl_head(uuid), public.kl_get(uuid, integer),
  public.kl_publish(uuid, integer, text, text) to anon, authenticated;
