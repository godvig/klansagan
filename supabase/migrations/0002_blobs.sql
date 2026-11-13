-- Släktsagan: encrypted photos for shared trees.
-- Each photo is stored once, encrypted in the browser with the tree's key, and only
-- referenced from the tree data ("kl:<id>"). Publishing a tree then never re-sends photos.

create table if not exists public.kl_blobs (
  tree_id     uuid not null references public.kl_trees(id) on delete cascade,
  id          text not null check (id ~ '^[A-Za-z0-9_-]{8,64}$'),
  payload     text not null,
  created_at  timestamptz not null default now(),
  primary key (tree_id, id)
);
alter table public.kl_blobs enable row level security;
revoke all on public.kl_blobs from anon, authenticated;

-- Store one encrypted photo (max ~4 MB of ciphertext). Same id twice is a no-op.
create or replace function public.kl_put_blob(tree uuid, write_secret text, blob_id text, payload text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  if payload is null or left(payload, 3) <> 'k1.' then raise exception 'bad payload'; end if;
  if length(payload) > 4000000 then raise exception 'payload too large'; end if;
  select write_hash into h from kl_trees where id = tree;
  if h is null then raise exception 'not found'; end if;
  if h <> encode(digest(write_secret, 'sha256'), 'hex') then raise exception 'forbidden'; end if;
  insert into kl_blobs(tree_id, id, payload) values (tree, blob_id, payload) on conflict do nothing;
end $$;

-- Fetch up to 50 photos at a time.
create or replace function public.kl_get_blobs(tree uuid, ids text[])
returns table(id text, payload text) language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(array_length(ids, 1), 0) > 50 then raise exception 'too many ids'; end if;
  return query select b.id, b.payload from kl_blobs b where b.tree_id = tree and b.id = any(ids);
end $$;

revoke all on function public.kl_put_blob(uuid, text, text, text), public.kl_get_blobs(uuid, text[]) from public;
grant execute on function public.kl_put_blob(uuid, text, text, text), public.kl_get_blobs(uuid, text[]) to anon, authenticated;
