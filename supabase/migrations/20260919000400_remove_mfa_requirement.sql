-- VH Imports — acesso operacional sem MFA.
-- Mantém a lista privada de masters, perfil ativo, e-mail confirmado,
-- sessão válida e expiração de oito horas. Remove somente a exigência de AAL2.
begin;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  join private.master_access m on m.user_id = p.id and m.enabled
  join auth.users u on u.id = p.id and u.email_confirmed_at is not null
  join auth.sessions s on s.user_id = p.id and s.id::text = auth.jwt()->>'session_id'
  where p.id = auth.uid()
    and p.active
    and p.role = 'admin'
    and lower(u.email) = m.email
    and s.created_at > now() - interval '8 hours'
    and (s.not_after is null or s.not_after > now())
    and (u.banned_until is null or u.banned_until < now());
$$;

create or replace function private.require_master()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() is distinct from 'admin'::public.app_role then
    raise exception 'Acesso exige master ativo, e-mail confirmado e sessão válida' using errcode = '42501';
  end if;
end;
$$;

commit;

