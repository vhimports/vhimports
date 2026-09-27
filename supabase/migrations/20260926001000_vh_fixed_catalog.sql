-- VH Imports — catálogo fixo e preços administráveis.
--
-- A VH Imports não controla estoque neste catálogo. As imagens são assets
-- versionados no frontend; o banco guarda somente a chave do asset e os
-- dados que o administrador pode publicar/alterar.
begin;

create table if not exists public.vh_catalogo_produtos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  brand text not null,
  category text not null,
  image_key text not null,
  description text,
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  promotional_price numeric(12,2)
    check (promotional_price is null or (promotional_price > 0 and promotional_price <= sale_price)),
  active boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.perfis(id),
  updated_by uuid references public.perfis(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not active or sale_price > 0)
);

create index if not exists vh_catalogo_produtos_publication_idx
  on public.vh_catalogo_produtos(active, sort_order, name);

alter table public.vh_catalogo_produtos enable row level security;
revoke all on public.vh_catalogo_produtos from anon, authenticated;
grant select on public.vh_catalogo_produtos to authenticated;

drop policy if exists "masters can view fixed catalog" on public.vh_catalogo_produtos;
create policy "masters can view fixed catalog"
on public.vh_catalogo_produtos for select to authenticated
using (public.is_active_staff());

create or replace function public.set_vh_catalog_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists vh_catalogo_produtos_set_updated_at on public.vh_catalogo_produtos;
create trigger vh_catalogo_produtos_set_updated_at
before update on public.vh_catalogo_produtos
for each row execute function public.set_vh_catalog_updated_at();

create or replace function private.audit_vh_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_data jsonb;
  after_data jsonb;
  raw_id text;
  entity_id uuid;
begin
  if tg_op <> 'INSERT' then
    before_data := jsonb_build_object(
      'id', old.id,
      'slug', old.slug,
      'image_key', old.image_key,
      'sale_price', old.sale_price,
      'promotional_price', old.promotional_price,
      'active', old.active,
      'featured', old.featured,
      'sort_order', old.sort_order
    );
  end if;
  if tg_op <> 'DELETE' then
    after_data := jsonb_build_object(
      'id', new.id,
      'slug', new.slug,
      'image_key', new.image_key,
      'sale_price', new.sale_price,
      'promotional_price', new.promotional_price,
      'active', new.active,
      'featured', new.featured,
      'sort_order', new.sort_order
    );
  end if;
  raw_id := coalesce(after_data->>'id', before_data->>'id');
  entity_id := raw_id::uuid;
  insert into public.logs_auditoria(user_id, action, entity_type, entity_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_schema || '.' || tg_table_name, entity_id, before_data, after_data);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists vh_catalogo_produtos_audit on public.vh_catalogo_produtos;
create trigger vh_catalogo_produtos_audit
after insert or update or delete on public.vh_catalogo_produtos
for each row execute function private.audit_vh_catalog_change();

create or replace function public.update_vh_catalog_prices(
  p_product_id uuid,
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
  if p_sale_price is null or p_sale_price < 0 or p_sale_price <> round(p_sale_price, 2) then
    raise exception 'Preço de venda inválido';
  end if;
  if p_promotional_price is not null and
     (p_promotional_price <= 0 or p_promotional_price > p_sale_price or p_promotional_price <> round(p_promotional_price, 2)) then
    raise exception 'Preço promocional inválido';
  end if;
  if coalesce(p_active, false) and p_sale_price <= 0 then
    raise exception 'Informe o preço antes de publicar o produto';
  end if;
  if p_sort_order is null or p_sort_order < 0 then
    raise exception 'Ordem de exibição inválida';
  end if;

  request_result := private.claim_request(
    p_request_id,
    'vh_catalog_price',
    jsonb_build_array(p_product_id, p_sale_price, p_promotional_price, p_active, p_featured, p_sort_order)
  );
  if request_result is not null then
    select * into catalog_row from public.vh_catalogo_produtos where id = request_result;
    return catalog_row;
  end if;

  update public.vh_catalogo_produtos
  set sale_price = p_sale_price,
      promotional_price = p_promotional_price,
      active = coalesce(p_active, false),
      featured = coalesce(p_featured, false),
      sort_order = p_sort_order
  where id = p_product_id
  returning * into catalog_row;

  if catalog_row.id is null then
    raise exception 'Produto fixo não encontrado';
  end if;

  update private.requests set result_id = catalog_row.id where request_id = p_request_id;
  return catalog_row;
end;
$$;

revoke all on function public.update_vh_catalog_prices(uuid, numeric, numeric, boolean, boolean, integer, uuid) from public, anon;
grant execute on function public.update_vh_catalog_prices(uuid, numeric, numeric, boolean, boolean, integer, uuid) to authenticated;

commit;
