-- VH Imports — nomes de tabelas em português.
-- Renomeia somente as tabelas/views de negócio; colunas, enums e funções RPC
-- permanecem estáveis para não quebrar o contrato da aplicação.
begin;

alter table public.profiles rename to perfis;
alter table public.store_settings rename to configuracoes_loja;
alter table public.categories rename to categorias;
alter table public.suppliers rename to fornecedores;
alter table public.products rename to produtos;
alter table public.product_images rename to imagens_produtos;
alter table public.customers rename to clientes;
alter table public.financial_accounts rename to contas_financeiras;
alter table public.financial_categories rename to categorias_financeiras;
alter table public.orders rename to pedidos;
alter table public.order_items rename to itens_pedidos;
alter table public.order_payments rename to pagamentos_pedidos;
alter table public.inventory_movements rename to movimentacoes_estoque;
alter table public.financial_transactions rename to transacoes_financeiras;
alter table public.receivable_agreements rename to acordos_recebiveis;
alter table public.receivable_installments rename to parcelas_recebiveis;
alter table public.receivable_installment_payments rename to pagamentos_parcelas;
alter table public.content_posts rename to publicacoes_conteudo;
alter table public.audit_logs rename to logs_auditoria;

alter view public.product_stock rename to estoque_produtos;
alter view public.receivable_installment_summary rename to resumo_parcelas_recebiveis;

-- Funções PL/pgSQL guardam o corpo como texto. Recria as funções que ainda
-- mencionam os nomes antigos, preservando assinaturas, permissões e triggers.
do $$
declare
  item record;
  original_definition text;
  updated_definition text;
begin
  for item in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prokind = 'f'
  loop
    original_definition := pg_get_functiondef(item.oid);
    updated_definition := original_definition;
    updated_definition := replace(updated_definition, 'public.profiles', 'public.perfis');
    updated_definition := replace(updated_definition, 'public.store_settings', 'public.configuracoes_loja');
    updated_definition := replace(updated_definition, 'public.categories', 'public.categorias');
    updated_definition := replace(updated_definition, 'public.suppliers', 'public.fornecedores');
    updated_definition := replace(updated_definition, 'public.products', 'public.produtos');
    updated_definition := replace(updated_definition, 'public.product_images', 'public.imagens_produtos');
    updated_definition := replace(updated_definition, 'public.customers', 'public.clientes');
    updated_definition := replace(updated_definition, 'public.financial_accounts', 'public.contas_financeiras');
    updated_definition := replace(updated_definition, 'public.financial_categories', 'public.categorias_financeiras');
    updated_definition := replace(updated_definition, 'public.orders', 'public.pedidos');
    updated_definition := replace(updated_definition, 'public.order_items', 'public.itens_pedidos');
    updated_definition := replace(updated_definition, 'public.order_payments', 'public.pagamentos_pedidos');
    updated_definition := replace(updated_definition, 'public.inventory_movements', 'public.movimentacoes_estoque');
    updated_definition := replace(updated_definition, 'public.financial_transactions', 'public.transacoes_financeiras');
    updated_definition := replace(updated_definition, 'public.receivable_agreements', 'public.acordos_recebiveis');
    updated_definition := replace(updated_definition, 'public.receivable_installments', 'public.parcelas_recebiveis');
    updated_definition := replace(updated_definition, 'public.receivable_installment_payments', 'public.pagamentos_parcelas');
    updated_definition := replace(updated_definition, 'public.content_posts', 'public.publicacoes_conteudo');
    updated_definition := replace(updated_definition, 'public.audit_logs', 'public.logs_auditoria');
    updated_definition := replace(updated_definition, 'public.product_stock', 'public.estoque_produtos');
    updated_definition := replace(updated_definition, 'public.receivable_installment_summary', 'public.resumo_parcelas_recebiveis');
    if updated_definition <> original_definition then
      execute updated_definition;
    end if;
  end loop;
end;
$$;

-- Configurações da loja usa uma chave booleana (id=true), enquanto as demais
-- entidades usam UUID. A auditoria deve registrar a alteração sem converter
-- valores incompatíveis para UUID.
create or replace function private.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_data jsonb;
  after_data jsonb;
  raw_id text;
  eid uuid;
begin
  if tg_op <> 'INSERT' then
    select coalesce(jsonb_object_agg(key, value), '{}') into before_data
    from jsonb_each(to_jsonb(old))
    where key in ('id','status','payment_status','amount','total_amount','quantity','type','direction','active','role','slot','enabled','user_id');
  end if;
  if tg_op <> 'DELETE' then
    select coalesce(jsonb_object_agg(key, value), '{}') into after_data
    from jsonb_each(to_jsonb(new))
    where key in ('id','status','payment_status','amount','total_amount','quantity','type','direction','active','role','slot','enabled','user_id');
  end if;
  raw_id := coalesce(after_data->>'id', before_data->>'id');
  eid := case when raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raw_id::uuid else null end;
  insert into public.logs_auditoria(user_id, action, entity_type, entity_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_schema || '.' || tg_table_name, eid, before_data, after_data);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

commit;

