-- =====================================================
-- 노래책/라이브 기록 쓰기 정책 추가
-- Supabase Dashboard → SQL Editor에서 실행하세요
-- =====================================================

-- songbook 쓰기 정책
create policy "인증된 사용자 삽입" on songbook
  for insert to authenticated with check (true);

create policy "인증된 사용자 수정" on songbook
  for update to authenticated using (true) with check (true);

create policy "인증된 사용자 삭제" on songbook
  for delete to authenticated using (true);

-- live_songs 쓰기 정책
create policy "인증된 사용자 삽입" on live_songs
  for insert to authenticated with check (true);

create policy "인증된 사용자 수정" on live_songs
  for update to authenticated using (true) with check (true);

create policy "인증된 사용자 삭제" on live_songs
  for delete to authenticated using (true);
