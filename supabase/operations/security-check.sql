-- Read-only checks for the SQL Editor. Does not return customer data or emails.
select
  (select count(*) from private.master_access) as reserved_master_slots,
  (select count(*) from private.master_access where enabled and user_id is not null) as bound_masters,
  (select count(*) from pg_policies where schemaname='public' and policyname='master_gate') as master_gates,
  (select count(*) from pg_trigger where tgname='audit_change' and not tgisinternal) as audit_triggers,
  has_table_privilege('authenticated','public.pagamentos_pedidos','INSERT') as unsafe_direct_payment,
  has_table_privilege('authenticated','public.logs_auditoria','INSERT') as unsafe_forged_audit,
  has_table_privilege('authenticated','public.perfis','UPDATE') as unsafe_role_edit,
  has_function_privilege('anon','public.mark_order_sold(uuid)','EXECUTE') as unsafe_anon_rpc;

