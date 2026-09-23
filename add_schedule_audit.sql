-- =====================================================
-- 일정 수정 시각 및 변경 이력
-- Supabase Dashboard -> SQL Editor에서 실행하세요.
-- 선행 조건: public.schedules, public.is_beadyo_editor()가 존재해야 합니다.
-- =====================================================

-- 기존 행은 실행 시각으로 채워지고, 이후에는 UPDATE마다 자동 갱신됩니다.
alter table public.schedules
  add column if not exists updated_at timestamptz not null default now();

alter table public.schedules
  alter column updated_at set default now();

update public.schedules
set updated_at = now()
where updated_at is null;

alter table public.schedules
  alter column updated_at set not null;

create or replace function public.set_schedules_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_schedules_updated_at() from public, anon, authenticated;

drop trigger if exists schedules_set_updated_at on public.schedules;
create trigger schedules_set_updated_at
  before update on public.schedules
  for each row
  execute function public.set_schedules_updated_at();

create table if not exists public.schedule_audit (
  id bigint generated always as identity primary key,
  -- text로 보관하면 schedules.id가 uuid/bigint 중 어느 쪽이어도 삭제 이력이 유지됩니다.
  schedule_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by_email text,
  changed_at timestamptz not null default now(),
  old_values jsonb,
  new_values jsonb
);

comment on table public.schedule_audit is
  'schedules의 insert/update/delete 변경 이력. 클라이언트 직접 쓰기는 금지합니다.';

create index if not exists schedule_audit_changed_at_idx
  on public.schedule_audit (changed_at desc);

create or replace function public.write_schedule_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_email text := lower(nullif(auth.jwt() ->> 'email', ''));
begin
  if tg_op = 'INSERT' then
    insert into public.schedule_audit (
      schedule_id, action, changed_by_email, old_values, new_values
    ) values (
      new.id::text, 'insert', actor_email, null, to_jsonb(new)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.schedule_audit (
      schedule_id, action, changed_by_email, old_values, new_values
    ) values (
      new.id::text, 'update', actor_email, to_jsonb(old), to_jsonb(new)
    );
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.schedule_audit (
      schedule_id, action, changed_by_email, old_values, new_values
    ) values (
      old.id::text, 'delete', actor_email, to_jsonb(old), null
    );
    return old;
  end if;

  raise exception '지원하지 않는 schedules 감사 동작: %', tg_op;
end;
$$;

-- 이 함수는 트리거만 실행합니다. REST RPC로 직접 호출할 수 없게 막습니다.
revoke all on function public.write_schedule_audit() from public, anon, authenticated;

drop trigger if exists schedules_write_audit on public.schedules;
create trigger schedules_write_audit
  after insert or update or delete on public.schedules
  for each row
  execute function public.write_schedule_audit();

alter table public.schedule_audit enable row level security;

-- 기본 권한을 먼저 모두 제거한 뒤 오너 조회에 필요한 SELECT만 돌려줍니다.
revoke all on table public.schedule_audit from public, anon, authenticated;
grant select on table public.schedule_audit to authenticated;

drop policy if exists "schedule_audit editor read" on public.schedule_audit;
drop policy if exists "schedule_audit owner read" on public.schedule_audit;
create policy "schedule_audit owner read"
  on public.schedule_audit
  for select
  to authenticated
  using (lower(coalesce((select auth.jwt()) ->> 'email', '')) = 'riosniper12@gmail.com');

-- 확인용 쿼리(설치 후 필요할 때 별도로 실행):
-- select id, schedule_id, action, changed_by_email, changed_at
-- from public.schedule_audit
-- order by changed_at desc
-- limit 20;

-- 권한 확인(둘 다 false, authenticated SELECT는 true여야 합니다):
-- select has_table_privilege('anon', 'public.schedule_audit', 'select');
-- select has_table_privilege('anon', 'public.schedule_audit', 'insert,update,delete');
-- select has_table_privilege('authenticated', 'public.schedule_audit', 'select');

-- 트리거 실행 시간 확인(전체가 ROLLBACK되어 일정/감사 로그는 남지 않습니다):
-- begin;
-- explain (analyze, buffers)
-- update public.schedules
-- set updated_at = updated_at
-- where id = (select id from public.schedules limit 1);
-- rollback;
-- EXPLAIN 결과 하단의 Trigger schedules_set_updated_at / schedules_write_audit 시간을 확인하세요.
