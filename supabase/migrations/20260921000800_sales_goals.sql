begin;

create table if not exists public.metas_vendas (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  target_amount numeric(12,2) not null check (target_amount > 0 and target_amount = round(target_amount,2)),
  active boolean not null default true,
  created_by uuid references public.perfis(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint metas_vendas_periodo_valido check (end_date >= start_date)
);

create unique index if not exists metas_vendas_active_idx on public.metas_vendas(active) where active;
create index if not exists metas_vendas_period_idx on public.metas_vendas(start_date, end_date) where active;

alter table public.metas_vendas enable row level security;
create policy metas_vendas_master_gate on public.metas_vendas as restrictive for all to authenticated
  using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy metas_vendas_staff_read on public.metas_vendas for select to authenticated
  using (public.is_active_staff());
grant select on public.metas_vendas to authenticated;
revoke insert, update, delete on public.metas_vendas from authenticated;

create trigger audit_sales_goal after insert or update or delete on public.metas_vendas
  for each row execute function private.audit_change();

create function public.save_sales_goal(
  p_start_date date,
  p_end_date date,
  p_target_amount numeric,
  p_request_id uuid
) returns public.metas_vendas
language plpgsql security definer set search_path = '' as $$
declare rid uuid; result public.metas_vendas;
begin
  perform private.require_master();
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Informe um período válido para a meta';
  end if;
  if p_target_amount is null or p_target_amount::text in ('NaN','Infinity','-Infinity')
    or p_target_amount <= 0 or p_target_amount > 9999999999.99
    or round(p_target_amount,2) <> p_target_amount then
    raise exception 'Informe um valor de meta positivo com até duas casas decimais';
  end if;
  rid := private.claim_request(p_request_id, 'save_sales_goal',
    jsonb_build_array(p_start_date, p_end_date, p_target_amount));
  if rid is not null then
    select * into result from public.metas_vendas where id = rid;
    return result;
  end if;
  update public.metas_vendas set active = false, updated_at = now() where active;
  insert into public.metas_vendas(start_date,end_date,target_amount,active,created_by)
  values(p_start_date,p_end_date,p_target_amount,true,auth.uid()) returning * into result;
  update private.requests set result_id = result.id where request_id = p_request_id;
  return result;
end $$;

create function public.sales_goal_summary() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare goal public.metas_vendas; paid_amount numeric := 0; paid_orders bigint := 0;
begin
  perform private.require_master();
  select * into goal from public.metas_vendas where active order by created_at desc limit 1;
  if goal.id is null then
    return jsonb_build_object('goal', null, 'paid_amount', 0, 'paid_orders', 0, 'remaining_amount', 0, 'progress_percent', 0);
  end if;
  select count(*), coalesce(sum(o.total_amount),0)
    into paid_orders, paid_amount
    from public.pedidos o
   where o.payment_status = 'paid'
     and o.paid_at is not null
     and (o.paid_at at time zone 'America/Sao_Paulo')::date between goal.start_date and goal.end_date;
  return jsonb_build_object(
    'goal', jsonb_build_object('id',goal.id,'start_date',goal.start_date,'end_date',goal.end_date,'target_amount',goal.target_amount,'created_at',goal.created_at),
    'paid_amount', paid_amount,
    'paid_orders', paid_orders,
    'remaining_amount', greatest(goal.target_amount - paid_amount, 0),
    'progress_percent', least(100, round((paid_amount / goal.target_amount) * 100, 2))
  );
end $$;

revoke all on function public.save_sales_goal(date,date,numeric,uuid), public.sales_goal_summary() from public, anon;
grant execute on function public.save_sales_goal(date,date,numeric,uuid), public.sales_goal_summary() to authenticated;
notify pgrst, 'reload schema';
commit;

