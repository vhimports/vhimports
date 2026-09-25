-- Security baseline. Apply after 001. No users are authorized by default.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;

create table private.master_access (
  slot smallint primary key check (slot in (1, 2)),
  email text not null unique check (email = lower(trim(email)) and position('@' in email) > 1),
  user_id uuid unique references auth.users(id),
  enabled boolean not null default true
);
alter table private.master_access enable row level security;
create table private.requests (
  request_id uuid primary key,
  actor uuid not null,
  operation text not null,
  payload jsonb not null,
  result_id uuid,
  created_at timestamptz not null default now()
);
alter table private.requests enable row level security;

alter table public.profiles alter column active set default false;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update private.master_access set user_id = new.id
  where email = lower(new.email) and enabled and user_id is null;
  if not exists (select 1 from private.master_access where user_id = new.id and enabled) then
    raise exception 'Cadastro restrito aos dois masters autorizados' using errcode = '42501';
  end if;
  insert into public.profiles(id, full_name, email, role, active)
  values(new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), 'Master'), new.email, 'admin', true);
  return new;
end $$;

create or replace function public.current_user_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p
  join private.master_access m on m.user_id = p.id and m.enabled
  join auth.users u on u.id = p.id and u.email_confirmed_at is not null
  join auth.sessions s on s.user_id = p.id and s.id::text = auth.jwt()->>'session_id'
  where p.id = auth.uid() and p.active and p.role = 'admin'
    and lower(u.email) = m.email
    and auth.jwt()->>'aal' = 'aal2'
    and s.created_at > now() - interval '8 hours'
    and (s.not_after is null or s.not_after > now())
    and (u.banned_until is null or u.banned_until < now());
$$;

create function private.require_master() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_user_role() is distinct from 'admin'::public.app_role then
    raise exception 'Acesso exige master ativo, sessão válida e MFA' using errcode = '42501';
  end if;
end $$;

-- Internal implementations cannot be called from the Data API.
alter function public.mark_order_sold(uuid) set schema private;
alter function public.record_order_payment(uuid,numeric,text,uuid,integer,timestamptz,text) set schema private;
alter function public.record_installment_payment(uuid,numeric,text,uuid,timestamptz) set schema private;

