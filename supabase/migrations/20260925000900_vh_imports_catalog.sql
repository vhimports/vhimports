begin;

create table if not exists public.marcas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  logo_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.perfis(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.produtos add column if not exists marca_id uuid references public.marcas(id);
create index if not exists produtos_marca_idx on public.produtos(marca_id);

create table if not exists public.grade_produtos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.produtos(id) on delete cascade,
  size text not null,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size),
  check (reserved_quantity <= stock_quantity)
);

create index if not exists grade_produtos_product_idx on public.grade_produtos(product_id);

create or replace view public.estoque_grade_produtos
with (security_invoker = true)
as
select g.id, g.product_id, p.name as product_name, p.sku, p.marca_id,
       g.size, g.stock_quantity, g.reserved_quantity,
       g.stock_quantity - g.reserved_quantity as available_quantity
from public.grade_produtos g
join public.produtos p on p.id = g.product_id
where p.active = true;

alter table public.marcas enable row level security;
alter table public.grade_produtos enable row level security;

drop policy if exists "staff can view brands" on public.marcas;
create policy "staff can view brands" on public.marcas for select using (public.is_active_staff());

drop policy if exists "managers can manage brands" on public.marcas;
create policy "managers can manage brands" on public.marcas for all
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists "staff can view product sizes" on public.grade_produtos;
create policy "staff can view product sizes" on public.grade_produtos for select
  using (public.is_active_staff());

drop policy if exists "managers can manage product sizes" on public.grade_produtos;
create policy "managers can manage product sizes" on public.grade_produtos for all
  using (public.is_manager()) with check (public.is_manager());

create or replace function public.adjust_size_stock(
  p_product_id uuid, p_size text, p_quantity integer, p_direction text,
  p_reason text, p_request_id uuid
) returns public.grade_produtos
language plpgsql security definer set search_path = ''
as $$
declare v_row public.grade_produtos;
begin
  if not public.is_active_staff() then raise exception 'Acesso operacional necessário'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantidade inválida'; end if;
  if p_direction not in ('in', 'out') then raise exception 'Direção inválida'; end if;
  if coalesce(trim(p_size), '') = '' or coalesce(trim(p_reason), '') = '' then
    raise exception 'Numeração e motivo são obrigatórios';
  end if;

  insert into public.grade_produtos(product_id, size)
  values (p_product_id, trim(p_size))
  on conflict (product_id, size) do nothing;

  update public.grade_produtos
  set stock_quantity = case when p_direction = 'in'
    then stock_quantity + p_quantity else stock_quantity - p_quantity end,
    updated_at = now()
  where product_id = p_product_id and size = trim(p_size)
    and (p_direction = 'in' or stock_quantity - reserved_quantity >= p_quantity)
  returning * into v_row;

  if v_row.id is null then raise exception 'Estoque insuficiente ou variação inexistente'; end if;

  insert into public.movimentacoes_estoque(product_id, type, quantity, notes, created_by)
  values (p_product_id,
    case when p_direction = 'in' then 'adjustment_in'::public.inventory_movement_type
         else 'adjustment_out'::public.inventory_movement_type end,
    p_quantity, concat('Numeração ', trim(p_size), ': ', trim(p_reason)), auth.uid());
  return v_row;
end;
$$;

commit;
