-- VH Imports — upload de foto pelo painel, seções editáveis da vitrine
-- e arquivamento (soft delete) de modelos do catálogo fixo.
--
-- Mantém o mesmo padrão de segurança do restante do projeto: RPCs com
-- security definer, checagem de public.is_active_staff(), idempotência via
-- private.claim_request e auditoria em logs_auditoria.
begin;

-- 1. Catálogo: foto enviada pelo painel + arquivamento reversível -----------

alter table public.vh_catalogo_produtos
  add column if not exists image_path text,
  add column if not exists archived_at timestamptz;

-- A foto pode vir de um upload (image_path) em vez da chave fixa versionada
-- no projeto; a constraint abaixo passa a exigir pelo menos uma das duas.
alter table public.vh_catalogo_produtos
  alter column image_key drop not null;

alter table public.vh_catalogo_produtos
  drop constraint if exists vh_catalogo_produtos_image_source_check;
alter table public.vh_catalogo_produtos
  add constraint vh_catalogo_produtos_image_source_check
  check (coalesce(trim(image_key), '') <> '' or coalesce(trim(image_path), '') <> '');

create index if not exists vh_catalogo_produtos_archived_idx
  on public.vh_catalogo_produtos(archived_at);

-- Um modelo arquivado nunca pode continuar publicado na vitrine.
alter table public.vh_catalogo_produtos
  drop constraint if exists vh_catalogo_produtos_archived_not_active_check;
alter table public.vh_catalogo_produtos
  add constraint vh_catalogo_produtos_archived_not_active_check
  check (archived_at is null or not active);

-- create_vh_catalog_product ganha p_image_path (upload) ao lado de
-- p_image_key (fotos já versionadas no projeto); a assinatura muda, então
-- a função antiga precisa ser removida antes de recriar.
drop function if exists public.create_vh_catalog_product(
  text, text, text, text, text, text, numeric, numeric, boolean, boolean, integer, uuid
);

create function public.create_vh_catalog_product(
  p_slug text,
  p_name text,
  p_brand text,
  p_category text,
  p_image_key text,
  p_image_path text,
  p_description text,
  p_sale_price numeric,
  p_promotional_price numeric,
  p_active boolean,
  p_featured boolean,
  p_sort_order integer,
  p_request_id uuid
) returns public.vh_catalogo_produtos
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_result uuid;
  catalog_row public.vh_catalogo_produtos;
begin
  if not public.is_active_staff() then
    raise exception 'Acesso de administrador necessário' using errcode = '42501';
  end if;
  if coalesce(trim(p_slug), '') = '' or trim(p_slug) !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Identificador do modelo inválido';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_brand), '') = '' or
     coalesce(trim(p_category), '') = '' then
    raise exception 'Nome, marca e categoria são obrigatórios';
  end if;
  if coalesce(trim(p_image_key), '') = '' and coalesce(trim(p_image_path), '') = '' then
    raise exception 'Escolha uma foto já cadastrada ou envie uma foto nova';
  end if;
  if p_sale_price is null or p_sale_price < 0 or p_sale_price <> round(p_sale_price, 2) then
    raise exception 'Preço normal inválido';
  end if;
  if p_promotional_price is not null and
     (p_promotional_price <= 0 or p_promotional_price > p_sale_price or p_promotional_price <> round(p_promotional_price, 2)) then
    raise exception 'Preço promocional inválido';
  end if;
  if coalesce(p_active, false) and p_sale_price <= 0 then
    raise exception 'Informe o preço normal antes de publicar o produto';
  end if;
  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'Ordem de exibição inválida';
  end if;

  request_result := private.claim_request(
    p_request_id,
    'vh_catalog_create_product',
    jsonb_build_array(p_slug, p_name, p_brand, p_category, p_image_key, p_image_path, p_description,
      p_sale_price, p_promotional_price, p_active, p_featured, p_sort_order)
  );
  if request_result is not null then
    select * into catalog_row from public.vh_catalogo_produtos where id = request_result;
    return catalog_row;
  end if;

  insert into public.vh_catalogo_produtos
    (slug, name, brand, category, image_key, image_path, description, sale_price, promotional_price, active, featured, sort_order, created_by)
  values
    (trim(p_slug), trim(p_name), trim(p_brand), trim(p_category),
      nullif(trim(p_image_key), ''), nullif(trim(p_image_path), ''), nullif(trim(p_description), ''),
      p_sale_price, p_promotional_price, coalesce(p_active, false), coalesce(p_featured, false), p_sort_order, auth.uid())
  returning * into catalog_row;

  update private.requests set result_id = catalog_row.id where request_id = p_request_id;
  return catalog_row;
