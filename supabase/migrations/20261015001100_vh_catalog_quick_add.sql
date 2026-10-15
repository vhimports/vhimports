-- VH Imports — catálogo completo e cadastro rápido de novos modelos.
-- As imagens continuam versionadas no frontend. O painel apenas escolhe
-- uma chave de imagem fixa, define os valores e publica o modelo.
begin;

insert into public.vh_catalogo_produtos
  (slug, name, brand, category, image_key, description, sort_order, active, featured)
values
  ('adidas-adizero-evo', 'Adizero Evo', 'Adidas', 'Corrida', 'catalog-drive/adidas-adizero-evo-01.jpg', 'Foto fixa do catálogo VH Imports.', 100, false, false),
  ('adidas-campus', 'Campus', 'Adidas', 'Lifestyle', 'catalog-drive/adidas-campus-01.jpg', 'Foto fixa do catálogo VH Imports.', 110, false, false),
  ('adidas-samba', 'Samba', 'Adidas', 'Lifestyle', 'catalog-drive/adidas-samba-01.jpg', 'Foto fixa do catálogo VH Imports.', 120, false, false),
  ('adidas-forum-low', 'Forum Low', 'Adidas', 'Lifestyle', 'catalog-drive/catalog-38-43/38-ao-43-adidas-replicas-forum-low-01.jpg', 'Foto fixa do catálogo VH Imports.', 130, false, false),
  ('adidas-adi2000', 'ADI2000', 'Adidas', 'Lifestyle', 'catalog-drive/catalog-38-43/38-ao-43-adidas-replicas-adi2000-01.jpg', 'Foto fixa do catálogo VH Imports.', 140, false, false),
  ('adidas-jellyfish', 'Jellyfish', 'Adidas', 'Lifestyle', 'catalog-drive/catalog-38-43/38-ao-43-adidas-replicas-adidas-jellyfish-01.jpg', 'Foto fixa do catálogo VH Imports.', 150, false, false),
  ('adidas-adios-pro-5', 'Adios Pro 5', 'Adidas', 'Corrida', 'catalog-drive/catalog-38-43/38-ao-43-adidas-replicas-adios-pro-5-01.jpg', 'Foto fixa do catálogo VH Imports.', 160, false, false),
  ('adidas-adizero-pro-4', 'Adizero Pro 4', 'Adidas', 'Corrida', 'catalog-drive/catalog-38-43/adidas-replicas-adizero-pro-4-01.jpg', 'Foto fixa do catálogo VH Imports.', 170, false, false),
  ('adidas-campus-00s', 'Campus 00s', 'Adidas', 'Lifestyle', 'catalog-drive/catalog-38-43/adidas-replicas-campus-00s-01.jpg', 'Foto fixa do catálogo VH Imports.', 180, false, false),
  ('adidas-originals', 'Adidas Originals', 'Adidas', 'Lifestyle', 'catalog-drive/catalog-38-43/adidas-originals-01.jpg', 'Foto fixa do catálogo VH Imports.', 190, false, false),
  ('asics', 'Asics', 'Asics', 'Corrida', 'catalog-drive/asics-asics-01.jpg', 'Foto fixa do catálogo VH Imports.', 200, false, false),
  ('new-balance', 'New Balance', 'New Balance', 'Lifestyle', 'catalog-drive/new-balance-new-balance-01.jpg', 'Foto fixa do catálogo VH Imports.', 210, false, false),
  ('air-max-portal', 'Air Max Portal', 'Nike', 'Lifestyle', 'catalog-drive/catalog-38-43/38-ao-43-air-max-portal-01.jpg', 'Foto fixa do catálogo VH Imports.', 300, false, false),
  ('nike-air-force', 'Air Force', 'Nike', 'Lifestyle', 'catalog-drive/nike-air-force-01.jpg', 'Foto fixa do catálogo VH Imports.', 310, false, false),
  ('nike-air-jordan-1', 'Air Jordan 1', 'Nike', 'Basquete', 'catalog-drive/nike-air-jordan-1-01.jpg', 'Foto fixa do catálogo VH Imports.', 320, false, false),
  ('nike-air-max-95', 'Air Max 95', 'Nike', 'Lifestyle', 'catalog-drive/catalog-38-43/nike-repicas-air-max-95-01.jpg', 'Foto fixa do catálogo VH Imports.', 330, false, false),
  ('nike-air-max-tn', 'Air Max TN', 'Nike', 'Lifestyle', 'catalog-drive/catalog-38-43/nike-repicas-air-max-tn-01.jpg', 'Foto fixa do catálogo VH Imports.', 340, false, false),
  ('nike-alphafly', 'Alphafly', 'Nike', 'Corrida', 'catalog-drive/catalog-38-43/nike-repicas-alphafly-01.jpg', 'Foto fixa do catálogo VH Imports.', 350, false, false),
  ('nike-court-vision', 'Court Vision', 'Nike', 'Lifestyle', 'catalog-drive/catalog-38-43/38-ao-43-nike-repicas-court-vision-01.jpg', 'Foto fixa do catálogo VH Imports.', 360, false, false),
  ('nike-dunk-jumbo', 'Dunk Jumbo', 'Nike', 'Lifestyle', 'catalog-drive/catalog-38-43/nike-repicas-dunk-jumbo-01.jpg', 'Foto fixa do catálogo VH Imports.', 370, false, false),
  ('nike-dunk-twist', 'Dunk Twist', 'Nike', 'Lifestyle', 'catalog-drive/catalog-38-43/nike-repicas-dunk-twist-01.jpg', 'Foto fixa do catálogo VH Imports.', 380, false, false),
  ('nike-original', 'Nike', 'Nike', 'Lifestyle', 'catalog-drive/catalog-38-43/nike-original-01.jpg', 'Foto fixa do catálogo VH Imports.', 390, false, false),
  ('nike-dunk', 'Dunk', 'Nike', 'Lifestyle', 'catalog-drive/nike-dunk-01.jpg', 'Foto fixa do catálogo VH Imports.', 400, false, false),
  ('nike-vomero', 'Vomero', 'Nike', 'Corrida', 'catalog-drive/nike-vomero-01.jpg', 'Foto fixa do catálogo VH Imports.', 410, false, false),
  ('puma-original', 'Puma', 'Puma', 'Lifestyle', 'catalog-drive/puma-original-puma-original-01.jpg', 'Foto fixa do catálogo VH Imports.', 500, false, false),
  ('puma-replica', 'Puma', 'Puma', 'Lifestyle', 'catalog-drive/puma-replica-puma-replica-01.jpg', 'Foto fixa do catálogo VH Imports.', 510, false, false),
  ('fila-original', 'Fila', 'Fila', 'Lifestyle', 'catalog-drive/catalog-38-43/38-ao-43-fila-original-01.jpg', 'Foto fixa do catálogo VH Imports.', 600, false, false),
  ('mizuno', 'Mizuno', 'Mizuno', 'Corrida', 'catalog-drive/catalog-38-43/38-ao-43-mizuno-01.jpg', 'Foto fixa do catálogo VH Imports.', 610, false, false),
  ('reserva-original', 'Reserva', 'Reserva', 'Lifestyle', 'catalog-drive/catalog-38-43/reserva-original-01.jpg', 'Foto fixa do catálogo VH Imports.', 620, false, false),
  ('vans', 'Vans', 'Vans', 'Skate', 'catalog-drive/catalog-38-43/38-ao-43-vans-01.jpg', 'Foto fixa do catálogo VH Imports.', 630, false, false)
