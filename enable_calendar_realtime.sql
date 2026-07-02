-- =====================================================
-- 캘린더 일정 Realtime 활성화
-- 다른 브라우저/PC에서 새로고침 없이 schedules 변경을 받기 위해 실행하세요.
-- Supabase Dashboard -> SQL Editor에서 1회 실행하면 됩니다.
-- Deployment marker: 2026-07-03
-- =====================================================

alter table public.schedules replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.schedules;
exception
  when duplicate_object then
    null;
  when undefined_object then
    raise notice 'supabase_realtime publication does not exist in this project.';
end $$;
