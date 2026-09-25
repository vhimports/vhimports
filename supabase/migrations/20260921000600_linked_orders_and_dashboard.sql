-- Revisão 23: criação atômica, cobrança vinculada e agregados autorizados.
begin;

alter table public.acordos_recebiveis add column if not exists order_id uuid unique references public.pedidos(id);
alter table public.pagamentos_pedidos add column if not exists installment_payment_id uuid unique references public.pagamentos_parcelas(id);

create function public.create_manual_order(
  p_customer_id uuid, p_items jsonb, p_shipping numeric, p_discount numeric,
  p_notes text, p_plan jsonb, p_request_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare oid uuid; item jsonb; product public.produtos; total numeric;
begin
  perform private.require_master();
  oid := private.claim_request(p_request_id,'create_order',jsonb_build_array(p_customer_id,p_items,p_shipping,p_discount,p_notes,p_plan));
  if oid is not null then return oid; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 200 then
    raise exception 'Adicione de 1 a 200 itens';
  end if;
  if p_shipping is null or p_discount is null or p_shipping < 0 or p_discount < 0
    or p_shipping::text in ('NaN','Infinity','-Infinity') or p_discount::text in ('NaN','Infinity','-Infinity')
    or round(p_shipping,2) <> p_shipping or round(p_discount,2) <> p_discount then raise exception 'Valores inválidos'; end if;
  if p_customer_id is not null and not exists(select 1 from public.clientes where id=p_customer_id and active) then
    raise exception 'Cliente inválido';
  end if;
  insert into public.pedidos(customer_id,source,notes,shipping_amount,created_by)
  values(p_customer_id,'manual',nullif(trim(p_notes),''),p_shipping,auth.uid()) returning id into oid;
  for item in select value from jsonb_array_elements(p_items) loop
    select * into product from public.produtos where id=(item->>'product_id')::uuid and active;
    if not found then raise exception 'Produto inválido'; end if;
    if (item->>'quantity')::numeric is null or (item->>'quantity')::numeric <> trunc((item->>'quantity')::numeric)
      or (item->>'quantity')::numeric not between 1 and 1000000
      or (item->>'unit_price')::numeric is null or (item->>'unit_price')::numeric < 0
      or (item->>'unit_price')::numeric::text in ('NaN','Infinity','-Infinity')
      or round((item->>'unit_price')::numeric,2) <> (item->>'unit_price')::numeric then raise exception 'Item inválido'; end if;
    insert into public.itens_pedidos(order_id,product_id,product_name_snapshot,sku_snapshot,quantity,unit_price,unit_cost_snapshot)
    values(oid,product.id,product.name,product.sku,(item->>'quantity')::integer,(item->>'unit_price')::numeric,product.cost_price);
  end loop;
  -- Desconto só depois dos itens: evita validação contra subtotal ainda zero.
  update public.pedidos set discount_amount=p_discount where id=oid returning total_amount into total;
  if p_plan is not null and p_plan <> 'null'::jsonb then
    if jsonb_typeof(p_plan) <> 'object' or p_customer_id is null then raise exception 'Parcelamento exige cliente e plano'; end if;
    insert into public.acordos_recebiveis(order_id,customer_id,total_amount,installment_count,installment_amount,first_due_date,due_day,notes,created_by)
    values(oid,p_customer_id,total,(p_plan->>'installment_count')::integer,0,(p_plan->>'first_due_date')::date,(p_plan->>'due_day')::integer,nullif(trim(p_notes),''),auth.uid());
  end if;
  update private.requests set result_id=oid where request_id=p_request_id;
  return oid;
end $$;

-- Um plano emitido não pode divergir do valor/cadastro do pedido por escrita direta.
revoke update(customer_id) on public.pedidos from authenticated;
create function private.guard_linked_order() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.acordos_recebiveis where order_id=old.id)
    and (new.subtotal,new.shipping_amount,new.discount_amount) is distinct from (old.subtotal,old.shipping_amount,old.discount_amount) then
    raise exception 'Pedido com cobrança emitida exige renegociação para alterar valores';
  end if;
  return new;
end $$;
drop trigger if exists linked_order_guard on public.pedidos;
create trigger linked_order_guard before update on public.pedidos for each row execute function private.guard_linked_order();

