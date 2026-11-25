-- =====================================================
-- runtime-collector 예약 실행 (pg_cron + pg_net → Edge Function)
-- GitHub Actions 예약(live-status / up-ranking / cafe-posts)이 몇 시간씩
-- 밀려서, 같은 수집을 Supabase 안에서 정시에 호출합니다.
--
-- 적용 전 준비(사용자가 직접, 값은 이 파일·채팅에 남기지 않음):
--   1) openssl rand -hex 32 로 만든 값을 Edge Function 비밀값 COLLECTOR_SECRET 에 저장
--   2) Edge Function 비밀값 COLLECTOR_MODE = shadow
--   3) SQL Editor에서 같은 값을 Vault에 저장:
--      select vault.create_secret('<같은 값>', 'beadyo_collector_secret',
--                                 'runtime-collector Edge Function 호출 인증');
--   4) runtime-collector 함수를 verify_jwt = false 로 배포
--
-- 서비스 키는 이 파일·Vault 어디에도 두지 않습니다(Edge 런타임 자동 주입만 사용).
-- 되돌리기: 파일 맨 아래 주석 참고.
-- =====================================================

-- 1. 확장
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- 2. 프로젝트 URL (비밀 아님)
select vault.create_secret(
  'https://qlmcwobfldgmhwhptkfz.supabase.co',
  'beadyo_project_url',
  'runtime-collector 호출 주소'
)
where not exists (select 1 from vault.secrets where name = 'beadyo_project_url');

-- 3. 호출 함수 (API에 노출되지 않는 private 스키마)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.invoke_collector(job text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  secret   text;
begin
  if job is null or job not in ('live', 'up', 'cafe') then
    raise exception 'unknown collector job: %', job;
  end if;

  select decrypted_secret into base_url
    from vault.decrypted_secrets where name = 'beadyo_project_url';
  select decrypted_secret into secret
    from vault.decrypted_secrets where name = 'beadyo_collector_secret';

  if base_url is null or secret is null then
    raise exception 'runtime-collector vault secrets are missing';
  end if;

  return net.http_post(
    url := base_url || '/functions/v1/runtime-collector',
    body := jsonb_build_object('job', job),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-collector-secret', secret
    ),
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function private.invoke_collector(text) from public, anon, authenticated;

comment on function private.invoke_collector(text) is
  'pg_cron이 runtime-collector Edge Function을 호출. 서비스 키는 다루지 않음.';

-- 4. 예약 (pg_cron은 UTC 기준. 분이 겹치지 않게 엇갈림)
select cron.schedule('beadyo-live-status', '*/5 * * * *',
  $$select private.invoke_collector('live')$$);

select cron.schedule('beadyo-up-ranking', '2-59/10 * * * *',
  $$select private.invoke_collector('up')$$);

select cron.schedule('beadyo-cafe-posts', '17,47 * * * *',
  $$select private.invoke_collector('cafe')$$);

-- 5. 실행 기록 정리 (매일 04:30 KST = 19:30 UTC, 7일 지난 기록만)
select cron.schedule('beadyo-cron-history-cleanup', '30 19 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);

-- =====================================================
-- 되돌리기 (필요할 때 SQL Editor에서 실행)
--
-- 즉시 정지:
--   select cron.alter_job(jobid, active := false)
--   from cron.job where jobname like 'beadyo-%';
--
-- 완전 제거:
--   select cron.unschedule(jobname) from cron.job where jobname like 'beadyo-%';
--   drop function if exists private.invoke_collector(text);
--   delete from vault.secrets where name in ('beadyo_project_url', 'beadyo_collector_secret');
--   -- 그림자 키 3행만 (별도 승인 후):
--   -- delete from public.site_runtime_cache
--   -- where cache_key in ('live_status__edge', 'up_ranking__edge', 'cafe_posts__edge');
-- =====================================================
