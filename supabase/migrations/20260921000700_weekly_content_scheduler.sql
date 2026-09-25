-- Revisão 24: planejador semanal de fotos para conteúdo.
begin;

create index if not exists imagens_produtos_storage_path_idx on public.imagens_produtos(storage_path);
create index if not exists publicacoes_conteudo_image_schedule_idx on public.publicacoes_conteudo(image_path, scheduled_for);

create or replace function public.generate_weekly_content_schedule(
  p_week_start date,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim uuid;
  v_day date;
  v_needed integer;
  v_slot integer;
  v_created integer := 0;
  v_first_id uuid;
  v_photo record;
  v_times time[] := array['09:00'::time, '11:30'::time, '14:00'::time, '17:00'::time, '20:00'::time];
begin
  perform private.require_master();
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'A semana deve começar em uma segunda-feira';
  end if;

  perform pg_advisory_xact_lock(hashtext('weekly_content:' || p_week_start::text));

  v_claim := private.claim_request(p_request_id, 'weekly_content_schedule', jsonb_build_array(p_week_start));
  if v_claim is not null then
    return jsonb_build_object(
      'week_start', p_week_start,
      'created', (select count(*) from public.publicacoes_conteudo where (scheduled_for at time zone 'America/Sao_Paulo')::date >= p_week_start and (scheduled_for at time zone 'America/Sao_Paulo')::date < (p_week_start + 7) and status = 'scheduled'),
      'requested', 35,
      'missing', greatest(0, 35 - (select count(*) from public.publicacoes_conteudo where (scheduled_for at time zone 'America/Sao_Paulo')::date >= p_week_start and (scheduled_for at time zone 'America/Sao_Paulo')::date < (p_week_start + 7) and status = 'scheduled')),
      'replayed', true
    );
  end if;

  for v_day in select (p_week_start + n)::date from generate_series(0, 6) as g(n) loop
    select greatest(0, 5 - count(image_path)::integer), least(5, count(image_path)::integer)
      into v_needed, v_slot
    from public.publicacoes_conteudo
    where (scheduled_for at time zone 'America/Sao_Paulo')::date = v_day
      and status in ('approved', 'scheduled', 'published');

    for v_photo in
      select candidates.storage_path, candidates.product_id, candidates.name
      from (
        select distinct on (i.storage_path) i.storage_path, i.product_id, p.name
        from public.imagens_produtos i
        join public.produtos p on p.id = i.product_id and p.active
        where i.storage_path is not null
          and not exists (
            select 1 from public.publicacoes_conteudo used
            where used.image_path = i.storage_path
            and (used.scheduled_for at time zone 'America/Sao_Paulo')::date >= p_week_start
            and (used.scheduled_for at time zone 'America/Sao_Paulo')::date < (p_week_start + 7)
              and used.status <> 'failed'
          )
        order by i.storage_path, i.is_cover desc, i.sort_order nulls last, i.id
      ) candidates
      order by random()
      limit v_needed
    loop
      insert into public.publicacoes_conteudo(
        product_id, image_path, caption, hashtags, scheduled_for, status, created_by
      ) values (
        v_photo.product_id,
        v_photo.storage_path,
        'Conheça ' || v_photo.name || ' — um detalhe para acompanhar você todos os dias.',
        '#vhimports #tenis #sneakers',
        ((v_day + v_times[v_slot + 1]) at time zone 'America/Sao_Paulo'),
        'scheduled',
        auth.uid()
      ) returning id into v_first_id;
      v_created := v_created + 1;
      v_slot := v_slot + 1;
    end loop;
  end loop;

  update private.requests
  set result_id = coalesce(v_first_id, gen_random_uuid())
  where request_id = p_request_id;

  return jsonb_build_object(
    'week_start', p_week_start,
    'created', v_created,
    'requested', 35,
    'missing', greatest(0, 35 - v_created),
    'replayed', false
  );
end;
$$;

revoke all on function public.generate_weekly_content_schedule(date,uuid) from public, anon;
grant execute on function public.generate_weekly_content_schedule(date,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