exception
  when unique_violation then
    raise exception 'Já existe um modelo com este nome interno';
end;
$$;

revoke all on function public.create_vh_catalog_product(
  text, text, text, text, text, text, text, numeric, numeric, boolean, boolean, integer, uuid
) from public, anon;
grant execute on function public.create_vh_catalog_product(
  text, text, text, text, text, text, text, numeric, numeric, boolean, boolean, integer, uuid
) to authenticated;

-- Troca a foto de um modelo já cadastrado (upload novo ou foto fixa).
create or replace function public.update_vh_catalog_photo(
  p_product_id uuid,
  p_image_key text,
  p_image_path text,
  p_request_id uuid
) returns public.vh_catalogo_produtos
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_result uuid;
  catalog_row public.vh_catalogo_produtos;
begin
  if not public.is_active_staff() then
    raise exception 'Acesso de administrador necessário' using errcode = '42501';
  end if;
  if coalesce(trim(p_image_key), '') = '' and coalesce(trim(p_image_path), '') = '' then
    raise exception 'Escolha uma foto já cadastrada ou envie uma foto nova';
  end if;

  request_result := private.claim_request(
    p_request_id,
    'vh_catalog_photo',
    jsonb_build_array(p_product_id, p_image_key, p_image_path)
  );
  if request_result is not null then
    select * into catalog_row from public.vh_catalogo_produtos where id = request_result;
    return catalog_row;
  end if;

  update public.vh_catalogo_produtos
  set image_key = nullif(trim(p_image_key), ''),
      image_path = nullif(trim(p_image_path), '')
  where id = p_product_id and archived_at is null
  returning * into catalog_row;

  if catalog_row.id is null then
    raise exception 'Produto fixo não encontrado ou arquivado';
  end if;

  update private.requests set result_id = catalog_row.id where request_id = p_request_id;
  return catalog_row;
end;
$$;

revoke all on function public.update_vh_catalog_photo(uuid, text, text, uuid) from public, anon;
grant execute on function public.update_vh_catalog_photo(uuid, text, text, uuid) to authenticated;

-- Arquivar/restaurar substitui a exclusão definitiva: o modelo some da
-- vitrine, mas o registro e o histórico de auditoria continuam no banco.
create or replace function public.archive_vh_catalog_product(
  p_product_id uuid,
  p_request_id uuid
) returns public.vh_catalogo_produtos
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_result uuid;
  catalog_row public.vh_catalogo_produtos;
begin
  if not public.is_active_staff() then
    raise exception 'Acesso de administrador necessário' using errcode = '42501';
  end if;

  request_result := private.claim_request(p_request_id, 'vh_catalog_archive', jsonb_build_array(p_product_id));
  if request_result is not null then
    select * into catalog_row from public.vh_catalogo_produtos where id = request_result;
    return catalog_row;
  end if;

  update public.vh_catalogo_produtos
  set active = false,
      archived_at = now()
  where id = p_product_id and archived_at is null
  returning * into catalog_row;

  if catalog_row.id is null then
    raise exception 'Produto fixo não encontrado ou já arquivado';
  end if;

  update private.requests set result_id = catalog_row.id where request_id = p_request_id;
  return catalog_row;
end;
$$;

revoke all on function public.archive_vh_catalog_product(uuid, uuid) from public, anon;
grant execute on function public.archive_vh_catalog_product(uuid, uuid) to authenticated;

create or replace function public.restore_vh_catalog_product(
  p_product_id uuid,
  p_request_id uuid
) returns public.vh_catalogo_produtos
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_result uuid;
  catalog_row public.vh_catalogo_produtos;
begin
  if not public.is_active_staff() then
    raise exception 'Acesso de administrador necessário' using errcode = '42501';
  end if;

  request_result := private.claim_request(p_request_id, 'vh_catalog_restore', jsonb_build_array(p_product_id));
  if request_result is not null then
    select * into catalog_row from public.vh_catalogo_produtos where id = request_result;
    return catalog_row;
  end if;

  -- Volta como rascunho (não publicado): o master decide se e quando
  -- reativar a publicação, já que o preço pode precisar de revisão.
  update public.vh_catalogo_produtos
  set archived_at = null
  where id = p_product_id and archived_at is not null
  returning * into catalog_row;

  if catalog_row.id is null then
    raise exception 'Produto fixo não encontrado ou não está arquivado';
  end if;

  update private.requests set result_id = catalog_row.id where request_id = p_request_id;
  return catalog_row;
