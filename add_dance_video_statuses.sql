-- =====================================================
-- 춤영상 검토 상태 공용 저장 테이블
-- Supabase Dashboard -> SQL Editor에서 실행하세요
-- =====================================================

create table if not exists public.dance_video_statuses (
  video_id   text primary key,
  status     text not null default 'review' check (status in ('review', 'approved', 'hidden')),
  title      text,
  source     text,
  song       text,
  url        text,
  thumbnail  text,
  updated_at timestamptz not null default now()
);

create or replace function public.is_beadyo_editor()
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'riosniper12@gmail.com'
    or exists (
      select 1
      from public.editors e
      where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

alter table public.dance_video_statuses enable row level security;

drop policy if exists "dance_video_statuses public read" on public.dance_video_statuses;
drop policy if exists "dance_video_statuses editor insert" on public.dance_video_statuses;
drop policy if exists "dance_video_statuses editor update" on public.dance_video_statuses;
drop policy if exists "dance_video_statuses editor delete" on public.dance_video_statuses;

create policy "dance_video_statuses public read" on public.dance_video_statuses
  for select using (true);

create policy "dance_video_statuses editor insert" on public.dance_video_statuses
  for insert to authenticated with check (public.is_beadyo_editor());

create policy "dance_video_statuses editor update" on public.dance_video_statuses
  for update to authenticated using (public.is_beadyo_editor()) with check (public.is_beadyo_editor());

create policy "dance_video_statuses editor delete" on public.dance_video_statuses
  for delete to authenticated using (public.is_beadyo_editor());