create function public.edit_order_details(p_order_id uuid,p_customer_id uuid,p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare ord public.pedidos; aid uuid;
begin
  perform private.require_master();
  -- Mesma ordem de locks do recebimento: acordo, depois pedido.
  select id into aid from public.acordos_recebiveis where order_id=p_order_id for update;
  select * into ord from public.pedidos where id=p_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if p_customer_id is distinct from ord.customer_id then
    if ord.status in ('canceled','returned','partially_returned') or exists(select 1 from public.pagamentos_pedidos where order_id=ord.id) then
      raise exception 'Não é possível trocar cliente após recebimento ou cancelamento';
    end if;
    if (aid is not null and p_customer_id is null) or (p_customer_id is not null and not exists(select 1 from public.clientes where id=p_customer_id and active)) then
      raise exception 'Cliente inválido';
    end if;
  end if;
  update public.pedidos set customer_id=p_customer_id,notes=nullif(trim(p_notes),''),updated_by=auth.uid() where id=ord.id;
  if aid is not null then update public.acordos_recebiveis set customer_id=p_customer_id where id=aid; end if;
end $$;

-- Pagamentos de pedidos com plano só podem vir de parcelas; não criar outro lançamento.
create function private.guard_order_payment_plan() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.acordos_recebiveis where order_id=new.order_id) and new.installment_payment_id is null then
    raise exception 'Receba este pedido pela tela Cobranças';
  end if;
  return new;
end $$;
drop trigger if exists order_payment_plan_guard on public.pagamentos_pedidos;
create trigger order_payment_plan_guard before insert on public.pagamentos_pedidos for each row execute function private.guard_order_payment_plan();

create function private.sync_installment_order_payment() returns trigger language plpgsql security definer set search_path = '' as $$
declare oid uuid; ord public.pedidos; received numeric;
begin
  select a.order_id into oid from public.acordos_recebiveis a join public.parcelas_recebiveis i on i.agreement_id=a.id where i.id=new.installment_id;
  if oid is null then return new; end if;
  select * into ord from public.pedidos where id=oid for update;
  if ord.status in ('canceled','returned','partially_returned') then raise exception 'Pedido não permite recebimento'; end if;
  select coalesce(sum(amount),0) into received from public.pagamentos_pedidos where order_id=oid and status='paid';
  if received+new.amount > ord.total_amount then raise exception 'Recebimento excede saldo do pedido'; end if;
  insert into public.pagamentos_pedidos(order_id,payment_method,amount,financial_account_id,paid_at,status,created_by,installment_payment_id)
  values(oid,new.payment_method,new.amount,new.financial_account_id,new.paid_at,'paid',auth.uid(),new.id);
  update public.pedidos set payment_status=case when received+new.amount=total_amount then 'paid'::public.payment_status else 'partially_paid'::public.payment_status end,
    paid_at=case when received+new.amount=total_amount then new.paid_at else null end,updated_by=auth.uid() where id=oid;
  return new;
end $$;
drop trigger if exists installment_order_payment on public.pagamentos_parcelas;
create trigger installment_order_payment after insert on public.pagamentos_parcelas for each row execute function private.sync_installment_order_payment();