end;
$$;

revoke all on function public.restore_vh_catalog_product(uuid, uuid) from public, anon;
grant execute on function public.restore_vh_catalog_product(uuid, uuid) to authenticated;

-- Permite remover o arquivo antigo do Storage ao trocar a foto.
drop policy if exists "VH Imports staff can delete product images" on storage.objects;
create policy "VH Imports staff can delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.is_active_staff());

-- 2. Seções editáveis da vitrine (blocos "Para onde você vai?") ------------

create table if not exists public.vh_catalogo_secoes (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  detail text not null,
  tone text not null default 'dark' check (tone in ('dark', 'lime', 'orange', 'blue')),
  sort_order integer not null default 0,
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.perfis(id),
  updated_by uuid references public.perfis(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (archived_at is null or not active)
);

create index if not exists vh_catalogo_secoes_publication_idx
  on public.vh_catalogo_secoes(active, sort_order, title);

alter table public.vh_catalogo_secoes enable row level security;
revoke all on public.vh_catalogo_secoes from anon, authenticated;
grant select on public.vh_catalogo_secoes to authenticated;

drop policy if exists "masters can view vh sections" on public.vh_catalogo_secoes;
create policy "masters can view vh sections"
on public.vh_catalogo_secoes for select to authenticated
using (public.is_active_staff());

drop trigger if exists vh_catalogo_secoes_set_updated_at on public.vh_catalogo_secoes;
create trigger vh_catalogo_secoes_set_updated_at
before update on public.vh_catalogo_secoes
for each row execute function public.set_vh_catalog_updated_at();

create or replace function private.audit_vh_secoes_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_data jsonb;
  after_data jsonb;
  entity_id uuid;
begin
  if tg_op <> 'INSERT' then before_data := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_data := to_jsonb(new); end if;
  entity_id := coalesce((after_data->>'id')::uuid, (before_data->>'id')::uuid);
  insert into public.logs_auditoria(user_id, action, entity_type, entity_id, old_data, new_data)
  values (auth.uid(), tg_op, 'public.vh_catalogo_secoes', entity_id, before_data, after_data);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists vh_catalogo_secoes_audit on public.vh_catalogo_secoes;
create trigger vh_catalogo_secoes_audit
after insert or update or delete on public.vh_catalogo_secoes
for each row execute function private.audit_vh_secoes_change();

create or replace function public.create_vh_catalog_section(
  p_title text,
  p_detail text,
  p_tone text,
  p_sort_order integer,
  p_active boolean,
  p_request_id uuid
) returns public.vh_catalogo_secoes
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_result uuid;
  section_row public.vh_catalogo_secoes;
begin
  if not public.is_active_staff() then
    raise exception 'Acesso de administrador necessário' using errcode = '42501';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_detail), '') = '' then
    raise exception 'Título e descrição são obrigatórios';
  end if;
  if coalesce(p_tone, '') not in ('dark', 'lime', 'orange', 'blue') then
    raise exception 'Cor da seção inválida';
  end if;
  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'Ordem de exibição inválida';
  end if;

  request_result := private.claim_request(
    p_request_id,
    'vh_section_create',
    jsonb_build_array(p_title, p_detail, p_tone, p_sort_order, p_active)
  );
  if request_result is not null then
    select * into section_row from public.vh_catalogo_secoes where id = request_result;
    return section_row;
  end if;

  insert into public.vh_catalogo_secoes (title, detail, tone, sort_order, active, created_by)
  values (trim(p_title), trim(p_detail), p_tone, p_sort_order, coalesce(p_active, true), auth.uid())
  returning * into section_row;

  update private.requests set result_id = section_row.id where request_id = p_request_id;
  return section_row;
exception
  when unique_violation then
    raise exception 'Já existe uma seção com este título';
end;
$$;

revoke all on function public.create_vh_catalog_section(text, text, text, integer, boolean, uuid) from public, anon;
grant execute on function public.create_vh_catalog_section(text, text, text, integer, boolean, uuid) to authenticated;

create or replace function public.update_vh_catalog_section(
  p_section_id uuid,
  p_title text,
  p_detail text,
  p_tone text,
  p_sort_order integer,
  p_active boolean,
  p_request_id uuid
) returns public.vh_catalogo_secoes
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_result uuid;
  section_row public.vh_catalogo_secoes;
