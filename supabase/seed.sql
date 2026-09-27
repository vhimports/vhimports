-- Dados iniciais seguros para desenvolvimento.
-- Este arquivo não cria usuários nem dados reais de clientes.

insert into public.configuracoes_loja (id, store_name, currency, timezone)
values (true, 'VH Imports', 'BRL', 'America/Sao_Paulo')
on conflict (id) do update
set store_name = excluded.store_name,
    currency = excluded.currency,
    timezone = excluded.timezone;

insert into public.marcas (name, slug, sort_order)
select name, slug, sort_order
from (values
  ('Nike', 'nike', 10),
  ('Adidas', 'adidas', 20),
  ('Asics', 'asics', 30),
  ('New Balance', 'new-balance', 40),
  ('Puma', 'puma', 50),
  ('Olympikus', 'olympikus', 60)
) as defaults(name, slug, sort_order)
where not exists (select 1 from public.marcas m where m.slug = defaults.slug);

insert into public.categorias (name, description)
select name, description
from (values
  ('Corrida', 'Tênis para corrida e alta performance'),
  ('Lifestyle', 'Modelos casuais para o dia a dia'),
  ('Basquete', 'Tênis de basquete e quadra'),
  ('Treino', 'Modelos para academia e treino'),
  ('Casual', 'Modelos versáteis e urbanos'),
  ('Infantil', 'Tênis infantis')
) as defaults(name, description)
where not exists (select 1 from public.categorias c where c.name = defaults.name);

insert into public.categorias_financeiras (name, type)
select name, type::public.financial_category_type
from (values
  ('Vendas', 'income'),
  ('Cobranças', 'income'),
  ('Compras de estoque', 'expense'),
  ('Frete', 'expense'),
  ('Marketing', 'expense'),
  ('Despesas operacionais', 'expense')
) as defaults(name, type)
where not exists (
  select 1 from public.categorias_financeiras fc
  where fc.name = defaults.name and fc.type = defaults.type::public.financial_category_type
);

insert into public.contas_financeiras (name, type, institution)
select name, type::public.financial_account_type, institution
from (values
  ('Conta principal', 'bank', null),
  ('Pix', 'digital_wallet', null),
  ('Cartão a receber', 'card_receivable', null)
) as defaults(name, type, institution)
where not exists (select 1 from public.contas_financeiras fa where fa.name = defaults.name);

-- Catálogo inicial para testes. As fotos são assets fixos do frontend; os
-- preços começam zerados e os produtos ficam ocultos até o master preenchê-los.
insert into public.vh_catalogo_produtos (slug, name, brand, category, image_key, description, sort_order, active, featured)
values
  ('nike-imports-01', 'Modelo Nike Imports 01', 'Nike', 'Lifestyle', 'catalog_nike-01-hi', 'Foto fixa de teste do catálogo VH Imports.', 10, false, false),
  ('nike-imports-02', 'Modelo Nike Imports 02', 'Nike', 'Lifestyle', 'catalog_nike-02-hi', 'Foto fixa de teste do catálogo VH Imports.', 20, false, false),
  ('nike-imports-03', 'Modelo Nike Imports 03', 'Nike', 'Corrida', 'catalog_nike-03-hi', 'Foto fixa de teste do catálogo VH Imports.', 30, false, false),
  ('nike-imports-04', 'Modelo Nike Imports 04', 'Nike', 'Casual', 'catalog_nike-04-hi', 'Foto fixa de teste do catálogo VH Imports.', 40, false, false)
on conflict (slug) do update
set name = excluded.name,
    brand = excluded.brand,
    category = excluded.category,
    image_key = excluded.image_key,
    description = excluded.description,
    sort_order = excluded.sort_order;
