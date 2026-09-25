-- VH Imports — operações do MVP que precisam permanecer no backend.
begin;

alter table public.receivable_installments
  add column if not exists last_contacted_at timestamptz,
  add column if not exists last_contacted_by uuid references public.profiles(id);

create or replace function public.mark_installment_contacted(p_installment_id uuid)
returns public.receivable_installments
language plpgsql
security definer
set search_path = ''
as $$
declare r public.receivable_installments;
begin
  perform private.require_master();
  update public.receivable_installments
  set last_contacted_at = now(), last_contacted_by = auth.uid(), updated_at = now()
  where id = p_installment_id and status <> 'canceled';
  if not found then raise exception 'Parcela não encontrada ou cancelada'; end if;
  select * into r from public.receivable_installments where id = p_installment_id;
  return r;
end;
$$;

create or replace function public.record_income(
  p_amount numeric,
  p_account uuid,
  p_category uuid,
  p_description text,
  p_request_id uuid,
  p_transaction_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare rid uuid;
begin
  perform private.require_master();
  perform private.validate_payment(p_amount, p_account, now());
  if p_description is null or length(trim(p_description)) < 3
     or not exists (select 1 from public.financial_categories where id = p_category and active and type = 'income') then
    raise exception 'Descrição ou categoria inválida';
  end if;
  rid := private.claim_request(p_request_id, 'income', jsonb_build_array(p_amount, p_account, p_category, p_description, p_transaction_date));
  if rid is not null then return rid; end if;
  insert into public.financial_transactions(
    financial_account_id, category_id, type, direction, status, amount,
    transaction_date, paid_at, description, created_by
  ) values (
    p_account, p_category, 'income', 'in', 'paid', p_amount,
    coalesce(p_transaction_date, current_date), now(), trim(p_description), auth.uid()
  ) returning id into rid;
  update private.requests set result_id = rid where request_id = p_request_id;
  return rid;
end;
$$;

grant update(last_contacted_at, last_contacted_by) on public.receivable_installments to authenticated;
grant execute on function public.mark_installment_contacted(uuid) to authenticated;
grant execute on function public.record_income(numeric, uuid, uuid, text, uuid, date) to authenticated;

-- Bucket privado para imagens de produtos. As políticas continuam subordinadas
-- ao gate de master usado pelas tabelas públicas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "VH Imports staff can read product images" on storage.objects;
create policy "VH Imports staff can read product images"
on storage.objects for select to authenticated
using (bucket_id = 'product-images' and public.is_active_staff());

drop policy if exists "VH Imports staff can upload product images" on storage.objects;
create policy "VH Imports staff can upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.is_active_staff());

drop policy if exists "VH Imports staff can update product images" on storage.objects;
create policy "VH Imports staff can update product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.is_active_staff())
with check (bucket_id = 'product-images' and public.is_active_staff());

commit;