create function public.edit_installment_due_date(p_installment_id uuid,p_due_date date,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare aid uuid; old_date date;
begin
  perform private.require_master();
  if p_due_date is null or p_reason is null or length(trim(p_reason)) not between 3 and 500 then raise exception 'Informe vencimento e motivo (3 a 500 caracteres)'; end if;
  select agreement_id into aid from public.parcelas_recebiveis where id=p_installment_id;
  perform 1 from public.acordos_recebiveis where id=aid and status='active' for update;
  if not found then raise exception 'Acordo inativo'; end if;
  select due_date into old_date from public.parcelas_recebiveis where id=p_installment_id and status not in ('paid','canceled') for update;
  if not found then raise exception 'Parcela quitada ou cancelada'; end if;
  update public.parcelas_recebiveis set due_date=p_due_date where id=p_installment_id;
  insert into public.logs_auditoria(user_id,action,entity_type,entity_id,old_data,new_data)
  values(auth.uid(),'due_date_correction','public.parcelas_recebiveis',p_installment_id,jsonb_build_object('due_date',old_date),jsonb_build_object('due_date',p_due_date,'reason',trim(p_reason)));
end $$;

create or replace view public.resumo_parcelas_recebiveis with (security_invoker = true) as
select i.id,i.agreement_id,a.customer_id,c.name as customer_name,c.phone as customer_phone,
  i.installment_number,a.installment_count,i.due_date,i.amount,
  coalesce(sum(ip.amount),0)::numeric(12,2) as paid_amount,
  case when i.status='canceled' or a.status='canceled' then 'canceled'
    when i.status='paid' or coalesce(sum(ip.amount),0)>=i.amount then 'paid'
    when i.due_date < (now() at time zone 'America/Sao_Paulo')::date then 'overdue'
    when coalesce(sum(ip.amount),0)>0 then 'partially_paid' else 'pending' end as effective_status,
  (i.due_date-(now() at time zone 'America/Sao_Paulo')::date) as days_until_due,
  a.order_id,o.order_number,i.last_contacted_at,a.status as agreement_status
from public.parcelas_recebiveis i join public.acordos_recebiveis a on a.id=i.agreement_id
join public.clientes c on c.id=a.customer_id left join public.pedidos o on o.id=a.order_id
left join public.pagamentos_parcelas ip on ip.installment_id=i.id
group by i.id,a.id,c.id,o.id;

create or replace view public.saldos_contas_financeiras with (security_invoker = true) as
select a.id,a.name,a.type,a.institution,a.initial_balance,a.active,
  a.initial_balance+coalesce(sum(case when t.direction='in' then t.amount else -t.amount end) filter(where t.status='paid'),0) as balance
from public.contas_financeiras a left join public.transacoes_financeiras t on t.financial_account_id=a.id group by a.id;
grant select on public.saldos_contas_financeiras to authenticated;

create function public.dashboard_summary() returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform private.require_master();
  select jsonb_build_object(
    'products',(select count(*) from public.produtos where active),
    'customers',(select count(*) from public.clientes where active),
    'orders',(select count(*) from public.pedidos where status<>'canceled'),
    'balance',(select coalesce(sum(balance),0) from public.saldos_contas_financeiras where active),
    'receivables',(select coalesce(sum(greatest(0,amount-paid_amount)),0) from public.resumo_parcelas_recebiveis where agreement_status='active' and effective_status in ('pending','partially_paid','overdue')),
    'recent_orders',coalesce((select jsonb_agg(r order by r.created_at desc) from (
      select o.id,o.order_number,o.total_amount,o.status,o.created_at,c.name as customer_name from public.pedidos o left join public.clientes c on c.id=o.customer_id order by o.created_at desc,o.id limit 5
    ) r),'[]'::jsonb),
    'upcoming',coalesce((select jsonb_agg(r order by r.due_date,r.id) from (
      select id,customer_name,due_date,amount-paid_amount as remaining,effective_status from public.resumo_parcelas_recebiveis where agreement_status='active' and effective_status in ('pending','partially_paid','overdue') and due_date<=today+7 order by due_date,id limit 5
    ) r),'[]'::jsonb),
    'flow',coalesce((select jsonb_agg(r order by r.day) from (
      select d::date as day,coalesce(sum(t.amount) filter(where t.direction='in'),0) as income,
        coalesce(sum(t.amount) filter(where t.direction='out'),0) as expense
      from generate_series(today-6,today,interval '1 day') d
      left join public.transacoes_financeiras t on t.transaction_date=d::date and t.status='paid'
      group by d
    ) r),'[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function private.guard_linked_order(),private.guard_order_payment_plan(),private.sync_installment_order_payment() from public,anon,authenticated;
revoke all on function public.create_manual_order(uuid,jsonb,numeric,numeric,text,jsonb,uuid),public.edit_order_details(uuid,uuid,text),public.edit_installment_due_date(uuid,date,text),public.dashboard_summary() from public,anon;
grant execute on function public.create_manual_order(uuid,jsonb,numeric,numeric,text,jsonb,uuid),public.edit_order_details(uuid,uuid,text),public.edit_installment_due_date(uuid,date,text),public.dashboard_summary() to authenticated;
notify pgrst,'reload schema';
commit;

