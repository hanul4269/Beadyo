-- =====================================================
-- 춤영상 검토페이지 · 개발요청란 편집자 전용 제한
-- Supabase Dashboard → SQL Editor에서 한 번 실행하세요.
-- 선행 조건: public.is_beadyo_editor() 함수와
--           add_development_requests.sql, add_development_request_comments.sql,
--           add_dance_video_statuses.sql이 이미 실행되어 있어야 합니다.
--
-- 되돌리기(원래대로):
--   drop policy if exists "편집자 전용" on public.development_requests;
--   drop policy if exists "편집자 전용" on public.development_request_comments;
--   drop policy if exists "dance_video_statuses approved or editor read" on public.dance_video_statuses;
--   create policy "dance_video_statuses public read" on public.dance_video_statuses
--     for select using (true);
-- =====================================================

-- 1) 개발요청 글/댓글: 편집자만 조회·작성·수정·삭제
--    RESTRICTIVE 정책은 기존 허용 정책(본인 글 수정 등)과 AND로 묶입니다.
--    → 편집자가 아니면 본인 글이어도 아무것도 할 수 없습니다.
drop policy if exists "편집자 전용" on public.development_requests;
create policy "편집자 전용" on public.development_requests
  as restrictive
  for all to authenticated
  using ((select public.is_beadyo_editor()))
  with check ((select public.is_beadyo_editor()));

drop policy if exists "편집자 전용" on public.development_request_comments;
create policy "편집자 전용" on public.development_request_comments
  as restrictive
  for all to authenticated
  using ((select public.is_beadyo_editor()))
  with check ((select public.is_beadyo_editor()));

-- 비로그인(anon) 차단은 기존 파일의 revoke로 이미 적용되어 있지만, 한 번 더 보장합니다.
revoke all on table public.development_requests from anon;
revoke all on table public.development_request_comments from anon;

-- 2) 춤영상 상태: 공개 페이지(dance.html)는 '채택(approved)'만 쓰므로
--    비편집자에게는 채택된 행만 보이고, 편집자는 전체(검토 필요·숨김 포함)를 봅니다.
drop policy if exists "dance_video_statuses public read" on public.dance_video_statuses;
drop policy if exists "dance_video_statuses approved or editor read" on public.dance_video_statuses;
create policy "dance_video_statuses approved or editor read" on public.dance_video_statuses
  for select
  using (status = 'approved' or (select public.is_beadyo_editor()));

-- 쓰기(insert/update/delete)는 기존 편집자 정책을 그대로 사용합니다.

-- 3) 확인용 조회 (실행 결과로 정책 목록이 보입니다)
select tablename, policyname, permissive, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('development_requests', 'development_request_comments', 'dance_video_statuses')
order by tablename, cmd, policyname;
