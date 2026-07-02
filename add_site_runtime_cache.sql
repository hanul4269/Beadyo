-- =====================================================
-- 사이트 런타임 캐시 테이블
-- live_status, up_ranking처럼 자주 바뀌는 작은 JSON을 Git 커밋 없이 저장합니다.
-- Supabase Dashboard -> SQL Editor에서 실행하세요.
-- =====================================================

create table if not exists public.site_runtime_cache (
  cache_key  text primary key,
  payload    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_runtime_cache enable row level security;

drop policy if exists "site_runtime_cache public read" on public.site_runtime_cache;

create policy "site_runtime_cache public read" on public.site_runtime_cache
  for select using (true);

grant select on public.site_runtime_cache to anon, authenticated;

comment on table public.site_runtime_cache is
  'Small public runtime cache updated by GitHub Actions through the service role key.';
