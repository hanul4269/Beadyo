-- =====================================================
-- 노래책/라이브 기록 쓰기 정책 추가
-- Supabase Dashboard → SQL Editor에서 실행하세요
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

drop policy if exists "인증된 사용자 삽입" on songbook;
drop policy if exists "인증된 사용자 수정" on songbook;
drop policy if exists "인증된 사용자 삭제" on songbook;
drop policy if exists "편집자 삽입" on songbook;
drop policy if exists "편집자 수정" on songbook;
drop policy if exists "편집자 삭제" on songbook;

-- songbook 쓰기 정책
create policy "편집자 삽입" on songbook
  for insert to authenticated with check (public.is_beadyo_editor());

create policy "편집자 수정" on songbook
  for update to authenticated using (public.is_beadyo_editor()) with check (public.is_beadyo_editor());

create policy "편집자 삭제" on songbook
  for delete to authenticated using (public.is_beadyo_editor());

drop policy if exists "인증된 사용자 삽입" on live_songs;
drop policy if exists "인증된 사용자 수정" on live_songs;
drop policy if exists "인증된 사용자 삭제" on live_songs;
drop policy if exists "편집자 삽입" on live_songs;
drop policy if exists "편집자 수정" on live_songs;
drop policy if exists "편집자 삭제" on live_songs;

-- live_songs 쓰기 정책
create policy "편집자 삽입" on live_songs
  for insert to authenticated with check (public.is_beadyo_editor());

create policy "편집자 수정" on live_songs
  for update to authenticated using (public.is_beadyo_editor()) with check (public.is_beadyo_editor());

create policy "편집자 삭제" on live_songs
  for delete to authenticated using (public.is_beadyo_editor());