create function private.claim_request(p_id uuid, p_operation text, p_payload jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare r private.requests;
begin
  perform private.require_master();
  if p_id is null then raise exception 'Identificador da operação obrigatório'; end if;
  insert into private.requests(request_id,actor,operation,payload)
  values(p_id,auth.uid(),p_operation,p_payload) on conflict do nothing;
  select * into r from private.requests where request_id=p_id for update;
  if r.actor <> auth.uid() or r.operation <> p_operation or r.payload <> p_payload then
    raise exception 'Identificador já utilizado para outra operação';
  end if;
  return r.result_id;
end $$;

create function private.validate_payment(p_amount numeric, p_account uuid, p_date timestamptz)
returns void language plpgsql set search_path = '' as $$
begin
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
     or p_amount <= 0 or p_amount <> round(p_amount,2) or p_amount > 9999999999.99 then
    raise exception 'Informe valor positivo com até duas casas decimais';
  end if;
  if p_date is null or p_date > now() + interval '5 minutes' then
    raise exception 'Data de recebimento inválida';
  end if;
  if not exists(select 1 from public.financial_accounts where id=p_account and active) then
    raise exception 'Conta financeira inválida ou inativa';
  end if;
end $$;

create function public.mark_order_sold(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare r public.orders;
begin
  perform private.require_master();
  select * into r from public.orders where id=p_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if r.status = 'sold' then return r; end if;
  -- Same product locks are used by all inventory writes, in stable order.
  perform p.id from public.products p where p.id in
    (select product_id from public.order_items where order_id=p_order_id)
    order by p.id for update;
  return private.mark_order_sold(p_order_id);
end $$;

create function public.record_order_payment(
  p_order_id uuid, p_amount numeric, p_payment_method text, p_financial_account_id uuid,
  p_request_id uuid, p_installments integer default 1,
  p_paid_at timestamptz default null, p_notes text default null
) returns public.order_payments language plpgsql security definer set search_path = '' as $$
declare rid uuid; r public.order_payments;
begin
  perform private.require_master();
  perform private.validate_payment(p_amount,p_financial_account_id,coalesce(p_paid_at,now()));
  rid := private.claim_request(p_request_id,'order_payment',jsonb_build_array(
    p_order_id,p_amount,p_payment_method,p_financial_account_id,p_installments,p_notes,p_paid_at));
  if rid is not null then select * into r from public.order_payments where id=rid; return r; end if;
  r := private.record_order_payment(p_order_id,p_amount,p_payment_method,p_financial_account_id,p_installments,coalesce(p_paid_at,now()),p_notes);
  update private.requests set result_id=r.id where request_id=p_request_id;
  return r;
end $$;

create function public.record_installment_payment(
  p_installment_id uuid, p_amount numeric, p_payment_method text, p_financial_account_id uuid,
  p_request_id uuid, p_paid_at timestamptz default null
) returns public.receivable_installment_payments language plpgsql security definer set search_path = '' as $$
declare rid uuid; r public.receivable_installment_payments; aid uuid;
begin
  perform private.require_master();
  perform private.validate_payment(p_amount,p_financial_account_id,coalesce(p_paid_at,now()));
  rid := private.claim_request(p_request_id,'installment_payment',jsonb_build_array(
    p_installment_id,p_amount,p_payment_method,p_financial_account_id,p_paid_at));
  if rid is not null then select * into r from public.receivable_installment_payments where id=rid; return r; end if;
  select agreement_id into aid from public.receivable_installments where id=p_installment_id;
  perform 1 from public.receivable_agreements where id=aid and status='active' for update;
  if not found then raise exception 'Acordo não está ativo'; end if;
  r := private.record_installment_payment(p_installment_id,p_amount,p_payment_method,p_financial_account_id,coalesce(p_paid_at,now()));
  update public.receivable_agreements set status='completed' where id=aid
    and not exists(select 1 from public.receivable_installments where agreement_id=aid and status <> 'paid');
  update private.requests set result_id=r.id where request_id=p_request_id;
  return r;
end $$;

create function public.adjust_stock(p_product_id uuid,p_quantity integer,p_direction text,p_reason text,p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  perform private.require_master();
  if p_quantity is null or p_quantity <= 0 or p_direction is null or p_direction not in ('in','out')
    or p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Ajuste inválido'; end if;
  rid := private.claim_request(p_request_id,'stock',jsonb_build_array(p_product_id,p_quantity,p_direction,p_reason));
  if rid is not null then return rid; end if;
  insert into public.inventory_movements(product_id,type,quantity,notes,created_by)
  values(p_product_id,case when p_direction='in' then 'adjustment_in'::public.inventory_movement_type
    else 'adjustment_out'::public.inventory_movement_type end,p_quantity,p_reason,auth.uid()) returning id into rid;
  update private.requests set result_id=rid where request_id=p_request_id;
  return rid;
end $$;

create function public.record_expense(p_amount numeric,p_account uuid,p_category uuid,p_description text,p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  perform private.require_master();
  perform private.validate_payment(p_amount,p_account,now());
  if p_description is null or length(trim(p_description)) < 3 or not exists
    (select 1 from public.financial_categories where id=p_category and active and type='expense') then
    raise exception 'Descrição ou categoria inválida'; end if;
  rid := private.claim_request(p_request_id,'expense',jsonb_build_array(p_amount,p_account,p_category,p_description));
  if rid is not null then return rid; end if;
  insert into public.financial_transactions(financial_account_id,category_id,type,direction,status,amount,transaction_date,paid_at,description,created_by)
  values(p_account,p_category,'expense','out','paid',p_amount,(now() at time zone 'America/Sao_Paulo')::date,now(),p_description,auth.uid()) returning id into rid;
  update private.requests set result_id=rid where request_id=p_request_id;
  return rid;
end $$;

create function private.guard_inventory() returns trigger language plpgsql set search_path = '' as $$
declare stock bigint;
begin
  if tg_op <> 'INSERT' then raise exception 'Movimentação imutável; use ajuste compensatório'; end if;
  perform 1 from public.products where id=new.product_id for update;
  select coalesce(sum(case when type in ('purchase','return','adjustment_in') then quantity else -quantity end),0)
  into stock from public.inventory_movements where product_id=new.product_id;
  if new.type in ('sale','adjustment_out','loss') and stock < new.quantity
     and not coalesce((select allow_negative_stock from public.store_settings where id=true),false) then
    raise exception 'Estoque insuficiente';
  end if;
  return new;
end $$;
create trigger inventory_guard before insert or update or delete on public.inventory_movements
for each row execute function private.guard_inventory();

create function private.guard_item() returns trigger language plpgsql security definer set search_path = '' as $$
declare oid uuid; r public.orders;
begin
  oid := case when tg_op='DELETE' then old.order_id else new.order_id end;
  if tg_op='UPDATE' and new.order_id <> old.order_id then raise exception 'Não é permitido transferir itens'; end if;
  select * into r from public.orders where id=oid for update;
  if r.status <> 'pending' or exists(select 1 from public.order_payments where order_id=oid) then
    raise exception 'Pedido vendido ou com pagamento não permite alterar itens';
  end if;
  if tg_op <> 'DELETE' and (new.discount_amount > new.quantity * new.unit_price
    or new.unit_price::text='NaN' or new.discount_amount::text='NaN') then raise exception 'Preço ou desconto inválido'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger item_guard before insert or update or delete on public.order_items
for each row execute function private.guard_item();

create function private.order_total() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE' and (new.shipping_amount,new.discount_amount) is distinct from (old.shipping_amount,old.discount_amount)
    and (old.status <> 'pending' or exists(select 1 from public.order_payments where order_id=old.id)) then
    raise exception 'Pedido vendido ou recebido não permite alterar valores';
  end if;
  if new.shipping_amount::text='NaN' or new.discount_amount::text='NaN'
    or new.discount_amount > new.subtotal+new.shipping_amount then raise exception 'Valores inválidos'; end if;
  new.total_amount := new.subtotal+new.shipping_amount-new.discount_amount;
  return new;
end $$;
create trigger order_total_guard before insert or update on public.orders for each row execute function private.order_total();

alter function public.recalculate_order_totals() security definer;
alter function public.generate_receivable_installments() security definer;
create function private.guard_agreement() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.total_amount::text='NaN' or new.installment_amount::text='NaN'
    or new.installment_count > 120 or floor(new.total_amount*100) < new.installment_count then
    raise exception 'Acordo inválido; cada parcela deve ter pelo menos um centavo e limite de 120 parcelas';
  end if;
  new.installment_amount := trunc(new.total_amount/new.installment_count,2);
  if extract(day from new.first_due_date)::integer <> least(new.due_day,
    extract(day from date_trunc('month',new.first_due_date)+interval '1 month - 1 day')::integer) then
    raise exception 'Primeiro vencimento deve corresponder ao dia escolhido';
  end if;
  return new;
end $$;
create trigger agreement_guard before insert on public.receivable_agreements for each row execute function private.guard_agreement();
-- Round down regular installments and leave the exact remainder in the last.
create or replace function public.generate_receivable_installments() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m date; d integer; a numeric(12,2); i integer;
begin
  a := trunc(new.total_amount/new.installment_count,2);
  for i in 1..new.installment_count loop
    m := (date_trunc('month',new.first_due_date)+(i-1)*interval '1 month')::date;
    d := least(new.due_day,extract(day from m+interval '1 month - 1 day')::integer);
    insert into public.receivable_installments(agreement_id,installment_number,due_date,amount)
    values(new.id,i,m+d-1,case when i=new.installment_count then new.total_amount-a*(i-1) else a end);
  end loop;
  return new;
end $$;

-- Audit metadata and business values only; no copies of names/phones/documents/notes.
create function private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare before_data jsonb; after_data jsonb; eid uuid;
begin
  if tg_op <> 'INSERT' then
    select coalesce(jsonb_object_agg(key,value),'{}') into before_data from jsonb_each(to_jsonb(old))
    where key in ('id','status','payment_status','amount','total_amount','quantity','type','direction','active','role','slot','enabled','user_id');
  end if;
  if tg_op <> 'DELETE' then
    select coalesce(jsonb_object_agg(key,value),'{}') into after_data from jsonb_each(to_jsonb(new))
    where key in ('id','status','payment_status','amount','total_amount','quantity','type','direction','active','role','slot','enabled','user_id');
  end if;
  eid := coalesce(after_data->>'id',before_data->>'id')::uuid;
  insert into public.audit_logs(user_id,action,entity_type,entity_id,old_data,new_data)
  values(auth.uid(),tg_op,tg_table_schema||'.'||tg_table_name,eid,before_data,after_data);
  return case when tg_op='DELETE' then old else new end;
end $$;

-- Restrictive master gate supplements every existing permissive policy.
do $$ declare t text; f record;
begin
  foreach t in array array['profiles','store_settings','categories','suppliers','products','product_images','customers',
    'financial_accounts','financial_categories','orders','order_items','order_payments','inventory_movements',
    'financial_transactions','receivable_agreements','receivable_installments','receivable_installment_payments','content_posts','audit_logs'] loop
    execute format('create policy master_gate on public.%I as restrictive for all to authenticated using ((select public.is_active_staff())) with check ((select public.is_active_staff()))',t);
    if t <> 'audit_logs' then
      execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
    end if;
  end loop;
  -- Fixed empty search paths; all relation names in the legacy functions are qualified.
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname in ('set_updated_at','handle_new_user','current_user_role',
    'is_active_staff','is_manager','is_finance_or_manager','calculate_order_item_total','recalculate_order_totals',
    'generate_receivable_installments','mark_order_sold','record_order_payment','record_installment_payment') loop
    execute format('alter function %s set search_path = %L',f.sig,'');
  end loop;
end $$;
create trigger audit_master_access after insert or update or delete on private.master_access for each row execute function private.audit_change();

revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;
alter default privileges in schema private revoke execute on functions from public,anon,authenticated;

revoke insert,update,delete on public.profiles,public.audit_logs,public.order_payments,
  public.receivable_installment_payments,public.receivable_installments,public.financial_transactions,
  public.inventory_movements,public.orders,public.order_items,public.receivable_agreements from authenticated;
grant insert(customer_id,source,notes,shipping_amount) on public.orders to authenticated;
grant update(customer_id,notes,shipping_amount,discount_amount) on public.orders to authenticated;
grant insert(order_id,product_id,product_name_snapshot,sku_snapshot,quantity,unit_price,unit_cost_snapshot,discount_amount)
  on public.order_items to authenticated;
grant update(quantity,unit_price,discount_amount) on public.order_items to authenticated;
grant insert(customer_id,total_amount,installment_count,installment_amount,first_due_date,due_day,notes)
  on public.receivable_agreements to authenticated;
grant update(notes) on public.receivable_agreements to authenticated;
revoke update on public.financial_accounts from authenticated;
grant update(name,type,institution,active) on public.financial_accounts to authenticated;

grant execute on function public.current_user_role(),public.is_active_staff(),public.is_manager(),public.is_finance_or_manager() to authenticated;
grant execute on function public.mark_order_sold(uuid),
  public.record_order_payment(uuid,numeric,text,uuid,uuid,integer,timestamptz,text),
  public.record_installment_payment(uuid,numeric,text,uuid,uuid,timestamptz),
  public.adjust_stock(uuid,integer,text,text,uuid),
  public.record_expense(numeric,uuid,uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;