on conflict (slug) do update
set name = excluded.name,
    brand = excluded.brand,
    category = excluded.category,
    image_key = excluded.image_key,
    description = excluded.description,
    sort_order = excluded.sort_order;

create or replace function public.create_vh_catalog_product(
  p_slug text,
  p_name text,
  p_brand text,
  p_category text,
  p_image_key text,
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
     coalesce(trim(p_category), '') = '' or coalesce(trim(p_image_key), '') = '' then
    raise exception 'Nome, marca, categoria e foto fixa são obrigatórios';
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
    jsonb_build_array(p_slug, p_name, p_brand, p_category, p_image_key, p_description,
      p_sale_price, p_promotional_price, p_active, p_featured, p_sort_order)
  );
  if request_result is not null then
    select * into catalog_row from public.vh_catalogo_produtos where id = request_result;
    return catalog_row;
  end if;

  insert into public.vh_catalogo_produtos
    (slug, name, brand, category, image_key, description, sale_price, promotional_price, active, featured, sort_order, created_by)
  values
    (trim(p_slug), trim(p_name), trim(p_brand), trim(p_category), trim(p_image_key), nullif(trim(p_description), ''),
      p_sale_price, p_promotional_price, coalesce(p_active, false), coalesce(p_featured, false), p_sort_order, auth.uid())
  returning * into catalog_row;

  update private.requests set result_id = catalog_row.id where request_id = p_request_id;
  return catalog_row;
exception
  when unique_violation then
    raise exception 'Já existe um modelo com este nome interno';
end;
$$;

revoke all on function public.create_vh_catalog_product(text, text, text, text, text, text, numeric, numeric, boolean, boolean, integer, uuid) from public, anon;
grant execute on function public.create_vh_catalog_product(text, text, text, text, text, text, numeric, numeric, boolean, boolean, integer, uuid) to authenticated;

commit;
