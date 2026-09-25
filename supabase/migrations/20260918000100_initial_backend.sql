-- VH Imports
-- Backend foundation: authentication, customers, orders, inventory,
-- financial control and receivable installments.

begin;

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'manager', 'operator', 'finance');
create type public.order_source as enum ('online_store', 'manual', 'marketplace');
create type public.order_status as enum ('pending', 'sold', 'shipped', 'completed', 'canceled', 'partially_returned', 'returned');
create type public.payment_status as enum ('pending', 'partially_paid', 'paid', 'refunded');
create type public.inventory_movement_type as enum ('purchase', 'sale', 'return', 'adjustment_in', 'adjustment_out', 'loss');
create type public.financial_account_type as enum ('bank', 'digital_wallet', 'cash', 'card_receivable');
create type public.financial_category_type as enum ('income', 'expense');
create type public.financial_transaction_type as enum ('income', 'expense', 'transfer');
create type public.financial_transaction_status as enum ('pending', 'paid', 'overdue', 'canceled');
create type public.financial_direction as enum ('in', 'out');
create type public.receivable_agreement_status as enum ('active', 'completed', 'canceled');
create type public.installment_status as enum ('pending', 'partially_paid', 'paid', 'overdue', 'canceled');
create type public.content_post_status as enum ('suggestion', 'approved', 'scheduled', 'published', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  role public.app_role not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_settings (
  id boolean primary key default true check (id = true),
  store_name text not null default 'VH Imports',
  logo_path text,
  currency text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  default_minimum_stock integer not null default 0 check (default_minimum_stock >= 0),
  allow_negative_stock boolean not null default false,
  allow_sale_without_customer boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  email text,
  phone text,
  address text,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category_id uuid references public.categories(id),
  supplier_id uuid references public.suppliers(id),
  description text,
  material text not null default 'Tênis importado',
  purity smallint default 925 check (purity is null or purity between 0 and 1000),
  weight_grams numeric(10,3) check (weight_grams is null or weight_grams >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  promotional_price numeric(12,2) check (promotional_price is null or promotional_price >= 0),
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  active boolean not null default true,
  care_instructions text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  document text,
  birth_date date,
  marketing_consent boolean not null default false,
  whatsapp_opt_in boolean not null default false,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.financial_account_type not null,
  institution text,
  initial_balance numeric(12,2) not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.financial_category_type not null,
  parent_id uuid references public.financial_categories(id),
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, type)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  source public.order_source not null default 'manual',
  customer_id uuid references public.customers(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  shipping_amount numeric(12,2) not null default 0 check (shipping_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  notes text,
  sold_at timestamptz,
  paid_at timestamptz,
  shipped_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name_snapshot text not null,
  sku_snapshot text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost_snapshot numeric(12,2) not null default 0 check (unit_cost_snapshot >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_method text not null check (payment_method in ('cash', 'pix', 'debit_card', 'credit_card', 'transfer', 'other')),
  amount numeric(12,2) not null check (amount > 0),
  installments integer not null default 1 check (installments > 0),
  paid_at timestamptz not null default now(),
  financial_account_id uuid not null references public.financial_accounts(id),
  status public.payment_status not null default 'paid',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  type public.inventory_movement_type not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  financial_account_id uuid not null references public.financial_accounts(id),
  category_id uuid references public.financial_categories(id),
  type public.financial_transaction_type not null,
  direction public.financial_direction not null,
  status public.financial_transaction_status not null default 'pending',
  amount numeric(12,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  due_date date,
  paid_at timestamptz,
  description text not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (type = 'income' and direction = 'in')
    or (type = 'expense' and direction = 'out')
    or type = 'transfer'
  )
);

create table public.receivable_agreements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  total_amount numeric(12,2) not null check (total_amount > 0),
  installment_count integer not null check (installment_count > 0),
  installment_amount numeric(12,2) not null check (installment_amount > 0),
  frequency text not null default 'monthly' check (frequency = 'monthly'),
  first_due_date date not null,
  due_day integer not null check (due_day between 1 and 31),
  status public.receivable_agreement_status not null default 'active',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.receivable_installments (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.receivable_agreements(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  status public.installment_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agreement_id, installment_number)
);

create table public.receivable_installment_payments (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references public.receivable_installments(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'pix', 'debit_card', 'credit_card', 'transfer', 'other')),
  financial_account_id uuid not null references public.financial_accounts(id),
  paid_at timestamptz not null default now(),
  financial_transaction_id uuid references public.financial_transactions(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.content_posts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id),
  image_path text,
  caption text,
  hashtags text,
  scheduled_for timestamptz,
  status public.content_post_status not null default 'suggestion',
  approved_by uuid references public.profiles(id),
  published_at timestamptz,
  external_post_id text,
  error_message text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index products_category_idx on public.products(category_id);
create index products_active_idx on public.products(active);
create index customers_name_idx on public.customers using gin (to_tsvector('simple', name));
create index orders_status_idx on public.orders(status);
create index orders_customer_idx on public.orders(customer_id);
create index orders_created_at_idx on public.orders(created_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index inventory_movements_product_idx on public.inventory_movements(product_id, created_at desc);
create index financial_transactions_date_idx on public.financial_transactions(transaction_date desc);
create index financial_transactions_account_idx on public.financial_transactions(financial_account_id);
create index receivable_installments_due_date_idx on public.receivable_installments(due_date);
create index content_posts_schedule_idx on public.content_posts(scheduled_for);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger settings_set_updated_at before update on public.store_settings for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger suppliers_set_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger accounts_set_updated_at before update on public.financial_accounts for each row execute function public.set_updated_at();
create trigger categories_financial_set_updated_at before update on public.financial_categories for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger order_items_set_updated_at before update on public.order_items for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.financial_transactions for each row execute function public.set_updated_at();
create trigger agreements_set_updated_at before update on public.receivable_agreements for each row execute function public.set_updated_at();
create trigger installments_set_updated_at before update on public.receivable_installments for each row execute function public.set_updated_at();
create trigger content_posts_set_updated_at before update on public.content_posts for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'Usuário'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer set search_path = public
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and active = true;
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.current_user_role() is not null;
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.current_user_role() in ('admin', 'manager');
$$;

create or replace function public.is_finance_or_manager()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.current_user_role() in ('admin', 'manager', 'finance');
$$;

create or replace function public.recalculate_order_totals()
returns trigger
language plpgsql
as $$
declare
  v_order_id uuid;
  v_subtotal numeric(12,2);
begin
  if tg_op = 'DELETE' then
    v_order_id := old.order_id;
  else
    v_order_id := new.order_id;
  end if;

  select coalesce(sum(total_amount), 0)
  into v_subtotal
  from public.order_items
  where order_id = v_order_id;

  update public.orders
  set subtotal = v_subtotal,
      total_amount = greatest(0, v_subtotal + shipping_amount - discount_amount),
      updated_at = now()
  where id = v_order_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.calculate_order_item_total()
returns trigger
language plpgsql
as $$
begin
  new.total_amount = greatest(0, (new.quantity * new.unit_price) - new.discount_amount);
  return new;
end;
$$;

create trigger order_items_calculate_total
  before insert or update on public.order_items
  for each row execute function public.calculate_order_item_total();

create trigger order_items_recalculate_totals
  after insert or update or delete on public.order_items
  for each row execute function public.recalculate_order_totals();

create or replace function public.generate_receivable_installments()
returns trigger
language plpgsql
as $$
declare
  v_month date;
  v_last_day integer;
  v_due_date date;
  v_installment_amount numeric(12,2);
  i integer;
begin
  v_installment_amount := round(new.total_amount / new.installment_count, 2);

  for i in 1..new.installment_count loop
    v_month := (date_trunc('month', new.first_due_date)::date + ((i - 1) * interval '1 month'))::date;
    v_last_day := extract(day from (v_month + interval '1 month - 1 day'))::integer;
    v_due_date := v_month + (least(new.due_day, v_last_day) - 1);

    insert into public.receivable_installments (agreement_id, installment_number, due_date, amount)
    values (
      new.id,
      i,
      v_due_date,
      case when i = new.installment_count
        then new.total_amount - (v_installment_amount * (new.installment_count - 1))
        else v_installment_amount
      end
    );
  end loop;

  return new;
end;
$$;

create trigger agreement_generate_installments
  after insert on public.receivable_agreements
  for each row execute function public.generate_receivable_installments();

create or replace function public.mark_order_sold(p_order_id uuid)
returns public.orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders;
  v_item record;
  v_stock integer;
  v_allow_negative boolean;
begin
  if not public.is_active_staff() then
    raise exception 'Usuário não autorizado';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.status <> 'pending' then
    raise exception 'Somente pedidos pendentes podem ser marcados como vendidos';
  end if;

  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'O pedido precisa ter pelo menos um item';
  end if;

  select allow_negative_stock into v_allow_negative
  from public.store_settings
  where id = true;

  for v_item in
    select oi.*
    from public.order_items oi
    where oi.order_id = p_order_id
  loop
    select coalesce(sum(
      case
        when im.type in ('purchase', 'return', 'adjustment_in') then im.quantity
        else -im.quantity
      end
    ), 0)
    into v_stock
    from public.inventory_movements im
    where im.product_id = v_item.product_id;

    if coalesce(v_allow_negative, false) = false and v_stock < v_item.quantity then
      raise exception 'Estoque insuficiente para o produto %', v_item.product_name_snapshot;
    end if;

    insert into public.inventory_movements (
      product_id, type, quantity, unit_cost, reference_type, reference_id, created_by
    )
    values (
      v_item.product_id, 'sale', v_item.quantity, v_item.unit_cost_snapshot,
      'order', p_order_id, (select auth.uid())
    );
  end loop;

  update public.orders
  set status = 'sold',
      sold_at = now(),
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

create or replace function public.record_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_financial_account_id uuid,
  p_installments integer default 1,
  p_paid_at timestamptz default now(),
  p_notes text default null
)
returns public.order_payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders;
  v_received numeric(12,2);
  v_payment_id uuid;
  v_category_id uuid;
begin
  if not public.is_active_staff() then
    raise exception 'Usuário não autorizado';
  end if;

  if p_amount <= 0 then
    raise exception 'O valor do pagamento deve ser maior que zero';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.status = 'canceled' then
    raise exception 'Pedido cancelado não pode receber pagamento';
  end if;

  select coalesce(sum(amount), 0)
  into v_received
  from public.order_payments
  where order_id = p_order_id
    and status = 'paid';

  if v_received + p_amount > v_order.total_amount then
    raise exception 'O pagamento excede o valor restante do pedido';
  end if;

  insert into public.order_payments (
    order_id, payment_method, amount, installments, paid_at,
    financial_account_id, status, notes, created_by
  )
  values (
    p_order_id, p_payment_method, p_amount, p_installments, p_paid_at,
    p_financial_account_id, 'paid', p_notes, (select auth.uid())
  )
  returning id into v_payment_id;

  select id into v_category_id
  from public.financial_categories
  where name = 'Vendas' and type = 'income' and active = true
  limit 1;

  insert into public.financial_transactions (
    financial_account_id, category_id, type, direction, status, amount,
    transaction_date, paid_at, description, reference_type, reference_id, created_by
  )
  values (
    p_financial_account_id, v_category_id, 'income', 'in', 'paid', p_amount,
    coalesce(p_paid_at::date, current_date), p_paid_at,
    'Pagamento do pedido #' || v_order.order_number, 'order_payment', v_payment_id,
    (select auth.uid())
  );

  update public.orders
  set payment_status = case
        when v_received + p_amount >= total_amount then 'paid'::public.payment_status
        else 'partially_paid'::public.payment_status
      end,
      paid_at = case when v_received + p_amount >= total_amount then coalesce(p_paid_at, now()) else paid_at end,
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = p_order_id;

  return (select op from public.order_payments op where op.id = v_payment_id);
end;
$$;

create or replace function public.record_installment_payment(
  p_installment_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_financial_account_id uuid,
  p_paid_at timestamptz default now()
)
returns public.receivable_installment_payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_installment public.receivable_installments;
  v_paid numeric(12,2);
  v_payment_id uuid;
  v_transaction_id uuid;
  v_category_id uuid;
begin
  if not public.is_active_staff() then
    raise exception 'Usuário não autorizado';
  end if;

  select * into v_installment
  from public.receivable_installments
  where id = p_installment_id
  for update;

  if not found or v_installment.status = 'canceled' then
    raise exception 'Parcela não encontrada ou cancelada';
  end if;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.receivable_installment_payments
  where installment_id = p_installment_id;

  if p_amount <= 0 or v_paid + p_amount > v_installment.amount then
    raise exception 'Valor do pagamento da parcela inválido';
  end if;

  select id into v_category_id
  from public.financial_categories
  where name = 'Cobranças' and type = 'income' and active = true
  limit 1;

  insert into public.financial_transactions (
    financial_account_id, category_id, type, direction, status, amount,
    transaction_date, paid_at, description, reference_type, reference_id, created_by
  )
  values (
    p_financial_account_id, v_category_id, 'income', 'in', 'paid', p_amount,
    coalesce(p_paid_at::date, current_date), p_paid_at,
    'Pagamento da parcela ' || v_installment.installment_number,
    'receivable_installment', p_installment_id, (select auth.uid())
  )
  returning id into v_transaction_id;

  insert into public.receivable_installment_payments (
    installment_id, amount, payment_method, financial_account_id,
    paid_at, financial_transaction_id, created_by
  )
  values (
    p_installment_id, p_amount, p_payment_method, p_financial_account_id,
    p_paid_at, v_transaction_id, (select auth.uid())
  )
  returning id into v_payment_id;

  update public.receivable_installments
  set status = case
        when v_paid + p_amount >= amount then 'paid'::public.installment_status
        else 'partially_paid'::public.installment_status
      end,
      updated_at = now()
  where id = p_installment_id;

  return (select rp from public.receivable_installment_payments rp where rp.id = v_payment_id);
end;
$$;

create or replace view public.product_stock
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.sku,
  p.category_id,
  p.sale_price,
  p.promotional_price,
  p.minimum_stock,
  p.active,
  coalesce(sum(
    case
      when im.type in ('purchase', 'return', 'adjustment_in') then im.quantity
      else -im.quantity
    end
  ), 0)::integer as current_stock
from public.products p
left join public.inventory_movements im on im.product_id = p.id
group by p.id;

create or replace view public.receivable_installment_summary
with (security_invoker = true)
as
select
  i.id,
  i.agreement_id,
  a.customer_id,
  c.name as customer_name,
  c.phone as customer_phone,
  i.installment_number,
  a.installment_count,
  i.due_date,
  i.amount,
  coalesce(sum(ip.amount), 0)::numeric(12,2) as paid_amount,
  case
    when i.status = 'paid' then 'paid'
    when i.status = 'canceled' then 'canceled'
    when coalesce(sum(ip.amount), 0) >= i.amount then 'paid'
    when i.due_date < current_date then 'overdue'
    when coalesce(sum(ip.amount), 0) > 0 then 'partially_paid'
    else 'pending'
  end as effective_status,
  (i.due_date - current_date) as days_until_due
from public.receivable_installments i
join public.receivable_agreements a on a.id = i.agreement_id
join public.customers c on c.id = a.customer_id
left join public.receivable_installment_payments ip on ip.installment_id = i.id
group by i.id, i.status, a.customer_id, a.installment_count, c.name, c.phone;

-- RLS: no public table is available anonymously. Every application query must
-- come from an authenticated active staff profile.
alter table public.profiles enable row level security;
alter table public.store_settings enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.customers enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.financial_categories enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.receivable_agreements enable row level security;
alter table public.receivable_installments enable row level security;
alter table public.receivable_installment_payments enable row level security;
alter table public.content_posts enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.store_settings to authenticated;
grant select, insert, update on public.categories to authenticated;
grant select, insert, update on public.suppliers to authenticated;
grant select, insert, update on public.products to authenticated;
grant select, insert, update on public.product_images to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.financial_accounts to authenticated;
grant select, insert, update on public.financial_categories to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert, update on public.order_items to authenticated;
grant select, insert, update on public.order_payments to authenticated;
grant select, insert, update on public.inventory_movements to authenticated;
grant select, insert, update on public.financial_transactions to authenticated;
grant select, insert, update on public.receivable_agreements to authenticated;
grant select, insert, update on public.receivable_installments to authenticated;
grant select, insert, update on public.receivable_installment_payments to authenticated;
grant select, insert, update on public.content_posts to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select on public.product_stock to authenticated;
grant select on public.receivable_installment_summary to authenticated;

create policy "staff can view active profiles"
on public.profiles for select to authenticated
using (public.is_active_staff());

create policy "managers can update profiles"
on public.profiles for update to authenticated
using (public.current_user_role() in ('admin', 'manager'))
with check (public.current_user_role() in ('admin', 'manager', 'operator', 'finance'));

create policy "staff can view settings"
on public.store_settings for select to authenticated
using (public.is_active_staff());

create policy "managers can change settings"
on public.store_settings for update to authenticated
using (public.is_manager())
with check (public.is_manager());

create policy "staff can view categories"
on public.categories for select to authenticated using (public.is_active_staff());
create policy "staff can manage categories"
on public.categories for insert to authenticated with check (public.is_manager());
create policy "staff can update categories"
on public.categories for update to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "staff can view suppliers"
on public.suppliers for select to authenticated using (public.is_active_staff());
create policy "managers can insert suppliers"
on public.suppliers for insert to authenticated with check (public.is_manager());
create policy "managers can update suppliers"
on public.suppliers for update to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "staff can view products"
on public.products for select to authenticated using (public.is_active_staff());
create policy "staff can insert products"
on public.products for insert to authenticated with check (public.is_active_staff());
create policy "staff can update products"
on public.products for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

create policy "staff can view product images"
on public.product_images for select to authenticated using (public.is_active_staff());
create policy "staff can insert product images"
on public.product_images for insert to authenticated with check (public.is_active_staff());
create policy "staff can update product images"
on public.product_images for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

create policy "staff can view customers"
on public.customers for select to authenticated using (public.is_active_staff());
create policy "staff can insert customers"
on public.customers for insert to authenticated with check (public.is_active_staff());
create policy "staff can update customers"
on public.customers for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

create policy "staff can view financial accounts"
on public.financial_accounts for select to authenticated using (public.is_active_staff());
create policy "managers can insert financial accounts"
on public.financial_accounts for insert to authenticated with check (public.is_manager());
create policy "managers can update financial accounts"
on public.financial_accounts for update to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "staff can view financial categories"
on public.financial_categories for select to authenticated using (public.is_active_staff());
create policy "managers can insert financial categories"
on public.financial_categories for insert to authenticated with check (public.is_manager());
create policy "managers can update financial categories"
on public.financial_categories for update to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "staff can view orders"
on public.orders for select to authenticated using (public.is_active_staff());
create policy "staff can insert orders"
on public.orders for insert to authenticated with check (public.is_active_staff());
create policy "staff can update orders"
on public.orders for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

create policy "staff can view order items"
on public.order_items for select to authenticated using (public.is_active_staff());
create policy "staff can insert order items"
on public.order_items for insert to authenticated with check (public.is_active_staff());
create policy "staff can update order items"
on public.order_items for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

create policy "staff can view order payments"
on public.order_payments for select to authenticated using (public.is_active_staff());
create policy "staff can insert order payments"
on public.order_payments for insert to authenticated with check (public.is_active_staff());
create policy "staff can update order payments"
on public.order_payments for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

create policy "staff can view inventory movements"
on public.inventory_movements for select to authenticated using (public.is_active_staff());
create policy "staff can insert inventory movements"
on public.inventory_movements for insert to authenticated with check (public.is_active_staff());
create policy "managers can update inventory movements"
on public.inventory_movements for update to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "staff can view financial transactions"
on public.financial_transactions for select to authenticated using (public.is_active_staff());
create policy "staff can insert financial transactions"
on public.financial_transactions for insert to authenticated with check (public.is_active_staff());
create policy "managers can update financial transactions"
on public.financial_transactions for update to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "staff can view receivable agreements"
on public.receivable_agreements for select to authenticated using (public.is_active_staff());
create policy "staff can insert receivable agreements"
on public.receivable_agreements for insert to authenticated with check (public.is_active_staff());
create policy "staff can update receivable agreements"
on public.receivable_agreements for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

create policy "staff can view receivable installments"
on public.receivable_installments for select to authenticated using (public.is_active_staff());
create policy "staff can insert receivable installments"
on public.receivable_installments for insert to authenticated with check (public.is_active_staff());
create policy "staff can update receivable installments"
on public.receivable_installments for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

create policy "staff can view installment payments"
on public.receivable_installment_payments for select to authenticated using (public.is_active_staff());
create policy "staff can insert installment payments"
on public.receivable_installment_payments for insert to authenticated with check (public.is_active_staff());
create policy "managers can update installment payments"
on public.receivable_installment_payments for update to authenticated using (public.is_manager()) with check (public.is_manager());

create policy "staff can view content posts"
on public.content_posts for select to authenticated using (public.is_active_staff());
create policy "staff can insert content posts"
on public.content_posts for insert to authenticated with check (public.is_active_staff());
create policy "staff can update content posts"
on public.content_posts for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

create policy "managers can view audit logs"
on public.audit_logs for select to authenticated using (public.current_user_role() in ('admin', 'manager'));
create policy "staff can insert audit logs"
on public.audit_logs for insert to authenticated with check (public.is_active_staff());

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_finance_or_manager() to authenticated;
grant execute on function public.mark_order_sold(uuid) to authenticated;
grant execute on function public.record_order_payment(uuid, numeric, text, uuid, integer, timestamptz, text) to authenticated;
grant execute on function public.record_installment_payment(uuid, numeric, text, uuid, timestamptz) to authenticated;

commit;
