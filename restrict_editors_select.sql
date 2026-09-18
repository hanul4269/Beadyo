-- =====================================================
-- editors 목록 조회 제한
-- Supabase Dashboard → SQL Editor에서 실행하세요
-- 선행 조건: public.is_beadyo_editor() 함수가 존재해야 합니다.
-- =====================================================

alter table public.editors enable row level security;

-- 기존 공개 SELECT 정책 유무와 관계없이 오너/편집자의 조회 경로를 보장합니다.
drop policy if exists "오너 및 편집자 조회" on public.editors;

create policy "오너 및 편집자 조회" on public.editors
  for select to authenticated
  using ((select public.is_beadyo_editor()));

-- 기존 공개 SELECT 정책이 남아 있어도 이 제한 정책과 AND로 평가됩니다.
-- anon과 로그인한 비편집자는 행을 볼 수 없습니다.
drop policy if exists "비편집자 목록 조회 차단" on public.editors;

create policy "비편집자 목록 조회 차단" on public.editors
  as restrictive
  for select to anon, authenticated
  using ((select public.is_beadyo_editor()));

-- anon 조회를 권한 오류 대신 빈 배열로 응답시키기 위한 SELECT 권한입니다.
-- 실제 행 노출 여부는 위 RLS 정책이 제한합니다.
grant select on table public.editors to anon, authenticated;
