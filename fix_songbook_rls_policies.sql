-- =====================================================
-- songbook / live_songs RLS write policy repair
-- Supabase Dashboard -> SQL Editor에서 실행하세요.
-- 편집자(owner 또는 editors 테이블 등록 이메일)만 쓰기 허용
-- =====================================================

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

alter table public.songbook enable row level security;
alter table public.live_songs enable row level security;

drop policy if exists "인증된 사용자 삽입" on public.songbook;
drop policy if exists "인증된 사용자 수정" on public.songbook;
drop policy if exists "인증된 사용자 삭제" on public.songbook;
drop policy if exists "편집자 삽입" on public.songbook;
drop policy if exists "편집자 수정" on public.songbook;
drop policy if exists "편집자 삭제" on public.songbook;

create policy "편집자 삽입" on public.songbook
  for insert to authenticated
  with check (public.is_beadyo_editor());

create policy "편집자 수정" on public.songbook
  for update to authenticated
  using (public.is_beadyo_editor())
  with check (public.is_beadyo_editor());

create policy "편집자 삭제" on public.songbook
  for delete to authenticated
  using (public.is_beadyo_editor());

drop policy if exists "인증된 사용자 삽입" on public.live_songs;
drop policy if exists "인증된 사용자 수정" on public.live_songs;
drop policy if exists "인증된 사용자 삭제" on public.live_songs;
drop policy if exists "편집자 삽입" on public.live_songs;
drop policy if exists "편집자 수정" on public.live_songs;
drop policy if exists "편집자 삭제" on public.live_songs;

create policy "편집자 삽입" on public.live_songs
  for insert to authenticated
  with check (public.is_beadyo_editor());

create policy "편집자 수정" on public.live_songs
  for update to authenticated
  using (public.is_beadyo_editor())
  with check (public.is_beadyo_editor());

create policy "편집자 삭제" on public.live_songs
  for delete to authenticated
  using (public.is_beadyo_editor());
