-- Släktsagan: version history.
-- Each version gets a small encrypted summary (who published, when, what changed),
-- so the history can be listed without downloading every full version.

alter table public.kl_versions add column if not exists meta text;

create or replace function public.kl_publish2(tree uuid, base_version integer, write_secret text, payload text, meta text)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare latest integer; h text;
begin
  perform public.kl_check_payload(payload);
  if meta is not null and (left(meta, 3) <> 'k1.' or length(meta) > 20000) then raise exception 'bad meta'; end if;
  select write_hash into h from kl_trees where id = tree for update;
  if h is null then raise exception 'not found'; end if;
  if h <> encode(digest(write_secret, 'sha256'), 'hex') then raise exception 'forbidden'; end if;
  select max(version) into latest from kl_versions where tree_id = tree;
  if latest <> base_version then raise exception 'conflict'; end if;
  insert into kl_versions(tree_id, version, payload, meta) values (tree, latest + 1, payload, meta);
  delete from kl_versions where tree_id = tree and version <= latest + 1 - 30;
  return latest + 1;
end $$;

-- The kept versions, newest first, with their encrypted summaries and sizes.
create or replace function public.kl_history(tree uuid)
returns table(version integer, created_at timestamptz, meta text, size integer)
language sql stable security definer set search_path = public as $$
  select v.version, v.created_at, v.meta, length(v.payload) from kl_versions v
  where v.tree_id = tree order by v.version desc;
$$;

revoke all on function public.kl_publish2(uuid, integer, text, text, text), public.kl_history(uuid) from public;
grant execute on function public.kl_publish2(uuid, integer, text, text, text), public.kl_history(uuid) to anon, authenticated;
