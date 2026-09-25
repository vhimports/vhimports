-- Run ONLY in the SQL Editor as postgres, after replacing the two placeholders.
-- Do not commit real emails. Never run this via the browser Data API.
begin;
do $$
declare emails text[] := array['REPLACE_MASTER_1','REPLACE_MASTER_2']; e text; i integer; uid uuid;
begin
  if emails[1] like 'REPLACE_%' or emails[2] like 'REPLACE_%'
    or lower(emails[1])=lower(emails[2]) then raise exception 'Informe dois e-mails distintos'; end if;
  for i in 1..2 loop
    e := lower(trim(emails[i]));
    if exists(select 1 from private.master_access where slot=i and email<>e) then
      raise exception 'Slot já reservado; substituição exige procedimento de revogação';
    end if;
    select id into uid from auth.users where lower(email)=e;
    insert into private.master_access(slot,email,user_id) values(i,e,uid)
    on conflict(slot) do update set user_id=coalesce(private.master_access.user_id,excluded.user_id);
    if uid is not null then
      insert into public.perfis(id,full_name,email,role,active) values(uid,'Master',e,'admin',true)
      on conflict(id) do update set role='admin',active=true;
    end if;
  end loop;
end $$;
commit;
-- Then use Authentication > Users > Invite user for emails not yet registered.
-- Both owners must verify their emails before using the application.