begin
  if not public.is_active_staff() then
    raise exception 'Acesso de administrador necessário' using errcode = '42501';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_detail), '') = '' then
    raise exception 'Título e descrição são obrigatórios';
  end if;
  if coalesce(p_tone, '') not in ('dark', 'lime', 'orange', 'blue') then
    raise exception 'Cor da seção inválida';
  end if;
  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'Ordem de exibição inválida';
  end if;

  request_result := private.claim_request(
    p_request_id,
    'vh_section_update',
    jsonb_build_array(p_section_id, p_title, p_detail, p_tone, p_sort_order, p_active)
  );
  if request_result is not null then
    select * into section_row from public.vh_catalogo_secoes where id = request_result;
    return section_row;
  end if;

  update public.vh_catalogo_secoes
  set title = trim(p_title),
      detail = trim(p_detail),
      tone = p_tone,
      sort_order = p_sort_order,
      active = coalesce(p_active, false)
  where id = p_section_id and archived_at is null
  returning * into section_row;

  if section_row.id is null then
    raise exception 'Seção não encontrada ou arquivada';
  end if;

  update private.requests set result_id = section_row.id where request_id = p_request_id;
  return section_row;
exception
  when unique_violation then
    raise exception 'Já existe uma seção com este título';
end;
$$;

revoke all on function public.update_vh_catalog_section(uuid, text, text, text, integer, boolean, uuid) from public, anon;
grant execute on function public.update_vh_catalog_section(uuid, text, text, text, integer, boolean, uuid) to authenticated;

create or replace function public.archive_vh_catalog_section(
  p_section_id uuid,
  p_request_id uuid
) returns public.vh_catalogo_secoes
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_result uuid;
  section_row public.vh_catalogo_secoes;
begin
  if not public.is_active_staff() then
    raise exception 'Acesso de administrador necessário' using errcode = '42501';
  end if;

  request_result := private.claim_request(p_request_id, 'vh_section_archive', jsonb_build_array(p_section_id));
  if request_result is not null then
    select * into section_row from public.vh_catalogo_secoes where id = request_result;
    return section_row;
  end if;

  update public.vh_catalogo_secoes
  set active = false,
      archived_at = now()
  where id = p_section_id and archived_at is null
  returning * into section_row;

  if section_row.id is null then
    raise exception 'Seção não encontrada ou já arquivada';
  end if;

  update private.requests set result_id = section_row.id where request_id = p_request_id;
  return section_row;
end;
$$;

revoke all on function public.archive_vh_catalog_section(uuid, uuid) from public, anon;
grant execute on function public.archive_vh_catalog_section(uuid, uuid) to authenticated;

create or replace function public.restore_vh_catalog_section(
  p_section_id uuid,
  p_request_id uuid
) returns public.vh_catalogo_secoes
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_result uuid;
  section_row public.vh_catalogo_secoes;
begin
  if not public.is_active_staff() then
    raise exception 'Acesso de administrador necessário' using errcode = '42501';
  end if;

  request_result := private.claim_request(p_request_id, 'vh_section_restore', jsonb_build_array(p_section_id));
  if request_result is not null then
    select * into section_row from public.vh_catalogo_secoes where id = request_result;
    return section_row;
  end if;

  update public.vh_catalogo_secoes
  set archived_at = null
  where id = p_section_id and archived_at is not null
  returning * into section_row;

  if section_row.id is null then
    raise exception 'Seção não encontrada ou não está arquivada';
  end if;

  update private.requests set result_id = section_row.id where request_id = p_request_id;
  return section_row;
end;
$$;

revoke all on function public.restore_vh_catalog_section(uuid, uuid) from public, anon;
grant execute on function public.restore_vh_catalog_section(uuid, uuid) to authenticated;

-- Seed: preserva os 4 blocos atuais da home como linhas editáveis.
insert into public.vh_catalogo_secoes (title, detail, tone, sort_order, active)
values
  ('Corrida', 'Leveza para ir mais longe.', 'dark', 100, true),
  ('Lifestyle', 'Seu uniforme de todos os dias.', 'lime', 200, true),
  ('Basquete', 'Presença que chega primeiro.', 'orange', 300, true),
  ('Por encomenda', 'O modelo que você procura.', 'blue', 400, true)
on conflict (title) do nothing;

notify pgrst, 'reload schema';

commit;
