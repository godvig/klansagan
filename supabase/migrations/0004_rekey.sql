-- Släktsagan: read-only links and changing keys.
--
-- Trees shared from now on have two keys in their links: a read key (everyone) and an
-- editor key (only those who may edit). The write secret is derived from the editor key,
-- so a read-only link cannot publish. Living people's details, comments and their photos
-- are encrypted with the editor key, so readers cannot decrypt them either.
--
-- kl_rekey publishes a new version and replaces the write secret in one step. It is used
-- to turn an old single-key tree into one with read-only links, and to change a link
-- (for example to lock out someone who should no longer edit).

create or replace function public.kl_rekey(tree uuid, base_version integer, write_secret text,
  new_write_hash text, payload text, meta text)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare latest integer; h text;
begin
  perform public.kl_check_payload(payload);
  if meta is not null and (left(meta, 3) <> 'k1.' or length(meta) > 20000) then raise exception 'bad meta'; end if;
  if new_write_hash is null or new_write_hash !~ '^[0-9a-f]{64}$' then raise exception 'bad hash'; end if;
  select write_hash into h from kl_trees where id = tree for update;
  if h is null then raise exception 'not found'; end if;
  if h <> encode(digest(write_secret, 'sha256'), 'hex') then raise exception 'forbidden'; end if;
  select max(version) into latest from kl_versions where tree_id = tree;
  if latest <> base_version then raise exception 'conflict'; end if;
  insert into kl_versions(tree_id, version, payload, meta) values (tree, latest + 1, payload, meta);
  delete from kl_versions where tree_id = tree and version <= latest + 1 - 30;
  update kl_trees set write_hash = new_write_hash where id = tree;
  return latest + 1;
end $$;

revoke all on function public.kl_rekey(uuid, integer, text, text, text, text) from public;
grant execute on function public.kl_rekey(uuid, integer, text, text, text, text) to anon, authenticated;
