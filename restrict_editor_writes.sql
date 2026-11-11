-- =====================================================
-- 로그인만 하면 누구나 쓸 수 있던 테이블 6개를 편집자 전용 쓰기로 변경
-- (2026-11-12 Supabase 실제 정책 점검 결과 반영)
-- ✅ 2026-11-12 Supabase 마이그레이션 "restrict_editor_writes"로 적용 완료
--    (실제 적용본은 begin/commit 없이 실행됨 — 마이그레이션이 자체 트랜잭션 사용)
--
-- 대상: broadcast_infos, calendar_notices, memo_cards, up_events,
--       youtube_links, youtube_songs
-- 공개 읽기 정책은 그대로 둡니다. (사이트 방문자는 계속 볼 수 있음)
--
-- 되돌리기용 원래 정책은 파일 맨 아래 주석에 있습니다.
-- =====================================================

begin;

-- 1) broadcast_infos
drop policy if exists "write_broadcast_infos" on public.broadcast_infos;
drop policy if exists "editor_write_broadcast_infos" on public.broadcast_infos;
create policy "editor_write_broadcast_infos" on public.broadcast_infos
  for all to authenticated
  using ((select public.is_beadyo_editor()))
  with check ((select public.is_beadyo_editor()));

-- 2) calendar_notices
drop policy if exists "calendar_notices authenticated insert" on public.calendar_notices;
drop policy if exists "calendar_notices authenticated update" on public.calendar_notices;
drop policy if exists "calendar_notices authenticated delete" on public.calendar_notices;
drop policy if exists "calendar_notices editor insert" on public.calendar_notices;
drop policy if exists "calendar_notices editor update" on public.calendar_notices;
drop policy if exists "calendar_notices editor delete" on public.calendar_notices;
create policy "calendar_notices editor insert" on public.calendar_notices
  for insert to authenticated with check ((select public.is_beadyo_editor()));
create policy "calendar_notices editor update" on public.calendar_notices
  for update to authenticated
  using ((select public.is_beadyo_editor())) with check ((select public.is_beadyo_editor()));
create policy "calendar_notices editor delete" on public.calendar_notices
  for delete to authenticated using ((select public.is_beadyo_editor()));

-- 3) memo_cards
drop policy if exists "write_memo_cards" on public.memo_cards;
drop policy if exists "editor_write_memo_cards" on public.memo_cards;
create policy "editor_write_memo_cards" on public.memo_cards
  for all to authenticated
  using ((select public.is_beadyo_editor()))
  with check ((select public.is_beadyo_editor()));

-- 4) up_events
drop policy if exists "인증 사용자만 쓰기" on public.up_events;
drop policy if exists "편집자만 쓰기" on public.up_events;
create policy "편집자만 쓰기" on public.up_events
  for all to authenticated
  using ((select public.is_beadyo_editor()))
  with check ((select public.is_beadyo_editor()));

-- 5) youtube_links
drop policy if exists "write_youtube_links" on public.youtube_links;
drop policy if exists "editor_write_youtube_links" on public.youtube_links;
create policy "editor_write_youtube_links" on public.youtube_links
  for all to authenticated
  using ((select public.is_beadyo_editor()))
  with check ((select public.is_beadyo_editor()));

-- 6) youtube_songs
drop policy if exists "Auth write" on public.youtube_songs;
drop policy if exists "Auth update" on public.youtube_songs;
drop policy if exists "Auth delete" on public.youtube_songs;
drop policy if exists "Editor write" on public.youtube_songs;
drop policy if exists "Editor update" on public.youtube_songs;
drop policy if exists "Editor delete" on public.youtube_songs;
create policy "Editor write" on public.youtube_songs
  for insert to authenticated with check ((select public.is_beadyo_editor()));
create policy "Editor update" on public.youtube_songs
  for update to authenticated
  using ((select public.is_beadyo_editor())) with check ((select public.is_beadyo_editor()));
create policy "Editor delete" on public.youtube_songs
  for delete to authenticated using ((select public.is_beadyo_editor()));

-- 7) 트리거 전용 함수는 API(rpc)로 직접 호출할 이유가 없으므로 실행 권한 회수
--    (트리거 동작에는 영향 없음)
revoke execute on function public.guard_development_request_update() from public, anon, authenticated;
revoke execute on function public.guard_development_request_comment_update() from public, anon, authenticated;

commit;

-- =====================================================
-- 되돌리기(원래 정책) 참고:
--   broadcast_infos  "write_broadcast_infos"            ALL to authenticated using (true) with check (true)
--   calendar_notices "calendar_notices authenticated insert/update/delete"  to authenticated, true
--   memo_cards       "write_memo_cards"                 ALL to authenticated using (auth.role() = 'authenticated')
--   up_events        "인증 사용자만 쓰기"                ALL to public using (auth.role() = 'authenticated')
--   youtube_links    "write_youtube_links"              ALL to authenticated using (true) with check (true)
--   youtube_songs    "Auth write/update/delete"         to authenticated, true
-- =====================================================
